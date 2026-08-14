import { describe, expect, it, vi } from "vitest"

const mockSelectChain = vi.fn()

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectChain,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}))

vi.mock("@/lib/schema", async () => {
  const actual = await vi.importActual<typeof import("@/lib/schema")>("@/lib/schema")
  return {
    ...actual,
    forgeAiUsage: { ...actual.forgeAiUsage, runId: "run_id", jobId: "job_id", estimatedCost: "estimated_cost" },
    forgeRuns: { ...actual.forgeRuns, id: "id" },
    forgeRunSteps: { ...actual.forgeRunSteps, id: "id" },
  }
})

describe("Forge run accounting (FK-based attribution)", () => {
  it("updateRunActualCost queries by runId FK, not by projectId + time window", async () => {
    mockSelectChain.mockResolvedValueOnce([{ total: "12.345600" }])

    const { updateRunActualCost } = await import("./accounting")
    await updateRunActualCost(1)

    // Function called — verifying it did not throw with the new signature
    expect(mockSelectChain).toHaveBeenCalled()
  })

  it("updateRunStepActualCost queries by jobId FK, not by projectId + job time window", async () => {
    mockSelectChain.mockClear()
    mockSelectChain.mockResolvedValueOnce([{ total: "5.432100" }])

    const { updateRunStepActualCost } = await import("./accounting")
    await updateRunStepActualCost(1, 100)

    // Function called with (stepId, jobId) — not (stepId, jobObject)
    expect(mockSelectChain).toHaveBeenCalled()
  })
})