import "server-only"
import { createHash, randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { type AdminRole } from "@/lib/admin-users"
import { hasCapability } from "@/lib/rbac"
import { requireCapability } from "./rbac"
import { BUILD_MILESTONES, commissionAt, commissionDelta, commissionGroup, COMMISSION_MILESTONES, isPooledCommission, milestoneCap, ExpansionFinanceError, financeText, financeUuid, formatPence, parseCommissionTerms, pence, type CommissionMilestone } from "@/lib/expansion-finance"

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
/** Net collected across every milestone that shares one commission rounding with `milestone`. */
async function collectedGroup(tx: Executor, contractId: string, milestones: CommissionMilestone[]) {
  const [total] = await rows(tx, sql`select coalesce(sum(net_pence),0)::text as total from expansion_payment_events where contract_id=${contractId} and milestone in (${sql.join(milestones.map(m => sql`${m}`), sql`, `)})`)
  return BigInt(String(total.total))
}
async function earnedGroup(tx: Executor, contractId: string, milestones: CommissionMilestone[]) {
  const [ledger] = await rows(tx, sql`select coalesce(sum(l.amount_pence),0)::text as earned
    from expansion_commission_ledger l join expansion_payment_events e on e.id=l.payment_event_id
    where l.contract_id=${contractId} and e.milestone in (${sql.join(milestones.map(m => sql`${m}`), sql`, `)})`)
  return BigInt(String(ledger.earned))
}
async function assertNoRefundReview(tx: Executor, partnerId: string) {
  const [pending] = await rows(tx, sql`select e.id from expansion_payment_events e
    join expansion_contracts c on c.id=e.contract_id
    join expansion_opportunities o on o.id=c.opportunity_id
    where o.partner_id=${partnerId} and e.refund_treatment='manual_review'
      and not exists (select 1 from commercial_audit a
        where a.entity='partner_finance' and a.record_id=e.id::text and a.action='refund_entitlement_retained')
    limit 1`)
  if (pending) conflict("Resolve outstanding refund entitlement review before preparing or approving a payout.")
}

export async function retainRefundEntitlement(input: { paymentId: string; evidenceReference: string }) {
  const actor = await requireCapability("expansion.manage")
  const paymentId = financeUuid(input.paymentId)
  const evidence = financeText(input.evidenceReference, "Reviewed agreement and entitlement decision evidence", 2000)
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const [source] = await rows(tx, sql`select o.partner_id from expansion_payment_events e
      join expansion_contracts c on c.id=e.contract_id join expansion_opportunities o on o.id=c.opportunity_id
      where e.id=${paymentId} and e.refund_treatment='manual_review'`)
    if (!source) conflict("Choose a refund awaiting commercial review.")
    await tx.execute(sql`select id from expansion_partners where id=${String(source.partner_id)} for update`)
    const [old] = await rows(tx, sql`select after_value->>'evidence' as evidence from commercial_audit
      where entity='partner_finance' and record_id=${paymentId} and action='refund_entitlement_retained'`)
    if (old) {
      if (old.evidence !== evidence) conflict("This review already has different decision evidence.")
      return { paymentId, replayed: true }
    }
    await audit(tx, actor.id, paymentId, "refund_entitlement_retained", { evidence })
    return { paymentId, replayed: false }
  })
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

