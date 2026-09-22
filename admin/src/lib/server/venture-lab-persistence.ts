import "server-only"

import { and, eq, gt, sql } from "drizzle-orm"
import type { AdminDatabaseTransaction } from "@/lib/db"
import { db } from "@/lib/db"
import {
  ventureApprovalEvents,
  ventureApprovalRequests,
  ventureAuditEvents,
  ventureBudgetEnvelopes,
  ventureBudgetReservations,
  ventureExperiments,
  ventureLedgerAccounts,
  ventureLedgerJournals,
  ventureLedgerPostings,
  ventureRuntimeState,
  ventureServiceAccounts,
} from "@/lib/schema"
import { canonicalJson } from "@/lib/venture-lab/canonical"
import { hashApprovalPayload } from "@/lib/venture-lab/approval"
import { assertMinorUnits, EXPERIMENT_ZERO_CAPITAL } from "@/lib/venture-lab/money"
import type { ApprovalPayload } from "@/lib/venture-lab/types"

export class VentureLabPersistenceError extends Error {
  constructor(public safeMessage: string, public code: string) {
    super(safeMessage)
    this.name = "VentureLabPersistenceError"
  }
}

const EXPERIMENT_ZERO_CODE = "EXP-000"
const FOUNDING_JOURNAL_KEY = "venture:EXP-000:founding-capital"

export async function initializeExperimentZero(input: {
  serviceAccountId: string
  serviceAccountName: string
}) {
  const serviceAccountId = requiredText(input.serviceAccountId, "serviceAccountId")
  const serviceAccountName = requiredText(input.serviceAccountName, "serviceAccountName")

  return db.transaction(async (tx) => {
    await tx.insert(ventureRuntimeState).values({ id: 1, paused: false }).onConflictDoNothing()
    await tx.insert(ventureServiceAccounts).values({
      id: serviceAccountId,
      displayName: serviceAccountName,
      active: true,
    }).onConflictDoNothing()

    const [serviceAccount] = await tx.select().from(ventureServiceAccounts)
      .where(eq(ventureServiceAccounts.id, serviceAccountId)).limit(1)
    if (!serviceAccount?.active || serviceAccount.revokedAt) {
      throw new VentureLabPersistenceError("The Venture Lab service account is revoked.", "service_revoked")
    }

    await tx.insert(ventureExperiments).values({
      code: EXPERIMENT_ZERO_CODE,
      name: "Experiment #000 — Simulation and Red Team",
      mode: "SIMULATED",
      status: "PREPARING",
    }).onConflictDoNothing()

    const [experiment] = await tx.select().from(ventureExperiments)
      .where(eq(ventureExperiments.code, EXPERIMENT_ZERO_CODE)).limit(1)
    if (!experiment) throw new VentureLabPersistenceError("Experiment #000 could not be initialized.", "experiment_missing")

    await tx.insert(ventureBudgetEnvelopes).values([
      {
        experimentId: experiment.id,
        kind: "protected_reserve",
        allocatedMinor: EXPERIMENT_ZERO_CAPITAL.protectedReserveMinor,
        reservedMinor: 0,
        spentMinor: 0,
        spendable: false,
      },
      {
        experimentId: experiment.id,
        kind: "experiment",
        allocatedMinor: EXPERIMENT_ZERO_CAPITAL.experimentAllocationMinor,
        reservedMinor: 0,
        spentMinor: 0,
        spendable: true,
      },
    ]).onConflictDoNothing()

    await tx.insert(ventureLedgerAccounts).values([
      { code: "simulated_cash", name: "Simulated Cash", kind: "asset" },
      { code: "founding_capital", name: "Founding Capital", kind: "equity" },
      { code: "validation_expense", name: "Validation Expense", kind: "expense" },
    ]).onConflictDoNothing()

    const [existingJournal] = await tx.select({ id: ventureLedgerJournals.id })
      .from(ventureLedgerJournals)
      .where(eq(ventureLedgerJournals.idempotencyKey, FOUNDING_JOURNAL_KEY))
      .limit(1)

    if (!existingJournal) {
      const [cash] = await tx.select().from(ventureLedgerAccounts)
        .where(eq(ventureLedgerAccounts.code, "simulated_cash")).limit(1)
      const [capital] = await tx.select().from(ventureLedgerAccounts)
        .where(eq(ventureLedgerAccounts.code, "founding_capital")).limit(1)
      if (!cash || !capital) throw new VentureLabPersistenceError("Venture Lab ledger accounts are incomplete.", "ledger_accounts_missing")

      const [journal] = await tx.insert(ventureLedgerJournals).values({
        experimentId: experiment.id,
        idempotencyKey: FOUNDING_JOURNAL_KEY,
        description: "Experiment #000 simulated founding capital",
        actorType: "system",
        actorKey: "venture-lab-bootstrap",
      }).returning()

      await tx.insert(ventureLedgerPostings).values([
        {
          journalId: journal.id,
          accountId: cash.id,
          debitMinor: EXPERIMENT_ZERO_CAPITAL.foundingCapitalMinor,
          creditMinor: 0,
        },
        {
          journalId: journal.id,
          accountId: capital.id,
          debitMinor: 0,
          creditMinor: EXPERIMENT_ZERO_CAPITAL.foundingCapitalMinor,
        },
      ])
      await tx.update(ventureLedgerJournals).set({
        sealed: true,
        sealedAt: sql`CURRENT_TIMESTAMP`,
      }).where(eq(ventureLedgerJournals.id, journal.id))

      await tx.insert(ventureAuditEvents).values({
        experimentId: experiment.id,
        actorType: "system",
        actorKey: "venture-lab-bootstrap",
        action: "experiment_zero_initialized",
        reason: "Initialized simulated £100 treasury and Experiment #000 governance state.",
        journalId: journal.id,
      })
    }

    return loadExperimentZeroSnapshot(tx, experiment.id)
  }, { isolationLevel: "serializable" })
}

