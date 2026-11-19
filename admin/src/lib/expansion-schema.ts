import { sql } from "drizzle-orm"
import { bigint, check, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, serial, text, timestamp, unique, uuid, type AnyPgColumn } from "drizzle-orm/pg-core"
import { adminUsers, clients, commercialContracts, commercialPayments, prospects } from "./schema"

// Reference only: web owns this table and its complete declaration/migrations.
// Keeping it unexported prevents admin schema generation claiming ownership.
const partnerApplicationsReference = pgTable("partner_applications", { id: serial("id").primaryKey() })
const time = (name: string) => timestamp(name, { withTimezone: true })
function fk(column: AnyPgColumn, target: AnyPgColumn, name: string, deletion: "restrict" | "no action" = "restrict") {
  return foreignKey({ columns: [column], foreignColumns: [target], name }).onDelete(deletion)
}

export const expansionApplicantRetentionHolds = pgTable("expansion_applicant_retention_holds", {
  applicationId: integer("application_id").primaryKey(),
  reasonCode: text("reason_code").notNull(),
  heldBy: uuid("held_by").notNull(),
  heldAt: time("held_at").notNull().defaultNow(),
}, t => [
  fk(t.applicationId, partnerApplicationsReference.id, "expansion_applicant_retention_holds_application_id_fkey"),
  fk(t.heldBy, adminUsers.id, "expansion_applicant_retention_holds_held_by_fkey"),
  check("expansion_applicant_retention_holds_reason_code_check", sql`${t.reasonCode} in ('legal_review', 'privacy_request', 'commercial_dispute')`),
])

export const expansionPartners = pgTable("expansion_partners", {
  id: uuid("id").primaryKey(), userId: uuid("user_id").notNull().unique("expansion_partners_user_id_key"),
  applicationId: integer("application_id").notNull().unique("expansion_partners_application_id_key"),
  agreementVersion: text("agreement_version").notNull(), confirmedAt: time("confirmed_at").notNull(),
  invitationHash: text("invitation_hash").unique("expansion_partners_invitation_hash_key"), invitationExpiresAt: time("invitation_expires_at"),
  activatedAt: time("activated_at"), createdAt: time("created_at").notNull().defaultNow(),
}, t => [
  fk(t.userId, adminUsers.id, "expansion_partners_user_id_fkey"),
  fk(t.applicationId, partnerApplicationsReference.id, "expansion_partners_application_id_fkey"),
  check("expansion_partners_check", sql`(${t.invitationHash} is null) = (${t.invitationExpiresAt} is null)`),
])

export const expansionOpportunities = pgTable("expansion_opportunities", {
  id: uuid("id").primaryKey(), partnerId: uuid("partner_id").notNull(),
  prospectId: integer("prospect_id").notNull().unique("expansion_opportunities_prospect_id_key"), clientId: integer("client_id"),
  normalizedDomain: text("normalized_domain").notNull().unique("expansion_opportunities_normalized_domain_key"),
  companyNumber: text("company_number").unique("expansion_opportunities_company_number_key"),
  status: text("status").notNull().default("registered"), discovery: jsonb("discovery").notNull().default(sql`'{}'::jsonb`),
  scope: jsonb("scope").notNull().default(sql`'{}'::jsonb`), scopeVersion: integer("scope_version").notNull().default(0),
  reviewNotes: text("review_notes"), createdAt: time("created_at").notNull().defaultNow(), updatedAt: time("updated_at").notNull().defaultNow(),
}, t => [
  fk(t.partnerId, expansionPartners.id, "expansion_opportunities_partner_id_fkey"),
  fk(t.prospectId, prospects.id, "expansion_opportunities_prospect_id_fkey"), fk(t.clientId, clients.id, "expansion_opportunities_client_id_fkey"),
  check("expansion_opportunities_status_check", sql`${t.status} in ('registered','contacted','discovery','qualified','scope_submitted','more_information','bespoke_required','deferred','approved','contract_accepted','closed_lost','withdrawn')`),
  check("expansion_opportunities_scope_version_check", sql`${t.scopeVersion} >= 0`),
  index("expansion_opportunities_partner_idx").on(t.partnerId, t.createdAt),
])

