import { createHash } from "crypto"
import { sql } from "drizzle-orm"
import { db } from "./db"
import { loginRateLimits } from "./schema"

export const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
export const LOGIN_RATE_LIMIT_MAX = 5

export function genericLoginError() {
  return "Unable to sign in with those credentials."
}

export function getAuthRequestIp(request?: Request) {
  const forwarded = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || request?.headers.get("x-real-ip") || request?.headers.get("cf-connecting-ip") || "unknown"
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

export async function checkLoginRateLimit(keys: string[], now = new Date()) {
  const resetAt = new Date(now.getTime() + LOGIN_RATE_LIMIT_WINDOW_MS)

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
      return false
    }
  }

  return true
}
