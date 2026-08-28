import { describe, expect, it } from "vitest"
import { compareDeploymentCandidates, degradedCandidateDependencies, isDeploymentCandidateState, verifyCandidateSnapshot, type CandidateArtifact } from "./forge-deployment-candidates"

const approved = (overrides: Partial<CandidateArtifact> = {}): CandidateArtifact => ({ id: 1, type: "copy_doc", title: "Copy", version: 2, outputHash: "abc", qualityState: "validated", approvalState: "approved", ...overrides })

describe("deployment candidate snapshots", () => {
  it("rejects unknown candidate states", () => expect(isDeploymentCandidateState("deployed")).toBe(false))
  it("verifies workspace and approved artifact hashes", () => {
    expect(verifyCandidateSnapshot({ workspaceHash: "workspace", approvedArtifactsJson: [approved()] }, { workspaceHash: "workspace", artifacts: [approved()] })).toEqual({ valid: true, errors: [] })
  })

  it("rejects changed workspaces and artifacts", () => {
    const result = verifyCandidateSnapshot({ workspaceHash: "old", approvedArtifactsJson: [approved()] }, { workspaceHash: "new", artifacts: [approved({ outputHash: "changed" })] })
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(2)
  })

  it("records fallback and degraded dependencies", () => {
    expect(degradedCandidateDependencies([approved({ qualityState: "fallback" }), approved({ id: 2, qualityState: "degraded" }), approved({ id: 3 })])).toHaveLength(2)
  })

  it("compares workspace, artifact and evidence changes", () => {
    const comparison = compareDeploymentCandidates(
      { workspaceHash: "old", approvedArtifactsJson: [approved()], evidenceJson: { qa: "old" } },
      { workspaceHash: "new", approvedArtifactsJson: [approved({ version: 3 }), approved({ id: 2 })], evidenceJson: { qa: "new" } },
    )
    expect(comparison.workspaceChanged).toBe(true)
    expect(comparison.artifactsAdded.map((item) => item.id)).toEqual([2])
    expect(comparison.artifactsChanged.map((item) => item.id)).toEqual([1])
    expect(comparison.evidenceChanged).toBe(true)
  })
})
