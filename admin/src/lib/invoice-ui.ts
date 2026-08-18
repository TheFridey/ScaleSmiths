import { isInvoiceOverdue, type InvoiceStatus } from "./invoices"

export type InvoiceFilter = "all" | "draft" | "outstanding" | "overdue" | "paid" | "void"

export function formatGbp(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100)
}

export function poundsToPence(value: string) {
  const normalized = value.trim().replace(/^£/, "").replaceAll(",", "")
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null
  const [pounds, fraction = ""] = normalized.split(".")
  const pence = Number(pounds) * 100 + Number(fraction.padEnd(2, "0"))
  return Number.isSafeInteger(pence) ? pence : null
}

export function penceToInput(pence: number) { return `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, "0")}` }

export function invoiceDisplayStatus(invoice: { status: InvoiceStatus; dueDate: Date | string; paidAt: Date | string | null }, now = new Date()) {
  return isInvoiceOverdue({ status: invoice.status, dueDate: new Date(invoice.dueDate), paidAt: invoice.paidAt ? new Date(invoice.paidAt) : null }, now) ? "overdue" as const : invoice.status
}

export function invoiceMatchesFilter(invoice: { status: InvoiceStatus; dueDate: Date | string; paidAt: Date | string | null }, filter: InvoiceFilter, now = new Date()) {
  const display = invoiceDisplayStatus(invoice, now)
  if (filter === "all") return true
  if (filter === "outstanding") return display === "issued" || display === "overdue"
  return display === filter
}

export function invoiceSummary(invoices: Array<{ status: InvoiceStatus; dueDate: Date | string; paidAt: Date | string | null; total: number }>, now = new Date()) {
  return invoices.reduce((summary, invoice) => {
    const display = invoiceDisplayStatus(invoice, now)
    if (display === "issued" || display === "overdue") summary.outstanding += invoice.total
    if (display === "overdue") summary.overdue += invoice.total
    if (display === "paid") { summary.paid += invoice.total; summary.paidCount += 1 }
    if (display === "draft") summary.draftCount += 1
    return summary
  }, { outstanding: 0, overdue: 0, paid: 0, paidCount: 0, draftCount: 0 })
}

export function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function invoiceLabel(invoiceNumber: string | null) { return invoiceNumber ?? "Draft" }
export function catalogueLine(item: { id: number; name: string; description: string | null; defaultUnitAmount: number }) { return { catalogueItemId: item.id, title: item.name, description: item.description ?? "", quantity: "1", unitPrice: penceToInput(item.defaultUnitAmount) } }
export function customLine() { return { catalogueItemId: null, title: "", description: "", quantity: "1", unitPrice: "0.00" } }
export function draftLineTotal(quantity: string, unitPrice: string) { const count = Number(quantity); const unit = poundsToPence(unitPrice); return Number.isSafeInteger(count) && count > 0 && unit !== null ? count * unit : 0 }
export function canIssueVisibleDraft(dirty: boolean, blockers: readonly string[]) { return !dirty && blockers.length === 0 }
