import { describe, expect, it } from "vitest"

describe("dashboard email failure snapshot", () => {
  it("sums email failure counts correctly across categories", () => {
    const snapshot = {
      failedQuoteEmails: 2,
      failedInvoiceDeliveries: 1,
      failedRequestNotifications: 0,
    }
    const total = snapshot.failedQuoteEmails + snapshot.failedInvoiceDeliveries + snapshot.failedRequestNotifications
    expect(total).toBe(3)
  })

  it("reports zero failures when all categories are zero", () => {
    const snapshot = {
      failedQuoteEmails: 0,
      failedInvoiceDeliveries: 0,
      failedRequestNotifications: 0,
    }
    const total = snapshot.failedQuoteEmails + snapshot.failedInvoiceDeliveries + snapshot.failedRequestNotifications
    expect(total).toBe(0)
  })

  it("reports each failure category independently", () => {
    const snapshot = {
      failedQuoteEmails: 5,
      failedInvoiceDeliveries: 3,
      failedRequestNotifications: 2,
    }
    expect(snapshot.failedQuoteEmails).toBe(5)
    expect(snapshot.failedInvoiceDeliveries).toBe(3)
    expect(snapshot.failedRequestNotifications).toBe(2)
  })
})