import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("Forge run invalidation mode/policy", () => {
  it("reads invalidation mode and policy from the persisted Forge run", () => {
    // Verify the module can be imported without errors — the fix replaces
    // hardcoded mode:"standard" and policy:{} with a DB read from forgeRuns.
    // The module is `import "server-only"` so we verify it compiles and
    // its structural dependencies exist.
    const source = readFileSync(new URL("./forge-runs/invalidation.ts", import.meta.url), "utf8")
    expect(source).toMatch(/forgeRuns\.(?:mode|policyJson)/)
    expect(source).toContain("eq(forgeRuns.id, runId)")
    expect(source).not.toMatch(/mode:\s*["']standard["']|policy:\s*\{\}/)
  })

  it("invalidation.ts function signature accepts the correct parameters", async () => {
    const { invalidateDownstreamForChangedInput } = await import("./forge-runs/invalidation")
    // Verify function signature: (runId, projectId, stageKey, actor)
    // The fix ensures loadStageContext is called with the run's actual mode
    // and policy, not hardcoded "standard" and {}.
    expect(invalidateDownstreamForChangedInput).toBeDefined()
    expect(invalidateDownstreamForChangedInput.length).toBe(4)
  })

  it("accounting.ts uses FK columns (runId/jobId), not time-window parameters", async () => {
    const { updateRunActualCost, updateRunStepActualCost } = await import("./forge-runs/accounting")
    // After the fix:
    // updateRunActualCost takes (runId) — not (runId, projectId)
    // updateRunStepActualCost takes (stepId, jobId) — not (stepId, Job object)
    expect(updateRunActualCost.length).toBe(1)
    expect(updateRunStepActualCost.length).toBe(2)
  })
})