export async function allocateExpansionInvoice(input: {
  contractId: string; invoiceId: number; milestone: CommissionMilestone; netPence: string; evidenceReference: string
}) {
  const actor = await requireCapability("expansion.manage")
  const contractId = financeUuid(input.contractId)
  const net = pence(input.netPence)
  const evidence = financeText(input.evidenceReference, "Accepted agreement and invoice allocation evidence", 2000)
  if (!Number.isSafeInteger(input.invoiceId) || input.invoiceId <= 0 || !COMMISSION_MILESTONES.includes(input.milestone)) {
    throw new ExpansionFinanceError("Choose a valid issued invoice and qualifying milestone.")
  }
  const key = `${contractId}:${input.invoiceId}:${input.milestone}`
  return db.transaction(async tx => {
    await lockedActor(tx, actor)
    const contract = await lockedContract(tx, contractId)
    const [invoice] = await rows(tx, sql`select total,client_id,status::text from invoices where id=${input.invoiceId} for update`)
    if (!invoice || invoice.client_id !== contract.client_id || ["draft","void"].includes(String(invoice.status))) conflict("Choose an issued invoice for this accepted contract's client.")
    const [old] = await rows(tx, sql`select after_value from commercial_audit where entity='partner_finance' and record_id=${key} and action='invoice_allocation_approved'`)
    const details = { contractId, invoiceId:input.invoiceId, milestone:input.milestone, netPence:net.toString(), evidence }
    if (old) {
      const prior = old.after_value as Row
      if (prior.netPence !== details.netPence || prior.evidence !== evidence) conflict("An approved allocation already exists with different terms.")
      return { allocationId:key, replayed:true }
    }
    const [totals] = await rows(tx, sql`select
      coalesce(sum((after_value->>'netPence')::bigint) filter (where after_value->>'invoiceId'=${String(input.invoiceId)}),0)::text as invoice,
      coalesce(sum((after_value->>'netPence')::bigint) filter (where after_value->>'contractId'=${contractId} and after_value->>'milestone'=${input.milestone}),0)::text as milestone
      from commercial_audit where entity='partner_finance' and action='invoice_allocation_approved'`)
    if (BigInt(String(totals.invoice)) + net > BigInt(String(invoice.total)) ||
        BigInt(String(totals.milestone)) + net > milestoneCap(parseCommissionTerms(contract.terms), input.milestone)) {
      conflict("Allocation exceeds the invoice total or approved milestone.")
    }
    await audit(tx, actor.id, key, "invoice_allocation_approved", details)
    return { allocationId:key, replayed:false }
  })
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
    if (contract.commercial_contract_id != null) {
      const [commercial] = await rows(tx, sql`select status from commercial_contracts where id=${Number(contract.commercial_contract_id)} for share`)
      if (commercial?.status !== "confirmed") conflict("New collections require an active canonical commercial contract.")
    }
    const [invoice] = await rows(tx, sql`select id,total,client_id,status::text from invoices where id=${input.invoiceId} for update`)
    if (!invoice || invoice.client_id !== contract.client_id || ["draft", "void"].includes(String(invoice.status))) conflict("Choose an issued invoice for this accepted contract's client.")
    const allocationKey = `${contractId}:${input.invoiceId}:${input.milestone}`
    const [binding] = await rows(tx, sql`select after_value->>'netPence' as limit_pence from commercial_audit
      where entity='partner_finance' and record_id=${allocationKey} and action='invoice_allocation_approved'`)
    if (!binding) conflict("This invoice and milestone need a reviewed allocation before collection.")
    const [bound] = await rows(tx, sql`select coalesce(sum(e.net_pence),0)::text as total
      from expansion_payment_events e join commercial_payments cp on cp.id=e.commercial_payment_id
      where e.contract_id=${contractId} and e.milestone=${input.milestone} and cp.invoice_id=${input.invoiceId}`)
    if (BigInt(String(bound.total)) + net > BigInt(String(binding.limit_pence))) conflict("Collection exceeds the approved milestone allocation for this invoice.")
    const [allocated] = await rows(tx, sql`select coalesce(sum(amount),0)::text as total from commercial_payments where invoice_id=${input.invoiceId}`)
    if (BigInt(String(allocated.total)) + net > BigInt(String(invoice.total))) conflict("Collection exceeds the outstanding VAT-exclusive invoice balance.")
    const terms = parseCommissionTerms(contract.terms)
    const group = commissionGroup(terms, input.milestone)
    const before = await collected(tx, contractId, input.milestone)
    const groupBefore = await collectedGroup(tx, contractId, group)
    const increment = commissionDelta(contract.terms, input.milestone, before, net, groupBefore)
    // Cash refunds awaiting review must not reopen commission headroom.
    const available = commissionAt(groupBefore + net, terms.rateBps) - await earnedGroup(tx, contractId, group)
    const delta = available <= BigInt(0) ? BigInt(0) : available < increment ? available : increment
    const [payment] = await rows(tx, sql`insert into commercial_payments(client_id,invoice_id,category,amount,evidence,reference,actor_user_id,received_at) values(${String(contract.client_id)}::integer,${input.invoiceId},${input.milestone === "first_retainer" ? "retainer" : "website_build"},${net.toString()}::integer,${evidence},${reference},${actor.id},${receivedAt}::timestamptz) returning id`)
    const eventId = randomUUID()
    await tx.execute(sql`insert into expansion_payment_events(id,contract_id,commercial_payment_id,reference,milestone,net_pence,gross_pence,evidence_reference,fingerprint,verified_by) values(${eventId},${contractId},${String(payment.id)}::integer,${reference},${input.milestone},${net.toString()}::bigint,${gross.toString()}::bigint,${evidence},${hash},${actor.id})`)
    await appendLedger(tx, contract, eventId, delta)
    await audit(tx, actor.id, eventId, "collection_verified", { reference, contractId, invoiceId: input.invoiceId, netPence: net.toString(), grossPence: gross.toString(), commissionPence: delta.toString() })
    return { paymentId: eventId, commissionPence: delta.toString(), replayed: false }
  })
}