export const expansionCapacity = pgTable("expansion_capacity", {
  period: date("period").primaryKey(), availableHours: integer("available_hours").notNull(), rationale: text("rationale").notNull(),
  configuredBy: uuid("configured_by").notNull(), configuredAt: time("configured_at").notNull().defaultNow(),
}, t => [fk(t.configuredBy, adminUsers.id, "expansion_capacity_configured_by_fkey", "no action"), check("expansion_capacity_available_hours_check", sql`${t.availableHours} between 0 and 10000`)])

export const expansionReservations = pgTable("expansion_reservations", {
  opportunityId: uuid("opportunity_id").primaryKey(), period: date("period").notNull(), hours: integer("hours").notNull(),
  status: text("status").notNull(), approvedBy: uuid("approved_by").notNull(), createdAt: time("created_at").notNull().defaultNow(),
}, t => [
  fk(t.opportunityId, expansionOpportunities.id, "expansion_reservations_opportunity_id_fkey"),
  fk(t.period, expansionCapacity.period, "expansion_reservations_period_fkey", "no action"),
  fk(t.approvedBy, adminUsers.id, "expansion_reservations_approved_by_fkey", "no action"),
  check("expansion_reservations_hours_check", sql`${t.hours} > 0`), check("expansion_reservations_status_check", sql`${t.status} in ('provisional','confirmed','released')`),
  index("expansion_reservations_period_idx").on(t.period, t.status),
])

export const expansionContracts = pgTable("expansion_contracts", {
  id: uuid("id").primaryKey(), opportunityId: uuid("opportunity_id").notNull().unique("expansion_contracts_opportunity_id_key"),
  clientId: integer("client_id").notNull(), commercialContractId: integer("commercial_contract_id").notNull().unique("expansion_contracts_commercial_contract_id_key"),
  terms: jsonb("terms").notNull(), scopeSnapshot: jsonb("scope_snapshot").notNull(), scopeVersion: integer("scope_version").notNull(),
  agreementReference: text("agreement_reference").notNull(), acceptedAt: time("accepted_at").notNull(),
  createdBy: uuid("created_by").notNull(), createdAt: time("created_at").notNull().defaultNow(),
}, t => [
  fk(t.opportunityId, expansionOpportunities.id, "expansion_contracts_opportunity_id_fkey"), fk(t.clientId, clients.id, "expansion_contracts_client_id_fkey"),
  fk(t.commercialContractId, commercialContracts.id, "expansion_contracts_commercial_contract_id_fkey"),
  fk(t.createdBy, adminUsers.id, "expansion_contracts_created_by_fkey", "no action"), check("expansion_contracts_scope_version_check", sql`${t.scopeVersion} > 0`),
])

export const expansionCommissionPlans = pgTable("expansion_commission_plans", {
  version: text("version").primaryKey(), terms: jsonb("terms").notNull(), createdBy: uuid("created_by").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
}, t => [fk(t.createdBy, adminUsers.id, "expansion_commission_plans_created_by_fkey", "no action")])

export const expansionContractCancellations = pgTable("expansion_contract_cancellations", {
  contractId: uuid("contract_id").primaryKey(), reason: text("reason").notNull(), createdBy: uuid("created_by").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
}, t => [
  fk(t.contractId, expansionContracts.id, "expansion_contract_cancellations_contract_id_fkey"),
  fk(t.createdBy, adminUsers.id, "expansion_contract_cancellations_created_by_fkey", "no action"),
])

export const expansionResources = pgTable("expansion_resources", {
  id: uuid("id").primaryKey(), title: text("title").notNull(), category: text("category").notNull(), version: integer("version").notNull(),
  audience: text("audience").notNull(), content: text("content").notNull(), status: text("status").notNull(),
  createdBy: uuid("created_by").notNull(), createdAt: time("created_at").notNull().defaultNow(),
}, t => [
  fk(t.createdBy, adminUsers.id, "expansion_resources_created_by_fkey", "no action"), check("expansion_resources_version_check", sql`${t.version} > 0`),
  unique("expansion_resources_title_version_key").on(t.title, t.version),
  check("expansion_resources_audience_check", sql`${t.audience} in ('partner','client')`), check("expansion_resources_status_check", sql`${t.status} in ('draft','published','archived')`),
])

