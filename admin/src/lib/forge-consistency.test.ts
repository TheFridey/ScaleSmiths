import { describe, expect, it } from "vitest"
import { evaluateForgeArtifactConsistency, type ForgeConsistencyArtifactInput } from "./forge-consistency"

function artifact(overrides: Partial<ForgeConsistencyArtifactInput> & Pick<ForgeConsistencyArtifactInput, "id" | "type">): ForgeConsistencyArtifactInput {
  return { title: overrides.type, version: 1, content: "", metadataJson: {}, outputHash: `hash-${overrides.id}`, upstreamArtifactIds: [], upstreamArtifactHashes: {}, qualityState: "validated", approvalState: "approved", supersededAt: null, ...overrides }
}

describe("cross-artifact consistency evaluator", () => {
  it("flags conflicting facts, missing trust/legal signals, and never mutates facts", () => {
    const report = evaluateForgeArtifactConsistency([
      artifact({ id: 1, type: "sitemap", content: "path: /\npath: /services\nphone: 01234 567890" }),
      artifact({ id: 2, type: "copy_doc", content: "Services: roof repair. Call 01999 111222. Get a quote." }),
    ], new Date("2026-01-01T00:00:00Z"))
    expect(report.clientFactsModified).toBe(false)
    expect(report.findings.map((finding) => finding.category)).toEqual(expect.arrayContaining(["conflicting_phone", "missing_legal_pages", "missing_trust_signals"]))
    expect(report.findings.every((finding) => !finding.automaticFixEligible && finding.humanReviewRequired)).toBe(true)
  })

  it("blocks stale lineage and approved fallback artifacts with version evidence", () => {
    const upstream = artifact({ id: 10, type: "sitemap", title: "Sitemap", version: 1, supersededAt: new Date(), approvalState: "approved" })
    const current = artifact({ id: 11, type: "sitemap", title: "Sitemap", version: 2 })
    const copy = artifact({ id: 20, type: "copy_doc", qualityState: "fallback", upstreamArtifactIds: [10], upstreamArtifactHashes: { "10": upstream.outputHash } })
    const report = evaluateForgeArtifactConsistency([upstream, current, copy])
    expect(report.blocking).toBe(true)
    expect(report.findings.map((finding) => finding.category)).toEqual(expect.arrayContaining(["obsolete_upstream", "unsafe_quality_dependency"]))
    expect(report.findings.find((finding) => finding.category === "obsolete_upstream")?.affectedArtifactVersions).toContainEqual({ artifactId: 20, version: 1 })
  })
})
