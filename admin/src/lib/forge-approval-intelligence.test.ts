import { describe, expect, it } from "vitest"
import { appendArtifactDecision, parseForgeArtifactDecision, summarizeForgeApprovalIntelligence } from "./forge-approval-intelligence"

describe("Forge approval intelligence", () => {
  it("parses structured rejection reasons with safety flags", () => {
    const decision = parseForgeArtifactDecision({
      decision: "rejected",
      primaryReason: "Client says the phone number is wrong.",
      category: "factual_accuracy",
      severity: "critical",
      clientCorrection: "Use 0113 000 0000.",
      internalNote: "Verify against intake before regeneration.",
      affectsFutureRegeneration: true,
      projectSpecific: true,
      reusableAcrossProjects: false,
      acceptanceScope: "partial_acceptance",
      pagePath: "/contact",
    }, "editor@example.com", new Date("2026-07-12T10:00:00.000Z"))

    expect(decision).toMatchObject({
      decision: "rejected",
      category: "factual_accuracy",
      severity: "critical",
      clientSuppliedCorrection: "Use 0113 000 0000.",
      projectSpecific: true,
      reusableAcrossProjects: false,
      acceptanceScope: "partial_acceptance",
    })
  })

  it("infers categories and rejects missing rejection reasons", () => {
    expect(parseForgeArtifactDecision({ decision: "rejected", reason: "Generic vague AI output." }, "editor").category).toBe("generic_output")
    expect(() => parseForgeArtifactDecision({ decision: "rejected", reason: "" }, "editor")).toThrow("rejection reason")
  })

  it("appends decisions to metadata and approval history", () => {
    const decision = parseForgeArtifactDecision({ decision: "approved", primaryReason: "Approved after review." }, "editor")
    const state = appendArtifactDecision({}, [], decision)
    expect(state.approvalHistory[0]).toMatchObject({ state: "approved", actor: "editor" })
    expect((state.metadataJson.approvalDecisionHistory as unknown[])).toHaveLength(1)
  })

  it("summarises rejection and approval intelligence without raw client corrections", () => {
    const rejected = parseForgeArtifactDecision({ decision: "rejected", reason: "Wrong address supplied by client.", category: "factual_accuracy", severity: "high" }, "editor", new Date("2026-07-12T10:30:00Z"))
    const approved = parseForgeArtifactDecision({ decision: "approved", primaryReason: "Approved after regeneration." }, "editor", new Date("2026-07-12T11:00:00Z"))
    const report = summarizeForgeApprovalIntelligence([
      { projectId: 1, type: "copy_doc", title: "Copy", approvalState: "rejected", approvalHistory: appendArtifactDecision({}, [], rejected).approvalHistory, provider: "openai", model: "gpt-x", qualityState: "fallback", createdAt: "2026-07-12T10:00:00Z" },
      { projectId: 1, type: "copy_doc", title: "Copy", approvalState: "approved", approvalHistory: appendArtifactDecision({}, [], approved).approvalHistory, provider: "openai", model: "gpt-x", qualityState: "fallback", createdAt: "2026-07-12T10:45:00Z" },
      { projectId: 2, type: "design_direction", title: "Design", approvalState: "approved", approvalHistory: [], provider: "anthropic", model: "claude-x", qualityState: "validated", createdAt: "2026-07-12T09:00:00Z" },
    ], [{ id: 1, projectType: "trades" }, { id: 2, projectType: "saas" }])

    expect(report.mostCommonRejectionReasons[0]).toMatchObject({ value: "wrong address supplied by client.", count: 1 })
    expect(report.rejectionRateByForgeAgent.find((row) => row.value === "copy_doc")?.rate).toBe(0.5)
    expect(report.rejectionRateByProvider.find((row) => row.value === "openai")?.rate).toBe(0.5)
    expect(report.rejectionRateByProjectType.find((row) => row.value === "trades")?.rate).toBe(0.5)
    expect(report.regenerationSuccessRate).toBe(1)
    expect(report.averageRevisionsBeforeApproval).toBe(0.5)
    expect(report.averageTimeToApprovalMinutes).toBe(15)
    expect(report.fallbackOutputApprovalRate).toBe(0.5)
    expect(JSON.stringify(report)).not.toContain("0113")
  })
})