export interface ExpansionRefund {
  paymentId: string; reference: string; netPence?: string; grossPence?: string
  reason: string; termsApprovalReference?: string
  treatment?: "manual_review" | "retain_entitlement" | "adjust_unpaid"
}
export async function refundExpansionPayment(input: ExpansionRefund) {
  const actor = await requireCapability("expansion.manage")
  const paymentId = financeUuid(input.paymentId), reference = financeText(input.reference, "Unique refund reference").toLowerCase()
  const reason = financeText(input.reason, "Refund evidence and reason", 2000)
  const treatment = input.treatment ?? "manual_review"
  if (!["manual_review", "retain_entitlement", "adjust_unpaid"].includes(treatment)) throw new ExpansionFinanceError("Choose a supported refund treatment.")
  const approval = treatment === "manual_review" && !input.termsApprovalReference
    ? null : financeText(input.termsApprovalReference, "Accepted agreement clause and decision evidence", 2000)
  const hash = fingerprint({ paymentId, reference, reason, approval, netPence: input.netPence ?? null, grossPence: input.grossPence ?? null, treatment })
  const legacyHash = input.treatment === undefined && input.grossPence === undefined
    ? fingerprint({ paymentId, reference, reason, approval, netPence: input.netPence ?? null }) : null
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const [source] = await rows(tx, sql`select e.*,p.invoice_id,p.client_id,p.category from expansion_payment_events e join commercial_payments p on p.id=e.commercial_payment_id where e.id=${paymentId}`)
    if (!source || BigInt(String(source.net_pence)) <= BigInt(0)) conflict("Choose an original verified collection.")
    const contract = await lockedContract(tx, String(source.contract_id), true)
    await tx.execute(sql`select id from expansion_partners where id=${String(contract.partner_id)} for update`)
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${reference}))`)
    const [old] = await rows(tx, sql`select id,fingerprint from expansion_payment_events where reference=${reference}`)
    if (old) {
      if (old.fingerprint !== hash && old.fingerprint !== legacyHash) conflict("Refund reference was already used with different details.")
      return { paymentId: String(old.id), replayed: true }
    }
    const [refunded] = await rows(tx, sql`select coalesce(-sum(net_pence),0)::text as net,coalesce(-sum(gross_pence),0)::text as gross from expansion_payment_events where reverses_event_id=${paymentId}`)
    const remainingNet = BigInt(String(source.net_pence)) - BigInt(String(refunded.net))
    const remainingGross = BigInt(String(source.gross_pence)) - BigInt(String(refunded.gross))
    if (remainingNet === BigInt(0)) conflict("This collection has already been refunded.")
    const refundNet = input.netPence === undefined ? remainingNet : pence(input.netPence)
    const refundGross = input.grossPence === undefined
      ? (input.netPence === undefined ? remainingGross : refundNet) : pence(input.grossPence)
    if (refundNet > remainingNet || refundGross < refundNet || refundGross - refundNet > remainingGross - remainingNet ||
        (refundNet === remainingNet && refundGross !== remainingGross)) conflict("Refund exceeds the remaining net or VAT balance.")
    if (treatment === "adjust_unpaid") {
      if (parseCommissionTerms(contract.terms).unpaidRefundApprovalReference !== approval) {
        conflict("This accepted agreement does not authorise the requested unpaid commission adjustment.")
      }
      const [allocated] = await rows(tx, sql`select p.status from expansion_payouts p join expansion_payout_claims pe on pe.payout_id=p.id
        join expansion_commission_ledger l on l.id=pe.ledger_id join expansion_payment_events e on e.id=l.payment_event_id
        where l.contract_id=${String(source.contract_id)} and e.milestone in (${sql.join(commissionGroup(parseCommissionTerms(contract.terms), source.milestone as CommissionMilestone).map(m => sql`${m}`), sql`, `)}) limit 1`)
      if (allocated) conflict("Resolve the prepared payout or seek manual review of previously approved or paid commission.")
      const [reserved] = await rows(tx, sql`select w.id from expansion_withdrawal_entries w join expansion_commission_ledger l on l.id=w.ledger_id join expansion_payment_events e on e.id=l.payment_event_id
        where w.released_at is null and l.contract_id=${String(source.contract_id)} and e.milestone in (${sql.join(commissionGroup(parseCommissionTerms(contract.terms), source.milestone as CommissionMilestone).map(m => sql`${m}`), sql`, `)}) limit 1`)
      if (reserved) conflict("Resolve the partner withdrawal request reserving this commission before adjusting it.")
    }
    await tx.execute(sql`select id from invoices where id=${String(source.invoice_id)}::integer for update`)
    const before = await collected(tx, String(source.contract_id), source.milestone as CommissionMilestone)
    const net = -refundNet, gross = -refundGross
    const groupBefore = await collectedGroup(tx, String(source.contract_id), commissionGroup(parseCommissionTerms(contract.terms), source.milestone as CommissionMilestone))
    const calculated = commissionDelta(contract.terms, source.milestone as CommissionMilestone, before, net, groupBefore)
    const delta = treatment === "adjust_unpaid" ? calculated : BigInt(0)
    await tx.execute(sql`select set_config('app.expansion_finance','verified',true)`)
    const [payment] = await rows(tx, sql`insert into commercial_payments(client_id,invoice_id,category,amount,evidence,reference,reverses_payment_id,actor_user_id,received_at,expansion_refund) values(${String(source.client_id)}::integer,${String(source.invoice_id)}::integer,${String(source.category)},${net.toString()}::integer,${reason},${reference},${String(source.commercial_payment_id)}::integer,${actor.id},now(),true) returning id`)
    const eventId = randomUUID()
    await tx.execute(sql`insert into expansion_payment_events(id,contract_id,commercial_payment_id,reference,milestone,net_pence,gross_pence,evidence_reference,fingerprint,reverses_event_id,terms_approval_reference,verified_by,calculated_adjustment_pence,refund_treatment)
      values(${eventId},${String(source.contract_id)},${String(payment.id)}::integer,${reference},${String(source.milestone)},${net.toString()}::bigint,${gross.toString()}::bigint,${reason},${hash},${paymentId},${approval ?? "Pending commercial review"},${actor.id},${calculated.toString()}::bigint,${treatment})`)
    await appendLedger(tx, contract, eventId, delta)
    await audit(tx, actor.id, eventId, "refund_verified", { originalPaymentId: paymentId, approval, reason, treatment, calculatedAdjustmentPence: calculated.toString(), commissionPence: delta.toString() })
    return { paymentId: eventId, commissionPence: delta.toString(), calculatedAdjustmentPence: calculated.toString(), treatment, replayed: false }
  })
}

export async function prepareExpansionPayout(input: { partnerId: string; invoiceReference: string; invoiceNetPence: string }) {
  const actor = await requireCapability("expansion.manage")
  const partnerId = financeUuid(input.partnerId), invoice = financeText(input.invoiceReference, "Partner invoice reference")
  const invoiceNet = pence(input.invoiceNetPence)
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const [partner] = await rows(tx, sql`select id from expansion_partners where id=${partnerId} for update`)
    if (!partner) throw new ExpansionFinanceError("Partner not found.", 404)
    const [old] = await rows(tx, sql`select id,amount_pence::text,invoice_reference from expansion_payouts where partner_id=${partnerId} and lower(invoice_reference)=lower(${invoice}) order by created_at,id limit 1`)
    if (old) {
      if (old.amount_pence !== invoiceNet.toString() || old.invoice_reference !== invoice) conflict("Invoice reference was already used with different payout details.")
      return { payoutId: String(old.id), amountPence: String(old.amount_pence), replayed: true }
    }
    await assertNoRefundReview(tx, partnerId)
    const entries = await rows(tx, sql`select l.id,l.amount_pence::text from expansion_commission_ledger l where l.partner_id=${partnerId} and not exists(select 1 from expansion_payout_claims pe where pe.ledger_id=l.id) and not exists(select 1 from expansion_withdrawal_entries w where w.ledger_id=l.id and w.released_at is null) order by l.created_at,l.id for update of l`)
    const total = entries.reduce((sum, row) => sum + BigInt(String(row.amount_pence)), BigInt(0))
    if (total <= BigInt(0)) conflict("No positive unallocated commission is available for payout.")
    if (total !== invoiceNet) conflict("Partner invoice net amount does not match payable ledger entries.")
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
    const [source] = await rows(tx, sql`select partner_id from expansion_payouts where id=${payoutId}`)
    if (!source) conflict("Choose a prepared payout for manual approval.")
    await tx.execute(sql`select id from expansion_partners where id=${String(source.partner_id)} for update`)
    const [payout] = await rows(tx, sql`select * from expansion_payouts where id=${payoutId} for update`)
    const [cancelled] = await rows(tx, sql`select payout_id from expansion_payout_cancellations where payout_id=${payoutId}`)
    if (!payout || payout.status !== "prepared" || cancelled) conflict("Choose a prepared payout for manual approval.")
    await assertNoRefundReview(tx, String(payout.partner_id))
    await tx.execute(sql`update expansion_payouts set status='approved',approved_by=${actor.id},approved_at=now() where id=${payoutId}`)
    await audit(tx, actor.id, payoutId, "payout_manually_approved", { amountPence: String(payout.amount_pence), invoiceReference: payout.invoice_reference })
    return { payoutId, status: "approved" }
  })
}

export async function cancelExpansionPayout(input: { payoutId: string; reason: string; noExternalSettlement: boolean }) {
  const actor = await requireCapability("expansion.manage")
  const payoutId = financeUuid(input.payoutId)
  const reason = financeText(input.reason, "Cancellation reason", 2000)
  if (input.noExternalSettlement !== true) throw new ExpansionFinanceError("Confirm no external payment was sent or scheduled.")
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const [source] = await rows(tx, sql`select partner_id from expansion_payouts where id=${payoutId}`)
    if (!source) conflict("Choose a prepared payout for cancellation.")
    await tx.execute(sql`select id from expansion_partners where id=${String(source.partner_id)} for update`)
    const [payout] = await rows(tx, sql`select status from expansion_payouts where id=${payoutId} for update`)
    const [old] = await rows(tx, sql`select reason from expansion_payout_cancellations where payout_id=${payoutId}`)
    if (old) {
      if (old.reason !== reason) conflict("This payout was cancelled with a different reason.")
      return { payoutId, status: "cancelled", replayed: true }
    }
    if (payout.status !== "prepared") conflict("Only a prepared payout with no external settlement may be cancelled.")
    await tx.execute(sql`insert into expansion_payout_cancellations(payout_id,cancelled_by,reason) values(${payoutId},${actor.id},${reason})`)
    await tx.execute(sql`update expansion_withdrawal_requests set status='approved',payout_id=null,updated_at=now() where payout_id=${payoutId}`)
    await audit(tx, actor.id, payoutId, "payout_cancelled", { reason, noExternalSettlement: true })
    return { payoutId, status: "cancelled", replayed: false }
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
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(lower(${reference})),7101)`)
    const [duplicate] = await rows(tx, sql`select id from expansion_payouts where lower(settlement_reference)=lower(${reference})`)
    if (duplicate) conflict("This settlement reference is already recorded.")
    await tx.execute(sql`update expansion_payouts set status='paid',paid_at=now(),settlement_reference=${reference} where id=${payoutId}`)
    await audit(tx, actor.id, payoutId, "external_settlement_recorded", { settlementReference: reference, amountPence: String(payout.amount_pence) })
    return { payoutId, status: "paid", replayed: false }
  })
}

