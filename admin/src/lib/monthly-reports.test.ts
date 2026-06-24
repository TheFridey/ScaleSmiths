import { describe, expect, it } from "vitest"
import {
  formatReportPeriod,
  parseReportEditPayload,
  parseReportPeriod,
} from "./monthly-reports"

describe("monthly report helpers", () => {
  it("parses valid report periods", () => {
    expect(parseReportPeriod({ month: 6, year: 2026 })).toEqual({ ok: true, data: { month: 6, year: 2026 } })
    expect(formatReportPeriod(6, 2026)).toBe("June 2026")
  })

  it("rejects invalid report periods", () => {
    expect(parseReportPeriod({ month: 13, year: 2026 })).toEqual({ ok: false, error: "Report month must be between 1 and 12." })
    expect(parseReportPeriod({ month: 6, year: 1900 })).toEqual({ ok: false, error: "Report year is invalid." })
  })

  it("validates report edit payloads", () => {
    expect(parseReportEditPayload({
      title: "Monthly report",
      summary: "A concise summary.",
      htmlContent: "<!doctype html><html><body>Report</body></html>",
    })).toEqual({
      ok: true,
      data: {
        title: "Monthly report",
        summary: "A concise summary.",
        htmlContent: "<!doctype html><html><body>Report</body></html>",
      },
    })
    expect(parseReportEditPayload({ title: "", summary: "Summary", htmlContent: "<html></html>" }))
      .toEqual({ ok: false, error: "Report title is required." })
  })
})
