import { describe, expect, it } from "vitest"
import { assembleMonthlyClientReport, type MonthlyReportEvidence } from "./monthly-report-generator"

function evidence(overrides: Partial<MonthlyReportEvidence> = {}): MonthlyReportEvidence {
  return {
    schemaVersion: 1,
    assembledAt: "2026-09-01T09:00:00.000Z",
    period: { month: 8, year: 2026, start: "2026-08-01T00:00:00.000Z", end: "2026-09-01T00:00:00.000Z", label: "August 2026" },
    client: { recordId: 7, portalClientId: "acme", name: "Acme & Co" },
    completedWork: [], milestones: [], deployments: [], requestsResolved: [], analytics: null,
    recommendations: [], nextMonthPriorities: [], financialActivity: [], sourceAvailability: {},
    ...overrides,
  }
}

describe("monthly report assembly", () => {
  it("omits unavailable sections instead of fabricating content or metrics", () => {
    const report = assembleMonthlyClientReport(evidence())
    expect(report.summary).toContain("No client-visible operational activity")
    expect(report.htmlContent).not.toContain("Analytics and KPIs")
    expect(report.htmlContent).not.toContain("Recommendations")
    expect(report.htmlContent).not.toContain("not connected yet")
    expect(report.htmlContent).not.toContain("Not populated")
  })

  it("renders only supplied evidence and escapes client-visible text", () => {
    const report = assembleMonthlyClientReport(evidence({
      completedWork: [{ source: "activity", id: 2, title: "Homepage <launch>", detail: "Published & checked", occurredAt: "2026-08-20T10:00:00.000Z" }],
      analytics: { totals: { sessions: 321, uptimePercent: 99.9 }, sources: ["GA4"], measuredThrough: "2026-08-31T00:00:00.000Z" },
    }))
    expect(report.htmlContent).toContain("Homepage &lt;launch&gt;")
    expect(report.htmlContent).toContain("Published &amp; checked")
    expect(report.htmlContent).toContain("Sessions: 321")
    expect(report.htmlContent).toContain("Uptime Percent: 99.9%")
  })

  it("stores the exact evidence as the versioned source snapshot", () => {
    const source = evidence({ requestsResolved: [{ id: 4, title: "Update footer", category: "website_update", completedAt: "2026-08-10T12:00:00.000Z" }] })
    expect(assembleMonthlyClientReport(source).sourceSnapshot).toBe(source)
  })
})
