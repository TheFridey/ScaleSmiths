import { createHash, timingSafeEqual } from "node:crypto"
import { hasCapability, type Capability } from "./rbac"
import type { AdminRole } from "./admin-users"

export const JARVIS_READ_CAPABILITIES = {
  "clients.read": "clients.read", "leads.read": "leads.read", "projects.read": "projects.read",
  "tasks.read": "projects.read", "invoices.read": "finance.read", "payments.read": "finance.read",
  "retainers.read": "finance.read", "proposals.read": "leads.read", "analytics.read": "analytics.read",
  "deployments.read": "forge.read",
  // OPERATION WATCHTOWER: inbound communications. Read-only projections over
  // client portal conversations, public enquiries and partner applications.
  "messages.read": "projects.read", "enquiries.read": "leads.read",
  "partner-applications.read": "expansion.manage",
  "partner-requests.read": "expansion.manage",
} as const satisfies Record<string, Capability>
export type JarvisReadAction = keyof typeof JARVIS_READ_CAPABILITIES

// Actions that expose personal data from inbound communications. They are
// never granted implicitly: `authorizeJarvisRead` requires every action to be
// named in JARVIS_SERVICE_SCOPES, and `provision-jarvis-service.mjs` has no
// default scope set, so none of these can be reached without an operator naming
// them. This constant is the canonical list used by tests and provisioning; it
// is a declaration, not a second gate.
export const JARVIS_COMMUNICATIONS_ACTIONS: readonly JarvisReadAction[] = [
  "messages.read", "enquiries.read", "partner-applications.read", "partner-requests.read",
]
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
// Numeric ids are the common case. The partner-request projections key rows as
// `mr:<uuid>` and `tk:<uuid>` so two sources stay distinct inside one ordered
// cursor, so those forms must be accepted or the second page is rejected.
const ID_BODY = "(?:[1-9]\\d{0,14}|(?:mr|tk):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"
const ID_PATTERN = new RegExp(`^${ID_BODY}$`)
// Communications actions page newest-first on a keyset cursor of the form
// `<micros>|<id>`, where micros is the row timestamp in whole microseconds since
// the Unix epoch. An opaque integer is used rather than the server's timestamptz
// text rendering because that rendering contains a space and a `+00` offset: a
// client that places it in a URL without encoding receives a space and a
// dropped offset back (`+` decodes to a space), the cursor then fails
// validation, and page two breaks with invalid_query. It also makes the
// comparison independent of the database's DateStyle and TimeZone.
// The sign is required: a timestamptz before 1970 has a negative epoch, and the
// grammar previously accepted only unsigned digits, so a pre-1970 row ending a
// page produced a cursor the server itself would reject. The width is 20 digits
// because microseconds since the epoch exceed bigint for dates past ~294000 and
// are compared as numeric, not cast to bigint.
// Actions that still page by id keep the plain id cursor.
const CURSOR_PATTERN = new RegExp(`^(?:-?\\d{1,20}\\|)?${ID_BODY}$`)
export const CURSOR_SEPARATOR = "|"
// Build and parse the keyset cursor in one place. They previously lived apart —
// emission in the server module, validation here — and drifted: the emitted form
// was not accepted back. encodeCursor refuses to emit anything validation would
// reject, so that class of drift now fails loudly at the source instead of on a
// client's second page.
export function encodeCursor(ts: string, id: string): string {
  const cursor = `${ts}${CURSOR_SEPARATOR}${id}`
  if (!CURSOR_PATTERN.test(cursor)) throw new JarvisServiceError(500, "cursor_encoding_failed")
  return cursor
}
export function decodeCursor(cursor: string | null): {ts: string | null; id: string | null} {
  if (!cursor) return {ts: null, id: null}
  const index = cursor.indexOf(CURSOR_SEPARATOR)
  if (index < 0) return {ts: null, id: cursor}
  return {ts: cursor.slice(0, index), id: cursor.slice(index + 1)}
}
export function jarvisReadQuery(params: URLSearchParams) {
  for (const key of params.keys()) if (!["id", "clientId", "cursor", "limit"].includes(key) || params.getAll(key).length !== 1) throw new JarvisServiceError(400, "invalid_query")
  const bounded = (key: string, pattern: RegExp) => {
    const value = params.get(key)
    if (value !== null && !pattern.test(value)) throw new JarvisServiceError(400, "invalid_query")
    return value
  }
  const id = bounded("id", ID_PATTERN), clientId = bounded("clientId", ID_PATTERN), cursor = bounded("cursor", CURSOR_PATTERN)
  const limitValue = params.get("limit") ?? "50"
  if (!/^\d{1,3}$/.test(limitValue) || Number(limitValue) < 1 || Number(limitValue) > 100 || (id && cursor)) throw new JarvisServiceError(400, "invalid_query")
  return {id, clientId, cursor, limit: Number(limitValue)}
}
