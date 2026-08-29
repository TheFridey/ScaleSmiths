import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const requests = readFileSync(new URL("./ClientRequestsQueue.tsx", import.meta.url), "utf8")
const reports = readFileSync(new URL("./client-requests/useRequestMonthlyReports.ts", import.meta.url), "utf8")
const invoice = readFileSync(new URL("./finance/InvoiceBuilder.tsx", import.meta.url), "utf8")
const invoiceApi = readFileSync(new URL("./finance/invoice-builder-api.ts", import.meta.url), "utf8")
const invoiceModel = readFileSync(new URL("./finance/invoice-builder-model.ts", import.meta.url), "utf8")

describe("component responsibility boundaries", () => {
  it("keeps monthly-report orchestration out of request queue rendering", () => {
    expect(requests).toContain("useRequestMonthlyReports")
    expect(requests).not.toContain('fetch("/api/monthly-reports')
    expect(reports).toContain("AbortController")
    expect(reports).toContain("generateMonthlyReport")
    expect(reports).toContain("publishReport")
  })

  it("keeps invoice transport and draft business rules outside the form renderer", () => {
    expect(invoice).toContain("buildInvoiceDraftModel")
    expect(invoice).not.toContain("fetch(`/api/invoices")
    expect(invoiceApi).toContain("transitionInvoice")
    expect(invoiceModel).toContain("blockers")
    expect(invoiceModel).toContain("optimisticTotal")
  })
})
