import "server-only"

import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { computeSalesMetrics } from "@/lib/prospects"
import { outreachActivities, proposalTrackings, prospects, salesProposals } from "@/lib/schema"

export async function listClientSalesProposals() {
  return db.select().from(salesProposals).orderBy(desc(salesProposals.updatedAt))
}

export async function getSalesDashboardSnapshot(now = new Date()) {
  const [prospectRows, activityRows, proposalRows, salesProposalRows, proposalStageProspects] = await Promise.all([
    db.select({ stage: prospects.stage, estimatedProjectValue: prospects.estimatedProjectValue,
      estimatedMonthlyRetainer: prospects.estimatedMonthlyRetainer, nextFollowUpAt: prospects.nextFollowUpAt,
      discoveryCallAt: prospects.discoveryCallAt, proposalSentAt: prospects.proposalSentAt,
      wonAt: prospects.wonAt, lostAt: prospects.lostAt }).from(prospects),
    db.select({ direction: outreachActivities.direction, createdAt: outreachActivities.createdAt }).from(outreachActivities),
    db.select({ status: proposalTrackings.status, sentAt: proposalTrackings.sentAt }).from(proposalTrackings),
    db.select({ prospectId: salesProposals.prospectId }).from(salesProposals),
    db.select({ id: prospects.id, businessName: prospects.businessName, contactName: prospects.contactName,
      proposalSentAt: prospects.proposalSentAt }).from(prospects).where(eq(prospects.stage, "proposal_sent")),
  ])
  const withDraft = new Set(salesProposalRows.map((row) => row.prospectId).filter((id): id is number => typeof id === "number"))
  return {
    metrics: computeSalesMetrics(prospectRows, activityRows, proposalRows, now),
    proposalsMissing: proposalStageProspects.filter((row) => !withDraft.has(row.id)).map((row) => ({
      ...row, proposalSentAt: row.proposalSentAt?.toISOString() ?? null,
    })).slice(0, 8),
  }
}
