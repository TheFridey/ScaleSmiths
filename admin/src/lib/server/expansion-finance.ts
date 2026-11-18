import "server-only"
import { createHash, randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { type AdminRole } from "@/lib/admin-users"
import { hasCapability } from "@/lib/rbac"
import { requireCapability } from "./rbac"
import { commissionAt, commissionDelta, COMMISSION_MILESTONES, ExpansionFinanceError, financeText, financeUuid, parseCommissionTerms, pence, type CommissionMilestone } from "@/lib/expansion-finance"

type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
type Actor = Awaited<ReturnType<typeof requireCapability>>
async function rows<T extends Row = Row>(tx: Executor, query: SQL): Promise<T[]> { return (await tx.execute(query)).rows as T[] }
function fingerprint(input: unknown) { return createHash("sha256").update(JSON.stringify(input)).digest("hex") }
function conflict(message: string): never { throw new ExpansionFinanceError(message, 409) }
async function lockedActor(tx: Executor, actor: Actor) {
  const [user] = await rows(tx, sql`select role::text, active, session_version from admin_users where id=${actor.id} for share`)
  if (!user?.active || user.session_version !== actor.sessionVersion || !hasCapability(user.role as AdminRole, "expansion.manage")) throw new ExpansionFinanceError("Financial authority was revoked.", 403)
}
async function audit(tx: Executor, actorId: string, id: string, action: string, value: unknown) {
  await tx.execute(sql`insert into commercial_audit(actor_user_id,entity,record_id,action,after_value) values(${actorId},'partner_finance',${id},${action},${JSON.stringify(value)}::jsonb)`)
}
async function lockedContract(tx: Executor, id: string, allowCancelled = false) {
  const [contract] = await rows(tx, sql`select c.*,o.partner_id from expansion_contracts c join expansion_opportunities o on o.id=c.opportunity_id where c.id=${id} for update of c`)
  if (!contract?.accepted_at) conflict("An accepted, approved contract is required.")
  if (!allowCancelled) {
    const [cancelled] = await rows(tx, sql`select contract_id from expansion_contract_cancellations where contract_id=${id}`)
    if (cancelled) conflict("This contract is cancelled; new commission-bearing collections require a newly approved agreement.")
  }
  parseCommissionTerms(contract.terms)
  return contract
}
async function collected(tx: Executor, contractId: string, milestone: CommissionMilestone) {
  const [total] = await rows(tx, sql`select coalesce(sum(net_pence),0)::text as total from expansion_payment_events where contract_id=${contractId} and milestone=${milestone}`)
  return BigInt(String(total.total))
}
async function appendLedger(tx: Executor, contract: Row, eventId: string, delta: bigint) {
  if (delta === BigInt(0)) return
  const terms = parseCommissionTerms(contract.terms)
  await tx.execute(sql`insert into expansion_commission_ledger(id,partner_id,contract_id,payment_event_id,amount_pence,plan_version) values(${randomUUID()},${String(contract.partner_id)},${String(contract.id)},${eventId},${delta.toString()}::bigint,${terms.planVersion})`)
}
function receiptDate(value: unknown): string {
  if (value !== undefined && (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT/.test(value))) throw new ExpansionFinanceError("Use an ISO receipt timestamp.")
  const date = value === undefined ? new Date() : new Date(String(value))
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now()) throw new ExpansionFinanceError("Receipt date cannot be invalid or in the future.")
  return date.toISOString()
}

export interface VerifiedExpansionPayment {
  contractId: string; invoiceId: number; milestone: CommissionMilestone
  reference: string; netPence: string; grossPence: string; evidenceReference: string
  confirmed: boolean; receivedAt?: string
}

