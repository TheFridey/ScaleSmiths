import { describe, expect, it } from "vitest"
import {
  WEB_RATE_LIMIT_POLICIES,
  evaluateRateLimit,
  rateLimitHeaders,
  webRateLimitKeys,
} from "./rate-limit-policy"

describe("webRateLimitKeys", () => {
  it("always limits the network bucket", () => {
    expect(webRateLimitKeys("experienceEvents", "203.0.113.7")).toEqual(["experienceEvents:ip:203.0.113.7"])
  })

  it("limits the identity alongside the network bucket when one is known", () => {
    expect(webRateLimitKeys("portalRequestCreate", "203.0.113.7", "client-42")).toEqual([
      "portalRequestCreate:ip:203.0.113.7",
      "portalRequestCreate:id:client-42",
    ])
  })

  it("namespaces scopes so unrelated limits never share a counter", () => {
    const [analytics] = webRateLimitKeys("experienceEvents", "203.0.113.7")
    const [portal] = webRateLimitKeys("portalRequestCreate", "203.0.113.7")
    expect(analytics).not.toBe(portal)
  })

  it("normalizes identity case so casing cannot mint a fresh bucket", () => {
    expect(webRateLimitKeys("portalRequestCreate", "203.0.113.7", "  Client-42 ")).toEqual([
      "portalRequestCreate:ip:203.0.113.7",
      "portalRequestCreate:id:client-42",
    ])
  })

  it("omits an empty identity rather than creating a shared blank bucket", () => {
    expect(webRateLimitKeys("portalRequestCreate", "203.0.113.7", "   ")).toEqual(["portalRequestCreate:ip:203.0.113.7"])
  })

  it("keeps an IPv6 /64 bucket intact in the key", () => {
    expect(webRateLimitKeys("experienceEvents", "2001:db8:1:2::/64")).toEqual([
      "experienceEvents:ip:2001:db8:1:2::/64",
    ])
  })
})

describe("evaluateRateLimit", () => {
  const policy = WEB_RATE_LIMIT_POLICIES.portalRequestCreate

  it("allows a request on the limit boundary", () => {
    const decision = evaluateRateLimit(policy.limit, policy, 1_000)
    expect(decision.ok).toBe(true)
    expect(decision.remaining).toBe(0)
  })

  it("refuses the first request past the limit", () => {
    expect(evaluateRateLimit(policy.limit + 1, policy, 1_000).ok).toBe(false)
  })

  it("never reports negative remaining", () => {
    expect(evaluateRateLimit(policy.limit + 50, policy, 1_000).remaining).toBe(0)
  })
})

describe("rateLimitHeaders", () => {
  it("omits Retry-After while the request is still allowed", () => {
    const headers = rateLimitHeaders({ ok: true, limit: 20, remaining: 19, resetAt: 60_000 }, 0)
    expect(headers["Retry-After"]).toBeUndefined()
    expect(headers["RateLimit-Limit"]).toBe("20")
    expect(headers["RateLimit-Remaining"]).toBe("19")
    expect(headers["RateLimit-Reset"]).toBe("60")
  })

  it("sends Retry-After in whole seconds when refusing", () => {
    const headers = rateLimitHeaders({ ok: false, limit: 20, remaining: 0, resetAt: 30_500 }, 0)
    expect(headers["Retry-After"]).toBe("31")
    expect(headers["RateLimit-Remaining"]).toBe("0")
  })

  it("never advertises Retry-After: 0, which would invite an immediate retry", () => {
    const headers = rateLimitHeaders({ ok: false, limit: 20, remaining: 0, resetAt: 0 }, 0)
    expect(headers["Retry-After"]).toBe("1")
  })

  it("clamps an already-elapsed reset instead of emitting a negative value", () => {
    const headers = rateLimitHeaders({ ok: false, limit: 20, remaining: 0, resetAt: -5_000 }, 0)
    expect(headers["RateLimit-Reset"]).toBe("0")
    expect(headers["Retry-After"]).toBe("1")
  })
})

describe("declared policies", () => {
  it("keeps every limit positive and windowed", () => {
    for (const [name, policy] of Object.entries(WEB_RATE_LIMIT_POLICIES)) {
      expect(policy.limit, name).toBeGreaterThan(0)
      expect(policy.windowMs, name).toBeGreaterThan(0)
      expect(policy.purpose, name).toBeTruthy()
    }
  })
})
