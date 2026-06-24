import { describe, expect, it } from "vitest"
import { formatReportPeriod } from "./monthly-reports"

describe("monthly report helpers", () => {
  it("formats report periods for the portal", () => {
    expect(formatReportPeriod(1, 2026)).toBe("January 2026")
    expect(formatReportPeriod(12, 2026)).toBe("December 2026")
  })
})