export async function verifyExpansionPayment(input: VerifiedExpansionPayment) {
  const actor = await requireCapability("expansion.manage")
  const contractId = financeUuid(input.contractId), reference = financeText(input.reference, "Unique collection reference").toLowerCase()
  const net = pence(input.netPence), gross = pence(input.grossPence), evidence = financeText(input.evidenceReference, "Collection evidence", 2000)
  if (input.confirmed !== true || net > gross || !Number.isSafeInteger(input.invoiceId) || input.invoiceId <= 0 || !COMMISSION_MILESTONES.includes(input.milestone)) throw new ExpansionFinanceError("Confirm an actual VAT-exclusive collection, valid invoice and milestone.")
  // The omitted receipt timestamp does not affect replay identity; the original timestamp remains authoritative.
  const receivedAt = receiptDate(input.receivedAt)
  const hash = fingerprint({ contractId, invoiceId: input.invoiceId, milestone: input.milestone, reference, net: net.toString(), gross: gross.toString(), evidence, receivedAt: input.receivedAt === undefined ? null : receivedAt })
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const contract = await lockedContract(tx, contractId, true)
    // Same reference on different contracts must serialize before checking uniqueness.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${reference}))`)
    const [old] = await rows(tx, sql`select id,fingerprint from expansion_payment_events where reference=${reference}`)
    if (old) {
      if (old.fingerprint !== hash) conflict("Collection reference was already used with different details.")
      return { paymentId: String(old.id), replayed: true }
    }
    // Cancellation stops new collections, while exact historical replay remains idempotent.
    // The contract row lock also serializes this check with founder cancellation.
    const [cancelled] = await rows(tx, sql`select contract_id from expansion_contract_cancellations where contract_id=${contractId}`)
    if (cancelled) conflict("This contract is cancelled; new commission-bearing collections require a newly approved agreement.")
    const [invoice] = await rows(tx, sql`select id,total,client_id,status::text from invoices where id=${input.invoiceId} for update`)
    if (!invoice || invoice.client_id !== contract.client_id || ["draft", "void"].includes(String(invoice.status))) conflict("Choose an issued invoice for this accepted contract's client.")
    const [allocated] = await rows(tx, sql`select coalesce(sum(amount),0)::text as total from commercial_payments where invoice_id=${input.invoiceId}`)
    if (BigInt(String(allocated.total)) + net > BigInt(String(invoice.total))) conflict("Collection exceeds the outstanding VAT-exclusive invoice balance.")
    const before = await collected(tx, contractId, input.milestone)
    const delta = commissionDelta(contract.terms, input.milestone, before, net)
    const [payment] = await rows(tx, sql`insert into commercial_payments(client_id,invoice_id,category,amount,evidence,reference,actor_user_id,received_at) values(${String(contract.client_id)}::integer,${input.invoiceId},${input.milestone === "first_retainer" ? "retainer" : "website_build"},${net.toString()}::integer,${evidence},${reference},${actor.id},${receivedAt}::timestamptz) returning id`)
    const eventId = randomUUID()
    await tx.execute(sql`insert into expansion_payment_events(id,contract_id,commercial_payment_id,reference,milestone,net_pence,gross_pence,evidence_reference,fingerprint,verified_by) values(${eventId},${contractId},${String(payment.id)}::integer,${reference},${input.milestone},${net.toString()}::bigint,${gross.toString()}::bigint,${evidence},${hash},${actor.id})`)
    await appendLedger(tx, contract, eventId, delta)
    await audit(tx, actor.id, eventId, "collection_verified", { reference, contractId, invoiceId: input.invoiceId, netPence: net.toString(), grossPence: gross.toString(), commissionPence: delta.toString() })
    return { paymentId: eventId, commissionPence: delta.toString(), replayed: false }
  })
}

