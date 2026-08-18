import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { buildInvoiceDocumentData, INVOICE_TEMPLATE_VERSION, paymentSnapshot, supplierSnapshot, type InvoiceDocumentData, type InvoicePaymentSnapshot, type InvoiceSupplierSnapshot } from "@/lib/invoice-document"
import { InvoiceDomainError } from "@/lib/invoices"
import { clients, invoiceItems, invoiceSupplierSettings, invoices } from "@/lib/schema"

const EMPTY_SUPPLIER: InvoiceSupplierSnapshot = { legalName: null, tradingName: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, contactEmail: null, website: null, companyNumber: null, vatNumber: null }
const EMPTY_PAYMENT: InvoicePaymentSnapshot = { instructions: null, accountName: null, sortCode: null, accountNumber: null, referenceInstructions: null }

export async function loadInvoiceDocument(invoiceId: number): Promise<InvoiceDocumentData> {
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1)
  if (!invoice) throw new InvoiceDomainError("Invoice not found.", 404, "not_found")
  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId)).orderBy(invoiceItems.position)
  if (invoice.status !== "draft") {
    if (invoice.documentTemplateVersion !== INVOICE_TEMPLATE_VERSION || !invoice.supplierSnapshot || !invoice.paymentSnapshot || !invoice.invoiceNumber) throw new InvoiceDomainError("Issued invoice document snapshot is incomplete or unsupported.", 409, "document_snapshot_incomplete")
    return buildInvoiceDocumentData({ status: invoice.status, invoiceNumber: invoice.invoiceNumber, invoiceDate: invoice.invoiceDate, dueDate: invoice.dueDate, issuedAt: invoice.issuedAt, paidAt: invoice.paidAt, customerNotes: invoice.customerNotes, supplier: invoice.supplierSnapshot, payment: invoice.paymentSnapshot, customer: customerFromInvoice(invoice), items })
  }
  const [[client], [settings]] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, invoice.clientId)).limit(1),
    db.select().from(invoiceSupplierSettings).where(eq(invoiceSupplierSettings.id, 1)).limit(1),
  ])
  return buildInvoiceDocumentData({ status: "draft", invoiceNumber: null, invoiceDate: invoice.invoiceDate, dueDate: invoice.dueDate, issuedAt: null, paidAt: null, customerNotes: invoice.customerNotes, supplier: settings ? supplierSnapshot(settings) : EMPTY_SUPPLIER, payment: settings ? paymentSnapshot(settings) : EMPTY_PAYMENT, customer: client ? { businessName: client.name, contactName: client.contactName, email: client.contactEmail, addressLine1: client.billingAddressLine1, addressLine2: client.billingAddressLine2, city: client.billingCity, county: client.billingCounty, postcode: client.billingPostcode, country: client.billingCountry } : customerFromInvoice(invoice), items })
}
export async function loadIssuedInvoicePdf(invoiceId:number){const [row]=await db.select({status:invoices.status,documentPdf:invoices.documentPdf}).from(invoices).where(eq(invoices.id,invoiceId)).limit(1);return row&&row.status!=="draft"&&row.documentPdf?Buffer.from(row.documentPdf):null}

function customerFromInvoice(invoice: typeof invoices.$inferSelect) { return { businessName: invoice.clientNameSnapshot, contactName: invoice.billingContactNameSnapshot, email: invoice.billingEmailSnapshot, addressLine1: invoice.billingAddressLine1Snapshot, addressLine2: invoice.billingAddressLine2Snapshot, city: invoice.billingCitySnapshot, county: invoice.billingCountySnapshot, postcode: invoice.billingPostcodeSnapshot, country: invoice.billingCountrySnapshot } }