export async function createVentureSpendApprovalRequest(input: {
  experimentCode?: string
  action: string
  amountMinor: number
  currency?: string
  target: string
  purpose: string
  metadata?: Record<string, unknown>
  requestedByService: string
  requestIdempotencyKey: string
  requestedAt?: Date
  expiresAt: Date
}) {
  const amountMinor = positiveMinor(input.amountMinor)
  const action = requiredText(input.action, "action")
  const target = requiredText(input.target, "target")
  const purpose = requiredText(input.purpose, "purpose")
  const requestedByService = requiredText(input.requestedByService, "requestedByService")
  const requestIdempotencyKey = requiredText(input.requestIdempotencyKey, "requestIdempotencyKey")
  const currency = (input.currency ?? "GBP").trim().toUpperCase()
  if (currency !== "GBP") throw new VentureLabPersistenceError("Experiment #000 currently supports GBP only.", "currency_not_allowed")

  const requestedAt = input.requestedAt ?? new Date()
  if (!(input.expiresAt instanceof Date) || Number.isNaN(input.expiresAt.getTime()) || input.expiresAt <= requestedAt) {
    throw new VentureLabPersistenceError("Approval expiry must be after the request timestamp.", "invalid_expiry")
  }

  return db.transaction(async (tx) => {
    await assertAgentMutationAllowed(tx, requestedByService)

    const code = input.experimentCode ?? EXPERIMENT_ZERO_CODE
    const [experiment] = await tx.select().from(ventureExperiments)
      .where(eq(ventureExperiments.code, code)).limit(1)
    if (!experiment) throw new VentureLabPersistenceError("Venture Lab experiment not found.", "experiment_missing")

    const [existing] = await tx.select().from(ventureApprovalRequests)
      .where(eq(ventureApprovalRequests.requestIdempotencyKey, requestIdempotencyKey)).limit(1)
    if (existing) throw new VentureLabPersistenceError("This approval request has already been recorded.", "duplicate_request")

    const payload: ApprovalPayload = {
      action,
      experimentId: experiment.id,
      amountMinor,
      currency,
      target,
      purpose,
      metadata: input.metadata ?? null,
    }
    const payloadJson = JSON.parse(canonicalJson(payload)) as Record<string, unknown>
    const payloadHash = hashApprovalPayload(payload)

    const [approval] = await tx.insert(ventureApprovalRequests).values({
      experimentId: experiment.id,
      action,
      amountMinor,
      currency,
      target,
      purpose,
      payloadHash,
      payloadJson,
      requestIdempotencyKey,
      requestedByService,
      requestedAt,
      expiresAt: input.expiresAt,
    }).returning()

    await tx.insert(ventureApprovalEvents).values({
      approvalId: approval.id,
      eventType: "REQUESTED",
      actorType: "service",
      actorKey: requestedByService,
      metadataJson: { payloadHash },
    })
    await tx.insert(ventureAuditEvents).values({
      experimentId: experiment.id,
      actorType: "service",
      actorKey: requestedByService,
      action: "spend_approval_requested",
      reason: purpose,
      metadataJson: { amountMinor, currency, target, payloadHash },
      approvalId: approval.id,
      requestId: requestIdempotencyKey,
    })

    return approval
  }, { isolationLevel: "serializable" })
}

