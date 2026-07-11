import { describe, expect, it } from "vitest"
import { resolveFailoverTarget } from "./forge-provider-health"

describe("resolveFailoverTarget", () => {
  it("returns null when no allowlist is configured", () => {
    expect(resolveFailoverTarget("anthropic", {})).toBeNull()
  })

  it("returns the permitted alternate when configured", () => {
    const env = { FORGE_AI_FAILOVER_ALLOW: "anthropic:openai,openai:anthropic" }
    expect(resolveFailoverTarget("anthropic", env)).toBe("openai")
    expect(resolveFailoverTarget("openai", env)).toBe("anthropic")
  })

  it("ignores malformed or self-referential pairs", () => {
    expect(resolveFailoverTarget("anthropic", { FORGE_AI_FAILOVER_ALLOW: "anthropic:anthropic" })).toBeNull()
    expect(resolveFailoverTarget("anthropic", { FORGE_AI_FAILOVER_ALLOW: "garbage" })).toBeNull()
    expect(resolveFailoverTarget("anthropic", { FORGE_AI_FAILOVER_ALLOW: "anthropic:mock" })).toBeNull()
  })
})
