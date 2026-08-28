import { describe, expect, it } from "vitest"
import { isInvoiceStatus } from "./invoices"
import { isMonthlyReportStatus } from "./monthly-reports"
import { isProspectStage } from "./prospects"

describe("persisted domain status validators", () => {
  it("rejects display-only or unknown values", () => {
    expect(isInvoiceStatus("overdue")).toBe(false)
    expect(isMonthlyReportStatus("scheduled")).toBe(false)
    expect(isProspectStage("qualified")).toBe(false)
  })
})
