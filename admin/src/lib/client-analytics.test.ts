import { describe, expect, it } from "vitest"
import { minimisedMetric, summarizeClientAnalytics } from "./client-analytics"

describe("client analytics minimisation", () => {
  it("stores daily aggregate metrics and drops unknown raw payload fields", () => {
    const metric = minimisedMetric({
      clientId: 1,
      configId: 2,
      metricDate: "2026-07-13T00:00:00.000Z",
      source: "analytics",
      sourceAttribution: "Manual GA4 export",
      sessions: 12.4,
      conversionEvents: 3,
      rawSummary: { provider: "ga4", note: "ok", userEmail: "person@example.com", nested: { unsafe: true } },
    })

    expect(metric.sessions).toBe(12)
    expect(metric.rawSummary).toEqual({ provider: "ga4", note: "ok" })
  })

  it("reports missing sources instead of inventing unavailable metrics", () => {
    const summary = summarizeClientAnalytics({
      configs: [],
      metrics: [{ clientId: 1, metricDate: "2026-07-13T00:00:00.000Z", source: "manual", sourceAttribution: "Manual", sessions: 10 }],
    })

    expect(summary.totals.sessions).toBe(10)
    expect(summary.totals.searchClicks).toBeNull()
    expect(summary.missingData).toContain("Search impressions/clicks are not connected.")
    expect(summary.missingData).toContain("Core Web Vitals are not connected.")
  })

  it("calculates uptime only from uptime checks and failures", () => {
    const summary = summarizeClientAnalytics({
      configs: [],
      metrics: [{ clientId: 1, metricDate: "2026-07-13T00:00:00.000Z", source: "uptime", sourceAttribution: "Monitor", uptimeChecks: 100, uptimeFailures: 1 }],
    })

    expect(summary.totals.uptimePercent).toBe(99)
  })
})
