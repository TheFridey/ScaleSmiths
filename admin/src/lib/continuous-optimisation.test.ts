import { describe, expect, it } from "vitest"
import { buildContinuousOptimisationProposals, didProposalImproveMetric } from "./continuous-optimisation"
import type { WebsiteOutcomeEvaluation, WebsiteOutcomeFinding } from "./website-outcome-evaluator"

function finding(input: Partial<WebsiteOutcomeFinding> & Pick<WebsiteOutcomeFinding, "category" | "conclusion">): WebsiteOutcomeFinding {
  return {
    category: input.category,
    severity: input.severity ?? "concern",
    conclusion: input.conclusion,
    reasoning: input.reasoning ?? ["Evidence-backed finding."],
    evidence: input.evidence ?? [{
      label: "Conversion rate",
      href: "/clients/42/analytics",
      recordType: "client_analytics_daily_metrics",
      recordId: "metric-1",
      metric: "conversionRate",
      value: "0.6%",
      sourceAttribution: "Approved aggregate analytics",
    }],
    confidence: input.confidence ?? "medium",
    causationClaimed: false,
  }
}

function outcome(overrides: Partial<WebsiteOutcomeEvaluation> = {}): WebsiteOutcomeEvaluation {
  return {
    generatedAt: "2026-07-13T00:00:00.000Z",
    clientId: 42,
    intendedConversionStrategy: "Generate qualified quote requests.",
    strongEvidence: [],
    weakSignals: [],
    hypotheses: [],
    recommendedInvestigations: [],
    suggestedImprovements: [],
    requiredClientDecisions: [],
    incompleteOrBiasedData: [],
    overallConfidence: "medium",
    ...overrides,
  }
}

describe("continuous optimisation proposals", () => {
  it("does not generate proposals for non-retainer clients", () => {
    const proposals = buildContinuousOptimisationProposals({
      clientId: 42,
      clientName: "Example Ltd",
      isRetainerClient: false,
      outcome: outcome({ suggestedImprovements: [finding({ category: "core_web_vitals", conclusion: "LCP is slow." })] }),
    })

    expect(proposals).toEqual([])
  })

  it("creates controlled proposals from approved outcome evidence", () => {
    const proposals = buildContinuousOptimisationProposals({
      clientId: 42,
      clientName: "Example Ltd",
      isRetainerClient: true,
      outcome: outcome({
        suggestedImprovements: [
          finding({ category: "form_completion", conclusion: "Form submissions are weak." }),
          finding({ category: "core_web_vitals", conclusion: "LCP is slow.", evidence: [{ label: "LCP", href: "/clients/42/analytics", recordType: "metric", recordId: "lcp", metric: "lcpP75Ms", value: "3200", sourceAttribution: "CrUX aggregate" }] }),
          finding({ category: "search_visibility", conclusion: "Search CTR is weak." }),
        ],
        recommendedInvestigations: [finding({ category: "data_quality", conclusion: "Conversion tracking is missing.", evidence: [] })],
      }),
    })

    expect(proposals.map((proposal) => proposal.key)).toEqual([
      "42:improve-cta-conversion",
      "42:improve-page-speed",
      "42:strengthen-local-seo",
      "42:add-tracking-conversion-tracking-is-missing",
    ])
    expect(proposals.every((proposal) => proposal.requiredApproval.includes("approval"))).toBe(true)
    expect(proposals.every((proposal) => proposal.rollbackPlan.length > 0)).toBe(true)
    expect(proposals.every((proposal) => proposal.validationMethod.length > 0)).toBe(true)
  })

  it("deduplicates repeated proposal categories", () => {
    const proposals = buildContinuousOptimisationProposals({
      clientId: 42,
      clientName: "Example Ltd",
      isRetainerClient: true,
      outcome: outcome({
        hypotheses: [
          finding({ category: "cta_performance", conclusion: "CTA may be weak." }),
          finding({ category: "actual_conversions", conclusion: "Conversion rate is weak." }),
        ],
      }),
    })

    expect(proposals).toHaveLength(1)
    expect(proposals[0].key).toBe("42:improve-cta-conversion")
  })

  it("measures improvement direction by metric type", () => {
    expect(didProposalImproveMetric({ baselineValue: 10, measuredValue: 14, targetMetric: "conversionEvents" })).toBe(true)
    expect(didProposalImproveMetric({ baselineValue: 3200, measuredValue: 2400, targetMetric: "lcpP75Ms" })).toBe(true)
    expect(didProposalImproveMetric({ baselineValue: 2, measuredValue: 4, targetMetric: "errorCount" })).toBe(false)
    expect(didProposalImproveMetric({ baselineValue: null, measuredValue: 4, targetMetric: "searchClicks" })).toBeNull()
  })
})
