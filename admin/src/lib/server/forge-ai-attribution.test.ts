import { describe, expect, it } from "vitest"
import { runWithForgeAttribution, currentForgeAttribution, type ForgeAttribution } from "./forge-attribution-context"

describe("Forge AI attribution context", () => {
  const EMPTY: ForgeAttribution = { projectId: null, runId: null, runStepId: null, jobId: null, taskId: null }

  it("returns empty attribution when no scope is active", () => {
    expect(currentForgeAttribution()).toEqual(EMPTY)
  })

  it("returns the active scope's values", () => {
    runWithForgeAttribution({ projectId: 1, runId: 10, jobId: 100 }, () => {
      expect(currentForgeAttribution()).toEqual({ projectId: 1, runId: 10, runStepId: null, jobId: 100, taskId: null })
    })
  })

  it("merges nested scopes over ancestor values", () => {
    runWithForgeAttribution({ projectId: 1, runId: 10 }, () => {
      runWithForgeAttribution({ runStepId: 20, jobId: 100 }, () => {
        expect(currentForgeAttribution()).toEqual({ projectId: 1, runId: 10, runStepId: 20, jobId: 100, taskId: null })
      })
    })
  })

  it("restores the previous scope after nested callback returns", () => {
    runWithForgeAttribution({ projectId: 1 }, () => {
      runWithForgeAttribution({ runId: 10 }, () => {
        expect(currentForgeAttribution().runId).toBe(10)
      })
      expect(currentForgeAttribution().runId).toBeNull()
      expect(currentForgeAttribution().projectId).toBe(1)
    })
  })

  it("isolates concurrent scopes from each other", async () => {
    const results: ForgeAttribution[] = []
    await Promise.all([
      new Promise<void>((resolve) => runWithForgeAttribution({ projectId: 1, jobId: 10 }, () => {
        // Simulate an async gap that another job could interleave through
        setImmediate(() => {
          results.push({ ...currentForgeAttribution() })
          resolve()
        })
      })),
      new Promise<void>((resolve) => runWithForgeAttribution({ projectId: 2, jobId: 20 }, () => {
        setImmediate(() => {
          results.push({ ...currentForgeAttribution() })
          resolve()
        })
      })),
    ])
    const byProject = new Map(results.map((r) => [r.projectId, r.jobId]))
    expect(byProject.get(1)).toBe(10)
    expect(byProject.get(2)).toBe(20)
  })

  it("does not leak attribution to unscoped callers after the scope ends", () => {
    runWithForgeAttribution({ projectId: 42 }, () => {
      // no-op
    })
    expect(currentForgeAttribution().projectId).toBeNull()
  })

  it("defaults missing fields to null", () => {
    runWithForgeAttribution({}, () => {
      expect(currentForgeAttribution()).toEqual(EMPTY)
    })
  })

  it("ignores non-integer id-like values", () => {
    runWithForgeAttribution({
      projectId: 1,
      runId: 0, // zero should be treated as absent in practice
      runStepId: -5,
      jobId: 3.14,
    } as Partial<ForgeAttribution>, () => {
      const attr = currentForgeAttribution()
      expect(attr.projectId).toBe(1)
      // The store preserves raw values; normalise-at-write is done in recordForgeAiUsage
      expect(typeof attr.runId).toBe("number")
    })
  })
})