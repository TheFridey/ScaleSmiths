import { describe, expect, it } from "vitest"
import { isInvoiceStatus, isPortalInvoiceStatus } from "./invoice-status"
import { isPortalAccountState, portalAccountState } from "./portal-account-state"
import { isMonthlyReportStatus } from "./monthly-reports"

describe("portal domain statuses", () => {
  it("rejects invalid persisted invoice and report statuses", () => {
    expect(isInvoiceStatus("overdue")).toBe(false)
    expect(isPortalInvoiceStatus("draft")).toBe(false)
    expect(isMonthlyReportStatus("scheduled")).toBe(false)
  })

  it("derives account display state without changing the persisted boolean", () => {
    expect(portalAccountState(true)).toBe("active")
    expect(portalAccountState(false)).toBe("disabled")
    expect(isPortalAccountState("pending")).toBe(false)
  })
})
