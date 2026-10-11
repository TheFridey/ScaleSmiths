import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db as rootDb } from "@/lib/db"
import { commercialAudit, proposalTrackings, prospects } from "@/lib/schema"
import { guardApiCapability } from "@/lib/server/rbac"
import { AdminIdentityError } from "@/lib/admin-users"
import {
  isProspectStage,
  optionalString,
  parseProposalPayload,
  parseProspectPayload,
  stageDateUpdates,
} from "@/lib/prospects"

export const dynamic = "force-dynamic"

export async function PATCH(
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
  const id = Number(rawId)

  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid prospect id." }, { status: 400 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid prospect payload." },
      { status: 400 },
    )
  }

  return rootDb.transaction(async (db) => {
    const [existing] = await db
      .select()
      .from(prospects)
      .where(eq(prospects.id, id))
      .limit(1)
      .for("update")

    if (!existing) {
      return NextResponse.json(
        { error: "Prospect not found." },
        { status: 404 },
      )
    }
    if ((body as Record<string, unknown>).version !== existing.version)
      return NextResponse.json(
        { error: "This record changed. Reload before saving." },
        { status: 409 },
      )
    const perform = async () => {
      const action =
        optionalString((body as Record<string, unknown>).action) ?? "update"
      const now = new Date()

      if (action === "moveStage") {
        const stage = (body as Record<string, unknown>).stage

        if (!isProspectStage(stage)) {
          return NextResponse.json(
            { error: "Invalid prospect stage." },
            { status: 400 },
          )
        }

        if (
          stage === "lost" &&
          !optionalString((body as Record<string, unknown>).lostReason)
        ) {
          return NextResponse.json(
            { error: "Lost prospects need a lost reason." },
            { status: 400 },
          )
        }

        const [prospect] = await db
          .update(prospects)
          .set({
            ...stageDateUpdates(stage, now, existing),
            lostReason:
              stage === "lost"
                ? optionalString((body as Record<string, unknown>).lostReason)
                : existing.lostReason,
            updatedAt: now,
          })
          .where(eq(prospects.id, id))
          .returning()

        return NextResponse.json({ ok: true, prospect })
      }

      if (action === "setFollowUp") {
        const parsed = parseProspectPayload(
          { nextFollowUpAt: (body as Record<string, unknown>).nextFollowUpAt },
          "patch",
        )

        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 })
        }

        const [prospect] = await db
          .update(prospects)
          .set({
            nextFollowUpAt: parsed.data.nextFollowUpAt ?? null,
            stage:
              existing.stage === "won" || existing.stage === "lost"
                ? existing.stage
                : "follow_up_due",
            updatedAt: now,
          })
          .where(eq(prospects.id, id))
          .returning()

        return NextResponse.json({ ok: true, prospect })
      }

      if (action === "markProposalSent") {
        const parsed = parseProposalPayload(body as Record<string, unknown>)

        if (!parsed.ok) {
          return NextResponse.json({ error: parsed.error }, { status: 400 })
        }

        const sentAt = parsed.data.sentAt ?? now
        const [proposal] = await db
          .insert(proposalTrackings)
          .values({
            prospectId: id,
            packageType: parsed.data.packageType,
            quotedAmount: parsed.data.quotedAmount,
            monthlyRetainerAmount: parsed.data.monthlyRetainerAmount,
            status: parsed.data.status,
            sentAt,
            acceptedAt: parsed.data.acceptedAt ?? null,
            rejectedAt: parsed.data.rejectedAt ?? null,
            notes: parsed.data.notes ?? null,
            updatedAt: now,
          })
          .returning()

        const [prospect] = await db
          .update(prospects)
          .set({
            stage: "proposal_sent",
            proposalSentAt: existing.proposalSentAt ?? sentAt,
            estimatedProjectValue:
              parsed.data.quotedAmount || existing.estimatedProjectValue,
            estimatedMonthlyRetainer:
              parsed.data.monthlyRetainerAmount ||
              existing.estimatedMonthlyRetainer,
            updatedAt: now,
          })
          .where(eq(prospects.id, id))
          .returning()

        return NextResponse.json({ ok: true, prospect, proposal })
      }

      if (action === "markWon") {
        await db
          .update(proposalTrackings)
          .set({ status: "accepted", acceptedAt: now, updatedAt: now })
          .where(eq(proposalTrackings.prospectId, id))

        const [prospect] = await db
          .update(prospects)
          .set({ stage: "won", wonAt: existing.wonAt ?? now, updatedAt: now })
          .where(eq(prospects.id, id))
          .returning()

        return NextResponse.json({ ok: true, prospect })
      }

      if (action === "markLost") {
        const lostReason = optionalString(
          (body as Record<string, unknown>).lostReason,
        )

        if (!lostReason) {
          return NextResponse.json(
            { error: "Lost prospects need a lost reason." },
            { status: 400 },
          )
        }

        await db
          .update(proposalTrackings)
          .set({ status: "rejected", rejectedAt: now, updatedAt: now })
          .where(eq(proposalTrackings.prospectId, id))

        const [prospect] = await db
          .update(prospects)
          .set({
            stage: "lost",
            lostAt: existing.lostAt ?? now,
            lostReason,
            updatedAt: now,
          })
          .where(eq(prospects.id, id))
          .returning()

        return NextResponse.json({ ok: true, prospect })
      }

      const parsed = parseProspectPayload(
        body as Record<string, unknown>,
        "patch",
      )

      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 })
      }

      if (Object.keys(parsed.data).length === 0) {
        return NextResponse.json(
          { error: "No prospect fields supplied." },
          { status: 400 },
        )
      }

      const [prospect] = await db
        .update(prospects)
        .set({ ...parsed.data, updatedAt: now })
        .where(eq(prospects.id, id))
        .returning()

      return NextResponse.json({ ok: true, prospect })
    }
    const response = await perform()
    if (response.ok) {
      const [after] = await db
        .select()
        .from(prospects)
        .where(eq(prospects.id, id))
      await db.insert(commercialAudit).values({
        actorUserId: actor.id,
        entity: "prospect",
        recordId: String(id),
        action: String((body as Record<string, unknown>).action ?? "update"),
        beforeValue: existing,
        afterValue: after,
      })
      const payload = await response.json()
      return NextResponse.json({ ...payload, prospect: after })
    }
    return response
  })
}
