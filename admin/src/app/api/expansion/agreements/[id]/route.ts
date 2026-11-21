import { NextResponse } from "next/server"
import { acceptedAgreementDocument } from "@/lib/server/partner-agreements"
import { expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
export const dynamic = "force-dynamic"

/** Founder copy of any accepted agreement, with its recomputed digest checked against the acceptance record. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { filename, text } = await acceptedAgreementDocument(id, "founder")
    return new NextResponse(text, { headers: { ...expansionHeaders, "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "X-Content-Type-Options": "nosniff" } })
  } catch (error) { return expansionFailure(error) }
}
