import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { prospects, salesProposals } from "@/lib/schema"
import { parseSalesProposalEditPayload } from "@/lib/sales-proposals"

export const dynamic = "force-dynamic"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const proposal = await findProposal(params)

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 })
  }

  return new NextResponse(proposal.htmlContent, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadName(proposal.title)}.html"`,
      "X-Robots-Tag": "noindex",
    },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const proposal = await findProposal(params)

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found." }, { status: 404 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid proposal payload." }, { status: 400 })
  }

  const parsed = parseSalesProposalEditPayload(body as Record<string, unknown>)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const now = new Date()
  const sentAt = parsed.data.status === "sent" && proposal.status !== "sent" ? now : proposal.sentAt
  const [updated] = await db
    .update(salesProposals)
    .set({
      title: parsed.data.title,
      summary: parsed.data.summary,
      htmlContent: parsed.data.htmlContent,
      status: parsed.data.status,
      sentAt,
      updatedAt: now,
    })
    .where(eq(salesProposals.id, proposal.id))
    .returning()

  if (parsed.data.status === "sent" && proposal.prospectId) {
    await db
      .update(prospects)
      .set({
        stage: "proposal_sent",
        proposalSentAt: sentAt ?? now,
        estimatedProjectValue: proposal.buildPrice,
        estimatedMonthlyRetainer: proposal.retainerPrice,
        updatedAt: now,
      })
      .where(eq(prospects.id, proposal.prospectId))
  }

  return NextResponse.json({ ok: true, proposal: updated })
}

async function findProposal(paramsPromise: Promise<{ id: string }>) {
  const { id: rawId } = await paramsPromise
  const id = Number.parseInt(rawId, 10)

  if (!Number.isInteger(id) || id < 1) return null

  const [proposal] = await db.select().from(salesProposals).where(eq(salesProposals.id, id)).limit(1)
  return proposal ?? null
}

function downloadName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "scalesmiths-proposal"
}
