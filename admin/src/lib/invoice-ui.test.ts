import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { canIssueVisibleDraft, catalogueLine, customLine, draftLineTotal, formatGbp, invoiceDisplayStatus, invoiceLabel, invoiceMatchesFilter, invoiceSummary, poundsToPence } from "./invoice-ui"

describe("invoice admin UI behaviour", () => {
  it("shows Draft instead of fabricating a temporary number", () => expect(invoiceLabel(null)).toBe("Draft"))
  it("formats integer pence as normal GBP", () => { expect(formatGbp(35000)).toBe("£350.00"); expect(formatGbp(200000)).toBe("£2,000.00") })
  it("parses pounds without floating point arithmetic", () => { expect(poundsToPence("350.00")).toBe(35000); expect(poundsToPence("1,234.56")).toBe(123456); expect(poundsToPence("1.234")).toBeNull() })
  it("copies catalogue values into an editable line snapshot", () => { const line = catalogueLine({ id: 4, name: "Retainer", description: "Monthly", defaultUnitAmount: 35000 }); expect(line).toEqual({ catalogueItemId: 4, title: "Retainer", description: "Monthly", quantity: "1", unitPrice: "350.00" }); line.title = "Invoice override"; expect(line.title).toBe("Invoice override") })
  it("creates custom items without a catalogue relationship", () => expect(customLine()).toMatchObject({ catalogueItemId: null, quantity: "1" }))
  it("updates displayed totals from quantity and pounds input", () => expect(draftLineTotal("3", "12.50")).toBe(3750))
  it("blocks stale issuance while changes are unsaved", () => { expect(canIssueVisibleDraft(true, [])).toBe(false); expect(canIssueVisibleDraft(false, ["code required"])).toBe(false); expect(canIssueVisibleDraft(false, [])).toBe(true) })
  it("derives overdue without changing persisted issued status", () => { const invoice = { status: "issued" as const, dueDate: "2026-01-01", paidAt: null }; expect(invoiceDisplayStatus(invoice, new Date("2026-02-01"))).toBe("overdue"); expect(invoiceMatchesFilter(invoice, "outstanding", new Date("2026-02-01"))).toBe(true) })
  it("summarizes outstanding, overdue, paid and draft values", () => expect(invoiceSummary([{ status: "draft", dueDate: "2026-03-01", paidAt: null, total: 100 }, { status: "issued", dueDate: "2026-01-01", paidAt: null, total: 200 }, { status: "paid", dueDate: "2026-01-01", paidAt: "2026-01-02", total: 300 }], new Date("2026-02-01"))).toEqual({ outstanding: 200, overdue: 200, paid: 300, paidCount: 1, draftCount: 1 }))
})

describe("invoice component safety contracts", () => {
  const builder = readFileSync(new URL("../components/finance/InvoiceBuilder.tsx", import.meta.url), "utf8")
  it("requires confirmation for issue, delete, paid, void and permanent code assignment", () => { for (const action of ['setConfirm("issue")', 'setConfirm("delete")', 'setConfirm("paid")', 'setConfirm("void")', 'setConfirm("code")']) expect(builder).toContain(action) })
  it("uses the authoritative server invoice after saves and transitions", () => { expect(builder).toContain("setInvoice(saved)"); expect(builder).toContain("setInvoice(data.invoice)") })
  it("does not render edit or delete controls for issued, paid or void invoices", () => { expect(builder).toContain('const mutable = editable && canWrite'); expect(builder).toContain('invoice?.status === "issued" && canWrite') })
  it("explains permanent issue-time allocation without predicting a number", () => { expect(builder).toContain("A permanent invoice number will be allocated by the server when issued."); expect(builder).not.toContain("DRAFT-001") })
  it("excludes inactive catalogue entries from normal line selection", () => expect(builder).toContain("catalogue.filter((item) => item.active)"))
  it("surfaces missing invoice code and requires explicit assignment", () => { expect(builder).toContain("Invoice code required before issue"); expect(builder).toContain("Assign Permanently") })
  it("surfaces document identity blockers and lifecycle-appropriate PDF actions", () => { expect(builder).toContain("Complete the ScaleSmiths supplier address in invoice settings."); expect(builder).toContain("Complete the client's billing address."); expect(builder).toContain("Preview PDF"); expect(builder).toContain("Download PDF") })
  it("delegates publication, sending and reminders to the protected delivery panel", () => { const panel=readFileSync(new URL("../components/finance/InvoiceDeliveryPanel.tsx",import.meta.url),"utf8");expect(panel).toContain("Publish to Client Portal");expect(panel).toContain("Send Invoice");expect(panel).toContain("Send Payment Reminder");expect(panel).toContain("ConfirmationDialog");expect(panel).toContain("canWrite") })
})
