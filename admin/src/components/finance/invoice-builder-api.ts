import type { FinanceClient, FinanceInvoice } from "./finance-types"

export async function saveInvoiceDraft(invoiceId: number | undefined, payload: Record<string, unknown>): Promise<FinanceInvoice> {
  const data = await request(invoiceId ? `/api/invoices/${invoiceId}` : "/api/invoices", {
    method: invoiceId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return data.invoice as FinanceInvoice
}

export async function transitionInvoice(invoiceId: number, action: "issue" | "mark_paid" | "void"): Promise<FinanceInvoice> {
  const data = await request(`/api/invoices/${invoiceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  })
  return data.invoice as FinanceInvoice
}

export async function deleteInvoiceDraft(invoiceId: number) {
  await request(`/api/invoices/${invoiceId}`, { method: "DELETE" })
}

export async function assignInvoiceClientCode(clientId: number, invoiceClientCode: string): Promise<FinanceClient> {
  const data = await request(`/api/clients/${clientId}/invoice-code`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceClientCode }),
  })
  return data.client as FinanceClient
}

async function request(url: string, init: RequestInit) {
  const response = await fetch(url, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || "Unable to update invoice.")
  return data
}