export const expansionSuppressions = pgTable("expansion_suppressions", {
  normalizedDomain: text("normalized_domain").primaryKey(), reason: text("reason").notNull(), createdBy: uuid("created_by").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
}, t => [fk(t.createdBy, adminUsers.id, "expansion_suppressions_created_by_fkey", "no action")])

export const expansionAudit = pgTable("expansion_audit", {
  id: serial("id").primaryKey(), actorId: uuid("actor_id").notNull(), entityId: text("entity_id").notNull(), action: text("action").notNull(),
  details: jsonb("details").notNull().default(sql`'{}'::jsonb`), createdAt: time("created_at").notNull().defaultNow(),
}, t => [fk(t.actorId, adminUsers.id, "expansion_audit_actor_id_fkey", "no action")])

export const expansionPaymentEvents = pgTable("expansion_payment_events", {
  id: uuid("id").primaryKey(), contractId: uuid("contract_id").notNull(), commercialPaymentId: integer("commercial_payment_id").notNull().unique("expansion_payment_events_commercial_payment_id_key"),
  reference: text("reference").notNull().unique("expansion_payment_events_reference_key"), milestone: text("milestone").notNull(),
  netPence: bigint("net_pence", { mode: "bigint" }).notNull(), grossPence: bigint("gross_pence", { mode: "bigint" }).notNull(),
  evidenceReference: text("evidence_reference").notNull(), fingerprint: text("fingerprint").notNull(),
  reversesEventId: uuid("reverses_event_id"), termsApprovalReference: text("terms_approval_reference"),
  calculatedAdjustmentPence: bigint("calculated_adjustment_pence", { mode: "bigint" }),
  refundTreatment: text("refund_treatment"),
  verifiedBy: uuid("verified_by").notNull(), createdAt: time("created_at").notNull().defaultNow(),
}, t => [
  fk(t.contractId, expansionContracts.id, "expansion_payment_events_contract_id_fkey"), fk(t.commercialPaymentId, commercialPayments.id, "expansion_payment_events_commercial_payment_id_fkey"),
  fk(t.reversesEventId, t.id, "expansion_payment_events_reverses_event_id_fkey"), fk(t.verifiedBy, adminUsers.id, "expansion_payment_events_verified_by_fkey"),
  check("expansion_payment_events_milestone_check", sql`${t.milestone} in ('deposit','final','first_retainer')`),
  check("expansion_payment_events_net_pence_check", sql`${t.netPence} <> 0`), check("expansion_payment_events_gross_pence_check", sql`${t.grossPence} <> 0`),
  check("expansion_payment_events_check", sql`(${t.netPence} > 0 and ${t.grossPence} >= ${t.netPence} and ${t.reversesEventId} is null) or (${t.netPence} < 0 and ${t.grossPence} <= ${t.netPence} and ${t.reversesEventId} is not null and ${t.termsApprovalReference} is not null)`),
  index("expansion_payment_contract_idx").on(t.contractId, t.milestone),
  index("expansion_payment_refund_source_idx").on(t.reversesEventId),
  check("expansion_payment_events_refund_treatment_check", sql`${t.refundTreatment} in ('manual_review','retain_entitlement','adjust_unpaid')`),
])

export const expansionCommissionLedger = pgTable("expansion_commission_ledger", {
  id: uuid("id").primaryKey(), partnerId: uuid("partner_id").notNull(), contractId: uuid("contract_id").notNull(),
  paymentEventId: uuid("payment_event_id").notNull().unique("expansion_commission_ledger_payment_event_id_key"),
  amountPence: bigint("amount_pence", { mode: "bigint" }).notNull(), planVersion: text("plan_version").notNull(), createdAt: time("created_at").notNull().defaultNow(),
}, t => [
  fk(t.partnerId, expansionPartners.id, "expansion_commission_ledger_partner_id_fkey"), fk(t.contractId, expansionContracts.id, "expansion_commission_ledger_contract_id_fkey"),
  fk(t.paymentEventId, expansionPaymentEvents.id, "expansion_commission_ledger_payment_event_id_fkey"),
  check("expansion_commission_ledger_amount_pence_check", sql`${t.amountPence} <> 0`), index("expansion_ledger_partner_idx").on(t.partnerId, t.createdAt),
])