export interface PartnerFinanceSummary {
  earnedPence: string; paidPence: string; unpaidPence: string; conditionalPence: string
  earnedThisMonthPence: string; paidThisMonthPence: string
  ledger: Row[]; payouts: Row[]; refunds: Row[]
}
export async function getPartnerFinance(userId?: string): Promise<PartnerFinanceSummary> {
  const actor = await requireCapability("expansion.partner")
  if (userId !== undefined && userId !== actor.id) throw new ExpansionFinanceError("Partner finance access denied.", 403)
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    const [partner] = await rows(tx, sql`select p.id from expansion_partners p join admin_users u on u.id=p.user_id where p.user_id=${actor.id} and p.activated_at is not null and u.active=true and u.session_version=${actor.sessionVersion}`)
    if (!partner) throw new ExpansionFinanceError("Active partner profile required.", 403)
    const id = String(partner.id)
    const ledger = await rows(tx, sql`select l.id,l.contract_id,l.amount_pence::text,l.plan_version,l.created_at,e.milestone,e.net_pence::text,i.client_name_snapshot as client_name,(c.terms->>'rateBps') as rate_bps,pe.payout_id,p.status as payout_status from expansion_commission_ledger l join expansion_payment_events e on e.id=l.payment_event_id left join commercial_payments cp on cp.id=e.commercial_payment_id left join invoices i on i.id=cp.invoice_id join expansion_contracts c on c.id=l.contract_id left join expansion_payout_claims pe on pe.ledger_id=l.id left join expansion_payouts p on p.id=pe.payout_id where l.partner_id=${id} order by l.created_at desc,l.id`)
    const payouts = await rows(tx, sql`select id,amount_pence::text,invoice_reference,case when c.payout_id is not null then 'cancelled' else p.status end as status,approved_at,paid_at,settlement_reference,created_at,c.cancelled_at from expansion_payouts p left join expansion_payout_cancellations c on c.payout_id=p.id where partner_id=${id} order by created_at desc,id`)
    const refunds = await rows(tx, sql`select e.id,e.milestone,e.net_pence::text,e.calculated_adjustment_pence::text,
      case when exists(select 1 from commercial_audit a where a.entity='partner_finance' and a.record_id=e.id::text and a.action='refund_entitlement_retained')
        then 'retain_entitlement' else e.refund_treatment end as treatment
      from expansion_payment_events e join expansion_contracts c on c.id=e.contract_id
      join expansion_opportunities o on o.id=c.opportunity_id
      where o.partner_id=${id} and e.reverses_event_id is not null order by e.created_at desc,e.id`)
    const contracts = await rows(tx, sql`select c.id,c.terms from expansion_contracts c join expansion_opportunities o on o.id=c.opportunity_id where o.partner_id=${id} and c.accepted_at is not null and not exists(select 1 from expansion_contract_cancellations x where x.contract_id=c.id)`)
    let conditional = BigInt(0)
    for (const contract of contracts) {
      const terms = parseCommissionTerms(contract.terms)
      let maximum = BigInt(0)
      if (isPooledCommission(terms)) {
        // Pooled plans round once on the build total, matching how entitlement is actually earned.
        const build = BUILD_MILESTONES.reduce((sum, m) => sum + milestoneCap(terms, m), BigInt(0))
        maximum = commissionAt(build, terms.rateBps) + commissionAt(milestoneCap(terms, "first_retainer"), terms.rateBps)
      } else for (const milestone of COMMISSION_MILESTONES) maximum += commissionAt(milestoneCap(terms, milestone), terms.rateBps)
      const contractEarned = ledger.filter(row => row.contract_id === contract.id).reduce((sum,row) => sum + BigInt(String(row.amount_pence)),BigInt(0))
      if (maximum > contractEarned) conditional += maximum - contractEarned
    }
    const earned = ledger.reduce((sum, row) => sum + BigInt(String(row.amount_pence)), BigInt(0))
    const paid = payouts.filter((row) => row.status === "paid").reduce((sum, row) => sum + BigInt(String(row.amount_pence)), BigInt(0))
    const [month] = await rows(tx, sql`select coalesce((select sum(amount_pence) from expansion_commission_ledger where partner_id=${id} and (created_at at time zone 'Europe/London') >= date_trunc('month',now() at time zone 'Europe/London')),0)::text as earned, coalesce((select sum(amount_pence) from expansion_payouts where partner_id=${id} and status='paid' and (paid_at at time zone 'Europe/London') >= date_trunc('month',now() at time zone 'Europe/London')),0)::text as paid`)
    return { earnedPence: earned.toString(), paidPence: paid.toString(), unpaidPence: (earned - paid).toString(), conditionalPence: conditional.toString(), earnedThisMonthPence: String(month.earned), paidThisMonthPence: String(month.paid), ledger, payouts, refunds }
  })
}

