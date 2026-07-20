import "server-only"
import { lt, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { rateLimitCounters } from "@/lib/schema"

// Durable, shared fixed-window rate limiting. The counter is incremented with a
// single atomic INSERT ... ON CONFLICT DO UPDATE so concurrent requests — across
// replicas — never lose an increment. Callers decide fail-open vs fail-closed;
// the admin middleware fails open so a database blip cannot lock admins out.

export interface DurableRateLimitResult {
  ok: boolean
  count: number
  limit: number
  remaining: number
  resetAt: number
  retryAfterMs: number
}

export async function checkDurableRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): Promise<DurableRateLimitResult> {
  const windowStartMs = Math.floor(now / windowMs) * windowMs
  const windowStart = new Date(windowStartMs)
  const expiresAt = new Date(windowStartMs + windowMs)

  const [row] = await db
    .insert(rateLimitCounters)
    .values({ key, windowStart, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: [rateLimitCounters.key, rateLimitCounters.windowStart],
      set: { count: sql`${rateLimitCounters.count} + 1` },
    })
    .returning({ count: rateLimitCounters.count })

  const count = row?.count ?? 1
  const ok = count <= limit
  return {
    ok,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: expiresAt.getTime(),
    retryAfterMs: ok ? 0 : Math.max(0, expiresAt.getTime() - now),
  }
}

/** Removes expired counter rows. Called periodically by the worker. */
export async function cleanupExpiredRateLimitCounters(now = new Date()): Promise<number> {
  const deleted = await db.delete(rateLimitCounters).where(lt(rateLimitCounters.expiresAt, now)).returning({ key: rateLimitCounters.key })
  return deleted.length
}
