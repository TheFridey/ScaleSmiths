import { describe, expect, it } from "vitest"
import {
  FORGE_DRAFT_BUDGET_USD,
  summarizeForgeCostQuality,
  type ForgeCostQualityInput,
} from "./forge-cost-quality"

function baseInput(overrides: Partial<ForgeCostQualityInput> = {}): ForgeCostQualityInput {
  return {
    stageCosts: [
      { stage: "copy", costUsd: 0.08, tokens: 4000, calls: 1 },
      { stage: "design", costUsd: 0.05, tokens: 2200, calls: 1 },
      { stage: "frontend", costUsd: 0.04, tokens: 1800, calls: 1 },
      { stage: "research", costUsd: 0.02, tokens: 1500, calls: 1 },
    ],
    retries: 1,
    models: [{ provider: "anthropic", model: "claude-haiku-4-5" }],
    qaStatus: "failed",
    readinessScore: 68,
    readinessBand: "needs_review",
    clientReady: false,
    qaFailures: 2,
    repairPasses: 1,
    buildDurationMs: 4200,
    ...overrides,
  }
}

describe("summarizeForgeCostQuality", () => {
  it("tracks total cost, per-stage breakdown (sorted), retries, QA and build signals", () => {
    const summary = summarizeForgeCostQuality(baseInput())

    expect(summary.totalCostUsd).toBeCloseTo(0.19, 5)
    expect(summary.costSoFarUsd).toBe(summary.totalCostUsd)
    expect(summary.costPerStage.map((stage) => stage.stage)).toEqual(["copy", "design", "frontend", "research"])
    expect(summary.retries).toBe(1)
    expect(summary.qaFailures).toBe(2)
    expect(summary.repairPasses).toBe(1)
    expect(summary.buildDurationMs).toBe(4200)
    expect(summary.qualityScore).toBe(68)
    expect(summary.models).toEqual([{ provider: "anthropic", model: "claude-haiku-4-5" }])
  })

  it("estimates improvement cost from the refinement stages", () => {
    const summary = summarizeForgeCostQuality(baseInput())
    // copy (0.08) + design (0.05) + frontend (0.04); seo/qa absent.
    expect(summary.estimatedCostToImproveUsd).toBeCloseTo(0.17, 5)
    expect(summary.refinement.estimatedCostUsd).toBe(summary.estimatedCostToImproveUsd)
  })

  it("falls back to ~60% of spend when no refinement-stage data exists", () => {
    const summary = summarizeForgeCostQuality(baseInput({
      stageCosts: [{ stage: "research", costUsd: 0.1, tokens: 1000, calls: 1 }],
    }))
    expect(summary.estimatedCostToImproveUsd).toBeCloseTo(0.06, 5)
  })

  describe("draft rule", () => {
    it("labels a cheap failing build an acceptable first-pass draft", () => {
      const summary = summarizeForgeCostQuality(baseInput({ qaStatus: "failed" }))
      expect(summary.totalCostUsd).toBeLessThanOrEqual(FORGE_DRAFT_BUDGET_USD)
      expect(summary.draft.isDraft).toBe(true)
      expect(summary.draft.label).toBe("Draft")
      expect(summary.draft.withinFirstPassBudget).toBe(true)
      expect(summary.draft.note).toContain("Acceptable first-pass draft")
    })

    it("flags a failing build that exceeded the first-pass budget", () => {
      const summary = summarizeForgeCostQuality(baseInput({
        stageCosts: [{ stage: "copy", costUsd: 0.45, tokens: 9000, calls: 3 }],
      }))
      expect(summary.draft.isDraft).toBe(true)
      expect(summary.draft.withinFirstPassBudget).toBe(false)
      expect(summary.draft.note).toContain("exceeded")
    })

    it("does not label a build a draft once QA passes", () => {
      const summary = summarizeForgeCostQuality(baseInput({ qaStatus: "passed", clientReady: true, readinessScore: 100, qaFailures: 0 }))
      expect(summary.draft.isDraft).toBe(false)
      expect(summary.draft.label).toBe("Client ready")
      expect(summary.refinement.recommended).toBe(false)
    })

    it("treats a build with no QA run as a draft", () => {
      const summary = summarizeForgeCostQuality(baseInput({ qaStatus: "not_run", readinessScore: null, readinessBand: null, qaFailures: 0, repairPasses: 0, buildDurationMs: null }))
      expect(summary.draft.isDraft).toBe(true)
      expect(summary.draft.label).toBe("Draft (QA not run)")
      expect(summary.refinement.recommended).toBe(false)
      expect(summary.refinement.reason).toContain("Run QA")
    })
  })

  describe("refinement recommendation", () => {
    it("recommends a refinement pass for a strong draft just below client-ready", () => {
      const summary = summarizeForgeCostQuality(baseInput({ qaStatus: "failed", readinessScore: 82 }))
      expect(summary.refinement.recommended).toBe(true)
      expect(summary.refinement.reason).toContain("Strong draft")
    })

    it("recommends fixing blocking checks for an unacceptable build", () => {
      const summary = summarizeForgeCostQuality(baseInput({ qaStatus: "failed", readinessScore: 40 }))
      expect(summary.refinement.recommended).toBe(true)
      expect(summary.refinement.reason).toContain("below acceptable")
    })
  })
})
