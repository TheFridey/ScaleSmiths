import { describe, expect, it } from "vitest"
import { evaluateForgeCopyQuality, readForgeCopyQualityReport, type ForgeCopyQualityReport } from "./forge-copy-quality"
import type { ForgeConsistencyArtifactInput } from "./forge-consistency"

function artifact(input: Partial<ForgeConsistencyArtifactInput> & { id: number; type: string; title: string; content?: string | null; metadataJson?: Record<string, unknown> | null }): ForgeConsistencyArtifactInput {
  return {
    version: 1,
    content: input.content ?? null,
    metadataJson: input.metadataJson ?? null,
    outputHash: `hash-${input.id}`,
    upstreamArtifactIds: [],
    upstreamArtifactHashes: {},
    qualityState: "validated",
    approvalState: "approved",
    supersededAt: null,
    ...input,
  }
}

const approvedFacts = [
  artifact({
    id: 1,
    type: "handover_doc",
    title: "Intake",
    content: "Business name: Oak & Hearth Property Care. Service area: Leeds and Wakefield. Core services: damp repairs, plaster repairs, and rental property maintenance. Proof: before-and-after photos and a two-step survey process.",
  }),
  artifact({
    id: 2,
    type: "research_report",
    title: "Research",
    content: "Customers worry about mess, timescales, response speed, and whether rental repairs will last.",
  }),
]

function copyArtifact(text: string) {
  return artifact({
    id: 3,
    type: "copy_doc",
    title: "Copy Document",
    content: text,
    metadataJson: {
      kind: "forge_copy_document",
      status: "approved",
      approvedCopy: {
        copySummary: "Approved copy",
        pages: [{
          pageTitle: "Home",
          path: "/",
          seoTitle: "Home",
          metaDescription: text,
          h1: "Home",
          heroSubheading: text,
          primaryCta: "Learn more",
          secondaryCta: "Contact us",
          sectionHeadings: ["Intro"],
          sections: [{ heading: "Intro", body: text }],
          faqItems: [],
          trustProofCopy: "",
          serviceDescriptions: [],
          localSeoCopy: text,
        }],
        selfCheck: { status: "pass", flaggedPhrases: [], warnings: [], notes: [] },
      },
    },
  })
}

describe("Forge copy quality evaluator", () => {
  it("flags generic AI language, vague CTAs, repetition, excessive em dashes, and unsupported high-risk claims", () => {
    const report = evaluateForgeCopyQuality([
      ...approvedFacts,
      copyArtifact("Unlock your potential with cutting-edge solutions. We are award-winning and fully insured. Learn more. We help with professional services. We help with professional services. We help with professional services. Local Leeds Leeds Leeds Leeds Leeds Leeds Leeds Leeds Leeds. Clear service — clear process — clear result — clear support — clear value."),
    ], new Date("2026-07-12T12:00:00.000Z"))

    expect(report.kind).toBe("forge_copy_quality_report_v1")
    expect(report.copyArtifactId).toBe(3)
    expect(report.humanReviewRequired).toBe(true)
    expect(report.fabricatedFactsAllowed).toBe(false)
    expect(report.findings.map((finding) => finding.category)).toEqual(expect.arrayContaining([
      "generic_ai_language",
      "unsupported_claim",
      "vague_call_to_action",
      "excessive_repetition",
      "excessive_em_dash",
    ]))
    expect(report.highRiskClaims).toEqual(expect.arrayContaining(["award-winning", "fully insured"]))
    expect(report.suggestedRevisions.join(" ")).toContain("Do not invent testimonials")
    expect(report.scores.evidence).toBeLessThan(70)
  })

  it("uses approved facts and research as source of truth for geography, services, evidence, and objections", () => {
    const report = evaluateForgeCopyQuality([
      ...approvedFacts,
      copyArtifact("Oak & Hearth Property Care handles damp repairs, plaster repairs, and rental property maintenance in Leeds and Wakefield. Request a repair survey and send photos first so the team can advise on cost, timing, mess, and next steps. Before-and-after photos and the two-step survey process explain how the work is checked."),
    ])

    expect(report.findings.find((finding) => finding.category === "missing_geographic_relevance")).toBeUndefined()
    expect(report.findings.find((finding) => finding.category === "missing_service_specificity")).toBeUndefined()
    expect(report.findings.find((finding) => finding.category === "weak_evidence")).toBeUndefined()
    expect(report.scores.specificity).toBeGreaterThanOrEqual(80)
    expect(report.sourceOfTruthArtifactIds).toEqual([1, 2, 3])
  })

  it("requires review when local SEO language lacks approved location facts", () => {
    const report = evaluateForgeCopyQuality([
      artifact({ id: 10, type: "handover_doc", title: "Intake", content: "Business name: Example Ltd. Core services: website design and hosting." }),
      copyArtifact("Example Ltd offers website design and hosting. Our local SEO copy helps local customers across the local service area with local support and local visibility. Get started."),
    ])

    expect(report.findings.map((finding) => finding.category)).toContain("unnatural_local_seo")
    expect(report.findings.map((finding) => finding.category)).toContain("vague_call_to_action")
  })

  it("returns a blocking report when no approved copy exists", () => {
    const report = evaluateForgeCopyQuality(approvedFacts)
    expect(report.copyArtifactId).toBeNull()
    expect(report.humanReviewRequired).toBe(true)
    expect(report.findings[0]).toMatchObject({ severity: "critical", category: "missing_service_specificity" })
  })

  it("reads persisted metadata reports", () => {
    const report = evaluateForgeCopyQuality([...approvedFacts, copyArtifact("Oak & Hearth Property Care offers damp repairs in Leeds. Request a repair survey.")])
    expect(readForgeCopyQualityReport({ report })).toBe(report as ForgeCopyQualityReport)
    expect(readForgeCopyQualityReport({ report: { kind: "other" } })).toBeNull()
  })
})
