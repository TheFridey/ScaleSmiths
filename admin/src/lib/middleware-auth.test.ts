import { describe, expect, it } from "vitest"
import { isAdminSessionCurrent } from "./admin-users"
import {
  buildForgeRateLimitKey,
  checkForgeRateLimit,
  isForgeMutatingMethod,
  isForgeTaskEndpoint,
  resolveForgeRateLimitActor,
  resolveForgeRateLimitConfig,
} from "./forge-security"

describe("admin session current check (isAdminSessionCurrent)", () => {
  it("returns true when active and session version matches", () => {
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 5 }, 5)).toBe(true)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 1 }, 1)).toBe(true)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 42 }, 42)).toBe(true)
  })

  it("returns false when account is inactive regardless of version match", () => {
    expect(isAdminSessionCurrent({ active: false, sessionVersion: 5 }, 5)).toBe(false)
    expect(isAdminSessionCurrent({ active: false, sessionVersion: 1 }, 1)).toBe(false)
  })

  it("returns false when session version does not match", () => {
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 5 }, 4)).toBe(false)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 5 }, 6)).toBe(false)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 5 }, 0)).toBe(false)
  })

  it("returns false when token version is not an integer", () => {
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 5 }, "5")).toBe(false)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 5 }, 5.5)).toBe(false)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 5 }, undefined)).toBe(false)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 5 }, null)).toBe(false)
  })

  it("returns false when token version is NaN", () => {
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 5 }, NaN)).toBe(false)
  })

  it("handles edge case: version 0 matches when expected", () => {
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 0 }, 0)).toBe(true)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 0 }, 1)).toBe(false)
  })

  it("handles edge case: inactive with version 0", () => {
    expect(isAdminSessionCurrent({ active: false, sessionVersion: 0 }, 0)).toBe(false)
  })
})

describe("Forge mutating method detection", () => {
  it("classifies POST, PATCH, DELETE as mutating", () => {
    expect(isForgeMutatingMethod("POST")).toBe(true)
    expect(isForgeMutatingMethod("PATCH")).toBe(true)
    expect(isForgeMutatingMethod("DELETE")).toBe(true)
  })

  it("classifies GET, HEAD, OPTIONS as non-mutating", () => {
    expect(isForgeMutatingMethod("GET")).toBe(false)
    expect(isForgeMutatingMethod("HEAD")).toBe(false)
    expect(isForgeMutatingMethod("OPTIONS")).toBe(false)
  })

  it("is case sensitive (UPPER CASE expected)", () => {
    expect(isForgeMutatingMethod("post")).toBe(false)
    expect(isForgeMutatingMethod("Post")).toBe(false)
  })
})

describe("Forge task endpoint detection", () => {
  it("matches known task-generating paths", () => {
    expect(isForgeTaskEndpoint("/api/forge/ai/test")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/research")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/copy")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/design")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/sitemap")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/qa")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/generate-site")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/visual-critique")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/visual-qa")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/accessibility")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/seo")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/export")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/preview")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/proposal")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/workspace")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/command-chat")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/deploy")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/component-spec")).toBe(true)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/copy-quality")).toBe(true)
  })

  it("does not match non-task paths within /api/forge", () => {
    expect(isForgeTaskEndpoint("/api/forge/projects")).toBe(false)
    expect(isForgeTaskEndpoint("/api/forge/projects/1")).toBe(false)
    expect(isForgeTaskEndpoint("/api/forge/ai-usage")).toBe(false)
    expect(isForgeTaskEndpoint("/api/forge/jobs/run")).toBe(false)
    expect(isForgeTaskEndpoint("/api/forge/projects/1/integrations/resend")).toBe(false)
  })

  it("does not match paths outside /api/forge", () => {
    expect(isForgeTaskEndpoint("/api/prospects")).toBe(false)
    expect(isForgeTaskEndpoint("/api/clients")).toBe(false)
    expect(isForgeTaskEndpoint("/api/forge-other")).toBe(false)
  })
})

describe("Forge rate limit key construction", () => {
  it("prefers the stable persisted user id over mutable identity attributes", () => {
    expect(resolveForgeRateLimitActor({ userId: "user-123", email: "changed@example.com", forwardedFor: "203.0.113.1" })).toBe("user-123")
    expect(resolveForgeRateLimitActor({ email: "admin@example.com", forwardedFor: "203.0.113.1" })).toBe("admin@example.com")
    expect(resolveForgeRateLimitActor({})).toBe("admin")
  })

  it("includes bucket, actor, method and pathname", () => {
    const key = buildForgeRateLimitKey({
      actor: "admin@example.com",
      method: "POST",
      pathname: "/api/forge/projects/1/research",
      bucket: "task",
    })
    expect(key).toBe("task:admin@example.com:POST:/api/forge/projects/1/research")
  })

  it("falls back to 'anonymous' for null/undefined actor", () => {
    const key = buildForgeRateLimitKey({
      actor: null,
      method: "POST",
      pathname: "/api/forge/projects/1/qa",
      bucket: "mutation",
    })
    expect(key).toBe("mutation:anonymous:POST:/api/forge/projects/1/qa")
  })
})