export const expansionPayouts = pgTable("expansion_payouts", {
  id: uuid("id").primaryKey(), partnerId: uuid("partner_id").notNull(), amountPence: bigint("amount_pence", { mode: "bigint" }).notNull(),
  invoiceReference: text("invoice_reference").notNull(), status: text("status").notNull().default("prepared"),
  preparedBy: uuid("prepared_by").notNull(), approvedBy: uuid("approved_by"), approvedAt: time("approved_at"),
  settlementReference: text("settlement_reference").unique("expansion_payouts_settlement_reference_key"), paidAt: time("paid_at"), createdAt: time("created_at").notNull().defaultNow(),
}, t => [
  fk(t.partnerId, expansionPartners.id, "expansion_payouts_partner_id_fkey"), fk(t.preparedBy, adminUsers.id, "expansion_payouts_prepared_by_fkey"), fk(t.approvedBy, adminUsers.id, "expansion_payouts_approved_by_fkey"),
  unique("expansion_payouts_partner_id_invoice_reference_key").on(t.partnerId, t.invoiceReference),
  check("expansion_payouts_amount_pence_check", sql`${t.amountPence} > 0`), check("expansion_payouts_status_check", sql`${t.status} in ('prepared','approved','paid')`),
  check("expansion_payouts_check", sql`(${t.status}='prepared' and ${t.approvedBy} is null and ${t.approvedAt} is null and ${t.paidAt} is null and ${t.settlementReference} is null) or (${t.status}='approved' and ${t.approvedBy} is not null and ${t.approvedAt} is not null and ${t.paidAt} is null and ${t.settlementReference} is null) or (${t.status}='paid' and ${t.approvedBy} is not null and ${t.approvedAt} is not null and ${t.paidAt} is not null and ${t.settlementReference} is not null)`),
  index("expansion_payout_partner_idx").on(t.partnerId, t.createdAt),
])

export const expansionPayoutEntries = pgTable("expansion_payout_entries", {
  payoutId: uuid("payout_id").notNull(), ledgerId: uuid("ledger_id").notNull(),
}, t => [
  primaryKey({ columns: [t.payoutId, t.ledgerId] }), fk(t.payoutId, expansionPayouts.id, "expansion_payout_entries_payout_id_fkey"), fk(t.ledgerId, expansionCommissionLedger.id, "expansion_payout_entries_ledger_id_fkey"),
  index("expansion_payout_entries_ledger_idx").on(t.ledgerId),
])

export const expansionPayoutCancellations = pgTable("expansion_payout_cancellations", {
  payoutId: uuid("payout_id").primaryKey(), cancelledBy: uuid("cancelled_by").notNull(),
  reason: text("reason").notNull(), cancelledAt: time("cancelled_at").notNull().defaultNow(),
}, t => [
  fk(t.payoutId, expansionPayouts.id, "expansion_payout_cancellations_payout_id_fkey"),
  fk(t.cancelledBy, adminUsers.id, "expansion_payout_cancellations_cancelled_by_fkey"),
  check("expansion_payout_cancellations_reason_check", sql`length(btrim(${t.reason})) between 1 and 2000`),
])

export const expansionPayoutClaims = pgTable("expansion_payout_claims", {
  ledgerId: uuid("ledger_id").primaryKey(), payoutId: uuid("payout_id").notNull(),
}, t => [foreignKey({
  columns: [t.payoutId, t.ledgerId],
  foreignColumns: [expansionPayoutEntries.payoutId, expansionPayoutEntries.ledgerId],
  name: "expansion_payout_claims_payout_id_ledger_id_fkey",
}).onDelete("restrict")])

// SQL triggers enforce append-only history, payout reconciliation and canonical
// payment reversal admission. Preserve those forward-migration controls; Drizzle
// table metadata cannot express PostgreSQL trigger bodies.
