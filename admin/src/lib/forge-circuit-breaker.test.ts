import { describe, expect, it } from "vitest"
import {
  createBreakerState,
  evaluateAttempt,
  isTripCategory,
  recordFailure,
  recordSuccess,
  resolveBreakerConfig,
  type BreakerConfig,
} from "./forge-circuit-breaker"

const config: BreakerConfig = { failureThreshold: 3, cooldownMs: 1000, windowMs: 5000 }

function tripOpen(now = 0) {
  let s = createBreakerState()
  for (let i = 0; i < 3; i++) s = recordFailure(s, "timeout", now, config).next
  return s
}

describe("isTripCategory", () => {
  it("counts only provider-health failures", () => {
    expect(isTripCategory("timeout")).toBe(true)
    expect(isTripCategory("rate_limit")).toBe(true)
    expect(isTripCategory("unavailable")).toBe(true)
    expect(isTripCategory("network")).toBe(true)
    expect(isTripCategory("authentication")).toBe(false)
    expect(isTripCategory("invalid_request")).toBe(false)
    expect(isTripCategory("schema_mismatch")).toBe(false)
  })
})

describe("recordFailure", () => {
  it("opens once the threshold is reached within the window", () => {
    const s = tripOpen(0)
    expect(s.state).toBe("open")
    expect(s.opensUntil).toBe(1000)
  })

  it("does not count non-trip categories", () => {
    let s = createBreakerState()
    for (let i = 0; i < 5; i++) s = recordFailure(s, "authentication", 0, config).next
    expect(s.state).toBe("closed")
  })

  it("drops failures older than the window", () => {
    let s = createBreakerState()
    s = recordFailure(s, "timeout", 0, config).next
    s = recordFailure(s, "timeout", 100, config).next
    s = recordFailure(s, "timeout", 9000, config).next // first two are stale (>5000 old)
    expect(s.state).toBe("closed")
    expect(s.failures.length).toBe(1)
  })
})

describe("evaluateAttempt", () => {
  it("allows attempts while closed", () => {
    const r = evaluateAttempt(createBreakerState(), 0, config)
    expect(r.allowed).toBe(true)
  })

  it("blocks while open during cooldown", () => {
    const r = evaluateAttempt(tripOpen(0), 500, config)
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain("open")
  })

  it("transitions open -> half-open after cooldown and allows one probe", () => {
    const r = evaluateAttempt(tripOpen(0), 1000, config)
    expect(r.allowed).toBe(true)
    expect(r.next.state).toBe("half-open")
    expect(r.transition).toEqual({ from: "open", to: "half-open" })
    // a second concurrent probe is blocked
    const r2 = evaluateAttempt(r.next, 1000, config)
    expect(r2.allowed).toBe(false)
  })
})

describe("recordSuccess", () => {
  it("closes the breaker from half-open", () => {
    const open = tripOpen(0)
    const probing = evaluateAttempt(open, 1000, config).next
    const r = recordSuccess(probing, 1100)
    expect(r.next.state).toBe("closed")
    expect(r.next.failures.length).toBe(0)
    expect(r.transition).toEqual({ from: "half-open", to: "closed" })
  })
})

describe("recordFailure from half-open", () => {
  it("re-opens and restarts cooldown", () => {
    const open = tripOpen(0)
    const probing = evaluateAttempt(open, 1000, config).next
    const r = recordFailure(probing, "unavailable", 1200, config)
    expect(r.next.state).toBe("open")
    expect(r.next.opensUntil).toBe(2200)
    expect(r.transition).toEqual({ from: "half-open", to: "open" })
  })
})

describe("resolveBreakerConfig", () => {
  it("defaults and clamps", () => {
    expect(resolveBreakerConfig({})).toEqual({ failureThreshold: 5, cooldownMs: 30_000, windowMs: 60_000 })
    expect(resolveBreakerConfig({ FORGE_AI_BREAKER_FAILURE_THRESHOLD: "1" }).failureThreshold).toBe(2)
  })
})