describe("Forge rate limit config resolution", () => {
  it("uses defaults when no env variables are set", () => {
    const config = resolveForgeRateLimitConfig({})
    expect(config.windowMs).toBe(60_000)
    expect(config.mutationLimit).toBe(30)
    expect(config.taskLimit).toBe(10)
  })

  it("reads positive integer overrides from env", () => {
    const config = resolveForgeRateLimitConfig({
      FORGE_RATE_LIMIT_WINDOW_MS: "120000",
      FORGE_MUTATION_RATE_LIMIT: "15",
      FORGE_TASK_RATE_LIMIT: "5",
    })
    expect(config.windowMs).toBe(120_000)
    expect(config.mutationLimit).toBe(15)
    expect(config.taskLimit).toBe(5)
  })

  it("ignores non-numeric env values and uses defaults", () => {
    const config = resolveForgeRateLimitConfig({
      FORGE_MUTATION_RATE_LIMIT: "abc",
      FORGE_TASK_RATE_LIMIT: "",
    })
    expect(config.mutationLimit).toBe(30)
    expect(config.taskLimit).toBe(10)
  })

  it("ignores zero and negative values and uses defaults", () => {
    const config = resolveForgeRateLimitConfig({
      FORGE_MUTATION_RATE_LIMIT: "0",
      FORGE_TASK_RATE_LIMIT: "-5",
    })
    expect(config.mutationLimit).toBe(30)
    expect(config.taskLimit).toBe(10)
  })
})

describe("Forge rate limit enforcement", () => {
  const windowMs = 60_000
  const limit = 3

  function freshStore() {
    return new Map() as ForgeRateLimitStore
  }

  it("allows the first request", () => {
    const store = freshStore()
    const result = checkForgeRateLimit(store, "key1", limit, windowMs, 1000)
    expect(result.ok).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it("allows requests up to the limit", () => {
    const store = freshStore()
    for (let i = 0; i < limit; i++) {
      const result = checkForgeRateLimit(store, "key1", limit, windowMs, 1000)
      expect(result.ok).toBe(true)
    }
  })

  it("rejects requests that exceed the limit", () => {
    const store = freshStore()
    for (let i = 0; i < limit; i++) {
      checkForgeRateLimit(store, "key1", limit, windowMs, 1000)
    }
    const blocked = checkForgeRateLimit(store, "key1", limit, windowMs, 1000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it("resets the window after the window expires", () => {
    const store = freshStore()
    for (let i = 0; i < limit; i++) {
      checkForgeRateLimit(store, "key1", limit, windowMs, 0)
    }
    const afterExpiry = checkForgeRateLimit(store, "key1", limit, windowMs, windowMs + 1)
    expect(afterExpiry.ok).toBe(true)
    expect(afterExpiry.remaining).toBe(2)
  })

  it("isolates rate limits per key", () => {
    const store = freshStore()
    for (let i = 0; i < limit; i++) {
      checkForgeRateLimit(store, "user-a", limit, windowMs, 1000)
    }
    const resultB = checkForgeRateLimit(store, "user-b", limit, windowMs, 1000)
    expect(resultB.ok).toBe(true)

    const blockedA = checkForgeRateLimit(store, "user-a", limit, windowMs, 1000)
    expect(blockedA.ok).toBe(false)
  })

  it("provides retryAfterMs as a positive number when blocked", () => {
    const store = freshStore()
    for (let i = 0; i < limit; i++) {
      checkForgeRateLimit(store, "key1", limit, windowMs, 0)
    }
    const blocked = checkForgeRateLimit(store, "key1", limit, windowMs, 100)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
  })

  it("retryAfterMs correctly reports time until window reset", () => {
    const store = freshStore()
    const now = 5000
    checkForgeRateLimit(store, "key1", limit, windowMs, now)
    checkForgeRateLimit(store, "key1", limit, windowMs, now)
    checkForgeRateLimit(store, "key1", limit, windowMs, now)
    const blocked = checkForgeRateLimit(store, "key1", limit, windowMs, now + 30000)
    expect(blocked.ok).toBe(false)
    const resetAt = (blocked as { resetAt: number }).resetAt
    const retryAfterMs = (blocked as { retryAfterMs: number }).retryAfterMs
    const expectedRemaining = resetAt - (now + 30000)
    expect(retryAfterMs).toBe(expectedRemaining)
  })

  it("handle edge case: limit of 1 allows exactly one request", () => {
    const store = freshStore()
    const result = checkForgeRateLimit(store, "key1", 1, windowMs, 1000)
    expect(result.ok).toBe(true)
    const blocked = checkForgeRateLimit(store, "key1", 1, windowMs, 1000)
    expect(blocked.ok).toBe(false)
  })
})

describe("Forge rate limit bypass (middleware fail-open pattern)", () => {
  it("rate limit key construction never throws for any input", () => {
    expect(() => buildForgeRateLimitKey({ actor: undefined, method: "POST", pathname: "/api/forge/test", bucket: "mutation" })).not.toThrow()
    expect(() => buildForgeRateLimitKey({ actor: "", method: "POST", pathname: "", bucket: "mutation" })).not.toThrow()
    expect(() => buildForgeRateLimitKey({ actor: "a".repeat(1000), method: "PATCH", pathname: "/" + "x".repeat(500), bucket: "task" })).not.toThrow()
  })

  it("checkForgeRateLimit never throws", () => {
    const store = new Map()
    expect(() => checkForgeRateLimit(store, "", 1, 0, 0)).not.toThrow()
    expect(() => checkForgeRateLimit(store, "key", 0, 60000, 0)).not.toThrow()
    expect(() => checkForgeRateLimit(store, "key", -1, 60000, 0)).not.toThrow()
  })
})
