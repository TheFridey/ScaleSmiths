import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { and, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  adminUsers,
  ventureAuditEvents,
  ventureExperiments,
  ventureOauthClients,
  ventureOauthCodes,
  ventureOauthTokens,
} from "@/lib/schema"
import { VENTURE_DIRECTOR_SERVICE_ID } from "@/lib/venture-lab/mcp-policy"

export const VENTURE_OAUTH_SCOPE = "venture"
export const CURSOR_OAUTH_REDIRECT_URIS = [
  "cursor://anysphere.cursor-mcp/oauth/callback",
  "https://www.cursor.com/agents/mcp/oauth/callback",
  "http://localhost:8787/callback",
] as const

const CODE_TTL_MS = 5 * 60 * 1000
const ACCESS_TTL_MS = 60 * 60 * 1000
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_ACTIVE_CLIENTS = 20

export class VentureOauthError extends Error {
  constructor(public status: number, public code: string, public safeMessage: string) {
    super(safeMessage)
    this.name = "VentureOauthError"
  }
}

export function ventureOauthOrigin(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.AUTH_URL?.trim()
  if (!raw) throw new VentureOauthError(503, "server_error", "OAuth canonical origin is not configured.")
  return new URL(raw).origin
}

export function ventureMcpResourceUrl(env: NodeJS.ProcessEnv = process.env) {
  return `${ventureOauthOrigin(env)}/api/venture-lab/mcp`
}

export function ventureProtectedResourceMetadata(env: NodeJS.ProcessEnv = process.env) {
  const origin = ventureOauthOrigin(env)
  return {
    resource: ventureMcpResourceUrl(env),
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: [VENTURE_OAUTH_SCOPE],
  }
}

