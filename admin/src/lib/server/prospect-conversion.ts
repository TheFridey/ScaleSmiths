import "server-only"

import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  clients,
  invoiceCatalogueItems,
  leadScoreSnapshots,
  outreachActivities,
  proposalTrackings,
  prospectConversions,
  prospects,
  salesProposals,
} from "@/lib/schema"
import {
  ProspectConversionError,
  buildConversionPlan,
  matchExistingClients,
  type ConversionPlan,
} from "@/lib/prospect-conversion"

export interface ConversionActor { id: string; email?: string | null; name?: string | null }
export type ProspectConversionRow = typeof prospectConversions.$inferSelect
export interface ConversionPlanResponse extends ConversionPlan {
  catalogue: Array<{ id: number; name: string; defaultUnitAmount: number; category: string | null }>
}

export async function loadConversionRecord(prospectId: number) {
  const [row] = await db.select().from(prospectConversions).where(eq(prospectConversions.prospectId, prospectId)).limit(1)
  return row ?? null
}

async function loadOpportunity(prospectId: number) {
  const [prospect] = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1)
  if (!prospect) throw new ProspectConversionError("Prospect not found.", 404, "not_found")
  const [activities, trackings, proposals, scores] = await Promise.all([
    db.select().from(outreachActivities).where(eq(outreachActivities.prospectId, prospectId)).orderBy(desc(outreachActivities.createdAt)),
    db.select().from(proposalTrackings).where(eq(proposalTrackings.prospectId, prospectId)).orderBy(desc(proposalTrackings.createdAt)),
    db.select().from(salesProposals).where(eq(salesProposals.prospectId, prospectId)).orderBy(desc(salesProposals.updatedAt)),
    db.select().from(leadScoreSnapshots).where(eq(leadScoreSnapshots.prospectId, prospectId)).orderBy(desc(leadScoreSnapshots.createdAt)).limit(1),
  ])
  return { prospect, activities, trackings, proposals, leadScore: scores[0] ?? null }
}

export function planInputs(data: Awaited<ReturnType<typeof loadOpportunity>>) {
  return {
    prospect: data.prospect as Record<string, unknown> & { id: number },
    activities: data.activities.map((a) => ({ type: a.type, direction: a.direction, subject: a.subject, outcome: a.outcome, createdAt: a.createdAt })),
    proposalTrackings: data.trackings.map((t) => ({ packageType: t.packageType, quotedAmount: t.quotedAmount, monthlyRetainerAmount: t.monthlyRetainerAmount, status: t.status, sentAt: t.sentAt, acceptedAt: t.acceptedAt })),
    salesProposals: data.proposals.map((p) => ({ status: p.status, selectedServices: p.selectedServices, buildPrice: p.buildPrice, retainerPrice: p.retainerPrice, packageType: null })),
    leadScore: data.leadScore ? { id: data.leadScore.id, score: data.leadScore.score } : null,
  }
}

export async function previewConversion(prospectId: number, _actor: ConversionActor): Promise<ConversionPlanResponse> {
  const data = await loadOpportunity(prospectId)
  const existing = await loadConversionRecord(prospectId)
  const [allClients, catalogue] = await Promise.all([
    db.select({ id: clients.id, name: clients.name, contactEmail: clients.contactEmail, tier: clients.tier, mrr: clients.mrr }).from(clients),
    db.select({ id: invoiceCatalogueItems.id, name: invoiceCatalogueItems.name, defaultUnitAmount: invoiceCatalogueItems.defaultUnitAmount, category: invoiceCatalogueItems.category, active: invoiceCatalogueItems.active }).from(invoiceCatalogueItems).orderBy(invoiceCatalogueItems.position, invoiceCatalogueItems.name),
  ])
  const matchCandidates = matchExistingClients(
    { businessName: data.prospect.businessName, contactEmail: data.prospect.contactEmail },
    allClients,
  )
  const plan = buildConversionPlan({ ...planInputs(data), matchCandidates, existingConversionId: existing?.id ?? null })
  return { ...plan, catalogue: catalogue.filter((c) => c.active).map(({ active: _a, ...rest }) => rest) }
}
