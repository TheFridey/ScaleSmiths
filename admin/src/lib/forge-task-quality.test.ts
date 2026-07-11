import { describe, expect, it } from "vitest"
import { inferTaskQuality, taskBlocksDeployment } from "./forge-task-quality"

describe("Forge task quality", () => {
  it("honestly classifies mock and unvalidated completion", () => {
    expect(inferTaskQuality({ status: "completed", provider: "mock" })).toBe("fallback")
    expect(inferTaskQuality({ status: "completed", provider: "openai" })).toBe("requires_review")
    expect(inferTaskQuality({ status: "failed" })).toBe("failed")
  })
  it("requires reasoned human approval for degraded output", () => {
    const task = { status: "completed", resultQuality: "fallback" as const, humanApprovalRequired: true, qualityApprovedAt: null, qualityApprovalReason: null }
    expect(taskBlocksDeployment(task)).toBe(true)
    expect(taskBlocksDeployment({ ...task, qualityApprovedAt: new Date(), qualityApprovalReason: "Reviewed against brief" })).toBe(false)
  })
})