export function ventureAuthorizationServerMetadata(env: NodeJS.ProcessEnv = process.env) {
  const origin = ventureOauthOrigin(env)
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/venture-lab/oauth/authorize`,
    token_endpoint: `${origin}/api/venture-lab/oauth/token`,
    registration_endpoint: `${origin}/api/venture-lab/oauth/register`,
    scopes_supported: [VENTURE_OAUTH_SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
  }
}

export async function registerCursorOauthClient(input: unknown) {
  const body = objectValue(input, "registration")
  const redirects = stringArray(body.redirect_uris, "redirect_uris")
  if (redirects.length < 1 || redirects.length > CURSOR_OAUTH_REDIRECT_URIS.length) {
    throw new VentureOauthError(400, "invalid_client_metadata", "redirect_uris must contain 1 to 3 approved Cursor callbacks.")
  }
  const unique = [...new Set(redirects)].sort()
  if (unique.length !== redirects.length || unique.some((uri) => !(CURSOR_OAUTH_REDIRECT_URIS as readonly string[]).includes(uri))) {
    throw new VentureOauthError(400, "invalid_redirect_uri", "Only approved Cursor OAuth callback URIs are accepted.")
  }

  const grantTypes = optionalStringArray(body.grant_types)
  if (grantTypes && (grantTypes.some((value) => !["authorization_code", "refresh_token"].includes(value)) || !grantTypes.includes("authorization_code"))) {
    throw new VentureOauthError(400, "invalid_client_metadata", "Unsupported OAuth grant type.")
  }
  const responseTypes = optionalStringArray(body.response_types)
  if (responseTypes && (responseTypes.length !== 1 || responseTypes[0] !== "code")) {
    throw new VentureOauthError(400, "invalid_client_metadata", "Only authorization-code response type is supported.")
  }
  if (body.token_endpoint_auth_method !== undefined && body.token_endpoint_auth_method !== "none") {
    throw new VentureOauthError(400, "invalid_client_metadata", "Venture Lab registers Cursor as a public PKCE client.")
  }

  const existingRows = await db.execute(sql`
    SELECT client_id, client_name, redirect_uris, created_at
    FROM venture_oauth_clients
    WHERE active = true
      AND redirect_uris = ${JSON.stringify(unique)}::jsonb
    LIMIT 1
  `)
  const existing = existingRows.rows[0] as { client_id?: string; client_name?: string; redirect_uris?: string[]; created_at?: Date } | undefined
  if (existing?.client_id) {
    return {
      client_id: existing.client_id,
      client_name: existing.client_name ?? "Cursor Grok Bot",
      redirect_uris: existing.redirect_uris ?? unique,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: existing.created_at ? Math.floor(existing.created_at.getTime() / 1000) : Math.floor(Date.now() / 1000),
    }
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(ventureOauthClients).where(eq(ventureOauthClients.active, true))
  if (Number(count) >= MAX_ACTIVE_CLIENTS) throw new VentureOauthError(429, "temporarily_unavailable", "Venture Lab OAuth client registration limit reached.")

  const clientId = `cursor_vl_${randomBytes(24).toString("base64url")}`
  const clientName = boundedString(body.client_name ?? "Cursor Grok Bot", "client_name", 200)
  const [client] = await db.insert(ventureOauthClients).values({
    clientId,
    clientName,
    redirectUris: unique,
  }).returning()

  await auditSystem("oauth_client_registered", "Registered a restricted Cursor OAuth client.", {
    clientId: client.clientId,
    clientName: client.clientName,
    redirectUris: unique,
  })

  return {
    client_id: client.clientId,
    client_name: client.clientName,
    redirect_uris: unique,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
  }
}

export async function createCursorAuthorizationCode(input: {
  clientId: string
  redirectUri: string
  codeChallenge: string
  codeChallengeMethod: string
  responseType: string
  scope?: string | null
  resource?: string | null
  state?: string | null
  actor: { id: string; role: string; active: boolean; mfaEnabled: boolean }
}) {
  if (!input.actor.active || input.actor.role !== "venture_controller" || !input.actor.mfaEnabled) {
    throw new VentureOauthError(403, "access_denied", "An active MFA-enabled Venture Controller must authorize this connector.")
  }
  if (input.responseType !== "code") throw new VentureOauthError(400, "unsupported_response_type", "Only authorization-code flow is supported.")
  if (input.codeChallengeMethod !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(input.codeChallenge)) {
    throw new VentureOauthError(400, "invalid_request", "PKCE S256 code challenge is required.")
  }
  if (!input.state || input.state.length > 1024) throw new VentureOauthError(400, "invalid_request", "OAuth state is required.")
  const scope = normalizeScope(input.scope)
  const resource = normalizeResource(input.resource)

  const [client] = await db.select().from(ventureOauthClients)
    .where(and(eq(ventureOauthClients.clientId, input.clientId), eq(ventureOauthClients.active, true))).limit(1)
  if (!client) throw new VentureOauthError(400, "unauthorized_client", "OAuth client is not registered or is disabled.")
  if (!client.redirectUris.includes(input.redirectUri)) throw new VentureOauthError(400, "invalid_request", "redirect_uri does not match the registered client.")

  const rawCode = `vlc_${randomBytes(32).toString("base64url")}`
  const expiresAt = new Date(Date.now() + CODE_TTL_MS)
  await db.insert(ventureOauthCodes).values({
    codeHash: sha256(rawCode),
    clientId: client.id,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    scope,
    resource,
    approvedBy: input.actor.id,
    expiresAt,
  })

  await auditHuman(input.actor.id, "oauth_connector_authorized", "Authorized Cursor Grok Bot to use the restricted Venture Director MCP identity.", {
    clientId: client.clientId,
    redirectUri: input.redirectUri,
    scope,
    resource,
  })

  return { code: rawCode, state: input.state }
}

export async function exchangeCursorOauthToken(form: URLSearchParams) {
  const grantType = form.get("grant_type")
  if (grantType === "authorization_code") return exchangeAuthorizationCode(form)
  if (grantType === "refresh_token") return exchangeRefreshToken(form)
  throw new VentureOauthError(400, "unsupported_grant_type", "Unsupported OAuth grant type.")
}

export async function authenticateVentureOauthAccessToken(rawToken: string) {
  if (!rawToken.startsWith("vlat_")) return null
  const hash = sha256(rawToken)
  const rows = await db.execute(sql`
    SELECT t.service_account_id
    FROM venture_oauth_tokens t
    JOIN venture_oauth_clients c ON c.id = t.client_id
    JOIN venture_service_accounts s ON s.id = t.service_account_id
    JOIN admin_users u ON u.id = t.authorized_by
    WHERE t.access_token_hash = ${hash}
      AND t.revoked_at IS NULL
      AND t.access_expires_at > CURRENT_TIMESTAMP
      AND c.active = true
      AND s.active = true
      AND s.revoked_at IS NULL
      AND u.active = true
      AND u.role::text = 'venture_controller'
      AND u.mfa_enabled = true
    LIMIT 1
  `)
  const row = rows.rows[0] as { service_account_id?: string } | undefined
  return row?.service_account_id ? { serviceId: row.service_account_id } : null
}

async function exchangeAuthorizationCode(form: URLSearchParams) {
  const clientId = requiredForm(form, "client_id")
  const rawCode = requiredForm(form, "code")
  const redirectUri = requiredForm(form, "redirect_uri")
  const verifier = requiredForm(form, "code_verifier")
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) throw new VentureOauthError(400, "invalid_grant", "Invalid PKCE code verifier.")
  normalizeResource(form.get("resource"))

  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      SELECT
        ac.id,
        ac.client_id,
        ac.redirect_uri,
        ac.code_challenge,
        ac.scope,
        ac.resource,
        ac.approved_by,
        ac.expires_at,
        ac.consumed_at,
        c.active AS client_active
      FROM venture_oauth_codes ac
      JOIN venture_oauth_clients c ON c.id = ac.client_id
      WHERE ac.code_hash = ${sha256(rawCode)}
      FOR UPDATE OF ac
    `)
    const row = result.rows[0] as {
      id?: string
      client_id?: string
      redirect_uri?: string
      code_challenge?: string
      scope?: string
      resource?: string
      approved_by?: string
      expires_at?: Date
      consumed_at?: Date | null
      client_active?: boolean
    } | undefined

    if (!row?.id || !row.client_active || row.client_id !== (await clientPkForId(tx, clientId)) || row.redirect_uri !== redirectUri) {
      throw new VentureOauthError(400, "invalid_grant", "Authorization code is invalid for this client.")
    }
    if (row.consumed_at || !row.expires_at || row.expires_at <= new Date()) throw new VentureOauthError(400, "invalid_grant", "Authorization code is expired or already consumed.")
    const challenge = createHash("sha256").update(verifier).digest("base64url")
    if (challenge !== row.code_challenge) throw new VentureOauthError(400, "invalid_grant", "PKCE verification failed.")

    await tx.execute(sql`UPDATE venture_oauth_codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = ${row.id}::uuid`)
    return issueTokenPair(tx, {
      clientPk: row.client_id,
      authorizedBy: row.approved_by!,
      scope: row.scope ?? VENTURE_OAUTH_SCOPE,
    })
  })
}

