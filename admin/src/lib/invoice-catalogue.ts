import { InvoiceDomainError } from "./invoices"

export function catalogueValues(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : ""
  const defaultUnitAmount = typeof body.defaultUnitAmount === "number" ? body.defaultUnitAmount : Number(body.defaultUnitAmount)
  if (!name || name.length > 200) throw new InvoiceDomainError("Catalogue name is required and must be at most 200 characters.")
  if (!Number.isSafeInteger(defaultUnitAmount) || defaultUnitAmount < 0) throw new InvoiceDomainError("Default unit amount must be a non-negative integer number of pence.")
  return { name, description: text(body.description), defaultUnitAmount, currency: "GBP", active: body.active === undefined ? true : body.active === true, category: text(body.category), position: Number.isSafeInteger(body.position) ? Number(body.position) : 0 }
}
function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null }
