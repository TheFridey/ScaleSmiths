// Declared semantic limits for the public web application, plus the pure
// helpers that turn a limiter decision into correct HTTP semantics.
//
// Keys are built from the trusted client bucket resolved by `client-ip.ts`
// (IPv4 address or IPv6 /64), never from a raw client-supplied header. Where a
// request carries a stable account identity, that is limited alongside the
// network bucket so one abusive account cannot simply rotate networks and one
// abusive network cannot simply rotate accounts.
//
// Limits are deliberately generous relative to real human use: the edge layer
// (nginx `limit_req`) absorbs volumetric floods, so these exist to bound
// semantic abuse — analytics stuffing, portal write spam, enumeration — without
// interrupting a legitimate visitor.

export interface RateLimitPolicy {
  /** Requests permitted per window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
  /** Human-readable purpose, surfaced in operational docs. */
  purpose: string
}

export const WEB_RATE_LIMIT_POLICIES = {
  experienceEvents: {
    limit: 120,
    windowMs: 60_000,
    purpose: "Anonymous analytics ingestion; one page visit emits several events.",
  },
  portalRequestCreate: {
    limit: 20,
    windowMs: 60 * 60 * 1000,
    purpose: "Client portal request creation, which notifies staff by email.",
  },
  portalRequestMessage: {
    limit: 60,
    windowMs: 60 * 60 * 1000,
    purpose: "Client portal replies on an existing request.",
  },
  portalInvoicePdf: {
    limit: 60,
    windowMs: 60 * 60 * 1000,
    purpose: "Portal invoice PDF retrieval, which reads and logs a stored document.",
  },
} as const satisfies Record<string, RateLimitPolicy>

export type WebRateLimitName = keyof typeof WEB_RATE_LIMIT_POLICIES

export interface RateLimitDecision {
  ok: boolean
  limit: number
  remaining: number
  resetAt: number
}

/**
 * Builds the durable counter keys for one request. The scope prefix keeps
 * unrelated limits in separate namespaces within the shared counter table.
 */
export function webRateLimitKeys(scope: WebRateLimitName, clientIp: string, identity?: string | null): string[] {
  const keys = [`${scope}:ip:${clientIp}`]
  const trimmed = identity?.trim().toLowerCase()
  if (trimmed) keys.push(`${scope}:id:${trimmed}`)
  return keys
}

/**
 * Returns RFC 9331-style RateLimit headers, plus Retry-After when the request is
 * being refused. Retry-After is always a whole number of seconds and at least 1,
 * because `Retry-After: 0` invites an immediate retry.
 */
export function rateLimitHeaders(decision: RateLimitDecision, now = Date.now()): Record<string, string> {
  const resetSeconds = Math.max(0, Math.ceil((decision.resetAt - now) / 1000))
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(decision.limit),
    "RateLimit-Remaining": String(Math.max(0, decision.remaining)),
    "RateLimit-Reset": String(resetSeconds),
  }

  if (!decision.ok) headers["Retry-After"] = String(Math.max(1, resetSeconds))

  return headers
}

/**
 * Evaluates a counter row against a policy. Exposed separately from storage so
 * the window and boundary behaviour can be tested without a database.
 */
export function evaluateRateLimit(count: number, policy: RateLimitPolicy, resetAt: number): RateLimitDecision {
  return {
    ok: count <= policy.limit,
    limit: policy.limit,
    remaining: Math.max(0, policy.limit - count),
    resetAt,
  }
}
