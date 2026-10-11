import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db as rootDb } from "@/lib/db"
import {
  commercialAudit,
  commercialContacts,
  outreachActivities,
  prospects,
} from "@/lib/schema"
import { guardApiCapability } from "@/lib/server/rbac"
import { AdminIdentityError } from "@/lib/admin-users"
import {
  stageIndex,
  type OutreachActivityType,
  type OutreachDirection,
  type ProspectStage,
  parseOutreachActivityPayload,
} from "@/lib/prospects"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let actor
  try {
    actor = await guardApiCapability("leads.write")
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: error instanceof AdminIdentityError ? error.status : 401 },
    )
  }
  const { id: rawId } = await params
  const prospectId = Number(rawId)

  if (!Number.isInteger(prospectId) || prospectId < 1) {
    return NextResponse.json({ error: "Invalid prospect id." }, { status: 400 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid activity payload." },
      { status: 400 },
    )
  }

  return rootDb.transaction(async (db) => {
    const [existing] = await db
      .select()
      .from(prospects)
      .where(eq(prospects.id, prospectId))
      .limit(1)
      .for("update")

    if (!existing) {
      return NextResponse.json(
        { error: "Prospect not found." },
        { status: 404 },
      )
    }

    const parsed = parseOutreachActivityPayload(body as Record<string, unknown>)

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }

    const now = new Date()
    if (
      parsed.data.direction === "outbound" &&
      (
        await db
          .select({ id: commercialContacts.id })
          .from(commercialContacts)
          .where(
            and(
              eq(commercialContacts.prospectId, prospectId),
              eq(commercialContacts.suppressed, true),
            ),
          )
          .limit(1)
      ).length
    )
      return NextResponse.json(
        {
          error:
            "Suppression record exists. Use Command Centre to select an opted-in contact.",
        },
        { status: 409 },
      )
    const [activity] = await db
      .insert(outreachActivities)
      .values({
        prospectId,
        type: parsed.data.type,
        direction: parsed.data.direction,
        subject: parsed.data.subject,
        body: parsed.data.body,
        outcome: parsed.data.outcome,
        createdBy: actor.displayName,
        actorUserId: actor.id,
        occurredAt: now,
        requestKey: crypto.randomUUID(),
      })
      .returning()

    const stage = nextStageAfterActivity(
      existing.stage,
      parsed.data.direction,
      parsed.data.type,
    )
    const [prospect] = await db
      .update(prospects)
      .set({
        stage,
        lastContactedAt:
          parsed.data.direction === "outbound" ? now : existing.lastContactedAt,
        proposalSentAt:
          parsed.data.type === "proposal"
            ? (existing.proposalSentAt ?? now)
            : existing.proposalSentAt,
        updatedAt: now,
        version: existing.version + 1,
      })
      .where(eq(prospects.id, prospectId))
      .returning()

    await db.insert(commercialAudit).values({
      actorUserId: actor.id,
      entity: "prospect",
      recordId: String(prospectId),
      action: "activity",
      beforeValue: existing,
      afterValue: { prospect, activity },
    })
    return NextResponse.json({ ok: true, activity, prospect }, { status: 201 })
  })
}

function nextStageAfterActivity(
  stage: ProspectStage,
  direction: OutreachDirection,
  type: OutreachActivityType,
) {
  if (stage === "won" || stage === "lost") return stage
  if (type === "proposal") return "proposal_sent"
  if (direction === "inbound" && stageIndex(stage) < stageIndex("replied"))
    return "replied"
  if (direction === "outbound" && stageIndex(stage) < stageIndex("contacted"))
    return "contacted"
  return stage
}
