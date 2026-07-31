import { describe, expect, it } from "vitest"
import { selectStagesToInvalidate, type InvalidationCandidateStep } from "./forge-run-invalidation"
import { getForgeRunStage, type ForgeRunMode, type ForgeRunPolicy, type ForgeStageEvaluationContext } from "./forge-run-stages"

function context(overrides: Partial<ForgeStageEvaluationContext> = {}): ForgeStageEvaluationContext {
  return {
    mode: "standard" as ForgeRunMode,
    policy: {},
    availableArtifacts: new Set<string>(),
    latestQaFailed: false,
    latestQaPassed: true,
    previewAvailable: false,
    deploymentReady: false,
    ...overrides,
  } as ForgeStageEvaluationContext
}

function step(stage: string, overrides: Partial<InvalidationCandidateStep> = {}): InvalidationCandidateStep {
  return { id: Math.abs(hash(stage)), stage, status: "completed", inputHash: "stale", required: true, ...overrides }
}

function hash(value: string) {
  return [...value].reduce((total, character) => total * 31 + character.charCodeAt(0), 7) % 100000
}

/** Every recomputed hash differs from the "stale" fixture, so only the guards decide. */
const changedHash = () => "fresh"
/** Nothing changed. */
const unchangedHash = () => "stale"

const stages = (steps: InvalidationCandidateStep[]) => steps.map((item) => item.stage).sort()

describe("downstream invalidation uses the active run's mode and policy", () => {
  it("5. migration-mode invalidation uses the migration policy", () => {
    const policy: ForgeRunPolicy = {
      migrationProject: true,
      requireClientReview: false,
      skipStages: { research: "Migration reuses the audited source content inventory." },
    }
    const selected = selectStagesToInvalidate({
      changedStage: "copy",
      steps: [step("design_direction"), step("research"), step("client_review", { required: false })],
      context: context({ mode: "migration", policy }),
      policy,
      currentInputHash: changedHash,
    })

    // design_direction consumes copy_doc, so it is genuinely stale.
    expect(stages(selected)).toEqual(["design_direction"])
    // A migration-policy skipped stage is never resurrected...
    expect(stages(selected)).not.toContain("research")
    // ...and client review disabled by this run's policy stays out.
    expect(stages(selected)).not.toContain("client_review")
  })

  it("6. refresh-mode invalidation uses the refresh policy", () => {
    const policy: ForgeRunPolicy = { requireClientReview: true, skipStages: {} }
    const selected = selectStagesToInvalidate({
      changedStage: "copy",
      steps: [step("design_direction"), step("component_specification"), step("code_generation")],
      context: context({ mode: "refresh", policy }),
      policy,
      currentInputHash: changedHash,
    })

    // All three consume copy_doc under a refresh run with nothing skipped.
    expect(stages(selected)).toEqual(["code_generation", "component_specification", "design_direction"])
  })

  it("a policy-skipped stage is not invalidated even when its inputs changed", () => {
    const policy: ForgeRunPolicy = { skipStages: { design_direction: "Existing approved design direction is retained for this refresh." } }
    const selected = selectStagesToInvalidate({
      changedStage: "copy",
      steps: [step("design_direction")],
      context: context({ mode: "refresh", policy }),
      policy,
      currentInputHash: changedHash,
    })
    expect(selected).toEqual([])
  })

  it("7. a skipped stage remains skipped when unrelated upstream artifacts change", () => {
    const policy: ForgeRunPolicy = {}
    // Repair is optional while QA has not failed, and is already skipped.
    const selected = selectStagesToInvalidate({
      changedStage: "copy",
      steps: [
        step("repair", { status: "skipped", required: false }),
        step("visual_qa", { status: "skipped", required: false }),
      ],
      context: context({ latestQaFailed: false, policy }),
      policy,
      currentInputHash: changedHash,
    })
    expect(selected).toEqual([])
  })

  it("does not invalidate a completed stage merely because an optional stage is absent", () => {
    const policy: ForgeRunPolicy = {}
    // functional_qa requires generated_code only. Copy changing must not touch it.
    const selected = selectStagesToInvalidate({
      changedStage: "copy",
      steps: [step("functional_qa"), step("accessibility"), step("preview", { required: false })],
      context: context({ latestQaFailed: false, policy }),
      policy,
      currentInputHash: changedHash,
    })
    expect(selected).toEqual([])
  })

  it("8. changed approved copy invalidates design and downstream output", () => {
    const policy: ForgeRunPolicy = {}
    const selected = selectStagesToInvalidate({
      changedStage: "copy",
      steps: [
        step("design_direction"),
        step("component_specification"),
        step("code_generation"),
        step("seo_schema"),
        step("consistency_review"),
      ],
      context: context({ policy }),
      policy,
      currentInputHash: changedHash,
    })

    // Every one of these declares copy_doc as a required input.
    expect(stages(selected)).toEqual([
      "code_generation",
      "component_specification",
      "consistency_review",
      "design_direction",
      "seo_schema",
    ])
  })

  it("9. changed design does not invalidate approved research or copy", () => {
    const policy: ForgeRunPolicy = {}
    const selected = selectStagesToInvalidate({
      changedStage: "design_direction",
      steps: [step("research"), step("copy"), step("sitemap"), step("design_system")],
      context: context({ policy }),
      policy,
      currentInputHash: changedHash,
    })

    // research, copy and sitemap are upstream of design_direction and must be untouched.
    expect(stages(selected)).toEqual(["design_system"])
    expect(getForgeRunStage("design_system")?.requiredInputs).toContain("design_direction")
  })

  it("invalidates nothing when the recomputed input hash is unchanged", () => {
    const policy: ForgeRunPolicy = {}
    const selected = selectStagesToInvalidate({
      changedStage: "copy",
      steps: [step("design_direction"), step("code_generation")],
      context: context({ policy }),
      policy,
      currentInputHash: unchangedHash,
    })
    expect(selected).toEqual([])
  })

  it("ignores steps that never recorded an input hash or are not in a settled state", () => {
    const policy: ForgeRunPolicy = {}
    const selected = selectStagesToInvalidate({
      changedStage: "copy",
      steps: [
        step("design_direction", { inputHash: null }),
        step("code_generation", { status: "running" }),
        step("component_specification", { status: "pending" }),
      ],
      context: context({ policy }),
      policy,
      currentInputHash: changedHash,
    })
    expect(selected).toEqual([])
  })

  it("invalidates a stage awaiting human approval, which is not yet durable output", () => {
    const policy: ForgeRunPolicy = {}
    const selected = selectStagesToInvalidate({
      changedStage: "copy",
      steps: [step("design_direction", { status: "awaiting_approval" })],
      context: context({ policy }),
      policy,
      currentInputHash: changedHash,
    })
    expect(stages(selected)).toEqual(["design_direction"])
  })
})
