import "server-only"

import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  ventureApprovalRequests,
  ventureAuditEvents,
  ventureBudgetEnvelopes,
  ventureExperiments,
  ventureLedgerJournals,
  ventureRuntimeState,
  ventureServiceAccounts,
} from "@/lib/schema"
import {
  ventureControlState,
  ventureEvidence,
  ventureOpportunities,
  ventureProposals,
} from "@/lib/venture-lab/access-schema"

const EXPERIMENT_ZERO_CODE = "EXP-000"

export async function getVentureLabDashboardSnapshot() {
  const [experiment] = await db.select().from(ventureExperiments)
    .where(eq(ventureExperiments.code, EXPERIMENT_ZERO_CODE)).limit(1)
  if (!experiment) return null

  const [
    runtime,
    envelopes,
    opportunities,
    evidence,
    proposals,
    approvals,
    journals,
    audits,
    control,
    services,
    ledgerTotals,
  ] = await Promise.all([
    db.select().from(ventureRuntimeState).where(eq(ventureRuntimeState.id, 1)).limit(1),
    db.select().from(ventureBudgetEnvelopes).where(eq(ventureBudgetEnvelopes.experimentId, experiment.id)),
    db.select().from(ventureOpportunities).where(eq(ventureOpportunities.experimentId, experiment.id)).orderBy(desc(ventureOpportunities.createdAt)).limit(50),
    db.select().from(ventureEvidence).where(eq(ventureEvidence.experimentId, experiment.id)).orderBy(desc(ventureEvidence.createdAt)).limit(50),
    db.select().from(ventureProposals).where(eq(ventureProposals.experimentId, experiment.id)).orderBy(desc(ventureProposals.createdAt)).limit(50),
    db.select().from(ventureApprovalRequests).where(eq(ventureApprovalRequests.experimentId, experiment.id)).orderBy(desc(ventureApprovalRequests.requestedAt)).limit(50),
    db.select().from(ventureLedgerJournals).where(eq(ventureLedgerJournals.experimentId, experiment.id)).orderBy(desc(ventureLedgerJournals.createdAt)).limit(50),
    db.select().from(ventureAuditEvents).where(eq(ventureAuditEvents.experimentId, experiment.id)).orderBy(desc(ventureAuditEvents.createdAt)).limit(100),
    db.select().from(ventureControlState).where(eq(ventureControlState.experimentId, experiment.id)).limit(1),
    db.select({
      id: ventureServiceAccounts.id,
      displayName: ventureServiceAccounts.displayName,
      active: ventureServiceAccounts.active,
      revokedAt: ventureServiceAccounts.revokedAt,
      tokenVersion: ventureServiceAccounts.tokenVersion,
    }).from(ventureServiceAccounts),
    db.execute(sql`
      SELECT
        COALESCE(SUM(p.debit_minor), 0)::int AS debit_minor,
        COALESCE(SUM(p.credit_minor), 0)::int AS credit_minor
      FROM venture_ledger_postings p
      JOIN venture_ledger_journals j ON j.id = p.journal_id
      WHERE j.experiment_id = ${experiment.id}
    `),
  ])

  const protectedReserve = envelopes.find((row) => row.kind === "protected_reserve")
  const experimentBudget = envelopes.find((row) => row.kind === "experiment")
  const totals = ledgerTotals.rows[0] as { debit_minor?: number; credit_minor?: number } | undefined

  return {
    experiment,
    runtime: runtime[0] ?? { paused: true, pauseReason: "Runtime state unavailable." },
    treasury: {
      foundingCapitalMinor: (protectedReserve?.allocatedMinor ?? 0) + (experimentBudget?.allocatedMinor ?? 0),
      protectedReserve,
      experimentBudget,
    },
    opportunities,
    evidence,
    proposals,
    approvals,
    ledger: {
      journals,
      debitMinor: Number(totals?.debit_minor ?? 0),
      creditMinor: Number(totals?.credit_minor ?? 0),
    },
    audit: audits,
    services,
    control: control[0] ?? {
      currentBlocker: "Control state has not been initialized.",
      nextDecision: "Initialize Venture Lab control state.",
      updatedAt: null,
    },
  }
}
