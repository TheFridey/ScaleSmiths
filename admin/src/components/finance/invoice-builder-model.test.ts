import { describe, expect, it } from "vitest"
import { buildInvoiceDraftModel, type InvoiceEditorLine } from "./invoice-builder-model"
import type { FinanceClient, InvoiceSupplierSettings } from "./finance-types"

const client: FinanceClient = {
  id: 1, name: "Acme", contactName: "A Client", contactEmail: "a@example.test", invoiceClientCode: "AC",
  billingAddressLine1: "1 High Street", billingAddressLine2: null, billingCity: "Nottingham",
  billingCounty: null, billingPostcode: "NG1 1AA", billingCountry: "United Kingdom", portalClientId: "acme",
}
const supplier: InvoiceSupplierSettings = {
  legalName: "ScaleSmiths Ltd", tradingName: null, addressLine1: "2 High Street", addressLine2: null,
  city: "Nottingham", county: null, postcode: "NG1 1AB", country: "United Kingdom",
  contactEmail: null, website: null, companyNumber: null, vatNumber: null, paymentInstructions: null,
  paymentAccountName: null, paymentSortCode: null, paymentAccountNumber: null, paymentReferenceInstructions: null,
}
const line: InvoiceEditorLine = { key: "1", catalogueItemId: null, title: "Build", description: "", quantity: "2", unitPrice: "125.50" }

describe("invoice builder draft model", () => {
  it("derives integer-pence totals and filters inactive catalogue entries", () => {
    const result = buildInvoiceDraftModel({ lines: [line], client, supplierSettings: supplier,
      catalogue: [{ id: 1, name: "Active", description: null, defaultUnitAmount: 1, active: true, category: null, position: 0 }, { id: 2, name: "Old", description: null, defaultUnitAmount: 1, active: false, category: null, position: 1 }],
      invoiceDate: "2026-08-28", dueDate: "2026-09-11" })
    expect(result.optimisticTotal).toBe(25100)
    expect(result.activeCatalogue.map((item) => item.id)).toEqual([1])
    expect(result.blockers).toEqual([])
  })

  it("centralises issue blockers without mutating form input", () => {
    const lines = [{ ...line, title: "", unitPrice: "invalid" }]
    const result = buildInvoiceDraftModel({ lines, client: { ...client, invoiceClientCode: null, billingPostcode: null },
      supplierSettings: null, catalogue: [], invoiceDate: "2026-09-12", dueDate: "2026-09-11" })
    expect(result.missingBilling).toBe(true)
    expect(result.blockers).toContain("Assign a permanent invoice client code.")
    expect(result.blockers).toContain("Correct invalid item titles, quantities or prices.")
    expect(result.blockers).toContain("Choose valid invoice and due dates.")
    expect(lines[0].title).toBe("")
  })
})