export async function getExpansionFinance() {
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await lockedActor(tx, actor)
    const partners = await rows(tx, sql`select p.id,u.display_name,coalesce((select sum(l.amount_pence) from expansion_commission_ledger l where l.partner_id=p.id),0)::text as earned_pence,coalesce((select sum(b.amount_pence) from expansion_payouts b where b.partner_id=p.id and b.status='paid'),0)::text as paid_pence from expansion_partners p join admin_users u on u.id=p.user_id order by p.created_at`)
    const payments = await rows(tx, sql`select e.id,e.contract_id,e.reference,e.milestone,e.net_pence::text,e.gross_pence::text,e.reverses_event_id,e.refund_treatment,e.calculated_adjustment_pence::text,e.created_at,p.invoice_id,i.client_name_snapshot as client_name,
      exists(select 1 from commercial_audit a where a.entity='partner_finance' and a.record_id=e.id::text and a.action='refund_entitlement_retained') as review_resolved
      from expansion_payment_events e left join commercial_payments p on p.id=e.commercial_payment_id left join invoices i on i.id=p.invoice_id order by e.created_at desc,e.id`)
    const payouts = await rows(tx, sql`select id,partner_id,amount_pence::text,invoice_reference,case when c.payout_id is not null then 'cancelled' else p.status end as status,created_at,approved_at,paid_at,settlement_reference,c.cancelled_at,c.reason as cancellation_reason from expansion_payouts p left join expansion_payout_cancellations c on c.payout_id=p.id order by created_at desc,id`)
    return { partners, payments, payouts }
  })
}


/* ================= Partner withdrawal requests (checkpoint 3B) =================
 * A request reserves specific ledger entries (no second ledger). Founder approval then creates an ordinary payout over
 * exactly those entries. Everything serialises on the same partner row lock used by payout preparation, cancellation and refunds,
 * and the database independently guarantees at most one live reservation per ledger entry. Nothing here moves money. */