export async function approveVentureSpendRequest(input: {
  approvalId: string
  actorUserId: string
  reason: string
}) {
  const actorUserId = requiredText(input.actorUserId, "actorUserId")
  const reason = requiredText(input.reason, "reason")

  return db.transaction(async (tx) => {
    const [approval] = await tx.update(ventureApprovalRequests).set({
      status: "APPROVED",
      approvedBy: actorUserId,
      approvedAt: sql`CURRENT_TIMESTAMP`,
      decisionReason: reason,
    }).where(and(
      eq(ventureApprovalRequests.id, input.approvalId),
      eq(ventureApprovalRequests.status, "REQUESTED"),
      gt(ventureApprovalRequests.expiresAt, sql`CURRENT_TIMESTAMP`),
    )).returning()

    if (!approval) throw new VentureLabPersistenceError("Approval request is missing, expired, or no longer requestable.", "approval_not_requestable")

    await tx.insert(ventureApprovalEvents).values({
      approvalId: approval.id,
      eventType: "APPROVED",
      actorType: "human",
      actorKey: actorUserId,
      metadataJson: { reason },
    })
    await tx.insert(ventureAuditEvents).values({
      experimentId: approval.experimentId,
      actorType: "human",
      actorKey: actorUserId,
      action: "spend_approval_approved",
      reason,
      approvalId: approval.id,
    })

    return approval
  }, { isolationLevel: "serializable" })
}

