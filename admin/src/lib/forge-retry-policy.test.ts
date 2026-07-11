import { describe, expect, it } from "vitest"
import {
  classifyRetryability,
  computeBackoffMs,
  nextRetryDecision,
  resolveRetryPolicyConfig,
  type RetryPolicyConfig,
} from "./forge-retry-policy"

const config: RetryPolicyConfig = { baseMs: 250, maxMs: 8000, maxElapsedMs: 30000, maxAttempts: 3 }

describe("classifyRetryability", () => {
  it("marks provider auth/credential errors permanent", () => {
    expect(classifyRetryability({ category: "authentication", retryable: false })).toMatchObject({ retryable: false, category: "authentication" })
  })

  it("marks invalid request, unsupported model, and safety permanent", () => {
    expect(classifyRetryability({ category: "invalid_request", retryable: false }).retryable).toBe(false)
    expect(classifyRetryability({ category: "model_unsupported", retryable: false }).retryable).toBe(false)
    expect(classifyRetryability({ category: "safety", retryable: false }).retryable).toBe(false)
  })

  it("marks rate_limit retryable and preserves retryAfterMs", () => {
    expect(classifyRetryability({ category: "rate_limit", retryable: true, retryAfterMs: 2000 })).toMatchObject({ retryable: true, category: "rate_limit", retryAfterMs: 2000 })
  })

  it("treats response schema mismatch as retryable", () => {
    expect(classifyRetryability({ code: "schema_mismatch", retryable: true, safeMessage: "bad" }).category).toBe("schema_mismatch")
    expect(classifyRetryability({ code: "schema_mismatch", retryable: true, safeMessage: "bad" }).retryable).toBe(true)
  })

  it("treats unknown/plain errors as retryable network", () => {
    expect(classifyRetryability(new Error("boom"))).toMatchObject({ retryable: true, category: "network" })
  })
})

describe("computeBackoffMs", () => {
  it("grows exponentially and caps at maxMs (with jitter at its ceiling)", () => {
    const noJitter = () => 1 // full jitter multiplier = 1 returns the cap
    expect(computeBackoffMs(0, { baseMs: 250, maxMs: 8000, random: noJitter })).toBe(250)
    expect(computeBackoffMs(1, { baseMs: 250, maxMs: 8000, random: noJitter })).toBe(500)
    expect(computeBackoffMs(2, { baseMs: 250, maxMs: 8000, random: noJitter })).toBe(1000)
    expect(computeBackoffMs(10, { baseMs: 250, maxMs: 8000, random: noJitter })).toBe(8000)
  })

  it("keeps jittered delay within [0, cap]", () => {
    for (let i = 0; i < 50; i++) {
      const d = computeBackoffMs(3, { baseMs: 250, maxMs: 8000 })
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(2000)
    }
  })

  it("never undercuts a server Retry-After", () => {
    expect(computeBackoffMs(0, { baseMs: 250, maxMs: 8000, retryAfterMs: 5000, random: () => 0 })).toBe(5000)
  })
})

describe("nextRetryDecision", () => {
  it("does not retry permanent errors", () => {
    const d = nextRetryDecision({ classification: { retryable: false, category: "authentication" }, attempt: 0, elapsedMs: 0, config })
    expect(d.retry).toBe(false)
    expect(d.reason).toContain("permanent")
  })

  it("does not retry once attempts are exhausted", () => {
    const d = nextRetryDecision({ classification: { retryable: true, category: "timeout" }, attempt: 3, elapsedMs: 0, config })
    expect(d.retry).toBe(false)
    expect(d.reason).toContain("attempts")
  })

  it("does not retry when the delay would pass the elapsed deadline", () => {
    const d = nextRetryDecision({ classification: { retryable: true, category: "timeout" }, attempt: 0, elapsedMs: 29900, config, random: () => 1 })
    expect(d.retry).toBe(false)
    expect(d.reason).toContain("elapsed")
  })

  it("retries a transient error within budget", () => {
    const d = nextRetryDecision({ classification: { retryable: true, category: "unavailable" }, attempt: 0, elapsedMs: 0, config, random: () => 1 })
    expect(d.retry).toBe(true)
    expect(d.delayMs).toBe(250)
  })
})

describe("resolveRetryPolicyConfig", () => {
  it("uses defaults and clamps out-of-range env values", () => {
    expect(resolveRetryPolicyConfig({}, 2)).toEqual({ baseMs: 250, maxMs: 8000, maxElapsedMs: 30000, maxAttempts: 2 })
    const c = resolveRetryPolicyConfig({ FORGE_AI_RETRY_BASE_MS: "5", FORGE_AI_RETRY_MAX_MS: "999999" }, 2)
    expect(c.baseMs).toBe(50)
    expect(c.maxMs).toBe(60000)
  })
})
