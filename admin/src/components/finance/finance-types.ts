import type { InvoiceStatus } from "@/lib/invoices"

export interface FinanceClient {
  id: number; name: string; contactName: string | null; contactEmail: string | null; invoiceClientCode: string | null
  billingAddressLine1: string | null; billingAddressLine2: string | null; billingCity: string | null
  billingCounty: string | null; billingPostcode: string | null; billingCountry: string | null
  portalClientId: string | null
}
export interface CatalogueItem { id: number; name: string; description: string | null; defaultUnitAmount: number; active: boolean; category: string | null; position: number }
export interface InvoiceSupplierSettings {
  legalName: string | null; tradingName: string | null; addressLine1: string | null; addressLine2: string | null
  city: string | null; county: string | null; postcode: string | null; country: string | null
  contactEmail: string | null; website: string | null; companyNumber: string | null; vatNumber: string | null
  paymentInstructions: string | null; paymentAccountName: string | null; paymentSortCode: string | null
  paymentAccountNumber: string | null; paymentReferenceInstructions: string | null
}
export interface InvoiceLine { id?: number; catalogueItemId: number | null; title: string; description: string | null; quantity: number; unitAmount: number; lineAmount: number; position: number }
export interface FinanceInvoice {
  id: number; invoiceNumber: string | null; clientId: number; sequenceNumber: number | null; clientCodeSnapshot: string | null
  clientNameSnapshot: string; billingContactNameSnapshot: string | null; billingEmailSnapshot: string | null
  billingAddressLine1Snapshot: string | null; billingAddressLine2Snapshot: string | null; billingCitySnapshot: string | null
  billingCountySnapshot: string | null; billingPostcodeSnapshot: string | null; billingCountrySnapshot: string | null
  currency: string; invoiceDate: Date | string; dueDate: Date | string; status: InvoiceStatus; subtotal: number; total: number
  internalNotes: string | null; customerNotes: string | null; issuedAt: Date | string | null; paidAt: Date | string | null
  voidedAt: Date | string | null; createdAt: Date | string; updatedAt: Date | string; items?: InvoiceLine[]; client?: FinanceClient | null
  portalPublishedAt?: Date | string | null
}