async function exchangeRefreshToken(form: URLSearchParams) {
  const clientId = requiredForm(form, "client_id")
  const rawRefresh = requiredForm(form, "refresh_token")
  normalizeResource(form.get("resource"))

  return db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      SELECT
        t.id,
        t.client_id,
        t.service_account_id,
        t.authorized_by,
        t.scope,
        t.refresh_expires_at,
        t.revoked_at,
        c.client_id AS public_client_id,
        c.active AS client_active,
        s.active AS service_active,
        s.revoked_at AS service_revoked_at,
        u.active AS user_active,
        u.role::text AS user_role,
        u.mfa_enabled AS user_mfa_enabled
      FROM venture_oauth_tokens t
      JOIN venture_oauth_clients c ON c.id = t.client_id
      JOIN venture_service_accounts s ON s.id = t.service_account_id
      JOIN admin_users u ON u.id = t.authorized_by
      WHERE t.refresh_token_hash = ${sha256(rawRefresh)}
      FOR UPDATE OF t
    `)
    const row = result.rows[0] as {
      id?: string
      client_id?: string
      service_account_id?: string
      authorized_by?: string
      scope?: string
      refresh_expires_at?: Date
      revoked_at?: Date | null
      public_client_id?: string
      client_active?: boolean
      service_active?: boolean
      service_revoked_at?: Date | null
      user_active?: boolean
      user_role?: string
      user_mfa_enabled?: boolean
    } | undefined

    if (!row?.id || row.public_client_id !== clientId || !row.client_active || !row.service_active || row.service_revoked_at || !row.user_active || row.user_role !== "venture_controller" || !row.user_mfa_enabled) {
      throw new VentureOauthError(400, "invalid_grant", "Refresh token is invalid for this client.")
    }
    if (row.revoked_at || !row.refresh_expires_at || row.refresh_expires_at <= new Date()) {
      throw new VentureOauthError(400, "invalid_grant", "Refresh token is expired or revoked.")
    }

    await tx.execute(sql`UPDATE venture_oauth_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ${row.id}::uuid`)
    return issueTokenPair(tx, {
      clientPk: row.client_id!,
      authorizedBy: row.authorized_by!,
      scope: row.scope ?? VENTURE_OAUTH_SCOPE,
    })
  })
}

async function issueTokenPair(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], input: {
  clientPk: string
  authorizedBy: string
  scope: string
}) {
  const accessToken = `vlat_${randomBytes(32).toString("base64url")}`
  const refreshToken = `vlrt_${randomBytes(40).toString("base64url")}`
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MS)
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS)

  await tx.insert(ventureOauthTokens).values({
    clientId: input.clientPk,
    serviceAccountId: VENTURE_DIRECTOR_SERVICE_ID,
    authorizedBy: input.authorizedBy,
    accessTokenHash: sha256(accessToken),
    refreshTokenHash: sha256(refreshToken),
    scope: input.scope,
    accessExpiresAt,
    refreshExpiresAt,
  })

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    refresh_token: refreshToken,
    scope: input.scope,
  }
}

async function clientPkForId(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], clientId: string) {
  const result = await tx.execute(sql`SELECT id FROM venture_oauth_clients WHERE client_id = ${clientId} AND active = true LIMIT 1`)
  return (result.rows[0] as { id?: string } | undefined)?.id ?? null
}

function normalizeScope(value: string | null | undefined) {
  const scope = (value ?? VENTURE_OAUTH_SCOPE).trim()
  if (scope !== VENTURE_OAUTH_SCOPE) throw new VentureOauthError(400, "invalid_scope", "Only the venture scope is supported.")
  return scope
}

function normalizeResource(value: string | null | undefined) {
  const expected = ventureMcpResourceUrl()
  if (value && value !== expected) throw new VentureOauthError(400, "invalid_target", "OAuth resource does not match Venture Lab MCP.")
  return expected
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function objectValue(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new VentureOauthError(400, "invalid_client_metadata", `${field} must be an object.`)
  return value as Record<string, unknown>
}

function stringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new VentureOauthError(400, "invalid_client_metadata", `${field} must be a string array.`)
  return value as string[]
}

function optionalStringArray(value: unknown) {
  if (value === undefined) return null
  return stringArray(value, "array")
}

function boundedString(value: unknown, field: string, max: number) {
  if (typeof value !== "string") throw new VentureOauthError(400, "invalid_client_metadata", `${field} must be a string.`)
  const text = value.trim()
  if (!text || text.length > max) throw new VentureOauthError(400, "invalid_client_metadata", `${field} is invalid.`)
  return text
}

function requiredForm(form: URLSearchParams, key: string) {
  const value = form.get(key)?.trim()
  if (!value) throw new VentureOauthError(400, "invalid_request", `${key} is required.`)
  return value
}

async function auditSystem(action: string, reason: string, metadataJson: Record<string, unknown>) {
  const [experiment] = await db.select({ id: ventureExperiments.id }).from(ventureExperiments).where(eq(ventureExperiments.code, "EXP-000")).limit(1)
  if (!experiment) return
  await db.insert(ventureAuditEvents).values({
    experimentId: experiment.id,
    actorType: "system",
    actorKey: "venture-oauth",
    action,
    reason,
    metadataJson,
  })
}

async function auditHuman(actorId: string, action: string, reason: string, metadataJson: Record<string, unknown>) {
  const [experiment] = await db.select({ id: ventureExperiments.id }).from(ventureExperiments).where(eq(ventureExperiments.code, "EXP-000")).limit(1)
  if (!experiment) return
  await db.insert(ventureAuditEvents).values({
    experimentId: experiment.id,
    actorType: "human",
    actorKey: actorId,
    action,
    reason,
    metadataJson,
  })
}
