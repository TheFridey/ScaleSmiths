import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { outreachActivities, prospects } from "@/lib/schema"
import { PROSPECT_STAGES, type OutreachActivityType, type OutreachDirection, type ProspectStage, parseOutreachActivityPayload } from "@/lib/prospects"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const prospectId = Number(rawId)

  if (!Number.isInteger(prospectId) || prospectId < 1) {
    return NextResponse.json({ error: "Invalid prospect id." }, { status: 400 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid activity payload." }, { status: 400 })
  }

  const [existing] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Prospect not found." }, { status: 404 })
  }

  const parsed = parseOutreachActivityPayload(body as Record<string, unknown>)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const now = new Date()
  const [activity] = await db
    .insert(outreachActivities)
    .values({
      prospectId,
      type: parsed.data.type,
      direction: parsed.data.direction,
      subject: parsed.data.subject,
      body: parsed.data.body,
      outcome: parsed.data.outcome,
      createdBy: parsed.data.createdBy,
    })
    .returning()

  const stage = nextStageAfterActivity(existing.stage, parsed.data.direction, parsed.data.type)
  const [prospect] = await db
    .update(prospects)
    .set({
      stage,
      lastContactedAt: parsed.data.direction === "outbound" ? now : existing.lastContactedAt,
      proposalSentAt: parsed.data.type === "proposal" ? existing.proposalSentAt ?? now : existing.proposalSentAt,
      updatedAt: now,
    })
    .where(eq(prospects.id, prospectId))
    .returning()

  return NextResponse.json({ ok: true, activity, prospect }, { status: 201 })
}

function nextStageAfterActivity(stage: ProspectStage, direction: OutreachDirection, type: OutreachActivityType) {
  if (stage === "won" || stage === "lost") return stage
  if (type === "proposal") return "proposal_sent"
  if (direction === "inbound" && PROSPECT_STAGES.indexOf(stage) < PROSPECT_STAGES.indexOf("replied")) return "replied"
  if (direction === "outbound" && PROSPECT_STAGES.indexOf(stage) < PROSPECT_STAGES.indexOf("contacted")) return "contacted"
  return stage
}
