import { createHash } from "crypto"
import { sql } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { resolveClientIp } from "./client-ip"
import { db } from "./db"
import { loginRateLimits } from "./schema"

export const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
export const LOGIN_RATE_LIMIT_MAX = 5

export function genericLoginError() {
  return "Unable to sign in with those credentials."
}

/**
 * Resolves the rate-limit bucket for a portal login. See `client-ip.ts`: only the
 * rightmost X-Forwarded-For entry is written by the trusted Nginx hop, and IPv6
 * clients are bucketed by /64 so prefix rotation cannot mint fresh attempts.
 */
export function getRequestIp(request: NextRequest) {
  return resolveClientIp(request.headers)
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

export interface LoginRateLimitDecision {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
}

/**
 * Increments every key before deciding. Returning early on the first exceeded
 * key would leave the remaining buckets un-incremented, letting an attacker
 * probe one identity for free once another bucket was already saturated.
 */
export async function checkLoginRateLimitDetailed(keys: string[], now = new Date()): Promise<LoginRateLimitDecision> {
  const windowResetAt = new Date(now.getTime() + LOGIN_RATE_LIMIT_WINDOW_MS)
  let allowed = true
  let remaining = LOGIN_RATE_LIMIT_MAX
  let resetAt = windowResetAt.getTime()

  for (const key of keys) {
    const [row] = await db
      .insert(loginRateLimits)
      .values({ key, count: 1, resetAt: windowResetAt, updatedAt: now })
      .onConflictDoUpdate({
        target: loginRateLimits.key,
        set: {
          count: sql<number>`case when ${loginRateLimits.resetAt} <= ${now} then 1 else ${loginRateLimits.count} + 1 end`,
          resetAt: sql<Date>`case when ${loginRateLimits.resetAt} <= ${now} then ${windowResetAt} else ${loginRateLimits.resetAt} end`,
          updatedAt: now,
        },
      })
      .returning({ count: loginRateLimits.count, resetAt: loginRateLimits.resetAt })

    const count = row?.count ?? LOGIN_RATE_LIMIT_MAX + 1
    if (count > LOGIN_RATE_LIMIT_MAX) {
      allowed = false
      resetAt = (row?.resetAt ?? windowResetAt).getTime()
    }
    remaining = Math.min(remaining, Math.max(0, LOGIN_RATE_LIMIT_MAX - count))
  }

  return { allowed, limit: LOGIN_RATE_LIMIT_MAX, remaining, resetAt }
}

export function createMemoryLoginLimiter(max = LOGIN_RATE_LIMIT_MAX, windowMs = LOGIN_RATE_LIMIT_WINDOW_MS) {
  const records = new Map<string, { count: number; resetAt: number }>()

  return {
    async check(keys: string[], now = Date.now()) {
      for (const key of keys) {
        const record = records.get(key)
        const next =
          !record || record.resetAt <= now
            ? { count: 1, resetAt: now + windowMs }
            : { count: record.count + 1, resetAt: record.resetAt }

        records.set(key, next)

        if (next.count > max) {
          return false
        }
      }

      return true
    },
    records,
  }
}
