import { describe, expect, it, vi } from "vitest"
import { emptyForgeCommandChatState, type ForgeCommandPlannerContext } from "@/lib/forge-command-chat"

class MockForgeAiError extends Error {}

vi.mock("@/lib/server/forge-ai", () => ({
  ForgeAiError: MockForgeAiError,
  runForgeAiJson: vi.fn(async () => {
    throw new MockForgeAiError("Provider unavailable")
  }),
}))

describe("Forge command planner provider fallback", () => {
  it("uses the deterministic heuristic when the configured provider fails", async () => {
    const { planCommand } = await import("./forge-command-router")
    const context: ForgeCommandPlannerContext = {
      projectId: 12,
      projectOwned: true,
      archived: false,
      run: {
        id: 4,
        status: "failed",
        currentStage: "functional_qa",
        steps: [{ stage: "functional_qa", status: "failed", approvalRequired: false }],
      },
      artifacts: new Set(["handover_doc", "generated_code"]),
      integrations: new Set(),
      budgetBlocked: false,
      deploymentApproved: false,
    }
    const plan = await planCommand({
      project: { name: "Acme", businessName: "Acme Ltd", industry: "Trades", status: "active" },
      projectId: 12,
      message: "Fix the failed step and resume.",
      state: emptyForgeCommandChatState(),
      context,
    })

    expect(plan.intent).toBe("resolve_current_failure")
    expect(plan.affectedStages).toEqual(["functional_qa"])
    expect(plan.stopConditions).toContain("Provider or job failure")
  })
})
