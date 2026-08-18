import { InvoiceDomainError, calculateInvoice, type InvoiceStatus } from "./invoices"

export const INVOICE_TEMPLATE_VERSION = "scalesmiths-v1" as const
export type InvoiceTemplateVersion = typeof INVOICE_TEMPLATE_VERSION

export interface InvoiceSupplierSnapshot {
  legalName: string | null; tradingName: string | null; addressLine1: string | null; addressLine2: string | null
  city: string | null; county: string | null; postcode: string | null; country: string | null
  contactEmail: string | null; website: string | null; companyNumber: string | null; vatNumber: string | null
}
export interface InvoicePaymentSnapshot {
  instructions: string | null; accountName: string | null; sortCode: string | null; accountNumber: string | null; referenceInstructions: string | null
}
export interface InvoiceCustomerSnapshot {
  businessName: string; contactName: string | null; email: string | null; addressLine1: string | null; addressLine2: string | null
  city: string | null; county: string | null; postcode: string | null; country: string | null
}
export interface InvoiceDocumentItem { title: string; description: string | null; quantity: number; unitAmount: number; lineAmount: number }
export interface InvoiceDocumentData {
  templateVersion: InvoiceTemplateVersion; documentState: "draft" | "issued" | "paid" | "void"
  invoiceNumber: string | null; invoiceDate: string; dueDate: string; issuedDate: string | null; paidDate: string | null
  supplier: InvoiceSupplierSnapshot; customer: InvoiceCustomerSnapshot; payment: InvoicePaymentSnapshot
  customerNote: string | null; items: InvoiceDocumentItem[]; subtotal: number; total: number; currency: "GBP"
}

export function supplierSnapshot(settings: SupplierSettingsLike): InvoiceSupplierSnapshot {
  return { legalName: settings.legalName, tradingName: settings.tradingName, addressLine1: settings.addressLine1, addressLine2: settings.addressLine2, city: settings.city, county: settings.county, postcode: settings.postcode, country: settings.country, contactEmail: settings.contactEmail, website: settings.website, companyNumber: settings.companyNumber, vatNumber: settings.vatNumber }
}
export function paymentSnapshot(settings: SupplierSettingsLike): InvoicePaymentSnapshot {
  return { instructions: settings.paymentInstructions, accountName: settings.paymentAccountName, sortCode: settings.paymentSortCode, accountNumber: settings.paymentAccountNumber, referenceInstructions: settings.paymentReferenceInstructions }
}

export function validateDocumentIdentity(supplier: InvoiceSupplierSnapshot, customer: InvoiceCustomerSnapshot) {
  const supplierName = supplier.legalName || supplier.tradingName
  if (!supplierName) throw new InvoiceDomainError("Add a supplier business or trading name in invoice settings before issuing.", 409, "supplier_name_required")
  if (!usableAddress(supplier)) throw new InvoiceDomainError("Complete the supplier address in invoice settings before issuing.", 409, "supplier_address_required")
  if (!customer.businessName.trim()) throw new InvoiceDomainError("Client business name is required before issuing.", 409, "customer_name_required")
  if (!usableAddress(customer)) throw new InvoiceDomainError("Complete the client billing address before issuing.", 409, "customer_address_required")
}

export function buildInvoiceDocumentData(input: DocumentBuildInput): InvoiceDocumentData {
  const calculated = calculateInvoice(input.items)
  return {
    templateVersion: INVOICE_TEMPLATE_VERSION, documentState: documentState(input.status), invoiceNumber: input.invoiceNumber,
    invoiceDate: isoDate(input.invoiceDate), dueDate: isoDate(input.dueDate), issuedDate: input.issuedAt ? isoDate(input.issuedAt) : null,
    paidDate: input.paidAt ? isoDate(input.paidAt) : null, supplier: input.supplier, customer: input.customer, payment: input.payment,
    customerNote: input.customerNotes, items: calculated.items.map(({ title, description, quantity, unitAmount, lineAmount }) => ({ title, description: description ?? null, quantity, unitAmount, lineAmount })),
    subtotal: calculated.subtotal, total: calculated.total, currency: "GBP",
  }
}

function documentState(status: InvoiceStatus): InvoiceDocumentData["documentState"] { return status === "draft" ? "draft" : status === "paid" ? "paid" : status === "void" ? "void" : "issued" }
function usableAddress(value: { addressLine1: string | null; city: string | null; postcode: string | null; country: string | null }) { return Boolean(value.addressLine1?.trim() && value.city?.trim() && value.postcode?.trim() && value.country?.trim()) }
function isoDate(value: Date | string) { return new Date(value).toISOString().slice(0, 10) }

interface SupplierSettingsLike extends InvoiceSupplierSnapshot {
  paymentInstructions: string | null; paymentAccountName: string | null; paymentSortCode: string | null
  paymentAccountNumber: string | null; paymentReferenceInstructions: string | null
}
interface DocumentBuildInput {
  status: InvoiceStatus; invoiceNumber: string | null; invoiceDate: Date | string; dueDate: Date | string; issuedAt: Date | string | null
  paidAt: Date | string | null; customerNotes: string | null; supplier: InvoiceSupplierSnapshot; customer: InvoiceCustomerSnapshot
  payment: InvoicePaymentSnapshot; items: Array<{ title: string; description?: string | null; quantity: number; unitAmount: number }>
}
