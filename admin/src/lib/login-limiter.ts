import { createHash } from "crypto"
import { sql } from "drizzle-orm"
import { UNKNOWN_CLIENT_IP, resolveClientIp } from "./client-ip"
import { db } from "./db"
import { loginRateLimits } from "./schema"

export const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
export const LOGIN_RATE_LIMIT_MAX = 5

export function genericLoginError() {
  return "Unable to sign in with those credentials."
}

/**
 * Resolves the rate-limit bucket for an admin sign-in attempt.
 *
 * Both admin topologies overwrite X-Forwarded-For from `$remote_addr` — the
 * direct-origin snippet from the TCP peer, the Cloudflare snippet from the peer
 * that `real_ip` already rewrote after validating the Cloudflare range. The
 * rightmost entry is therefore always proxy-written, and CF-Connecting-IP never
 * has to be trusted directly by the application.
 */
export function getAuthRequestIp(request?: Request) {
  return request ? resolveClientIp(request.headers) : UNKNOWN_CLIENT_IP
}

export function hashLimiterIdentifier(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex")
}

export function loginRateLimitKeys(scope: string, ip: string, identifier: string) {
  const keys = [`${scope}:ip:${hashLimiterIdentifier(ip)}`]
  const cleanIdentifier = identifier.trim().toLowerCase()

  if (cleanIdentifier) {
    keys.push(`${scope}:id:${hashLimiterIdentifier(cleanIdentifier)}`)
  }

  return keys
}

/**
 * Increments every key before deciding. Returning early on the first exceeded
 * key would leave the remaining buckets un-incremented, letting an attacker
 * probe one identity for free once another bucket was already saturated.
 */
export async function checkLoginRateLimit(keys: string[], now = new Date()) {
  const resetAt = new Date(now.getTime() + LOGIN_RATE_LIMIT_WINDOW_MS)
  let allowed = true

  for (const key of keys) {
    const [row] = await db
      .insert(loginRateLimits)
      .values({ key, count: 1, resetAt, updatedAt: now })
      .onConflictDoUpdate({
        target: loginRateLimits.key,
        set: {
          count: sql<number>`case when ${loginRateLimits.resetAt} <= ${now} then 1 else ${loginRateLimits.count} + 1 end`,
          resetAt: sql<Date>`case when ${loginRateLimits.resetAt} <= ${now} then ${resetAt} else ${loginRateLimits.resetAt} end`,
          updatedAt: now,
        },
      })
      .returning({ count: loginRateLimits.count })

    if ((row?.count ?? LOGIN_RATE_LIMIT_MAX + 1) > LOGIN_RATE_LIMIT_MAX) {
      allowed = false
    }
  }

  return allowed
}