async function currentWithdrawalPolicy(tx: Executor) {
  const [policy] = await rows(tx, sql`select version,enabled,min_amount_pence,invoice_required,approval_reference,created_at from expansion_withdrawal_policies order by version desc limit 1`)
  return policy
}
function withdrawalUnavailable(policy: Row | undefined): string | null {
  if (!policy) return "Withdrawal requests are not available yet: no payout policy has been approved."
  if (!policy.enabled) return "Withdrawal requests are currently disabled by ScaleSmiths."
  return null
}
async function activePartnerId(tx: Executor, actor: Actor) {
  const [partner] = await rows(tx, sql`select p.id from expansion_partners p join admin_users u on u.id=p.user_id where p.user_id=${actor.id} and p.activated_at is not null and u.active=true and u.session_version=${actor.sessionVersion} and u.role::text='independent_partner'`)
  if (!partner) throw new ExpansionFinanceError("Active partner profile required.", 403)
  return String(partner.id)
}
const availableEntries = (tx: Executor, partnerId: string, lock = false) => rows(tx, sql`select l.id,l.amount_pence::text,l.created_at,e.milestone,i.client_name_snapshot as client_name
  from expansion_commission_ledger l join expansion_payment_events e on e.id=l.payment_event_id
  left join commercial_payments cp on cp.id=e.commercial_payment_id left join invoices i on i.id=cp.invoice_id
  where l.partner_id=${partnerId} and not exists(select 1 from expansion_payout_claims pc where pc.ledger_id=l.id)
    and not exists(select 1 from expansion_withdrawal_entries w where w.ledger_id=l.id and w.released_at is null)
  order by l.created_at,l.id ${lock ? sql`for update of l` : sql``}`)
const sumPence = (items: Row[], key = "amount_pence") => items.reduce((sum, row) => sum + BigInt(String(row[key])), BigInt(0))

export async function getWithdrawalOverview() {
  const actor = await requireCapability("expansion.partner")
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    const partnerId = await activePartnerId(tx, actor)
    const policy = await currentWithdrawalPolicy(tx)
    const entries = await availableEntries(tx, partnerId)
    const [pending] = await rows(tx, sql`select count(*)::int c,coalesce(sum(e.calculated_adjustment_pence),0)::text amount from expansion_payment_events e
      join expansion_contracts c on c.id=e.contract_id join expansion_opportunities o on o.id=c.opportunity_id
      where o.partner_id=${partnerId} and e.refund_treatment='manual_review'
        and not exists(select 1 from commercial_audit a where a.entity='partner_finance' and a.record_id=e.id::text and a.action='refund_entitlement_retained')`)
    const [totals] = await rows(tx, sql`select
      coalesce((select sum(l.amount_pence) from expansion_commission_ledger l where l.partner_id=${partnerId}),0)::text earned,
      coalesce((select sum(l.amount_pence) from expansion_commission_ledger l where l.partner_id=${partnerId} and l.amount_pence<0),0)::text adjusted,
      coalesce((select sum(l.amount_pence) from expansion_withdrawal_entries w join expansion_withdrawal_requests r on r.id=w.request_id join expansion_commission_ledger l on l.id=w.ledger_id where r.partner_id=${partnerId} and w.released_at is null and r.status in ('submitted','approved')),0)::text requested,
      coalesce((select sum(p.amount_pence) from expansion_payouts p where p.partner_id=${partnerId} and p.status in ('prepared','approved') and not exists(select 1 from expansion_payout_cancellations c where c.payout_id=p.id)),0)::text prepared,
      coalesce((select sum(p.amount_pence) from expansion_payouts p where p.partner_id=${partnerId} and p.status='paid'),0)::text paid`)
    const requests = await rows(tx, sql`select r.id,r.amount_pence::text,r.invoice_reference,r.status,r.partner_note,
      r.review_note,r.created_at,r.reviewed_at,
      case when c.payout_id is not null then 'cancelled' else p.status end payout_status,
      (select count(*) from expansion_withdrawal_entries w where w.request_id=r.id)::int entries
      from expansion_withdrawal_requests r left join expansion_payouts p on p.id=r.payout_id left join expansion_payout_cancellations c on c.payout_id=r.payout_id
      where r.partner_id=${partnerId} order by r.created_at desc,r.id`)
    const policyReason = withdrawalUnavailable(policy)
    const disputed = Number(pending.c) > 0
    const available = sumPence(entries)
    return {
      policy: { available: policyReason === null && !disputed, unavailableReason: policyReason ?? (disputed ? "A refund review is outstanding. Withdrawals resume once ScaleSmiths resolves it." : null),
        minAmountPence: policy?.min_amount_pence == null ? null : String(policy.min_amount_pence), invoiceRequired: policy ? Boolean(policy.invoice_required) : true, version: policy ? Number(policy.version) : null },
      balances: { earnedPence: String(totals.earned), availablePence: available.toString(), requestedPence: String(totals.requested), preparedPence: String(totals.prepared), paidPence: String(totals.paid),
        adjustmentsPence: String(totals.adjusted), disputedPence: String(pending.amount) },
      entries, requests,
    }
  })
}

