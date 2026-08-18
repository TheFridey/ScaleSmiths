import { NextResponse } from "next/server"
import { InvoiceDomainError } from "@/lib/invoices"
import { deleteDraftInvoice, loadInvoiceForAdmin, transitionInvoice, updateDraftInvoice } from "@/lib/server/invoices"
import { guardApiCapability } from "@/lib/server/rbac"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("finance.write")
    const invoiceId = idOf((await params).id)
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new InvoiceDomainError("Invalid invoice payload.")
    const input = body as Record<string, unknown>
    const invoice = typeof input.action === "string"
      ? await transitionInvoice(invoiceId, actionOf(input.action), actor.id)
      : await updateDraftInvoice(invoiceId, input, actor.id)
    return NextResponse.json({ ok: true, invoice })
  } catch (error) { return failure(error) }
}
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await guardApiCapability("finance.write"); await deleteDraftInvoice(idOf((await params).id)); return NextResponse.json({ ok: true }) }
  catch (error) { return failure(error) }
}
function idOf(value: string) { const id = Number(value); if (!Number.isSafeInteger(id) || id <= 0) throw new InvoiceDomainError("Invoice id is invalid."); return id }
function actionOf(value: string) { if (value === "issue" || value === "mark_paid" || value === "void") return value; throw new InvoiceDomainError("Invoice action is invalid.") }
function failure(error: unknown) { return error instanceof InvoiceDomainError ? NextResponse.json({ error: error.safeMessage, code: error.code }, { status: error.status }) : NextResponse.json({ error: "Unable to update invoice." }, { status: 500 }) }
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await guardApiCapability("finance.read"); return NextResponse.json({ ok: true, invoice: await loadInvoiceForAdmin(idOf((await params).id)) }) }
  catch (error) { return failure(error) }
}
