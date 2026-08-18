export interface InvoiceSupplierIdentityInput {
  legalName?: unknown
  tradingName?: unknown
  addressLine1?: unknown
  addressLine2?: unknown
  city?: unknown
  county?: unknown
  postcode?: unknown
  country?: unknown
  contactEmail?: unknown
  website?: unknown
  companyNumber?: unknown
  vatNumber?: unknown
  paymentInstructions?: unknown
  paymentAccountName?: unknown
  paymentSortCode?: unknown
  paymentAccountNumber?: unknown
  paymentReferenceInstructions?: unknown
}

export function parseInvoiceSupplierIdentity(input: InvoiceSupplierIdentityInput) {
  return {
    legalName: optional(input.legalName), tradingName: optional(input.tradingName),
    addressLine1: optional(input.addressLine1), addressLine2: optional(input.addressLine2), city: optional(input.city),
    county: optional(input.county), postcode: optional(input.postcode), country: optional(input.country),
    contactEmail: optional(input.contactEmail), website: optional(input.website),
    companyNumber: optional(input.companyNumber), vatNumber: optional(input.vatNumber),
    paymentInstructions: optional(input.paymentInstructions), paymentAccountName: optional(input.paymentAccountName),
    paymentSortCode: optional(input.paymentSortCode), paymentAccountNumber: optional(input.paymentAccountNumber),
    paymentReferenceInstructions: optional(input.paymentReferenceInstructions),
  }
}

function optional(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null }