export async function requestWithdrawal(input: { ledgerIds?: string[]; all?: boolean; invoiceReference?: string; note?: string }) {
  const actor = await requireCapability("expansion.partner")
  const note = input.note === undefined || input.note === "" ? null : financeText(input.note, "Note", 1000)
  const wanted = input.all === true ? null : (Array.isArray(input.ledgerIds) ? [...new Set(input.ledgerIds.map(financeUuid))] : [])
  if (wanted !== null && (wanted.length === 0 || wanted.length > 200)) throw new ExpansionFinanceError("Choose the commission entries to withdraw, or withdraw everything available.")
  return db.transaction(async (tx) => {
    const partnerId = await activePartnerId(tx, actor)
    // Same lock as payout preparation, payout cancellation and refunds.
    await tx.execute(sql`select id from expansion_partners where id=${partnerId} for update`)
    const policy = await currentWithdrawalPolicy(tx)
    const reason = withdrawalUnavailable(policy)
    if (reason) conflict(reason)
    const invoice = input.invoiceReference === undefined || input.invoiceReference === "" ? null : financeText(input.invoiceReference, "Your invoice reference")
    if (policy.invoice_required && !invoice) throw new ExpansionFinanceError("Your invoice reference is required for a withdrawal request.")
    await assertNoRefundReview(tx, partnerId)
    const entries = await availableEntries(tx, partnerId, true)
    if (invoice) {
      // Replaying the same invoice reference returns the original request instead of reserving anything twice.
      const [existing] = await rows(tx, sql`select r.id,r.amount_pence::text,(select array_agg(w.ledger_id::text order by w.ledger_id::text) from expansion_withdrawal_entries w where w.request_id=r.id) ids
        from expansion_withdrawal_requests r where r.partner_id=${partnerId} and lower(r.invoice_reference)=lower(${invoice}) and r.status in ('submitted','approved','payout_prepared')`)
      if (existing) {
        const same = wanted === null ? entries.length === 0 : JSON.stringify([...wanted].sort()) === JSON.stringify(existing.ids)
        if (same) return { requestId: String(existing.id), amountPence: String(existing.amount_pence), replayed: true }
        conflict("A withdrawal request already uses that invoice reference.")
      }
    }
    // Refund adjustments (negative entries) can never be left behind: they always travel with a request.
    const negatives = entries.filter(row => BigInt(String(row.amount_pence)) < BigInt(0))
    const picked = wanted === null ? entries : entries.filter(row => wanted.includes(String(row.id)))
    const chosen = [...new Map([...picked, ...negatives].map(row => [String(row.id), row])).values()]
    if (wanted !== null && wanted.some(id => !entries.some(row => String(row.id) === id))) conflict("Some of those commission entries are no longer available. Refresh and try again.")
    const total = sumPence(chosen)
    if (chosen.length === 0 || total <= BigInt(0)) conflict("There is no positive available commission to withdraw.")
    if (policy.min_amount_pence != null && total < BigInt(Number(policy.min_amount_pence))) conflict(`The minimum withdrawal is ${formatPence(String(policy.min_amount_pence))}.`)
    const requestId = randomUUID()
    await tx.execute(sql`insert into expansion_withdrawal_requests(id,partner_id,policy_version,amount_pence,invoice_reference,partner_note) values(${requestId},${partnerId},${Number(policy.version)},${total.toString()}::bigint,${invoice},${note})`)
    for (const entry of chosen) await tx.execute(sql`insert into expansion_withdrawal_entries(id,request_id,ledger_id) values(${randomUUID()},${requestId},${String(entry.id)})`)
    await audit(tx, actor.id, requestId, "withdrawal_requested", { partnerId, amountPence: total.toString(), ledgerIds: chosen.map(row => row.id), policyVersion: Number(policy.version) })
    return { requestId, amountPence: total.toString(), replayed: false }
  })
}

async function releaseReservations(tx: Executor, requestId: string) {
  await tx.execute(sql`update expansion_withdrawal_entries set released_at=now() where request_id=${requestId} and released_at is null`)
}

export async function cancelWithdrawal(input: { requestId: string }) {
  const actor = await requireCapability("expansion.partner"), requestId = financeUuid(input.requestId)
  return db.transaction(async (tx) => {
    const partnerId = await activePartnerId(tx, actor)
    await tx.execute(sql`select id from expansion_partners where id=${partnerId} for update`)
    const [request] = await rows(tx, sql`select status from expansion_withdrawal_requests where id=${requestId} and partner_id=${partnerId} for update`)
    if (!request) throw new ExpansionFinanceError("Withdrawal request not found.", 404)
    if (request.status === "cancelled") return { requestId, status: "cancelled", replayed: true }
    if (!["submitted", "approved"].includes(String(request.status))) conflict("Only a request that has not been prepared for payout can be cancelled.")
    await tx.execute(sql`update expansion_withdrawal_requests set status='cancelled',updated_at=now() where id=${requestId}`)
    await releaseReservations(tx, requestId)
    await audit(tx, actor.id, requestId, "withdrawal_cancelled", { by: "partner" })
    return { requestId, status: "cancelled", replayed: false }
  })
}

export async function setWithdrawalPolicy(input: { enabled: boolean; minAmountPence?: string; invoiceRequired: boolean; approvalReference: string }) {
  const actor = await requireCapability("expansion.manage")
  if (typeof input.enabled !== "boolean" || typeof input.invoiceRequired !== "boolean") throw new ExpansionFinanceError("State whether withdrawals are enabled and whether an invoice is required.")
  const approval = financeText(input.approvalReference, "Policy approval reference", 500)
  const min = input.minAmountPence === undefined || input.minAmountPence === "" ? null : pence(input.minAmountPence)
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const [created] = await rows(tx, sql`insert into expansion_withdrawal_policies(enabled,min_amount_pence,invoice_required,approval_reference,approved_by) values(${input.enabled},${min === null ? null : min.toString()}::integer,${input.invoiceRequired},${approval},${actor.id}) returning version`)
    await audit(tx, actor.id, String(created.version), "withdrawal_policy_set", { enabled: input.enabled, minAmountPence: min?.toString() ?? null, invoiceRequired: input.invoiceRequired, approval })
    return { version: Number(created.version) }
  })
}

