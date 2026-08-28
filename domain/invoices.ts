// Persisted shared-database contract. Admin owns the table/migrations; web is a narrow portal reader.
export const INVOICE_STATUSES = ["draft", "issued", "paid", "void"] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]
