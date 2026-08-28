import "server-only"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { webRateLimits } from "@/lib/schema"
import {
  WEB_RATE_LIMIT_POLICIES,
  evaluateRateLimit,
  type RateLimitDecision,
  type WebRateLimitName,
} from "@/lib/rate-limit-policy"

// Durable, replica-safe counters for the public web application. Each key is
// incremented by a single atomic INSERT ... ON CONFLICT DO UPDATE, so concurrent
// requests across instances cannot lose a count the way a process-local Map does.
//
// Every key in the set is incremented before a verdict is returned, so a request
// that trips the network bucket still consumes its account bucket. Returning
// early would let an attacker probe one bucket for free.

export async function checkWebRateLimit(
  scope: WebRateLimitName,
  keys: string[],
  now = new Date(),
): Promise<RateLimitDecision> {
  const policy = WEB_RATE_LIMIT_POLICIES[scope]
  const resetAt = new Date(now.getTime() + policy.windowMs)
  let worst: RateLimitDecision | null = null

  for (const key of keys) {
    const [row] = await db
      .insert(webRateLimits)
      .values({ key, count: 1, resetAt, updatedAt: now })
      .onConflictDoUpdate({
        target: webRateLimits.key,
        set: {
          count: sql<number>`case when ${webRateLimits.resetAt} <= ${now} then 1 else ${webRateLimits.count} + 1 end`,
          resetAt: sql<Date>`case when ${webRateLimits.resetAt} <= ${now} then ${resetAt} else ${webRateLimits.resetAt} end`,
          updatedAt: now,
        },
      })
      .returning({ count: webRateLimits.count, resetAt: webRateLimits.resetAt })

    const decision = evaluateRateLimit(row?.count ?? policy.limit + 1, policy, (row?.resetAt ?? resetAt).getTime())
    if (!worst || (!decision.ok && worst.ok) || decision.remaining < worst.remaining) worst = decision
  }

  return worst ?? evaluateRateLimit(1, policy, resetAt.getTime())
}

// Expired rows are pruned by the admin worker, not here: the web runtime role
// deliberately holds no DELETE privilege on any table.