export async function reviewWithdrawal(input: { requestId: string; decision: "approved" | "rejected"; note: string }) {
  const actor = await requireCapability("expansion.manage"), requestId = financeUuid(input.requestId)
  if (!["approved", "rejected"].includes(input.decision)) throw new ExpansionFinanceError("Choose approve or reject.")
  const note = financeText(input.note, "Review decision and reason", 2000)
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const [source] = await rows(tx, sql`select partner_id from expansion_withdrawal_requests where id=${requestId}`)
    if (!source) throw new ExpansionFinanceError("Withdrawal request not found.", 404)
    await tx.execute(sql`select id from expansion_partners where id=${String(source.partner_id)} for update`)
    const [request] = await rows(tx, sql`select status,review_note from expansion_withdrawal_requests where id=${requestId} for update`)
    if (request.status === input.decision && request.review_note === note) return { requestId, status: input.decision, replayed: true }
    if (request.status !== "submitted" && !(request.status === "approved" && input.decision === "rejected")) conflict("Only a submitted request can be approved, and only a submitted or approved request can be rejected.")
    if (input.decision === "approved") {
      const reason = withdrawalUnavailable(await currentWithdrawalPolicy(tx))
      if (reason) conflict(reason)
      await assertNoRefundReview(tx, String(source.partner_id))
    }
    await tx.execute(sql`update expansion_withdrawal_requests set status=${input.decision},review_note=${note},reviewed_by=${actor.id},reviewed_at=now(),updated_at=now() where id=${requestId}`)
    if (input.decision === "rejected") await releaseReservations(tx, requestId)
    await audit(tx, actor.id, requestId, `withdrawal_${input.decision}`, { note })
    return { requestId, status: input.decision, replayed: false }
  })
}

/** Creates an ordinary prepared payout over exactly the reserved entries. Approval, manual settlement and reconciliation then use the existing payout workflow. */
export async function prepareWithdrawalPayout(input: { requestId: string; invoiceReference?: string }) {
  const actor = await requireCapability("expansion.manage"), requestId = financeUuid(input.requestId)
  return db.transaction(async (tx) => {
    await lockedActor(tx, actor)
    const [source] = await rows(tx, sql`select partner_id from expansion_withdrawal_requests where id=${requestId}`)
    if (!source) throw new ExpansionFinanceError("Withdrawal request not found.", 404)
    const partnerId = String(source.partner_id)
    await tx.execute(sql`select id from expansion_partners where id=${partnerId} for update`)
    const [request] = await rows(tx, sql`select * from expansion_withdrawal_requests where id=${requestId} for update`)
    if (request.status === "payout_prepared") return { requestId, payoutId: String(request.payout_id), replayed: true }
    if (request.status !== "approved") conflict("Approve the withdrawal request before preparing its payout.")
    const policyReason = withdrawalUnavailable(await currentWithdrawalPolicy(tx))
    if (policyReason) conflict(policyReason)
    await assertNoRefundReview(tx, partnerId)
    const reference = input.invoiceReference ? financeText(input.invoiceReference, "Payout invoice reference") : request.invoice_reference ? String(request.invoice_reference) : null
    if (!reference) throw new ExpansionFinanceError("A partner invoice reference is required to prepare a payout.")
    const [used] = await rows(tx, sql`select id from expansion_payouts where partner_id=${partnerId} and lower(invoice_reference)=lower(${reference})`)
    if (used) conflict("That invoice reference already has a payout (possibly cancelled). Supply a replacement invoice reference.")
    const entries = await rows(tx, sql`select l.id,l.amount_pence::text from expansion_withdrawal_entries w join expansion_commission_ledger l on l.id=w.ledger_id where w.request_id=${requestId} and w.released_at is null order by l.created_at,l.id for update of l`)
    const total = sumPence(entries)
    if (total !== BigInt(String(request.amount_pence)) || total <= BigInt(0)) conflict("The reserved commission no longer matches the approved request.")
    const payoutId = randomUUID()
    await tx.execute(sql`insert into expansion_payouts(id,partner_id,amount_pence,invoice_reference,prepared_by) values(${payoutId},${partnerId},${total.toString()}::bigint,${reference},${actor.id})`)
    await tx.execute(sql`update expansion_withdrawal_requests set status='payout_prepared',payout_id=${payoutId},updated_at=now() where id=${requestId}`)
    for (const entry of entries) await tx.execute(sql`insert into expansion_payout_entries(payout_id,ledger_id) values(${payoutId},${String(entry.id)})`)
    await audit(tx, actor.id, payoutId, "payout_prepared", { partnerId, invoiceReference: reference, amountPence: total.toString(), ledgerIds: entries.map(row => row.id), withdrawalRequestId: requestId })
    return { requestId, payoutId, amountPence: total.toString(), replayed: false }
  })
}

export async function getWithdrawalAdmin() {
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await lockedActor(tx, actor)
    const policy = await currentWithdrawalPolicy(tx)
    const requests = await rows(tx, sql`select r.id,r.partner_id,u.display_name partner_name,r.amount_pence::text,r.invoice_reference,r.status,r.partner_note,r.review_note,r.created_at,r.reviewed_at,r.payout_id,r.policy_version,
      case when c.payout_id is not null then 'cancelled' else p.status end payout_status,(select count(*) from expansion_withdrawal_entries w where w.request_id=r.id)::int entries
      from expansion_withdrawal_requests r join expansion_partners ep on ep.id=r.partner_id join admin_users u on u.id=ep.user_id
      left join expansion_payouts p on p.id=r.payout_id left join expansion_payout_cancellations c on c.payout_id=r.payout_id order by (r.status='submitted') desc,r.created_at desc limit 200`)
    return { policy: policy ?? null, unavailableReason: withdrawalUnavailable(policy), requests }
  })
}
