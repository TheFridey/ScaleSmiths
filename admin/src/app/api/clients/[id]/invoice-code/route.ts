import { NextResponse } from "next/server"
import { InvoiceDomainError } from "@/lib/invoices"
import { assignClientInvoiceCode } from "@/lib/server/invoices"
import { guardApiCapability } from "@/lib/server/rbac"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await guardApiCapability("finance.write")
    const id = Number((await params).id)
    if (!Number.isSafeInteger(id) || id <= 0) throw new InvoiceDomainError("Client id is invalid.")
    const body = await request.json().catch(() => null) as { invoiceClientCode?: unknown } | null
    if (!body) throw new InvoiceDomainError("Invalid client code payload.")
    return NextResponse.json({ ok: true, client: await assignClientInvoiceCode(id, body.invoiceClientCode) })
  } catch (error) {
    return error instanceof InvoiceDomainError ? NextResponse.json({ error: error.safeMessage, code: error.code }, { status: error.status }) : NextResponse.json({ error: "Unable to assign client code." }, { status: 500 })
  }
}
