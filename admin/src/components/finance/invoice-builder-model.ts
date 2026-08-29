import { poundsToPence } from "@/lib/invoice-ui"
import type { CatalogueItem, FinanceClient, InvoiceSupplierSettings } from "./finance-types"

export type InvoiceEditorLine = {
  key: string
  catalogueItemId: number | null
  title: string
  description: string
  quantity: string
  unitPrice: string
}

export function buildInvoiceDraftModel({
  lines,
  client,
  catalogue,
  supplierSettings,
  invoiceDate,
  dueDate,
}: {
  lines: InvoiceEditorLine[]
  client: FinanceClient | null
  catalogue: CatalogueItem[]
  supplierSettings: InvoiceSupplierSettings | null
  invoiceDate: string
  dueDate: string
}) {
  const activeCatalogue = catalogue.filter((item) => item.active)
  const parsedLines = lines.map((line) => ({
    ...line,
    quantityNumber: Number(line.quantity),
    unitPence: poundsToPence(line.unitPrice),
  }))
  const optimisticTotal = parsedLines.reduce((total, line) => (
    Number.isSafeInteger(line.quantityNumber) && line.quantityNumber > 0 && line.unitPence !== null
      ? total + line.quantityNumber * line.unitPence
      : total
  ), 0)
  const blockers: string[] = []
  if (!client) blockers.push("Select a client.")
  if (!client?.invoiceClientCode) blockers.push("Assign a permanent invoice client code.")
  if (!hasBillingAddress(client)) blockers.push("Complete the client's billing address.")
  if (!supplierSettings || !(supplierSettings.legalName || supplierSettings.tradingName)) blockers.push("Complete the ScaleSmiths supplier business name in invoice settings.")
  if (!supplierSettings?.addressLine1 || !supplierSettings.city || !supplierSettings.postcode || !supplierSettings.country) blockers.push("Complete the ScaleSmiths supplier address in invoice settings.")
  if (!lines.length) blockers.push("Add at least one invoice item.")
  if (parsedLines.some((line) => !line.title.trim() || !Number.isSafeInteger(line.quantityNumber) || line.quantityNumber <= 0 || line.unitPence === null)) blockers.push("Correct invalid item titles, quantities or prices.")
  if (!invoiceDate || !dueDate || dueDate < invoiceDate) blockers.push("Choose valid invoice and due dates.")
  return { activeCatalogue, parsedLines, optimisticTotal, blockers, missingBilling: Boolean(client && !hasBillingAddress(client)) }
}

function hasBillingAddress(client: FinanceClient | null) {
  return Boolean(client?.billingAddressLine1 && client.billingCity && client.billingPostcode && client.billingCountry)
}
