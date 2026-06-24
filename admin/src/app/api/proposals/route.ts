import { NextRequest, NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { salesProposals } from "@/lib/schema"
import { parseSalesProposalGeneratePayload } from "@/lib/sales-proposals"
import { generateSalesProposal } from "@/lib/server/sales-proposal-generator"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const prospectId = Number.parseInt(request.nextUrl.searchParams.get("prospectId") ?? "", 10)
  const clientId = Number.parseInt(request.nextUrl.searchParams.get("clientId") ?? "", 10)

  if ((!Number.isInteger(prospectId) || prospectId < 1) && (!Number.isInteger(clientId) || clientId < 1)) {
    return NextResponse.json({ error: "Prospect or client id is required." }, { status: 400 })
  }

  const proposals = await db
    .select()
    .from(salesProposals)
    .where(Number.isInteger(prospectId) && prospectId > 0 ? eq(salesProposals.prospectId, prospectId) : eq(salesProposals.clientId, clientId))
    .orderBy(desc(salesProposals.updatedAt))

  return NextResponse.json({ ok: true, proposals })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid proposal payload." }, { status: 400 })
  }

  const parsed = parseSalesProposalGeneratePayload(body as Record<string, unknown>)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const generated = await generateSalesProposal(parsed.data)
    const now = new Date()
    const [proposal] = await db
      .insert(salesProposals)
      .values({
        prospectId: parsed.data.prospectId,
        clientId: parsed.data.clientId,
        title: generated.title,
        summary: generated.summary,
        htmlContent: generated.htmlContent,
        status: "draft",
        generatedBy: generated.generatedBy,
        selectedServices: parsed.data.selectedServices,
        buildPrice: parsed.data.buildPrice,
        retainerPrice: parsed.data.retainerPrice,
        updatedAt: now,
      })
      .returning()

    return NextResponse.json({ ok: true, proposal })
  } catch (error) {
    const message = error instanceof Error && ["Prospect not found.", "Client not found.", "Prospect or client not found."].includes(error.message)
      ? error.message
      : "Unable to generate proposal."
    return NextResponse.json({ error: message }, { status: message.endsWith("not found.") ? 404 : 500 })
  }
}
