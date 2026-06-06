import { describe, expect, it } from "vitest"
import {
  createMemoryLoginLimiter,
  genericLoginError,
  hashLimiterIdentifier,
  loginRateLimitKeys,
} from "./login-limiter"

describe("login limiter", () => {
  it("increments invalid portal login attempts by hashed IP and identifier", async () => {
    const limiter = createMemoryLoginLimiter()
    const keys = loginRateLimitKeys("portal-login", "203.0.113.10", "client@example.com")

    await limiter.check(keys, Date.parse("2026-06-01T10:00:00.000Z"))

    expect(limiter.records.get(keys[0])?.count).toBe(1)
    expect(limiter.records.get(keys[1])?.count).toBe(1)
  })

  it("returns a generic result once portal attempts are throttled", async () => {
    const limiter = createMemoryLoginLimiter(2)
    const keys = loginRateLimitKeys("portal-login", "203.0.113.10", "client@example.com")
    const now = Date.parse("2026-06-01T10:00:00.000Z")

    expect(await limiter.check(keys, now)).toBe(true)
    expect(await limiter.check(keys, now)).toBe(true)
    expect(await limiter.check(keys, now)).toBe(false)
    expect(genericLoginError()).toBe("Unable to sign in with those credentials.")
  })

  it("allows a valid portal login before the threshold is reached", async () => {
    const limiter = createMemoryLoginLimiter(5)
    const keys = loginRateLimitKeys("portal-login", "203.0.113.10", "client@example.com")

    expect(await limiter.check(keys, Date.parse("2026-06-01T10:00:00.000Z"))).toBe(true)
  })

  it("increments invalid admin login attempts with the admin scope", async () => {
    const limiter = createMemoryLoginLimiter()
    const keys = loginRateLimitKeys("admin-login", "198.51.100.20", "admin@example.com")

    await limiter.check(keys, Date.parse("2026-06-01T10:00:00.000Z"))
    await limiter.check(keys, Date.parse("2026-06-01T10:00:30.000Z"))

    expect(limiter.records.get(keys[0])?.count).toBe(2)
    expect(limiter.records.get(keys[1])?.count).toBe(2)
  })

  it("returns the same generic login error for throttled admin attempts", async () => {
    const limiter = createMemoryLoginLimiter(1)
    const keys = loginRateLimitKeys("admin-login", "198.51.100.20", "admin@example.com")
    const now = Date.parse("2026-06-01T10:00:00.000Z")

    expect(await limiter.check(keys, now)).toBe(true)
    expect(await limiter.check(keys, now)).toBe(false)
    expect(genericLoginError()).not.toContain("admin@example.com")
  })

  it("hashes identifiers without keeping raw email or IP in keys", () => {
    const keys = loginRateLimitKeys("portal-login", "203.0.113.10", "Client@Example.com")

    expect(keys).toEqual([
      `portal-login:ip:${hashLimiterIdentifier("203.0.113.10")}`,
      `portal-login:id:${hashLimiterIdentifier("client@example.com")}`,
    ])
    expect(keys.join(" ")).not.toContain("203.0.113.10")
    expect(keys.join(" ")).not.toContain("Client@Example.com")
    expect(keys.join(" ")).not.toContain("client@example.com")
  })
})
