import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { leadScoreSnapshots, outreachActivities, proposalTrackings, prospects } from "@/lib/schema"
import { scoreLead, type LeadScoreOutcome, type LeadScoreResult } from "@/lib/lead-scoring"

export type LeadScoreSnapshotRow = typeof leadScoreSnapshots.$inferSelect

export async function createLeadScoreSnapshot(prospectId: number) {
  const context = await loadLeadScoreContext(prospectId)
  if (!context) return null

  const result = scoreLead(context)
  const [snapshot] = await db
    .insert(leadScoreSnapshots)
    .values(toSnapshotInsert(prospectId, result))
    .returning()

  return snapshot
}

export async function getLatestLeadScoreSnapshots() {
  const rows = await db
    .select()
    .from(leadScoreSnapshots)
    .orderBy(desc(leadScoreSnapshots.createdAt))

  const byProspect = new Map<number, LeadScoreSnapshotRow>()
  for (const row of rows) {
    if (!byProspect.has(row.prospectId)) byProspect.set(row.prospectId, row)
  }
  return byProspect
}

export async function getLatestLeadScoreSnapshot(prospectId: number) {
  const [snapshot] = await db
    .select()
    .from(leadScoreSnapshots)
    .where(eq(leadScoreSnapshots.prospectId, prospectId))
    .orderBy(desc(leadScoreSnapshots.createdAt))
    .limit(1)

  return snapshot ?? null
}

export async function applyLeadScoreOverride(input: { prospectId: number; overrideScore: number; reason: string; actor: string }) {
  const latest = await getLatestLeadScoreSnapshot(input.prospectId) ?? await createLeadScoreSnapshot(input.prospectId)
  if (!latest) return null

  const [snapshot] = await db
    .update(leadScoreSnapshots)
    .set({
      overrideScore: input.overrideScore,
      overrideReason: input.reason,
      overrideBy: input.actor,
      overrideAt: new Date(),
    })
    .where(eq(leadScoreSnapshots.id, latest.id))
    .returning()

  return snapshot
}

export async function recordLeadScoreOutcome(input: { prospectId: number; outcome: LeadScoreOutcome; outcomeValue: number; outcomeRetainer: number; notes: string | null }) {
  const latest = await getLatestLeadScoreSnapshot(input.prospectId) ?? await createLeadScoreSnapshot(input.prospectId)
  if (!latest) return null

  const [snapshot] = await db
    .update(leadScoreSnapshots)
    .set({
      outcome: input.outcome,
      outcomeValue: input.outcomeValue,
      outcomeRetainer: input.outcomeRetainer,
      outcomeNotes: input.notes,
      outcomeRecordedAt: new Date(),
    })
    .where(eq(leadScoreSnapshots.id, latest.id))
    .returning()

  return snapshot
}

async function loadLeadScoreContext(prospectId: number) {
  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1)
  if (!prospect) return null

  const [activities, proposals] = await Promise.all([
    db.select().from(outreachActivities).where(eq(outreachActivities.prospectId, prospectId)).orderBy(desc(outreachActivities.createdAt)),
    db.select().from(proposalTrackings).where(eq(proposalTrackings.prospectId, prospectId)).orderBy(desc(proposalTrackings.createdAt)),
  ])

  return { prospect, activities, proposals }
}

function toSnapshotInsert(prospectId: number, result: LeadScoreResult): typeof leadScoreSnapshots.$inferInsert {
  return {
    prospectId,
    score: result.score,
    confidence: result.confidence,
    probabilityOfClosing: result.probabilityOfClosing,
    estimatedProjectValue: result.estimatedProjectValue,
    estimatedRetainerPotential: result.estimatedRetainerPotential,
    recommendedNextAction: result.recommendedNextAction,
    positiveFactors: result.positiveFactors,
    negativeFactors: result.negativeFactors,
    neutralFactors: result.neutralFactors,
    missingInformation: result.missingInformation,
    affectedData: result.affectedData,
    modelVersion: result.modelVersion,
  }
}
