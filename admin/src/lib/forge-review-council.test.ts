import { describe, expect, it } from "vitest"
import { buildCanonicalApprovedProjectState, FORGE_REVIEWER_PERSPECTIVES, runDeterministicForgeCouncil, synthesizeForgeCouncil, validateReviewerReport, type ForgeReviewerReport } from "./forge-review-council"
import type { ForgeConsistencyArtifactInput, ForgeConsistencyFinding } from "./forge-consistency"

const artifact = (id: number, type: string, content: string): ForgeConsistencyArtifactInput => ({ id, type, title: type, version: 2, content, metadataJson: {}, outputHash: `hash-${id}`, upstreamArtifactIds: [], upstreamArtifactHashes: {}, qualityState: "validated", approvalState: "approved", supersededAt: null })
const finding = (overrides: Partial<ForgeConsistencyFinding> = {}): ForgeConsistencyFinding => ({ severity: "error", category: "unsupported_claims", evidence: ["Copy says award-winning but approved research has no supporting evidence."], affectedArtifacts: [2], affectedArtifactVersions: [{ artifactId: 2, version: 2 }], recommendedCorrection: "Request evidence or remove the claim.", automaticFixEligible: false, humanReviewRequired: true, confidence: .91, blocking: true, ...overrides })

describe("Forge multi-perspective review council", () => {
  it("uses one canonical approved snapshot and keeps reviewers within remit", () => {
    const canonical = buildCanonicalApprovedProjectState([artifact(1, "research_report", "Business name: Northstar Heating"), artifact(2, "copy_doc", "Company name: Northstar Heating\nAward-winning service")])
    const report = runDeterministicForgeCouncil(canonical, [finding()], new Date("2026-01-02T00:00:00Z"))
    expect(report.reviews.map((review) => review.perspective)).toEqual(FORGE_REVIEWER_PERSPECTIVES)
    expect(new Set(report.reviews.map((review) => review.canonicalSnapshotHash))).toEqual(new Set([canonical.snapshotHash]))
    expect(report.reviews.every((review) => validateReviewerReport(review).valid && !review.inventedFacts)).toBe(true)
    expect(report.reviews.find((review) => review.perspective === "creative_director")?.findings).toHaveLength(0)
    expect(report.reviews.find((review) => review.perspective === "security_reviewer")?.findings[0]).toMatchObject({ category: "unsupported_claims", affectedArtifacts: [{ artifactId: 2, version: 2 }] })
  })

  it("deduplicates categories, identifies conflicts, ranks actions, and preserves high-risk dissent", () => {
    const base = runDeterministicForgeCouncil(buildCanonicalApprovedProjectState([artifact(2, "copy_doc", "Business name: Example")]), [finding({ severity: "critical" })]).reviews
    const industry = base.find((review) => review.perspective === "industry_business_expert")!
    const customer = base.find((review) => review.perspective === "skeptical_prospective_customer")!
    const conflicting: ForgeReviewerReport[] = [industry, { ...customer, findings: customer.findings.map((item) => ({ ...item, recommendation: "Keep the claim but label it clearly.", automaticFixEligible: true, humanDecisionRequired: false })) }]
    const synthesis = synthesizeForgeCouncil(conflicting)
    expect(synthesis.groups).toContainEqual(expect.objectContaining({ category: "unsupported_claims" }))
    expect(synthesis.conflicts).toHaveLength(1)
    expect(synthesis.actionPlan[0]).toMatchObject({ priority: 1, severity: "critical", humanDecisionRequired: true, automaticFixEligible: false })
    expect(synthesis.preservedDissent.length).toBeGreaterThan(0)
  })

  it("rejects out-of-remit or evidence-free reviewer findings", () => {
    const report = runDeterministicForgeCouncil(buildCanonicalApprovedProjectState([artifact(1, "copy_doc", "Business name: Example")]), [finding()]).reviews[0]
    const invalid = { ...report, findings: [{ ...finding(), id: "bad", reviewer: "creative_director" as const, affectedArtifacts: [], category: "unsupported_claims", title: "Bad", recommendationRank: 1, scoreImpact: 1, uncertainty: null, highRiskDissent: false }] }
    expect(validateReviewerReport(invalid).valid).toBe(false)
  })
})