export async function reserveApprovedVentureBudget(input: {
  approvalId: string
  requestedByService: string
  idempotencyKey: string
  action: string
  amountMinor: number
  currency?: string
  target: string
  purpose: string
  metadata?: Record<string, unknown>
}) {
  const requestedByService = requiredText(input.requestedByService, "requestedByService")
  const idempotencyKey = requiredText(input.idempotencyKey, "idempotencyKey")
  const action = requiredText(input.action, "action")
  const amountMinor = positiveMinor(input.amountMinor)
  const currency = (input.currency ?? "GBP").trim().toUpperCase()
  const target = requiredText(input.target, "target")
  const purpose = requiredText(input.purpose, "purpose")
  if (currency !== "GBP") throw new VentureLabPersistenceError("Experiment #000 currently supports GBP only.", "currency_not_allowed")

  return db.transaction(async (tx) => {
    await assertAgentMutationAllowed(tx, requestedByService)

    const [duplicate] = await tx.select({ id: ventureBudgetReservations.id })
      .from(ventureBudgetReservations)
      .where(eq(ventureBudgetReservations.idempotencyKey, idempotencyKey))
      .limit(1)
    if (duplicate) throw new VentureLabPersistenceError("This spend reservation has already been processed.", "duplicate_reservation")

    const [approval] = await tx.select().from(ventureApprovalRequests)
      .where(eq(ventureApprovalRequests.id, input.approvalId)).limit(1)
    if (!approval) throw new VentureLabPersistenceError("Approval request not found.", "approval_missing")

    const expectedPayload: ApprovalPayload = {
      action,
      experimentId: approval.experimentId,
      amountMinor,
      currency,
      target,
      purpose,
      metadata: input.metadata ?? null,
    }
    const expectedHash = hashApprovalPayload(expectedPayload)
    if (
      approval.status !== "APPROVED"
      || approval.requestedByService !== requestedByService
      || approval.action !== action
      || approval.amountMinor !== amountMinor
      || approval.currency !== currency
      || approval.target !== target
      || approval.purpose !== purpose
      || approval.payloadHash !== expectedHash
    ) {
      throw new VentureLabPersistenceError("Approval is expired, consumed, or does not exactly match this spend payload.", "approval_mismatch")
    }

    const [envelope] = await tx.select().from(ventureBudgetEnvelopes).where(and(
      eq(ventureBudgetEnvelopes.experimentId, approval.experimentId),
      eq(ventureBudgetEnvelopes.kind, "experiment"),
      eq(ventureBudgetEnvelopes.spendable, true),
    )).limit(1)
    if (!envelope) throw new VentureLabPersistenceError("Experiment budget is unavailable.", "budget_unavailable")

    let reservation: typeof ventureBudgetReservations.$inferSelect | undefined
    try {
      ;[reservation] = await tx.insert(ventureBudgetReservations).values({
        envelopeId: envelope.id,
        approvalId: approval.id,
        requestedByService,
        idempotencyKey,
        action,
        payloadHash: expectedHash,
        amountMinor,
        currency,
        target,
        purpose,
        status: "RESERVED",
      }).returning()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/budget would be exceeded/i.test(message)) {
        throw new VentureLabPersistenceError("Experiment budget is exhausted or unavailable.", "budget_exceeded")
      }
      if (/approval is not consumable|consumed or expired concurrently/i.test(message)) {
        throw new VentureLabPersistenceError("Approval is expired or has already been consumed.", "approval_mismatch")
      }
      if (/reservation does not match its approval payload/i.test(message)) {
        throw new VentureLabPersistenceError("Reservation does not exactly match its approval.", "approval_mismatch")
      }
      if (/paused/i.test(message)) {
        throw new VentureLabPersistenceError("Venture Lab is paused. Mutating execution is blocked.", "venture_paused")
      }
      if (/service account is revoked or unavailable/i.test(message)) {
        throw new VentureLabPersistenceError("Venture Lab service account is revoked or unavailable.", "service_revoked")
      }
      throw error
    }
    if (!reservation) throw new VentureLabPersistenceError("Reservation insert returned no row.", "reservation_missing")

    await tx.insert(ventureApprovalEvents).values({
      approvalId: approval.id,
      eventType: "CONSUMED",
      actorType: "service",
      actorKey: requestedByService,
      metadataJson: { reservationId: reservation.id, idempotencyKey, payloadHash: expectedHash },
    })
    await tx.insert(ventureAuditEvents).values({
      experimentId: approval.experimentId,
      actorType: "service",
      actorKey: requestedByService,
      action: "budget_reserved",
      reason: purpose,
      metadataJson: { reservationId: reservation.id, amountMinor, currency, target, payloadHash: expectedHash },
      approvalId: approval.id,
      requestId: idempotencyKey,
    })

    return reservation
  }, { isolationLevel: "serializable" })
}

