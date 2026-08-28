import { INVOICE_STATUSES, type InvoiceStatus } from "../../../domain/invoices"
export { INVOICE_STATUSES, type InvoiceStatus } from "../../../domain/invoices"
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = { draft: "Draft", issued: "Issued", paid: "Paid", void: "Void" }
export function isInvoiceStatus(value: unknown): value is InvoiceStatus { return typeof value === "string" && INVOICE_STATUSES.includes(value as InvoiceStatus) }

export class InvoiceDomainError extends Error {
  constructor(public readonly safeMessage: string, public readonly status = 400, public readonly code = "invalid_invoice") {
    super(safeMessage)
    this.name = "InvoiceDomainError"
  }
}

export interface InvoiceItemInput {
  catalogueItemId?: number | null
  title: string
  description?: string | null
  quantity: number
  unitAmount: number
}

export interface CalculatedInvoiceItem extends InvoiceItemInput { lineAmount: number; position: number }

export function normalizeInvoiceClientCode(value: unknown) {
  if (typeof value !== "string") throw new InvoiceDomainError("Invoice client code is required.")
  const code = value.trim().toUpperCase()
  if (!/^[A-Z0-9]{2,12}$/.test(code)) throw new InvoiceDomainError("Invoice client code must be 2 to 12 uppercase letters or numbers.")
  return code
}

export function formatInvoiceNumber(clientCode: string, sequence: number) {
  const code = normalizeInvoiceClientCode(clientCode)
  if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 9999) throw new InvoiceDomainError("Invoice sequence is outside the supported range.", 409, "sequence_exhausted")
  return `SS-${code}-${String(sequence).padStart(4, "0")}`
}

export function calculateInvoice(items: InvoiceItemInput[]) {
  if (!Array.isArray(items) || items.length === 0) throw new InvoiceDomainError("At least one invoice item is required.")
  let subtotal = 0
  const calculated: CalculatedInvoiceItem[] = items.map((item, position) => {
    const title = typeof item.title === "string" ? item.title.trim() : ""
    if (!title || title.length > 200) throw new InvoiceDomainError(`Invoice item ${position + 1} needs a valid title.`)
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) throw new InvoiceDomainError(`Invoice item ${position + 1} quantity must be a positive whole number.`)
    if (!Number.isSafeInteger(item.unitAmount) || item.unitAmount < 0) throw new InvoiceDomainError(`Invoice item ${position + 1} unit amount must be a non-negative integer number of pence.`)
    const lineAmount = item.quantity * item.unitAmount
    if (!Number.isSafeInteger(lineAmount)) throw new InvoiceDomainError(`Invoice item ${position + 1} amount is too large.`)
    subtotal += lineAmount
    if (!Number.isSafeInteger(subtotal)) throw new InvoiceDomainError("Invoice total is too large.")
    return { ...item, title, description: optionalText(item.description), lineAmount, position }
  })
  return { items: calculated, subtotal, total: subtotal }
}

export function defaultInvoiceDates(now = new Date()) {
  const invoiceDate = new Date(now)
  const dueDate = new Date(invoiceDate)
  dueDate.setUTCDate(dueDate.getUTCDate() + 14)
  return { invoiceDate, dueDate }
}

export function isInvoiceOverdue(invoice: { status: InvoiceStatus; dueDate: Date; paidAt: Date | null }, now = new Date()) {
  return invoice.status === "issued" && invoice.paidAt === null && invoice.dueDate.getTime() < now.getTime()
}

export function assertDraft(status: InvoiceStatus) {
  if (status !== "draft") throw new InvoiceDomainError("Only draft invoices can be edited.", 409, "invoice_locked")
}

export function nextInvoiceStatus(current: InvoiceStatus, action: "issue" | "mark_paid" | "void") {
  if (action === "issue" && current === "draft") return "issued" as const
  if (action === "mark_paid" && current === "issued") return "paid" as const
  if (action === "void" && current === "issued") return "void" as const
  throw new InvoiceDomainError(`Invoice cannot transition from ${current} using ${action}.`, 409, "invalid_status_transition")
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
