import { describe, expect, it } from "vitest"
import { deriveArtifactApprovalSemantics, hasClientDeploymentApproval, isCurrentHumanApprovedArtifact } from "./forge-approval-semantics"

describe("Forge approval semantics", () => {
  it("does not treat policy approval as human approval", () => {
    expect(deriveArtifactApprovalSemantics({ qualityState: "validated", approvalState: "approved", approvalHistory: [{ state: "approved", actor: "forge-run-policy" }] })).toEqual(["generated", "validated", "policy_approved"])
  })

  it("does not treat internal human approval as client approval", () => {
    expect(deriveArtifactApprovalSemantics({ qualityState: "validated", approvalState: "approved", approvalHistory: [{ state: "approved", actor: "operator@example.test" }] })).toEqual(["generated", "validated", "human_approved"])
  })

  it("preserves explicit client approval in audit history", () => {
    expect(deriveArtifactApprovalSemantics({ qualityState: "validated", approvalState: "approved", approvalHistory: [{ state: "approved", actor: "operator@example.test" }, { state: "approved", actor: "client@example.test", approvalScope: "client" }] })).toContain("client_approved")
  })

  it("never treats a superseded artifact as current approved output", () => {
    expect(isCurrentHumanApprovedArtifact({ qualityState: "validated", approvalState: "approved", approvalHistory: [{ state: "approved", actor: "operator@example.test" }], supersededAt: new Date() })).toBe(false)
  })

  it("requires explicit client evidence for final deployment approval", () => {
    expect(hasClientDeploymentApproval("ready_to_deploy", [{ action: "update", metadataJson: {} }])).toBe(false)
    expect(hasClientDeploymentApproval("ready_to_deploy", [{ action: "client_approval_recorded", metadataJson: { approvalScope: "client" } }])).toBe(true)
  })
})