export async function settleSimulatedVentureSpend(input: {
  reservationId: string
  actorUserId: string
}) {
  const actorUserId = requiredText(input.actorUserId, "actorUserId")

  return db.transaction(async (tx) => {
    await assertRuntimeActive(tx)

    const [reservation] = await tx.select().from(ventureBudgetReservations)
      .where(and(
        eq(ventureBudgetReservations.id, input.reservationId),
        eq(ventureBudgetReservations.status, "RESERVED"),
      )).limit(1)
    if (!reservation) throw new VentureLabPersistenceError("Spend reservation is missing or no longer unsettled.", "reservation_not_settleable")

    const [envelope] = await tx.select().from(ventureBudgetEnvelopes)
      .where(eq(ventureBudgetEnvelopes.id, reservation.envelopeId)).limit(1)
    if (!envelope) throw new VentureLabPersistenceError("Budget envelope not found.", "envelope_missing")

    const [updatedEnvelope] = await tx.update(ventureBudgetEnvelopes).set({
      reservedMinor: sql`${ventureBudgetEnvelopes.reservedMinor} - ${reservation.amountMinor}`,
      spentMinor: sql`${ventureBudgetEnvelopes.spentMinor} + ${reservation.amountMinor}`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(and(
      eq(ventureBudgetEnvelopes.id, envelope.id),
      eq(ventureBudgetEnvelopes.kind, "experiment"),
      eq(ventureBudgetEnvelopes.spendable, true),
      sql`${ventureBudgetEnvelopes.reservedMinor} >= ${reservation.amountMinor}`,
    )).returning()
    if (!updatedEnvelope) throw new VentureLabPersistenceError("Reserved budget cannot be settled safely.", "settlement_budget_mismatch")

    const [settled] = await tx.update(ventureBudgetReservations).set({
      status: "SETTLED",
      settledAt: sql`CURRENT_TIMESTAMP`,
    }).where(and(
      eq(ventureBudgetReservations.id, reservation.id),
      eq(ventureBudgetReservations.status, "RESERVED"),
    )).returning()
    if (!settled) throw new VentureLabPersistenceError("Spend reservation was settled concurrently.", "reservation_race")

    const [cash] = await tx.select().from(ventureLedgerAccounts)
      .where(eq(ventureLedgerAccounts.code, "simulated_cash")).limit(1)
    const [expense] = await tx.select().from(ventureLedgerAccounts)
      .where(eq(ventureLedgerAccounts.code, "validation_expense")).limit(1)
    if (!cash || !expense) throw new VentureLabPersistenceError("Venture Lab ledger accounts are incomplete.", "ledger_accounts_missing")

    const journalKey = `reservation:${reservation.id}:settlement`
    const [journal] = await tx.insert(ventureLedgerJournals).values({
      experimentId: envelope.experimentId,
      approvalId: reservation.approvalId,
      idempotencyKey: journalKey,
      description: `Simulated spend: ${reservation.purpose}`,
      actorType: "human",
      actorKey: actorUserId,
    }).returning()

    await tx.insert(ventureLedgerPostings).values([
      {
        journalId: journal.id,
        accountId: expense.id,
        debitMinor: reservation.amountMinor,
        creditMinor: 0,
      },
      {
        journalId: journal.id,
        accountId: cash.id,
        debitMinor: 0,
        creditMinor: reservation.amountMinor,
      },
    ])
    await tx.update(ventureLedgerJournals).set({
      sealed: true,
      sealedAt: sql`CURRENT_TIMESTAMP`,
    }).where(eq(ventureLedgerJournals.id, journal.id))

    await tx.insert(ventureAuditEvents).values({
      experimentId: envelope.experimentId,
      actorType: "human",
      actorKey: actorUserId,
      action: "simulated_spend_settled",
      reason: reservation.purpose,
      metadataJson: { reservationId: reservation.id, amountMinor: reservation.amountMinor },
      approvalId: reservation.approvalId,
      journalId: journal.id,
      requestId: journalKey,
    })

    return { reservation: settled, journal, envelope: updatedEnvelope }
  }, { isolationLevel: "serializable" })
}

export async function activateVentureEmergencyStop(input: {
  actorUserId: string
  reason: string
}) {
  const actorUserId = requiredText(input.actorUserId, "actorUserId")
  const reason = requiredText(input.reason, "reason")

  return db.transaction(async (tx) => {
    await tx.insert(ventureRuntimeState).values({ id: 1, paused: false }).onConflictDoNothing()
    const [state] = await tx.update(ventureRuntimeState).set({
      paused: true,
      pausedAt: sql`CURRENT_TIMESTAMP`,
      pausedBy: actorUserId,
      pauseReason: reason,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(and(eq(ventureRuntimeState.id, 1), eq(ventureRuntimeState.paused, false))).returning()

    if (state) {
      await tx.insert(ventureAuditEvents).values({
        actorType: "human",
        actorKey: actorUserId,
        action: "emergency_stop_activated",
        reason,
      })
    }

    const [current] = await tx.select().from(ventureRuntimeState).where(eq(ventureRuntimeState.id, 1)).limit(1)
    return current
  }, { isolationLevel: "serializable" })
}

export async function resumeVentureLab(input: {
  actorUserId: string
  reason: string
}) {
  const actorUserId = requiredText(input.actorUserId, "actorUserId")
  const reason = requiredText(input.reason, "reason")

  return db.transaction(async (tx) => {
    const [state] = await tx.update(ventureRuntimeState).set({
      paused: false,
      pausedAt: null,
      pausedBy: null,
      pauseReason: null,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(and(eq(ventureRuntimeState.id, 1), eq(ventureRuntimeState.paused, true))).returning()

    if (state) {
      await tx.insert(ventureAuditEvents).values({
        actorType: "human",
        actorKey: actorUserId,
        action: "emergency_stop_released",
        reason,
      })
    }
    return state ?? null
  }, { isolationLevel: "serializable" })
}

export async function revokeVentureServiceAccount(input: {
  serviceAccountId: string
  actorUserId: string
  reason: string
}) {
  const serviceAccountId = requiredText(input.serviceAccountId, "serviceAccountId")
  const actorUserId = requiredText(input.actorUserId, "actorUserId")
  const reason = requiredText(input.reason, "reason")

  return db.transaction(async (tx) => {
    const [account] = await tx.update(ventureServiceAccounts).set({
      active: false,
      revokedAt: sql`CURRENT_TIMESTAMP`,
      tokenVersion: sql`${ventureServiceAccounts.tokenVersion} + 1`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).where(and(
      eq(ventureServiceAccounts.id, serviceAccountId),
      eq(ventureServiceAccounts.active, true),
    )).returning()

    if (!account) throw new VentureLabPersistenceError("Service account is missing or already revoked.", "service_not_revocable")

    await tx.insert(ventureAuditEvents).values({
      actorType: "human",
      actorKey: actorUserId,
      action: "service_account_revoked",
      reason,
      metadataJson: { serviceAccountId, tokenVersion: account.tokenVersion },
    })

    return account
  }, { isolationLevel: "serializable" })
}

async function assertRuntimeActive(tx: AdminDatabaseTransaction) {
  const [state] = await tx.select().from(ventureRuntimeState)
    .where(eq(ventureRuntimeState.id, 1)).limit(1)
  if (!state || state.paused) {
    throw new VentureLabPersistenceError("Venture Lab is paused. Mutating execution is blocked.", "venture_paused")
  }
}

async function assertAgentMutationAllowed(tx: AdminDatabaseTransaction, serviceAccountId: string) {
  await assertRuntimeActive(tx)
  const [account] = await tx.select().from(ventureServiceAccounts)
    .where(eq(ventureServiceAccounts.id, serviceAccountId)).limit(1)
  if (!account?.active || account.revokedAt) {
    throw new VentureLabPersistenceError("Venture Lab service account is revoked or unavailable.", "service_revoked")
  }
}

async function loadExperimentZeroSnapshot(tx: AdminDatabaseTransaction, experimentId: number) {
  const envelopes = await tx.select().from(ventureBudgetEnvelopes)
    .where(eq(ventureBudgetEnvelopes.experimentId, experimentId))
  const [experiment] = await tx.select().from(ventureExperiments)
    .where(eq(ventureExperiments.id, experimentId)).limit(1)
  return { experiment, envelopes }
}

function positiveMinor(value: number) {
  assertMinorUnits(value)
  if (value <= 0) throw new VentureLabPersistenceError("Amount must be greater than zero.", "invalid_amount")
  return value
}

function requiredText(value: string, field: string) {
  const normalized = value?.trim()
  if (!normalized) throw new VentureLabPersistenceError(`${field} is required.`, "invalid_input")
  return normalized
}
