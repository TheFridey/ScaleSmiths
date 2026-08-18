import type { InvoiceDocumentData } from "./invoice-document"
import { formatGbp } from "./invoice-ui"

export type InvoiceDeliveryKind = "invoice" | "reminder"
export function buildInvoiceEmail(document: InvoiceDocumentData, kind: InvoiceDeliveryKind, portalUrl: string | null) {
  if (!document.invoiceNumber) throw new Error("A permanent invoice number is required for delivery.")
  const reminder = kind === "reminder"
  const greeting = "Hello " + (document.customer.contactName || document.customer.businessName) + ","
  const summary = reminder
    ? "This is a polite reminder that " + document.invoiceNumber + " for " + formatGbp(document.total) + " is due on " + date(document.dueDate) + "."
    : "Please find invoice " + document.invoiceNumber + " for " + formatGbp(document.total) + ", due on " + date(document.dueDate) + "."
  const lines = [greeting, "", summary, document.payment.instructions, document.payment.referenceInstructions, portalUrl ? "View in your ScaleSmiths portal: " + portalUrl : null, "", "Kind regards,", document.supplier.tradingName || document.supplier.legalName || "ScaleSmiths"].filter((value): value is string => value !== null)
  const text = lines.join("\n")
  return { subject: reminder ? "Payment reminder: " + document.invoiceNumber : "Invoice " + document.invoiceNumber + " from ScaleSmiths", text, html: '<div style="font-family:Arial,sans-serif;max-width:620px;color:#111827">' + lines.map(line => line ? "<p>" + escapeHtml(line) + "</p>" : "<br/>").join("") + "</div>" }
}
export function validInvoiceRecipient(value: unknown) { const email=typeof value==="string"?value.trim().toLowerCase():"";return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null }
function date(value:string){return new Intl.DateTimeFormat("en-GB",{dateStyle:"long",timeZone:"UTC"}).format(new Date(value+"T00:00:00Z"))}
function escapeHtml(value:string){return value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}
