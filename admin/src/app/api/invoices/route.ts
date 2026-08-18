import { NextResponse } from "next/server"
import { InvoiceDomainError } from "@/lib/invoices"
import { createInvoice, listInvoicesForAdmin } from "@/lib/server/invoices"
import { guardApiCapability } from "@/lib/server/rbac"

export async function POST(request: Request) {
  try {
    const actor = await guardApiCapability("finance.write")
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new InvoiceDomainError("Invalid invoice payload.")
    return NextResponse.json({ ok: true, invoice: await createInvoice(body, actor.id) }, { status: 201 })
  } catch (error) { return failure(error) }
}
function failure(error: unknown) { return error instanceof InvoiceDomainError ? NextResponse.json({ error: error.safeMessage, code: error.code }, { status: error.status }) : NextResponse.json({ error: "Unable to create invoice." }, { status: 500 }) }
export async function GET() {
  try { await guardApiCapability("finance.read"); return NextResponse.json({ ok: true, invoices: await listInvoicesForAdmin() }) }
  catch (error) { return failure(error) }
}
