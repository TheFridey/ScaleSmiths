import { INVOICE_STATUSES, type InvoiceStatus } from "../../../domain/invoices"
export { INVOICE_STATUSES, type InvoiceStatus } from "../../../domain/invoices"
export type PortalInvoiceStatus = Exclude<InvoiceStatus, "draft">
export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = { draft: "Draft", issued: "Issued", paid: "Paid", void: "Void" }

export function isInvoiceStatus(value: unknown): value is InvoiceStatus { return typeof value === "string" && INVOICE_STATUSES.includes(value as InvoiceStatus) }
export function isPortalInvoiceStatus(value: unknown): value is PortalInvoiceStatus { return isInvoiceStatus(value) && value !== "draft" }
