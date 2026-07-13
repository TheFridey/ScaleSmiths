import { describe, expect, it } from "vitest"
import { evaluateReleaseGates, OVERRIDABLE_RELEASE_GATES, RELEASE_GATE_KEYS, releaseGateDecisionAllowed, type ReleaseGateDecision, type ReleaseGateEvidence, type ReleaseGateKey } from "./forge-release-gates"

const passingEvidence = (overrides: Partial<ReleaseGateEvidence> = {}): ReleaseGateEvidence => ({
  integrityValid: true, integrityErrors: [], qaCommands: [{ name: "build", status: "passed" }, { name: "typecheck", status: "passed" }, { name: "lint", status: "passed" }],
  accessibilityPassed: true, accessibilityReason: "passed", securityPassed: true, securityReason: "passed", approvedArtifactTypes: ["copy_doc", "design_system"], fallbackDependencies: 0,
  visualQaPassed: true, visualQaReason: "passed", dependencyPolicyPassed: true, dependencyPolicyReason: "passed", migrationRequired: false, candidateApproved: true, ...overrides,
})
const decision = (gateKey: ReleaseGateKey, kind: "approved" | "override" = "approved"): ReleaseGateDecision => ({ gateKey, decision: kind, actorId: "owner@example.test", actorRole: "owner", reason: "Reviewed evidence", decidedAt: "2026-07-13T12:00:00.000Z", candidateWorkspaceHash: "hash" })

describe("Forge release-gate policy", () => {
  it("passes the complete policy with client approval", () => {
    const result = evaluateReleaseGates(passingEvidence(), [decision("client_approval")])
    expect(result.allowed).toBe(true)
    expect(result.gates).toHaveLength(RELEASE_GATE_KEYS.length)
  })

  it.each([
    ["workspace_integrity", { integrityValid: false, integrityErrors: ["hash mismatch"] }], ["build", { qaCommands: [{ name: "typecheck", status: "passed" }, { name: "lint", status: "passed" }] }],
    ["typecheck", { qaCommands: [{ name: "build", status: "passed" }, { name: "lint", status: "passed" }] }], ["lint", { qaCommands: [{ name: "build", status: "passed" }, { name: "typecheck", status: "passed" }] }],
    ["accessibility", { accessibilityPassed: false }], ["security", { securityPassed: false }], ["content_approval", { approvedArtifactTypes: ["design_system"] }],
    ["design_approval", { approvedArtifactTypes: ["copy_doc"] }], ["fallback_warning", { fallbackDependencies: 1 }], ["visual_qa", { visualQaPassed: false }],
    ["release_authorisation", { candidateApproved: false }], ["dependency_policy", { dependencyPolicyPassed: false }],
  ] as Array<[ReleaseGateKey, Partial<ReleaseGateEvidence>]>) ("blocks when %s fails", (key, evidence) => {
    const result = evaluateReleaseGates(passingEvidence(evidence), [decision("client_approval")])
    expect(result.blockers.map((item) => item.key)).toContain(key)
  })

  it("requires migration approval only where applicable", () => {
    expect(evaluateReleaseGates(passingEvidence({ migrationRequired: true }), [decision("client_approval")]).blockers.map((item) => item.key)).toContain("migration_plan")
    expect(evaluateReleaseGates(passingEvidence({ migrationRequired: true }), [decision("client_approval"), decision("migration_plan")]).allowed).toBe(true)
  })

  it.each(RELEASE_GATE_KEYS)("allows overrides only for the explicit owner policy: %s", (key) => {
    expect(releaseGateDecisionAllowed(key, "override", "owner")).toBe(OVERRIDABLE_RELEASE_GATES.has(key))
    expect(releaseGateDecisionAllowed(key, "override", "administrator")).toBe(false)
  })

  it("never permits an integrity override to bypass a hash mismatch", () => {
    const result = evaluateReleaseGates(passingEvidence({ integrityValid: false, integrityErrors: ["workspace hash mismatch"] }), [decision("client_approval"), decision("workspace_integrity", "override")])
    expect(result.allowed).toBe(false)
    expect(result.blockers.map((item) => item.key)).toContain("workspace_integrity")
  })

  it("records override actor, time and reason in the evaluated gate", () => {
    const result = evaluateReleaseGates(passingEvidence({ accessibilityPassed: false }), [decision("client_approval"), decision("accessibility", "override")])
    const gate = result.gates.find((item) => item.key === "accessibility")
    expect(gate).toMatchObject({ status: "overridden", approvalActor: "owner@example.test", approvalTime: "2026-07-13T12:00:00.000Z", approvalReason: "Reviewed evidence" })
  })
})
