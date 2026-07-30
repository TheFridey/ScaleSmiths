import { describe, expect, it } from "vitest"
import {
  FORGE_RUN_STAGES,
  FORGE_RUN_STAGE_REGISTRY,
  estimateForgeRunCost,
  evaluateStageOptionality,
  getForgeRunStage,
  type ForgeStageEvaluationContext,
} from "./forge-run-stages"

const baseContext: ForgeStageEvaluationContext = {
  mode: "standard",
  policy: {},
  availableArtifacts: new Set(),
  latestQaFailed: false,
  latestQaPassed: false,
  previewAvailable: false,
  deploymentReady: false,
}

describe("Forge run stage registry", () => {
  it("defines the standard production sequence exactly once and in order", () => {
    expect(FORGE_RUN_STAGE_REGISTRY.map((stage) => stage.key)).toEqual(FORGE_RUN_STAGES)
    expect(FORGE_RUN_STAGE_REGISTRY.map((stage) => stage.order)).toEqual(
      FORGE_RUN_STAGES.map((_, index) => index + 1),
    )
    expect(new Set(FORGE_RUN_STAGES).size).toBe(FORGE_RUN_STAGES.length)
  })

  it("keeps only the three operator gates human-approved", () => {
    expect(FORGE_RUN_STAGE_REGISTRY.filter((stage) => stage.approvalPolicy === "human").map((stage) => stage.key))
      .toEqual(["brief", "client_review", "deploy_readiness"])
  })

  it("skips optional stages explicitly with a recorded reason", () => {
    const repair = getForgeRunStage("repair")
    const clientReview = getForgeRunStage("client_review")
    expect(repair).not.toBeNull()
    expect(clientReview).not.toBeNull()
    expect(evaluateStageOptionality(repair!, baseContext)).toBe("Functional QA has no recorded failure.")
    expect(evaluateStageOptionality(repair!, { ...baseContext, latestQaFailed: true })).toBeNull()
    expect(evaluateStageOptionality(clientReview!, { ...baseContext, policy: { requireClientReview: false } }))
      .toBe("Client review disabled by recorded run policy.")
  })

  it("declares downstream invalidation and excludes policy-skipped work from estimates", () => {
    expect(getForgeRunStage("copy")?.invalidatedDownstreamStages).toContain("code_generation")
    expect(getForgeRunStage("copy")?.invalidatedDownstreamStages).not.toContain("research")
    expect(estimateForgeRunCost({ skipStages: { research: "Existing approved research remains valid." } }))
      .toBeLessThan(estimateForgeRunCost())
  })

  it("reports missing prerequisites and completion outputs", () => {
    const copy = getForgeRunStage("copy")
    expect(copy?.readinessEvaluator(baseContext)).toMatchObject({ ready: false })
    const ready = { ...baseContext, availableArtifacts: new Set(["sitemap", "research_report", "copy_doc"] as const) }
    expect(copy?.readinessEvaluator(ready)).toEqual({ ready: true, reason: null })
    expect(copy?.completionEvaluator(ready)).toEqual({ ready: true, reason: null })
  })
})
