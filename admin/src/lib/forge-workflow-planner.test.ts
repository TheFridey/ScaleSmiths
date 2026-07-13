import { describe, expect, it } from "vitest"
import { canOverridePlannerLimit, planForgeWorkflow } from "./forge-workflow-planner"

describe("adaptive Forge workflow planner", () => {
  it("prioritises clarification and never authorises execution or deployment", () => {
    const plan = planForgeWorkflow({ projectState: "research", contradictoryIntake: ["Two company names"], researchWeaknesses: ["No competitor evidence"] })
    expect(plan.recommendations[0].task).toBe("clarify_intake")
    expect(plan.recommendations.every((item) => item.mayExecuteAutomatically === false)).toBe(true)
    expect(plan.deploymentAllowed).toBe(false)
    expect(plan.terminalCondition).toBe("awaiting_human_facts")
  })

  it("maps quality evidence to deterministic bounded repairs", () => {
    const plan = planForgeWorkflow({ projectState: "qa", copyRejectionCount: 3, mobileFailures: ["Navigation overflows at 390px"], visualQaFailures: ["CTA clipped"] })
    expect(plan.recommendations.map((item) => item.task)).toEqual(["tone_recalibration", "responsive_repair", "design_repair"])
  })

  it("blocks degraded upstream work until review", () => {
    const plan = planForgeWorkflow({ projectState: "copy", degradedUpstreamTaskIds: [42] })
    expect(plan.recommendations[0]).toMatchObject({ task: "review_degraded_upstream", blocksDownstream: true, approvalPolicy: "human_decision" })
    expect(plan.terminalCondition).toBe("awaiting_approval")
  })

  it("enforces loop, cost, runtime, and terminal limits", () => {
    expect(planForgeWorkflow({ projectState: "qa", mobileFailures: ["overflow"], previousTaskCounts: { responsive_repair: 3 } }).terminalCondition).toBe("loop_limit")
    expect(planForgeWorkflow({ projectState: "research", estimatedNextCostUsd: 2 }, { remainingCostUsd: 1 }).terminalCondition).toBe("cost_limit")
    expect(planForgeWorkflow({ projectState: "research", elapsedRuntimeMs: 100 }, { remainingRuntimeMs: 100 }).terminalCondition).toBe("runtime_limit")
    expect(planForgeWorkflow({ projectState: "deployed" }).recommendations).toEqual([])
  })

  it("restricts overrides to privileged actors with meaningful reasons", () => {
    expect(canOverridePlannerLimit("owner", "Client approved one additional repair pass.")).toBe(true)
    expect(canOverridePlannerLimit("developer", "Client approved one additional repair pass.")).toBe(false)
    expect(canOverridePlannerLimit("administrator", "short")).toBe(false)
  })
})
