import { NextResponse } from "next/server"
import { InvoiceDomainError } from "@/lib/invoices"
import { invoicePdfFilename, renderInvoicePdf } from "@/lib/server/invoice-pdf"
import { loadInvoiceDocument, loadIssuedInvoicePdf } from "@/lib/server/invoice-documents"
import { createLogger } from "@/lib/server/logging"
import { guardApiCapability } from "@/lib/server/rbac"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let invoiceId: number | null = null
  try {
    await guardApiCapability("finance.read")
    invoiceId = parseId((await params).id)
    const document = await loadInvoiceDocument(invoiceId)
    const bytes = await loadIssuedInvoicePdf(invoiceId) ?? await renderInvoicePdf(document)
    const download = new URL(request.url).searchParams.get("download") === "1"
    return new Response(Buffer.from(bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${invoicePdfFilename(document)}"`,
        "Content-Length": String(bytes.length),
        "Content-Type": "application/pdf",
      },
    })
  } catch (error) {
    if (error instanceof InvoiceDomainError) return NextResponse.json({ error: error.safeMessage, code: error.code }, { status: error.status })
    createLogger({ component: "invoice-pdf", invoiceId }).error("Invoice PDF generation failed", { error })
    return NextResponse.json({ error: "Unable to generate the invoice PDF." }, { status: 500 })
  }
}

function parseId(value: string) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new InvoiceDomainError("Invoice id is invalid.")
  return id
}
