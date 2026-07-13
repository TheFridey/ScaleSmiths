import { describe, expect, it } from "vitest"
import { summarizeClientAnalytics, type ClientAnalyticsDailyMetric } from "./client-analytics"
import { evaluateWebsiteOutcome } from "./website-outcome-evaluator"

function evaluation(metrics: ClientAnalyticsDailyMetric[]) {
  return evaluateWebsiteOutcome({
    clientId: 1,
    clientName: "Client",
    intendedConversionStrategy: "Increase qualified enquiries",
    analytics: summarizeClientAnalytics({ configs: [{ id: 1, clientId: 1, provider: "manual", displayName: "Manual", propertyId: null, consentGranted: true, consentNotes: null, retentionDays: 395, enabled: true, scopes: [], sourceAttribution: "Manual", hasCredentials: false, lastIngestedAt: null }], metrics }),
    metrics,
    generatedAt: "2026-07-13T09:00:00.000Z",
  })
}

describe("website outcome evaluator", () => {
  it("reports strong evidence without claiming causation", () => {
    const result = evaluation([{ clientId: 1, metricDate: "2026-07-12T00:00:00.000Z", source: "manual", sourceAttribution: "Manual GA4 export", sessions: 500, conversionEvents: 25, formSubmissions: 12 }])

    expect(result.strongEvidence.some((finding) => finding.category === "actual_conversions")).toBe(true)
    expect(result.strongEvidence.every((finding) => finding.causationClaimed === false)).toBe(true)
    expect(result.strongEvidence.flatMap((finding) => finding.evidence).some((evidence) => evidence.sourceAttribution === "Manual GA4 export")).toBe(true)
  })

  it("flags incomplete page and device data instead of inventing conclusions", () => {
    const result = evaluation([{ clientId: 1, metricDate: "2026-07-12T00:00:00.000Z", source: "manual", sourceAttribution: "Manual", sessions: 50 }])

    expect(result.incompleteOrBiasedData.some((finding) => finding.category === "high_traffic_low_conversion")).toBe(true)
    expect(result.incompleteOrBiasedData.some((finding) => finding.category === "device_performance")).toBe(true)
  })

  it("creates low-confidence hypotheses for weak conversion data", () => {
    const result = evaluation([{ clientId: 1, metricDate: "2026-07-12T00:00:00.000Z", source: "manual", sourceAttribution: "Manual", sessions: 300, conversionEvents: 1 }])

    expect(result.hypotheses).toEqual(expect.arrayContaining([expect.objectContaining({ category: "cta_performance", confidence: "low" })]))
  })

  it("requires a client decision when conversion strategy is missing", () => {
    const metrics: ClientAnalyticsDailyMetric[] = [{ clientId: 1, metricDate: "2026-07-12T00:00:00.000Z", source: "manual", sourceAttribution: "Manual", sessions: 20 }]
    const result = evaluateWebsiteOutcome({ clientId: 1, clientName: "Client", intendedConversionStrategy: null, analytics: summarizeClientAnalytics({ configs: [], metrics }), metrics })

    expect(result.requiredClientDecisions).toEqual(expect.arrayContaining([expect.objectContaining({ category: "conversion_strategy" })]))
    expect(result.overallConfidence).toBe("low")
  })
})