export interface ExpansionRefund {
  paymentId: string; reference: string; netPence?: string; reason: string; termsApprovalReference: string
}
export async function refundExpansionPayment(input: ExpansionRefund) {
  const actor = await requireCapability("expansion.manage")
  const paymentId = financeUuid(input.paymentId), reference = financeText(input.reference, "Unique refund reference").toLowerCase()
  const reason = financeText(input.reason, "Refund evidence and reason", 2000), approval = financeText(input.termsApprovalReference, "Approved refund terms reference", 2000)
  const hash = fingerprint({ paymentId, reference, reason, approval, netPence: input.netPence ?? null })
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const [source] = await rows(tx, sql`select e.*,p.invoice_id,p.client_id,p.category from expansion_payment_events e join commercial_payments p on p.id=e.commercial_payment_id where e.id=${paymentId}`)
    if (!source || BigInt(String(source.net_pence)) <= BigInt(0)) conflict("Choose an original verified collection.")
    const contract = await lockedContract(tx, String(source.contract_id), true)
    await tx.execute(sql`select id from expansion_partners where id=${String(contract.partner_id)} for update`)
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${reference}))`)
    const [old] = await rows(tx, sql`select id,fingerprint from expansion_payment_events where reference=${reference}`)
    if (old) {
      if (old.fingerprint !== hash) conflict("Refund reference was already used with different details.")
      return { paymentId: String(old.id), replayed: true }
    }
    if (input.netPence !== undefined && pence(input.netPence) !== BigInt(String(source.net_pence))) conflict("This workflow supports a complete collection reversal. Partial refunds require a separately reviewed accounting adjustment.")
    const [reversed] = await rows(tx, sql`select id from expansion_payment_events where reverses_event_id=${paymentId}`)
    if (reversed) conflict("This collection has already been refunded.")
    // A prepared/approved payout cannot silently change after approval. Paid history is offset by an append-only negative liability.
    const [reserved] = await rows(tx, sql`select p.id from expansion_payouts p join expansion_payout_entries pe on pe.payout_id=p.id join expansion_commission_ledger l on l.id=pe.ledger_id where l.payment_event_id=${paymentId} and p.status<>'paid'`)
    if (reserved) conflict("Resolve the prepared payout before approving a refund of its collection.")
    await tx.execute(sql`select id from invoices where id=${String(source.invoice_id)}::integer for update`)
    const before = await collected(tx, String(source.contract_id), source.milestone as CommissionMilestone)
    const net = -BigInt(String(source.net_pence)), gross = -BigInt(String(source.gross_pence))
    const delta = commissionDelta(contract.terms, source.milestone as CommissionMilestone, before, net)
    await tx.execute(sql`select set_config('app.expansion_finance','verified',true)`)
    const [payment] = await rows(tx, sql`insert into commercial_payments(client_id,invoice_id,category,amount,evidence,reference,reverses_payment_id,actor_user_id,received_at) values(${String(source.client_id)}::integer,${String(source.invoice_id)}::integer,${String(source.category)},${net.toString()}::integer,${reason},${reference},${String(source.commercial_payment_id)}::integer,${actor.id},now()) returning id`)
    const eventId = randomUUID()
    await tx.execute(sql`insert into expansion_payment_events(id,contract_id,commercial_payment_id,reference,milestone,net_pence,gross_pence,evidence_reference,fingerprint,reverses_event_id,terms_approval_reference,verified_by) values(${eventId},${String(source.contract_id)},${String(payment.id)}::integer,${reference},${String(source.milestone)},${net.toString()}::bigint,${gross.toString()}::bigint,${reason},${hash},${paymentId},${approval},${actor.id})`)
    await appendLedger(tx, contract, eventId, delta)
    await audit(tx, actor.id, eventId, "refund_verified", { originalPaymentId: paymentId, approval, reason, commissionPence: delta.toString() })
    return { paymentId: eventId, commissionPence: delta.toString(), replayed: false }
  })
}

export async function prepareExpansionPayout(input: { partnerId: string; invoiceReference: string }) {
  const actor = await requireCapability("expansion.manage")
  const partnerId = financeUuid(input.partnerId), invoice = financeText(input.invoiceReference, "Partner invoice reference")
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const [partner] = await rows(tx, sql`select id from expansion_partners where id=${partnerId} for update`)
    if (!partner) throw new ExpansionFinanceError("Partner not found.", 404)
    const [old] = await rows(tx, sql`select id,amount_pence::text from expansion_payouts where partner_id=${partnerId} and invoice_reference=${invoice}`)
    if (old) return { payoutId: String(old.id), amountPence: String(old.amount_pence), replayed: true }
    const entries = await rows(tx, sql`select l.id,l.amount_pence::text from expansion_commission_ledger l where l.partner_id=${partnerId} and not exists(select 1 from expansion_payout_entries pe where pe.ledger_id=l.id) order by l.created_at,l.id for update of l`)
    const total = entries.reduce((sum, row) => sum + BigInt(String(row.amount_pence)), BigInt(0))
    if (total <= BigInt(0)) conflict("No positive unallocated commission is available for payout.")
    const payoutId = randomUUID()
    await tx.execute(sql`insert into expansion_payouts(id,partner_id,amount_pence,invoice_reference,prepared_by) values(${payoutId},${partnerId},${total.toString()}::bigint,${invoice},${actor.id})`)
    for (const entry of entries) await tx.execute(sql`insert into expansion_payout_entries(payout_id,ledger_id) values(${payoutId},${String(entry.id)})`)
    await audit(tx, actor.id, payoutId, "payout_prepared", { partnerId, invoiceReference: invoice, amountPence: total.toString(), ledgerIds: entries.map((row) => row.id) })
    return { payoutId, amountPence: total.toString(), replayed: false }
  })
}

export async function approveExpansionPayout(input: { payoutId: string }) {
  const actor = await requireCapability("expansion.manage"), payoutId = financeUuid(input.payoutId)
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const [payout] = await rows(tx, sql`select * from expansion_payouts where id=${payoutId} for update`)
    if (!payout || payout.status !== "prepared") conflict("Choose a prepared payout for manual approval.")
    await tx.execute(sql`update expansion_payouts set status='approved',approved_by=${actor.id},approved_at=now() where id=${payoutId}`)
    await audit(tx, actor.id, payoutId, "payout_manually_approved", { amountPence: String(payout.amount_pence), invoiceReference: payout.invoice_reference })
    return { payoutId, status: "approved" }
  })
}

export async function settleExpansionPayout(input: { payoutId: string; settlementReference: string }) {
  const actor = await requireCapability("expansion.manage"), payoutId = financeUuid(input.payoutId)
  const reference = financeText(input.settlementReference, "Verified external settlement reference")
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const [payout] = await rows(tx, sql`select * from expansion_payouts where id=${payoutId} for update`)
    if (payout?.status === "paid" && payout.settlement_reference === reference) return { payoutId, status: "paid", replayed: true }
    if (!payout || payout.status !== "approved") conflict("Only a manually approved payout can be marked settled.")
    await tx.execute(sql`update expansion_payouts set status='paid',paid_at=now(),settlement_reference=${reference} where id=${payoutId}`)
    await audit(tx, actor.id, payoutId, "external_settlement_recorded", { settlementReference: reference, amountPence: String(payout.amount_pence) })
    return { payoutId, status: "paid", replayed: false }
  })
}

export interface PartnerFinanceSummary {
  earnedPence: string; paidPence: string; unpaidPence: string; conditionalPence: string
  earnedThisMonthPence: string; paidThisMonthPence: string
  ledger: Row[]; payouts: Row[]
}
export async function getPartnerFinance(userId?: string): Promise<PartnerFinanceSummary> {
  const actor = await requireCapability("expansion.partner")
  if (userId !== undefined && userId !== actor.id) throw new ExpansionFinanceError("Partner finance access denied.", 403)
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    const [partner] = await rows(tx, sql`select p.id from expansion_partners p join admin_users u on u.id=p.user_id where p.user_id=${actor.id} and p.activated_at is not null and u.active=true and u.session_version=${actor.sessionVersion}`)
    if (!partner) throw new ExpansionFinanceError("Active partner profile required.", 403)
    const id = String(partner.id)
    const ledger = await rows(tx, sql`select l.id,l.contract_id,l.amount_pence::text,l.plan_version,l.created_at,e.milestone,e.net_pence::text,i.client_name_snapshot as client_name,(c.terms->>'rateBps') as rate_bps,pe.payout_id,p.status as payout_status from expansion_commission_ledger l join expansion_payment_events e on e.id=l.payment_event_id left join commercial_payments cp on cp.id=e.commercial_payment_id left join invoices i on i.id=cp.invoice_id join expansion_contracts c on c.id=l.contract_id left join expansion_payout_entries pe on pe.ledger_id=l.id left join expansion_payouts p on p.id=pe.payout_id where l.partner_id=${id} order by l.created_at desc,l.id`)
    const payouts = await rows(tx, sql`select id,amount_pence::text,invoice_reference,status,approved_at,paid_at,settlement_reference,created_at from expansion_payouts where partner_id=${id} order by created_at desc,id`)
    const contracts = await rows(tx, sql`select c.id,c.terms from expansion_contracts c join expansion_opportunities o on o.id=c.opportunity_id where o.partner_id=${id} and c.accepted_at is not null and not exists(select 1 from expansion_contract_cancellations x where x.contract_id=c.id)`)
    let conditional = BigInt(0)
    for (const contract of contracts) {
      const terms = parseCommissionTerms(contract.terms)
      let maximum = BigInt(0)
      for (const milestone of COMMISSION_MILESTONES) maximum += commissionAt(pence(terms.milestones[milestone], true), terms.rateBps)
      const contractEarned = ledger.filter(row => row.contract_id === contract.id).reduce((sum,row) => sum + BigInt(String(row.amount_pence)),BigInt(0))
      if (maximum > contractEarned) conditional += maximum - contractEarned
    }
    const earned = ledger.reduce((sum, row) => sum + BigInt(String(row.amount_pence)), BigInt(0))
    const paid = payouts.filter((row) => row.status === "paid").reduce((sum, row) => sum + BigInt(String(row.amount_pence)), BigInt(0))
    const [month] = await rows(tx, sql`select coalesce((select sum(amount_pence) from expansion_commission_ledger where partner_id=${id} and (created_at at time zone 'Europe/London') >= date_trunc('month',now() at time zone 'Europe/London')),0)::text as earned, coalesce((select sum(amount_pence) from expansion_payouts where partner_id=${id} and status='paid' and (paid_at at time zone 'Europe/London') >= date_trunc('month',now() at time zone 'Europe/London')),0)::text as paid`)
    return { earnedPence: earned.toString(), paidPence: paid.toString(), unpaidPence: (earned - paid).toString(), conditionalPence: conditional.toString(), earnedThisMonthPence: String(month.earned), paidThisMonthPence: String(month.paid), ledger, payouts }
  })
}

export async function getExpansionFinance() {
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const partners = await rows(tx, sql`select p.id,u.display_name,coalesce((select sum(l.amount_pence) from expansion_commission_ledger l where l.partner_id=p.id),0)::text as earned_pence,coalesce((select sum(b.amount_pence) from expansion_payouts b where b.partner_id=p.id and b.status='paid'),0)::text as paid_pence from expansion_partners p join admin_users u on u.id=p.user_id order by p.created_at`)
    const payments = await rows(tx, sql`select e.id,e.contract_id,e.reference,e.milestone,e.net_pence::text,e.gross_pence::text,e.reverses_event_id,e.created_at,p.invoice_id,i.client_name_snapshot as client_name from expansion_payment_events e left join commercial_payments p on p.id=e.commercial_payment_id left join invoices i on i.id=p.invoice_id order by e.created_at desc,e.id`)
    const payouts = await rows(tx, sql`select id,partner_id,amount_pence::text,invoice_reference,status,created_at,approved_at,paid_at,settlement_reference from expansion_payouts order by created_at desc,id`)
    return { partners, payments, payouts }
  })
}
