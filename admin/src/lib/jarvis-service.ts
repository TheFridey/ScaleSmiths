import { createHash, timingSafeEqual } from "node:crypto"
import { hasCapability, type Capability } from "./rbac"
import type { AdminRole } from "./admin-users"

export const JARVIS_READ_CAPABILITIES = {
  "clients.read": "clients.read", "leads.read": "leads.read", "projects.read": "projects.read",
  "tasks.read": "projects.read", "invoices.read": "finance.read", "payments.read": "finance.read",
  "retainers.read": "finance.read", "proposals.read": "leads.read", "analytics.read": "analytics.read",
  "deployments.read": "forge.read",
} as const satisfies Record<string, Capability>
export type JarvisReadAction = keyof typeof JARVIS_READ_CAPABILITIES
export class JarvisServiceError extends Error {
  constructor(public status: number, public code: string) { super(code) }
}
export function jarvisReadAction(value: string): JarvisReadAction {
  if (!Object.hasOwn(JARVIS_READ_CAPABILITIES, value)) throw new JarvisServiceError(404, "unsupported_action")
  return value as JarvisReadAction
}
export function authenticateJarvisService(headers: Headers, env: Record<string, string | undefined> = process.env) {
  const digest = env.JARVIS_SERVICE_TOKEN_SHA256 ?? ""
  const userId = env.JARVIS_SERVICE_ADMIN_ID ?? ""
  const version = env.JARVIS_SERVICE_SESSION_VERSION ?? ""
  if (!/^[a-f0-9]{64}$/.test(digest) || !userId || !/^\d+$/.test(version)) throw new JarvisServiceError(503, "integration_not_configured")
  const match = /^Bearer ([A-Za-z0-9_-]{43,256})$/.exec(headers.get("authorization") ?? "")
  const actual = createHash("sha256").update(match?.[1] ?? "").digest()
  if (!match || !timingSafeEqual(actual, Buffer.from(digest, "hex"))) throw new JarvisServiceError(401, "unauthorized")
  return { userId, sessionVersion: Number(version), scopes: (env.JARVIS_SERVICE_SCOPES ?? "").split(",").map(value => value.trim()).filter(Boolean) }
}
export function authorizeJarvisRead(identity: ReturnType<typeof authenticateJarvisService>, user: {active: boolean; role: AdminRole; sessionVersion: number} | null, action: JarvisReadAction) {
  if (!user?.active || user.sessionVersion !== identity.sessionVersion) throw new JarvisServiceError(401, "service_identity_revoked")
  if (!identity.scopes.includes(action) || !hasCapability(user.role, JARVIS_READ_CAPABILITIES[action])) throw new JarvisServiceError(403, "scope_denied")
}
export function jarvisReadQuery(params: URLSearchParams) {
  for (const key of params.keys()) if (!["id", "clientId", "cursor", "limit"].includes(key) || params.getAll(key).length !== 1) throw new JarvisServiceError(400, "invalid_query")
  const bounded = (key: string) => {
    const value = params.get(key)
    if (value !== null && !/^[1-9]\d{0,14}$/.test(value)) throw new JarvisServiceError(400, "invalid_query")
    return value
  }
  const id = bounded("id"), clientId = bounded("clientId"), cursor = bounded("cursor")
  const limitValue = params.get("limit") ?? "50"
  if (!/^\d{1,3}$/.test(limitValue) || Number(limitValue) < 1 || Number(limitValue) > 100 || (id && cursor)) throw new JarvisServiceError(400, "invalid_query")
  return {id, clientId, cursor, limit: Number(limitValue)}
}
