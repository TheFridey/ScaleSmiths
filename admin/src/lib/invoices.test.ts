import { describe, expect, it } from "vitest"
import { InvoiceDomainError, assertDraft, calculateInvoice, defaultInvoiceDates, formatInvoiceNumber, isInvoiceOverdue, nextInvoiceStatus, normalizeInvoiceClientCode } from "./invoices"

describe("invoice domain", () => {
  it("normalizes client codes and formats per-client invoice sequences", () => {
    expect(normalizeInvoiceClientCode(" cak ")).toBe("CAK")
    expect(formatInvoiceNumber("CAK", 1)).toBe("SS-CAK-0001")
    expect(formatInvoiceNumber("CAK", 2)).toBe("SS-CAK-0002")
    expect(formatInvoiceNumber("OTHER", 1)).toBe("SS-OTHER-0001")
  })

  it("calculates authoritative integer-pence totals for catalogue and custom snapshots", () => {
    expect(calculateInvoice([
      { catalogueItemId: 3, title: "Retainer", quantity: 2, unitAmount: 35000 },
      { title: "Custom work", quantity: 1, unitAmount: 1250 },
    ])).toMatchObject({ subtotal: 71250, total: 71250, items: [{ lineAmount: 70000 }, { lineAmount: 1250 }] })
  })

  it.each([{ quantity: 0, unitAmount: 1 }, { quantity: 1.5, unitAmount: 1 }, { quantity: 1, unitAmount: -1 }, { quantity: 1, unitAmount: 1.2 }])("rejects malformed quantity or money: %o", (values) => {
    expect(() => calculateInvoice([{ title: "Bad", ...values }])).toThrow(InvoiceDomainError)
  })

  it("uses 14 day default terms and derives overdue without a persisted status", () => {
    const { invoiceDate, dueDate } = defaultInvoiceDates(new Date("2026-08-01T12:00:00Z"))
    expect(dueDate.getTime() - invoiceDate.getTime()).toBe(14 * 86400000)
    expect(isInvoiceOverdue({ status: "issued", dueDate, paidAt: null }, new Date("2026-08-16T00:00:00Z"))).toBe(true)
    expect(isInvoiceOverdue({ status: "paid", dueDate, paidAt: new Date() }, new Date("2026-08-16T00:00:00Z"))).toBe(false)
  })

  it("locks issued, paid and void invoices and enforces transitions", () => {
    expect(() => assertDraft("issued")).toThrow(/Only draft/)
    expect(() => assertDraft("paid")).toThrow(/Only draft/)
    expect(() => assertDraft("void")).toThrow(/Only draft/)
    expect(nextInvoiceStatus("draft", "issue")).toBe("issued")
    expect(nextInvoiceStatus("issued", "mark_paid")).toBe("paid")
    expect(() => nextInvoiceStatus("draft", "void")).toThrow(/cannot transition/)
    expect(() => nextInvoiceStatus("paid", "void")).toThrow(/cannot transition/)
  })
})
