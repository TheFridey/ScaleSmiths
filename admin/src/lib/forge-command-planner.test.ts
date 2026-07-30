import { describe, expect, it } from "vitest"
import {
  planForgeCommandHeuristic,
  validateForgeCommandPlan,
  type ForgeCommandPlan,
  type ForgeCommandPlannerContext,
} from "./forge-command-chat"

function context(overrides: Partial<ForgeCommandPlannerContext> = {}): ForgeCommandPlannerContext {
  return {
    projectId: 42,
    projectOwned: true,
    archived: false,
    run: null,
    artifacts: new Set(["handover_doc", "sitemap", "copy_doc", "generated_code", "export_record"]),
    integrations: new Set(),
    budgetBlocked: false,
    deploymentApproved: false,
    ...overrides,
  }
}

const failedRun: NonNullable<ForgeCommandPlannerContext["run"]> = {
  id: 7,
  status: "failed",
  currentStage: "functional_qa",
  steps: [
    { stage: "brief", status: "completed", approvalRequired: true },
    { stage: "functional_qa", status: "failed", approvalRequired: false },
  ],
}

describe("Forge constrained command planner", () => {
  it("plans a complete first draft in production order behind confirmation", () => {
    const plannerContext = context()
    const plan = planForgeCommandHeuristic("Build the complete first draft.", plannerContext)
    const validation = validateForgeCommandPlan(plan, plannerContext)

    expect(plan.intent).toBe("build_complete_draft")
    expect(plan.affectedStages).toEqual(expect.arrayContaining(["research", "code_generation", "preview"]))
    expect(plan.requiredApprovals).toContain("Preview/design approval")
    expect(validation).toMatchObject({ legal: true, requiresConfirmation: true })
  })

  it("resumes a persisted run without proposing a new standalone job", () => {
    const plannerContext = context({ run: { ...failedRun, status: "paused" } })
    const plan = planForgeCommandHeuristic("Continue from where it stopped.", plannerContext)

    expect(plan.intent).toBe("continue_current_run")
    expect(plan.affectedStages).toEqual(["functional_qa"])
    expect(validateForgeCommandPlan(plan, plannerContext).legal).toBe(true)
  })

  it("explains a failed run without requiring execution confirmation", () => {
    const plannerContext = context({ run: failedRun })
    const plan = planForgeCommandHeuristic("Why has this failed?", plannerContext)
    const validation = validateForgeCommandPlan(plan, plannerContext)

    expect(plan.intent).toBe("explain_current_state")
    expect(validation).toMatchObject({ legal: true, requiresConfirmation: false })
    expect(plan.userVisibleOutcome).toContain("explanation")
  })

  it("limits client feedback invalidation to affected downstream artifacts", () => {
    const plannerContext = context({ run: { ...failedRun, status: "paused" } })
    const plan = planForgeCommandHeuristic(
      "Apply this client feedback: update the About page copy but preserve the approved design.",
      plannerContext,
    )

    expect(plan.intent).toBe("apply_feedback")
    expect(plan.affectedStages[0]).toBe("copy")
    expect(plan.affectedStages).not.toContain("research")
    expect(plan.invalidatedArtifacts).toContain("copy_doc")
    expect(plan.invalidatedArtifacts).toContain("generated_code")
    expect(plan.invalidatedArtifacts).not.toContain("research_report")
  })

  it("requires explicit confirmation for guarded multi-stage execution", () => {
    const plannerContext = context({ run: { ...failedRun, status: "paused" } })
    const plan = planForgeCommandHeuristic("Apply client feedback to the homepage design.", plannerContext)

    expect(validateForgeCommandPlan(plan, plannerContext).requiresConfirmation).toBe(true)
  })

  it("rejects illegal plans with invented paths and out-of-order stages", () => {
    const plannerContext = context()
    const original = planForgeCommandHeuristic("Build the complete first draft.", plannerContext)
    const illegal: ForgeCommandPlan = {
      ...original,
      affectedStages: ["preview", "copy"],
      steps: [{ ...original.steps[0], params: { filePath: "/tmp/invented-site/page.tsx" } }],
    }
    const validation = validateForgeCommandPlan(illegal, plannerContext)

    expect(validation.legal).toBe(false)
    expect(validation.errors).toEqual(expect.arrayContaining([
      "Plans may not invent or accept filesystem paths.",
      "Plan stages are not in legal production order.",
    ]))
  })

  it("rejects every production plan for an archived project", () => {
    const plannerContext = context({ archived: true })
    const plan = planForgeCommandHeuristic("Build the complete first draft.", plannerContext)

    expect(validateForgeCommandPlan(plan, plannerContext).errors).toContain(
      "Archived projects cannot run production commands.",
    )
  })

  it("requires clarification when confidence is too low", () => {
    const plannerContext = context()
    const plan = planForgeCommandHeuristic("build", plannerContext)
    const validation = validateForgeCommandPlan(plan, plannerContext)

    expect(plan.confidence).toBeLessThan(.55)
    expect(validation.errors).toContain("Plan confidence is too low; clarification is required.")
  })

  it("rejects feedback invalidation while an affected stage is executing", () => {
    const plannerContext = context({
      run: {
        id: 9,
        status: "running",
        currentStage: "copy",
        steps: [{ stage: "copy", status: "running", approvalRequired: false }],
      },
    })
    const plan = planForgeCommandHeuristic("Apply client feedback to the homepage copy.", plannerContext)

    expect(validateForgeCommandPlan(plan, plannerContext).errors[0]).toContain("queued or running")
  })
})
