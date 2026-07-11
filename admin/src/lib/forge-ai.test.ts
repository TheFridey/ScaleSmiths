import { describe, expect, it } from "vitest"
import { buildForgeTaskOutputMetadata, type ForgeAiResult } from "./forge-ai"

describe("buildForgeTaskOutputMetadata failover", () => {
  it("passes failover info through to task metadata", () => {
    const result: ForgeAiResult = {
      provider: "openai",
      model: "gpt-5.5",
      taskType: "planning",
      data: { ok: true },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      costEstimateUsd: 0,
      latencyMs: 10,
      retries: 0,
      responseId: "x",
      failover: { from: "anthropic", to: "openai", reason: "circuit open (cooling down)" },
    }
    const meta = buildForgeTaskOutputMetadata(result)
    expect((meta.ai as { failover?: unknown }).failover).toEqual({ from: "anthropic", to: "openai", reason: "circuit open (cooling down)" })
  })
})
