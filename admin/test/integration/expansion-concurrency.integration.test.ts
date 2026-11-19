import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "../../src/lib/schema"
import { hasCapability, type Capability } from "../../src/lib/rbac"
import { standardCommissionTerms } from "../../src/lib/expansion-finance"

type Actor = { id: string; role: "owner" | "independent_partner"; active: boolean; sessionVersion: number; displayName: string }
type Gate = { arrive(pid: number): Promise<void>; pids: Set<number> }
const state = vi.hoisted(() => ({
  database: null as NodePgDatabase<typeof schema> | null,
  actors: null as AsyncLocalStorage<Actor> | null,
  gate: null as Gate | null,
}))
vi.mock("@/lib/db", () => ({ db: {
  execute: (...args: Parameters<NodePgDatabase<typeof schema>["execute"]>) => state.database!.execute(...args),
  transaction: (operation: Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]) => state.database!.transaction(async tx => {
    const gate = state.gate
    if (gate) {
      const result = await tx.execute(sql`select pg_backend_pid() as pid`)
      await gate.arrive(Number(result.rows[0].pid))
    }
    return operation(tx)
  }),
} }))
vi.mock("../../src/lib/server/rbac", () => ({ requireCapability: async (capability: Capability) => {
  const actor = state.actors?.getStore()
  if (!actor || !hasCapability(actor.role, capability)) throw new Error("Forbidden capability")
  return { ...actor }
} }))

import { founderMutation, partnerMutation, partnerSnapshot } from "../../src/lib/server/expansion"
import { resolveQualificationFlag } from "../../src/lib/server/expansion-programme"
import { requestMeeting, decideMeeting, correctMeeting } from "../../src/lib/server/expansion-operations"
import { allocateCandidate, checkCandidate, clearCandidateExclusivity, createCandidate, excludeCandidate, getResearchAdmin, markCandidateEligible, recordScreening, reassignCandidate, releaseCandidate } from "../../src/lib/server/expansion-research"
import { translateDbError } from "../../src/lib/db-errors"
import { approveProgramme, attributeReferral, createProgramme, createReferralCode, decideQualification, getProgrammeOverview, revokeQualification, reviewAchievementReward } from "../../src/lib/server/expansion-programme"
import { allocateExpansionInvoice, approveExpansionPayout, cancelExpansionPayout, cancelWithdrawal, getWithdrawalOverview, prepareWithdrawalPayout, requestWithdrawal, reviewWithdrawal, setWithdrawalPolicy, getPartnerFinance, prepareExpansionPayout, refundExpansionPayment, settleExpansionPayout, verifyExpansionPayment } from "../../src/lib/server/expansion-finance"
import { activatePartnerInvitation } from "../../src/lib/server/partner-invitations"
import { createInvoice, transitionInvoice } from "../../src/lib/server/invoices"

// Deliberately independent from DATABASE_URL / TEST_DATABASE_URL. This suite never provisions,
// truncates, drops or migrates the shared database; fixtures are additive and visibly test-labelled.
export function safeExpansionConcurrencyUrl(value: string | undefined): string {
  if (!value) throw new Error("EXPANSION_TEST_DATABASE_URL is required for this explicit disposable database test.")
  const url = new URL(value)
  const isolatedDocker = url.port === "55440" && ["/ss_expansion_test", "/ss_expansion_hardening_races"].includes(url.pathname)
  const isolatedNative = url.port === "55444" && url.pathname === "/ss_expansion_hardening_races"
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || (!isolatedDocker && !isolatedNative)) throw new Error("Expansion concurrency tests require an explicitly designated disposable loopback database.")
  return value
}

const suffix = randomUUID().slice(0, 8)
const founder: Actor = { id: randomUUID(), role: "owner", active: true, sessionVersion: 1, displayName: `Concurrency founder ${suffix}` }
const first: Actor = { id: randomUUID(), role: "independent_partner", active: true, sessionVersion: 1, displayName: `Concurrency partner A ${suffix}` }
const second: Actor = { id: randomUUID(), role: "independent_partner", active: true, sessionVersion: 1, displayName: `Concurrency partner B ${suffix}` }
let pool: Pool
let firstPartnerId: string
let clientId: number
let invoiceId: number
let acceptedContractId: string
let acceptedOpportunityId: string
let period: string
const runAs = <T>(actor: Actor, operation: () => Promise<T>) => state.actors!.run(actor, operation)

async function race<T>(operations: Array<() => Promise<T>>) {
  let arrived = 0, release!: () => void
  const ready = new Promise<void>(resolve => { release = resolve })
  const gate: Gate = { pids: new Set(), arrive: async pid => {
    gate.pids.add(pid)
    if (++arrived === operations.length) release()
    await Promise.race([ready, new Promise<never>((_, reject) => { const timer = setTimeout(() => reject(new Error("Concurrent transaction barrier timed out")), 10000); timer.unref() })])
  } }
  state.gate = gate
  try {
    const results = await Promise.allSettled(operations.map(operation => operation()))
    expect(gate.pids.size).toBe(operations.length)
    return results
  } finally { state.gate = null }
}

async function application(name: string, email: string, status = "activated") {
  const result = await pool.query<{ id: number }>("insert into partner_applications(name,email,region,experience,motivation,privacy_version,status,retention_until,onboarding_confirmations) values($1,$2,'TEST ONLY','Demonstration commercial experience','Isolated concurrency test only','test-reviewed-v1',$3,now()+interval '30 days','{\"agreement\":true,\"legal\":true,\"independentStatus\":true,\"operations\":true}') returning id", [name, email, status])
  return result.rows[0].id
}
async function submitted(tag: string, actor = first) {
  return runAs(actor, async () => {
    const record = await partnerMutation({ action: "register", country: "GB", businessName: `TEST ONLY concurrency ${suffix} ${tag}`, website: `concurrency-${suffix}-${tag}.example`, contactName: "Test director" })
    await partnerMutation({ action: "discovery", id: record.id, discovery: { objectives: "Test enquiries", pages: "Five", functionality: "Contact form", budget: "Subject to founder approval", timescale: "Assessed availability", decisionProcess: "Director" } })
    await partnerMutation({ action: "submit_scope", id: record.id, summary: "TEST ONLY five-page approved scope" })
    return record.id
  })
}
const approve = async (id: string, deliveryPeriod: string, hours = 10) => { const r = await approveRaw(id, deliveryPeriod, hours); await runAs(founder, async () => { await pool.query("update expansion_opportunities set customer_country_confirmed_by=$1 where id=$2 and customer_country is not null", [founder.id, id]) }); return r }
const approveRaw = (id: string, deliveryPeriod: string, hours = 10) => runAs(founder, () => founderMutation({ action: "review_scope", id, decision: "approved", period: deliveryPeriod, hours, technicalConfirmed: true, commercialConfirmed: true, notes: "TEST ONLY reviewed technical feasibility, price, delivery effort and commercial terms" }))

const refundClause = "TEST ONLY signed clause authorising unpaid commission adjustment"
async function fundedPartner(tag: string) {
  const actor: Actor = { id: randomUUID(), role: "independent_partner", active: true, sessionVersion: 1, displayName: `TEST ONLY ${tag} ${suffix}` }
  const email = `concurrency-${actor.id}@example.invalid`
  const applicantId = await application(actor.displayName, email)
  const partnerId = randomUUID()
  await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login',$4,true,1)", [actor.id, email, actor.displayName, actor.role])
  await pool.query("insert into expansion_partners(id,user_id,application_id,agreement_version,confirmed_at,activated_at) values($1,$2,$3,'test-reviewed-v1',now(),now())", [partnerId, actor.id, applicantId])
  const opportunityId = await submitted(tag, actor)
  const week = (await pool.query<{ next: string }>("select (max(period)+7)::text as next from expansion_capacity")).rows[0].next
  await runAs(founder, () => founderMutation({ action: "capacity", period: week, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY isolated finance race allocation" }))
  await approve(opportunityId, week)
  const terms = { ...standardCommissionTerms(), planVersion: "concurrency-approved-refund-v1", unpaidRefundApprovalReference: refundClause }
  const accepted = await runAs(founder, () => founderMutation({ action: "accept_contract", id: opportunityId, clientId, terms, agreementReference: "TEST ONLY signed fixture" }))
  const contractId = String((accepted as { id: string }).id)
  const invoice = await createInvoice({ clientId, items: [{ title: "TEST ONLY deposit", quantity: 1, unitAmount: 100000 }] }, founder.id)
  await transitionInvoice(invoice.id, "issue", founder.id)
  await runAs(founder, () => allocateExpansionInvoice({ contractId, invoiceId: invoice.id, milestone: "deposit", netPence: "100000", evidenceReference: "TEST ONLY reviewed invoice allocation to accepted deposit" }))
  const collection = await runAs(founder, () => verifyExpansionPayment({
    contractId, invoiceId: invoice.id, milestone: "deposit", reference: `${suffix}-${tag}-collection`,
    netPence: "100000", grossPence: "120000", evidenceReference: "TEST ONLY verified net and gross receipt", confirmed: true,
  }))
  return { actor, partnerId, contractId, opportunityId, invoiceId: invoice.id, paymentId: collection.paymentId }
}

const prepare = (partnerId: string, reference: string) => runAs(founder, () => prepareExpansionPayout({ partnerId, invoiceReference: `${suffix}-${reference}`, invoiceNetPence: "30000" }))

function expectSingleWinner(results: PromiseSettledResult<unknown>[], rejection: RegExp) {
  expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
  const rejected = results.find(result => result.status === "rejected")
  expect(rejected?.reason).toMatchObject({ status: 409, message: expect.stringMatching(rejection) })
}

describe.skipIf(!process.env.EXPANSION_TEST_DATABASE_URL)("Expansion real separate-connection PostgreSQL races", () => {
  beforeAll(async () => {
    const url = safeExpansionConcurrencyUrl(process.env.EXPANSION_TEST_DATABASE_URL)
    pool = new Pool({ connectionString: url, max: 8, options: "-c app.access_mode=internal_write", connectionTimeoutMillis: 5000 })
    const identity = await pool.query<{ name: string }>("select current_database() name")
    if (identity.rows[0]?.name !== new URL(url).pathname.slice(1)) throw new Error("Unexpected database; refusing test mutations.")
    state.database = drizzle(pool, { schema })
    state.actors = new AsyncLocalStorage<Actor>()
    for (const actor of [founder, first, second]) await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login',$4,true,1)", [actor.id, `concurrency-${actor.id}@example.invalid`, actor.displayName, actor.role])
    for (const actor of [first, second]) {
      const applicantId = await application(actor.displayName, `concurrency-${actor.id}@example.invalid`)
      const id = randomUUID()
      await pool.query("insert into expansion_partners(id,user_id,application_id,agreement_version,confirmed_at,activated_at) values($1,$2,$3,'test-reviewed-v1',now(),now())", [id, actor.id, applicantId])
      if (actor.id === first.id) firstPartnerId = id
    }
    const client = await pool.query<{ id: number }>("insert into clients(name,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) values($1,$2,'1 Test Street','Nottingham','NG1 1AA','United Kingdom') returning id", [`TEST ONLY concurrency client ${suffix}`, `T${suffix.toUpperCase()}`])
    clientId = client.rows[0].id
    await pool.query("insert into invoice_supplier_settings(id,legal_name,address_line_1,city,postcode,country,payment_instructions) values(1,'TEST ONLY ScaleSmiths','1 Test Street','Nottingham','NG1 1AA','United Kingdom','No real transfer') on conflict(id) do nothing")
    // Gate prerequisite: explicitly approved synthetic market (the production default is fail-closed, no rows).
    await pool.query("insert into expansion_markets(country_code,country_name,status,plan_keys,legal_reviewed,accounting_reviewed,privacy_reviewed,operations_reviewed,approval_reference,approved_by) values('GB','United Kingdom','approved','{standard-v2,growth-only-v1,bespoke-v1}',true,true,true,true,'TEST ONLY market approval',$1) on conflict(country_code) do update set status='approved',plan_keys=excluded.plan_keys,legal_reviewed=true,accounting_reviewed=true,privacy_reviewed=true,operations_reviewed=true,approval_reference=excluded.approval_reference,approved_by=excluded.approved_by", [founder.id])
    acceptedOpportunityId = await submitted("accepted")
    // Additive reruns choose fresh future Mondays and preserve every previous fixture/demo reservation.
    const weeks = await pool.query<{ initial: string; race: string }>("select greatest(date '2100-01-04',coalesce(max(period)+7,date '2100-01-04'))::text initial,(greatest(date '2100-01-04',coalesce(max(period)+7,date '2100-01-04'))+7)::text race from expansion_capacity")
    const initialPeriod = weeks.rows[0].initial
    period = weeks.rows[0].race
    await runAs(founder, () => founderMutation({ action: "capacity", period: initialPeriod, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY separate allocation for accepted contract" }))
    await approve(acceptedOpportunityId, initialPeriod)
    const accepted = await runAs(founder, () => founderMutation({ action: "accept_contract", id: acceptedOpportunityId, clientId, terms: standardCommissionTerms(), agreementReference: `TEST ONLY signed fixture ${suffix}` }))
    acceptedContractId = String((accepted as { id: string }).id)
    const invoice = await createInvoice({ clientId, items: [{ title: "TEST ONLY qualifying deposit", quantity: 1, unitAmount: 100000 }] }, founder.id)
    await transitionInvoice(invoice.id, "issue", founder.id)
    invoiceId = invoice.id
    await runAs(founder, () => allocateExpansionInvoice({ contractId: acceptedContractId, invoiceId, milestone: "deposit", netPence: "100000", evidenceReference: "TEST ONLY reviewed invoice allocation to accepted deposit" }))
  }, 60000)
  afterAll(async () => { state.gate = null; await pool?.end() })

  it("locks two simultaneous replays on distinct connections into exactly one £300 entitlement", async () => {
    const input = { contractId: acceptedContractId, invoiceId, milestone: "deposit" as const, reference: `concurrency-bank-${suffix}`, netPence: "100000", grossPence: "120000", evidenceReference: "TEST ONLY verified statement, net amount separately confirmed", confirmed: true }
    const results = await race([() => runAs(founder, () => verifyExpansionPayment(input)), () => runAs(founder, () => verifyExpansionPayment(input))])
    expect(results.every(result => result.status === "fulfilled")).toBe(true)
    const values = results.map(result => result.status === "fulfilled" ? result.value : null)
    expect(values.filter(value => value?.replayed === false)).toHaveLength(1)
    expect(values.filter(value => value?.replayed === true)).toHaveLength(1)
    const ledger = await pool.query("select count(*)::integer count,coalesce(sum(amount_pence),0)::text amount from expansion_commission_ledger where contract_id=$1", [acceptedContractId])
    expect(ledger.rows).toEqual([{ count: 1, amount: "30000" }])
    const canonical = await pool.query("select count(*)::integer count,sum(amount)::text amount from commercial_payments where reference=$1", [input.reference])
    expect(canonical.rows).toEqual([{ count: 1, amount: "100000" }])
  })
  it("allows only one founder approval to consume the final assessed delivery slot", async () => {
    const firstId = await submitted("slot-a"), secondId = await submitted("slot-b")
    await runAs(founder, () => founderMutation({ action: "capacity", period, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY one remaining slot after all commitments" }))
    const results = await race([() => approve(firstId, period), () => approve(secondId, period)])
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1)
    const reservations = await pool.query("select count(*)::integer count,sum(hours)::integer hours from expansion_reservations where opportunity_id=any($1::uuid[]) and status<>'released'", [[firstId, secondId]])
    expect(reservations.rows).toEqual([{ count: 1, hours: 10 }])
  })
  it("consumes a pending invitation once when activation requests run on separate connections", async () => {
    vi.stubEnv("PARTNER_ACTIVATION_ENABLED", "true")
    try {
      const applicantId = await application(`TEST ONLY activation ${suffix}`, `activate-${suffix}@example.invalid`, "onboarding")
      const invitation = await runAs(founder, () => founderMutation({ action: "invite", id: applicantId, agreementVersion: "test-reviewed-v1" }))
      const token = String((invitation as { invitationToken: string }).invitationToken)
      const results = await race([() => activatePartnerInvitation(token, "TestOnly!Activation-A-123"), () => activatePartnerInvitation(token, "TestOnly!Activation-B-123")])
      expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
      expect(results.filter(result => result.status === "rejected")).toHaveLength(1)
      const identity = await pool.query("select u.active,u.session_version,p.invitation_hash,p.invitation_expires_at,p.activated_at is not null as activated from expansion_partners p join admin_users u on u.id=p.user_id where p.application_id=$1", [applicantId])
      expect(identity.rows).toEqual([{ active: true, session_version: 2, invitation_hash: null, invitation_expires_at: null, activated: true }])
    } finally {
      vi.unstubAllEnvs()
    }
  })
  it("keeps partner B outside partner A's prospect and earned commission boundaries", async () => {
    await expect(runAs(second, () => partnerMutation({ action: "discovery", id: acceptedOpportunityId, discovery: { objectives: "Cross-partner attack" } }))).rejects.toThrow("not found")
    const snapshot = await runAs(second, () => partnerSnapshot())
    expect(snapshot.opportunities).toEqual([])
    const finance = await runAs(second, () => getPartnerFinance())
    expect([finance.earnedPence, finance.paidPence, finance.unpaidPence]).toEqual(["0", "0", "0"])
    expect(finance.ledger).toEqual([])
    await expect(runAs(second, () => getPartnerFinance(first.id))).rejects.toThrow("access denied")
    expect(firstPartnerId).toBeTruthy()
  })
  it("serializes overlapping partial refunds and keeps canonical cash and commission in sync", async () => {
    const partner = await fundedPartner("overlapping-refunds")
    const refund = (tag: string) => runAs(founder, () => refundExpansionPayment({
      paymentId: partner.paymentId, reference: `${suffix}-${tag}`, treatment: "adjust_unpaid", netPence: "60000", grossPence: "72000",
      reason: "TEST ONLY verified refund", termsApprovalReference: refundClause,
    }))
    const results = await race([() => refund("refund-a"), () => refund("refund-b")])
    expectSingleWinner(results, /remaining net or VAT balance/)
    const cash = await pool.query("select count(*)::int count,sum(e.net_pence)::text net,sum(e.gross_pence)::text gross,sum(c.amount)::text canonical from expansion_payment_events e join commercial_payments c on c.id=e.commercial_payment_id where e.contract_id=$1", [partner.contractId])
    expect(cash.rows).toEqual([{ count: 2, net: "40000", gross: "48000", canonical: "40000" }])
    const finance = await runAs(partner.actor, () => getPartnerFinance())
    expect(finance.earnedPence).toBe("12000")
    expect(finance.ledger.map(entry => entry.amount_pence).sort()).toEqual(["-18000", "30000"])
  })
  it("serializes prepared payout cancellation against approval and preserves historical allocation", async () => {
    const partner = await fundedPartner("cancel-approve")
    const payout = await prepare(partner.partnerId, "cancel-approve-original")
    const cancellation = { payoutId: payout.payoutId, reason: "TEST ONLY corrected payout invoice", noExternalSettlement: true }
    const results = await race<unknown>([
      () => runAs(founder, () => cancelExpansionPayout(cancellation)),
      () => runAs(founder, () => approveExpansionPayout({ payoutId: payout.payoutId })),
    ])
    expectSingleWinner(results, /prepared payout/)
    const cancelled = results[0].status === "fulfilled"
    const history = await pool.query("select p.status,(select count(*)::int from expansion_payout_entries where payout_id=p.id) entries,(select count(*)::int from expansion_payout_claims where payout_id=p.id) claims,(select count(*)::int from expansion_payout_cancellations where payout_id=p.id) cancellations from expansion_payouts p where id=$1", [payout.payoutId])
    expect(history.rows).toEqual([cancelled ? { status: "prepared", entries: 1, claims: 0, cancellations: 1 } : { status: "approved", entries: 1, claims: 1, cancellations: 0 }])
    if (cancelled) {
      expect(await runAs(founder, () => cancelExpansionPayout(cancellation))).toMatchObject({ replayed: true })
      expect(await prepare(partner.partnerId, "cancel-approve-replacement")).toMatchObject({ amountPence: "30000", replayed: false })
    } else {
      await expect(prepare(partner.partnerId, "cancel-approve-replacement")).rejects.toThrow("No positive unallocated commission")
    }
  })
  it("awards one exclusive claim when two distinct payout invoices compete for one ledger entry", async () => {
    const partner = await fundedPartner("exclusive-claim")
    const results = await race([() => prepare(partner.partnerId, "claim-a"), () => prepare(partner.partnerId, "claim-b")])
    expectSingleWinner(results, /No positive unallocated commission/)
    const claims = await pool.query("select count(*)::int count,sum(l.amount_pence)::text amount from expansion_payout_claims c join expansion_commission_ledger l on l.id=c.ledger_id where l.partner_id=$1", [partner.partnerId])
    expect(claims.rows).toEqual([{ count: 1, amount: "30000" }])
  })

  it("preserves a voided allocation and ends the linked contract without erasing the cash history", async () => {
    const fixture = await fundedPartner("canonical-cancellation")
    const prepared = await prepare(fixture.partnerId,"canonical-void")
    await runAs(founder, () => cancelExpansionPayout({
      payoutId:prepared.payoutId,reason:"TEST ONLY no payment sent",noExternalSettlement:true,
    }))
    await runAs(founder, () => founderMutation({
      action:"cancel_contract",id:fixture.opportunityId,reason:"TEST ONLY accepted cancellation",deliveryReviewed:true,
    }))
    const [record] = (await pool.query(`select c.status,
      (select count(*)::int from expansion_payout_entries where payout_id=$2) as history,
      (select count(*)::int from expansion_payout_claims where payout_id=$2) as claims,
      (select count(*)::int from expansion_payment_events where contract_id=$1) as receipts
      from expansion_contracts e join commercial_contracts c on c.id=e.commercial_contract_id where e.id=$1`,
      [fixture.contractId,prepared.payoutId])).rows
    expect(record).toEqual({status:"ended",history:1,claims:0,receipts:1})
  })
  it("records approved settlement while concurrent cancellation is denied", async () => {
    const partner = await fundedPartner("settle-cancel")
    const payout = await prepare(partner.partnerId, "settle-cancel-invoice")
    await runAs(founder, () => approveExpansionPayout({ payoutId: payout.payoutId }))
    const settlementReference = `${suffix}-verified-test-settlement`
    const results = await race<unknown>([
      () => runAs(founder, () => cancelExpansionPayout({ payoutId: payout.payoutId, reason: "TEST ONLY cancellation attempt", noExternalSettlement: true })),
      () => runAs(founder, () => settleExpansionPayout({ payoutId: payout.payoutId, settlementReference })),
    ])
    expectSingleWinner(results, /Only a prepared payout/)
    expect(results[1]).toMatchObject({ status: "fulfilled", value: { status: "paid", replayed: false } })
    const history = await pool.query("select p.status,p.settlement_reference,(select count(*)::int from expansion_payout_claims where payout_id=p.id) claims,(select count(*)::int from expansion_payout_cancellations where payout_id=p.id) cancellations from expansion_payouts p where id=$1", [payout.payoutId])
    expect(history.rows).toEqual([{ status: "paid", settlement_reference: settlementReference, claims: 1, cancellations: 0 }])
    const finance = await runAs(partner.actor, () => getPartnerFinance())
    expect([finance.earnedPence, finance.paidPence, finance.unpaidPence]).toEqual(["30000", "30000", "0"])
  })
  it("orders a refund awaiting entitlement review against payout preparation and blocks subsequent approval", async () => {
    const partner = await fundedPartner("refund-prepare")
    const results = await race<unknown>([
      () => runAs(founder, () => refundExpansionPayment({ paymentId: partner.paymentId, reference: `${suffix}-manual-review`, netPence: "20000", grossPence: "24000", reason: "TEST ONLY refund requires review" })),
      () => prepare(partner.partnerId, "review-race"),
    ])
    expect(results[0]).toMatchObject({ status: "fulfilled", value: { treatment: "manual_review", commissionPence: "0", calculatedAdjustmentPence: "-6000" } })
    const payouts = await pool.query<{ id: string; status: string }>("select id,status from expansion_payouts where partner_id=$1", [partner.partnerId])
    if (results[1].status === "fulfilled") {
      expect(payouts.rows).toHaveLength(1)
      expect(payouts.rows[0].status).toBe("prepared")
      await expect(runAs(founder, () => approveExpansionPayout({ payoutId: payouts.rows[0].id }))).rejects.toThrow("outstanding refund entitlement review")
    } else {
      expect(results[1].reason).toMatchObject({ status: 409, message: expect.stringContaining("outstanding refund entitlement review") })
      expect(payouts.rows).toEqual([])
    }
    expect((await runAs(partner.actor, () => getPartnerFinance())).earnedPence).toBe("30000")
  })

  describe("checkpoint 2A: pooled commercial plans on separate connections", () => {
    const enable = (planKey: string, enabled: boolean) => runAs(founder, () => founderMutation({ action: "set_plan_enabled", planKey, enabled, reason: "TEST ONLY isolated plan gate" }))
    async function planContract(tag: string, plan: Record<string, unknown>, invoiceItems: Array<[string, number]>) {
      const opportunityId = await submitted(tag)
      const week = (await pool.query<{ next: string }>("select (max(period)+7)::text as next from expansion_capacity")).rows[0].next
      await runAs(founder, () => founderMutation({ action: "capacity", period: week, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY plan race allocation" }))
      await approve(opportunityId, week)
      const accepted = await runAs(founder, () => founderMutation({ action: "accept_contract", id: opportunityId, clientId, plan, agreementReference: `TEST ONLY signed plan fixture ${suffix}-${tag}` }))
      const contractId = String((accepted as { id: string }).id)
      const invoice = await createInvoice({ clientId, items: invoiceItems.map(([title, unitAmount]) => ({ title: `TEST ONLY ${title}`, quantity: 1, unitAmount })) }, founder.id)
      await transitionInvoice(invoice.id, "issue", founder.id)
      return { contractId, invoiceId: invoice.id }
    }
    const allocate = (c: { contractId: string; invoiceId: number }, milestone: "deposit" | "interim" | "final" | "first_retainer", netPence: string) =>
      runAs(founder, () => allocateExpansionInvoice({ ...c, milestone, netPence, evidenceReference: "TEST ONLY reviewed plan allocation" }))
    const collect = (c: { contractId: string; invoiceId: number }, milestone: "deposit" | "interim" | "final" | "first_retainer", netPence: string, reference: string) =>
      runAs(founder, () => verifyExpansionPayment({ ...c, milestone, reference: `${suffix}-${reference}`, netPence, grossPence: netPence, evidenceReference: "TEST ONLY verified receipt", confirmed: true }))
    const ledger = async (contractId: string) => (await pool.query<{ t: string }>("select coalesce(sum(amount_pence),0)::text t from expansion_commission_ledger where contract_id=$1", [contractId])).rows[0].t

    it("serialises concurrent instalments on one interim milestone: pooled commission is exact and the allocation cap holds", async () => {
      await enable("standard-v2", true)
      const c = await planContract("pooled-a", { plan: "standard-v2", scheduleId: "custom", buildInstalmentsPence: [50000, 50000, 50000, 50000], scheduleApprovalReference: "TEST ONLY approval" }, [["build", 200000], ["retainer", 35000]])
      await allocate(c, "deposit", "50000"); await allocate(c, "interim", "100000"); await allocate(c, "final", "50000"); await allocate(c, "first_retainer", "35000")
      await collect(c, "deposit", "50000", "pa-1")
      const results = await race([() => collect(c, "interim", "50000", "pa-2"), () => collect(c, "interim", "50000", "pa-3")])
      expect(results.every(r => r.status === "fulfilled")).toBe(true)
      await collect(c, "final", "50000", "pa-4"); await collect(c, "first_retainer", "35000", "pa-5")
      expect(await ledger(c.contractId)).toBe("70500")
      await expect(collect(c, "interim", "1", "pa-6")).rejects.toMatchObject({ status: 409 })
    })
    it("admits only one of two concurrent collections that together exceed the interim allocation", async () => {
      const c = await planContract("pooled-b", { plan: "standard-v2", scheduleId: "custom", buildInstalmentsPence: [50000, 50000, 50000, 50000], scheduleApprovalReference: "TEST ONLY approval" }, [["build", 200000]])
      await allocate(c, "interim", "100000")
      const results = await race([() => collect(c, "interim", "60000", "pb-1"), () => collect(c, "interim", "60000", "pb-2")])
      expectSingleWinner(results, /exceeds the approved milestone allocation|exceeds the approved milestone/)
      expect(await ledger(c.contractId)).toBe("18000")
    })
    it("never creates a contract on a plan disabled before acceptance, and a concurrent disable leaves a consistent outcome", async () => {
      await enable("growth-only-v1", false)
      const id = await submitted("gate"), week = (await pool.query<{ next: string }>("select (max(period)+7)::text as next from expansion_capacity")).rows[0].next
      await runAs(founder, () => founderMutation({ action: "capacity", period: week, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY gate allocation" }))
      await approve(id, week)
      const accept = () => runAs(founder, () => founderMutation({ action: "accept_contract", id, clientId, plan: { plan: "growth-only-v1" }, agreementReference: "TEST ONLY gate" }))
      await expect(accept()).rejects.toMatchObject({ status: 409, message: expect.stringContaining("not enabled") })
      await enable("growth-only-v1", true)
      const results = await race([accept, () => enable("growth-only-v1", false)])
      expect(results[1].status).toBe("fulfilled")
      const contracts = (await pool.query("select count(*)::int c from expansion_contracts where opportunity_id=$1", [id])).rows[0].c
      expect(contracts).toBe(results[0].status === "fulfilled" ? 1 : 0)
      if (results[0].status === "rejected") expect(results[0].reason).toMatchObject({ status: 409, message: expect.stringContaining("not enabled") })
      expect((await pool.query("select enabled from expansion_plan_settings where plan_key='growth-only-v1'")).rows[0].enabled).toBe(false)
    })
  })

  describe("checkpoint 2B: allowances and additional claims on separate connections", () => {
    async function approvedFor(actor: Actor, tag: string) {
      const id = await submitted(tag, actor)
      const week = (await pool.query<{ next: string }>("select (max(period)+7)::text as next from expansion_capacity")).rows[0].next
      await runAs(founder, () => founderMutation({ action: "capacity", period: week, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY allowance race allocation" }))
      await approve(id, week)
      return id
    }
    const setPolicy = (partnerId: string, count: number) => runAs(founder, () => founderMutation({ action: "set_discount_policy", partnerId, periodStart: "2020-01-01", periodEnd: "2099-01-01", allowanceCount: count, permittedFeesPence: [150000, 0], approvalReference: "TEST ONLY allowance approval" }))
    const reserve = (id: string) => runAs(founder, () => founderMutation({ action: "reserve_discount", id, feePence: 150000, reason: "TEST ONLY commercial reason" }))

    it("Case N: two simultaneous reservations against one remaining allowance admit exactly one", async () => {
      const partner = await fundedPartner("allowance-n")
      await setPolicy(partner.partnerId, 1)
      const a = await approvedFor(partner.actor, "n-a"), b = await approvedFor(partner.actor, "n-b")
      const results = await race([() => reserve(a), () => reserve(b)])
      expectSingleWinner(results, /exhausted/)
      const used = await pool.query("select count(*)::int c from expansion_discount_reservations r join expansion_discount_policies p on p.id=r.policy_id where p.partner_id=$1 and r.status in ('reserved','consumed')", [partner.partnerId])
      expect(used.rows[0].c).toBe(1)
    })
    it("never overspends under six-way contention for a three-slot allowance", async () => {
      const partner = await fundedPartner("allowance-six")
      await setPolicy(partner.partnerId, 3)
      const ids: string[] = []
      for (let i = 0; i < 6; i++) ids.push(await approvedFor(partner.actor, `six-${i}`))
      const results = await race(ids.map(id => () => reserve(id)))
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(3)
      expect(results.filter(r => r.status === "rejected").every(r => (r as PromiseRejectedResult).reason?.status === 409)).toBe(true)
    })
    it("serialises a policy reduction against concurrent reservations so use never exceeds the allowance", async () => {
      const partner = await fundedPartner("allowance-lower")
      await setPolicy(partner.partnerId, 2)
      const [x, y] = [await approvedFor(partner.actor, "l-a"), await approvedFor(partner.actor, "l-b")]
      await reserve(x)
      const results = await race([() => reserve(y), () => setPolicy(partner.partnerId, 1)])
      const used = (await pool.query("select count(*)::int c from expansion_discount_reservations r join expansion_discount_policies p on p.id=r.policy_id where p.partner_id=$1 and r.status in ('reserved','consumed')", [partner.partnerId])).rows[0].c
      const allowance = (await pool.query("select allowance_count c from expansion_discount_policies where partner_id=$1", [partner.partnerId])).rows[0].c
      expect(used).toBeLessThanOrEqual(allowance)
      expect(results.some(r => r.status === "rejected")).toBe(true)
    })
    it("admits one additional claim when two partners claim the same project, and one approval when founders review concurrently", async () => {
      const label = `Booking ${suffix}`, domain = `existing-${suffix}.example`
      const claim = (actor: Actor) => runAs(actor, () => partnerMutation({ action: "request_additional", businessName: "TEST ONLY Existing Ltd", website: domain, projectLabel: label, contribution: "TEST ONLY documented introduction." }))
      const results = await race([() => claim(first), () => claim(second)])
      expect(results.every(r => r.status === "fulfilled")).toBe(true)
      const claims = await pool.query<{ id: string }>("select id from expansion_additional_claims where normalized_domain=$1", [domain])
      expect(claims.rows).toHaveLength(1)
      const approve2 = () => runAs(founder, () => founderMutation({ action: "review_additional", claimId: claims.rows[0].id, decision: "approved", clientId, attributionConfirmed: true, notes: "TEST ONLY attribution evidence" }))
      const reviews = await race([approve2, approve2])
      expectSingleWinner(reviews, /pending/)
      expect((await pool.query("select count(*)::int c from expansion_opportunities where additional_claim_id=$1", [claims.rows[0].id])).rows[0].c).toBe(1)
      expect((await pool.query("select count(*)::int c from clients where id=$1", [clientId])).rows[0].c).toBe(1)
    })
  })

  describe("checkpoint 3A: persisted discounted, free-build and additional-customer journeys", () => {
    type Ref = { contractId: string; invoiceId: number }
    type M = "deposit" | "interim" | "final" | "first_retainer"
    const allocate = (c: Ref, milestone: M, netPence: string) => runAs(founder, () => allocateExpansionInvoice({ ...c, milestone, netPence, evidenceReference: "TEST ONLY reviewed 3A allocation" }))
    const collect = (c: Ref, milestone: M, netPence: string, reference: string) => runAs(founder, () => verifyExpansionPayment({ ...c, milestone, reference: `${suffix}-${reference}`, netPence, grossPence: netPence, evidenceReference: "TEST ONLY verified receipt", confirmed: true }))
    const ledger = async (contractId: string) => (await pool.query<{ t: string }>("select coalesce(sum(amount_pence),0)::text t from expansion_commission_ledger where contract_id=$1", [contractId])).rows[0].t
    const nextWeek = async () => (await pool.query<{ next: string }>("select (max(period)+7)::text as next from expansion_capacity")).rows[0].next
    const enable = (planKey: string) => runAs(founder, () => founderMutation({ action: "set_plan_enabled", planKey, enabled: true, reason: "TEST ONLY 3A" }))
    const policy = () => runAs(founder, () => founderMutation({ action: "set_discount_policy", partnerId: firstPartnerId, periodStart: "2020-01-01", periodEnd: "2099-01-01", allowanceCount: 20, permittedFeesPence: [150000, 0], approvalReference: "TEST ONLY 3A allowance" }))
    async function approvedOpportunity(tag: string) {
      const id = await submitted(tag), week = await nextWeek()
      await runAs(founder, () => founderMutation({ action: "capacity", period: week, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY 3A allocation" }))
      await approve(id, week)
      return { id, week }
    }
    async function invoiceFor(items: Array<[string, number]>) {
      const invoice = await createInvoice({ clientId, items: items.map(([title, unitAmount]) => ({ title: `TEST ONLY ${title}`, quantity: 1, unitAmount })) }, founder.id)
      await transitionInvoice(invoice.id, "issue", founder.id)
      return invoice.id
    }

    it("Case E: approved £1,500 build under an allowance earns £450 + £105 = £555 from verified collections", async () => {
      await enable("standard-v2"); await policy()
      const { id } = await approvedOpportunity("3a-e")
      await runAs(founder, () => founderMutation({ action: "reserve_discount", id, feePence: 150000, reason: "TEST ONLY approved £1,500 build" }))
      const accepted = await runAs(founder, () => founderMutation({ action: "accept_contract", id, clientId, plan: { plan: "standard-v2", buildFeePence: 150000 }, agreementReference: `TEST ONLY 3A-E ${suffix}` })) as { id: string }
      const stored = (await pool.query("select terms from expansion_contracts where id=$1", [accepted.id])).rows[0].terms
      expect(stored.commitment).toMatchObject({ buildPence: "150000", minTermMonths: 12, minimumContractValuePence: "570000", buildInstalments: ["75000", "75000"] })
      expect((await pool.query("select status,contract_id from expansion_discount_reservations where opportunity_id=$1", [id])).rows).toEqual([{ status: "consumed", contract_id: accepted.id }])
      const c = { contractId: accepted.id, invoiceId: await invoiceFor([["build", 150000], ["retainer", 35000]]) }
      await allocate(c, "deposit", "75000"); await allocate(c, "final", "75000"); await allocate(c, "first_retainer", "35000")
      expect((await collect(c, "deposit", "75000", "3ae-1")).commissionPence).toBe("22500")
      expect((await collect(c, "final", "75000", "3ae-2")).commissionPence).toBe("22500")
      expect(await ledger(accepted.id)).toBe("45000")
      expect((await collect(c, "first_retainer", "35000", "3ae-3")).commissionPence).toBe("10500")
      expect(await ledger(accepted.id)).toBe("55500")
    })
    it("Case F: approved free build earns only £105 on the first £350, with a £4,200 twelve-month commitment", async () => {
      await enable("standard-v2"); await policy()
      const { id } = await approvedOpportunity("3a-f")
      expect((await pool.query("select hours,status from expansion_reservations where opportunity_id=$1", [id])).rows[0]).toMatchObject({ hours: 10, status: "provisional" })
      await runAs(founder, () => founderMutation({ action: "reserve_discount", id, feePence: 0, reason: "TEST ONLY approved free build" }))
      const accepted = await runAs(founder, () => founderMutation({ action: "accept_contract", id, clientId, plan: { plan: "standard-v2", buildFeePence: 0 }, agreementReference: `TEST ONLY 3A-F ${suffix}` })) as { id: string }
      expect((await pool.query("select terms->'commitment' c from expansion_contracts where id=$1", [accepted.id])).rows[0].c).toMatchObject({ buildPence: "0", recurringPence: "35000", minimumContractValuePence: "420000", minTermMonths: 12, buildInstalments: [] })
      expect((await pool.query("select one_off_amount,monthly_amount from commercial_contracts where id=(select commercial_contract_id from expansion_contracts where id=$1)", [accepted.id])).rows).toEqual([{ one_off_amount: 0, monthly_amount: 35000 }])
      const c = { contractId: accepted.id, invoiceId: await invoiceFor([["retainer", 35000], ["second retainer", 35000]]) }
      await expect(allocate(c, "deposit", "1")).rejects.toMatchObject({ status: 409 })
      await allocate(c, "first_retainer", "35000")
      expect((await collect(c, "first_retainer", "35000", "3af-1")).commissionPence).toBe("10500")
      await expect(collect(c, "first_retainer", "35000", "3af-2")).rejects.toMatchObject({ status: 409 })
      expect(await ledger(accepted.id)).toBe("10500")
    })
    it("Case H: an approved additional project for an existing customer earns commission only on its own allocated collections", async () => {
      await enable("bespoke-v1")
      const clientsBefore = (await pool.query("select count(*)::int c from clients")).rows[0].c
      const domain = `additional-3a-${suffix}.example`
      const { id: claimId } = await runAs(first, () => partnerMutation({ action: "request_additional", businessName: "TEST ONLY Existing Customer", website: domain, projectLabel: "Booking platform", contribution: "TEST ONLY introduced the director and led requirements." })) as { id: string }
      const { opportunityId } = await runAs(founder, () => founderMutation({ action: "review_additional", claimId, decision: "approved", clientId, attributionConfirmed: true, notes: "TEST ONLY attribution evidence reviewed." })) as { opportunityId: string }
      await runAs(founder, () => founderMutation({ action: "set_opportunity_market", id: opportunityId, countryCode: "GB" }))
      await runAs(first, async () => {
        await partnerMutation({ action: "discovery", id: opportunityId, discovery: { objectives: "Bookings", pages: "Five", functionality: "Booking", budget: "Subject to approval", timescale: "Assessed", decisionProcess: "Director" } })
        await partnerMutation({ action: "submit_scope", id: opportunityId, summary: "TEST ONLY booking platform approved separately." })
      })
      const week = await nextWeek()
      await runAs(founder, () => founderMutation({ action: "capacity", period: week, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY 3A-H allocation" }))
      await approve(opportunityId, week)
      const plan = { plan: "bespoke-v1", buildInstalmentsPence: [400000, 600000] }
      await expect(runAs(founder, () => founderMutation({ action: "accept_contract", id: opportunityId, clientId: clientId + 100000, plan, agreementReference: "TEST ONLY wrong client" }))).rejects.toThrow()
      const accepted = await runAs(founder, () => founderMutation({ action: "accept_contract", id: opportunityId, clientId, plan, agreementReference: `TEST ONLY 3A-H ${suffix}` })) as { id: string }
      expect((await pool.query("select count(*)::int c from clients")).rows[0].c).toBe(clientsBefore)
      expect(await ledger(accepted.id)).toBe("0")
      const historicalBefore = await ledger(acceptedContractId)
      // Historical revenue on the same customer is not claimable: the old invoice has no reviewed allocation to the new contract.
      await expect(collect({ contractId: accepted.id, invoiceId }, "deposit", "1000", "3ah-old")).rejects.toMatchObject({ status: 409, message: expect.stringContaining("reviewed allocation") })
      const c = { contractId: accepted.id, invoiceId: await invoiceFor([["booking build", 1000000]]) }
      await allocate(c, "deposit", "400000"); await allocate(c, "final", "600000")
      expect((await collect(c, "deposit", "400000", "3ah-1")).commissionPence).toBe("120000")
      expect(await ledger(accepted.id)).toBe("120000")
      expect((await collect(c, "final", "600000", "3ah-2")).commissionPence).toBe("180000")
      expect(await ledger(accepted.id)).toBe("300000")
      expect(await ledger(acceptedContractId)).toBe(historicalBefore)
      expect((await pool.query("select l.partner_id from expansion_commission_ledger l where l.contract_id=$1 group by 1", [accepted.id])).rows).toEqual([{ partner_id: firstPartnerId }])
    })
  })

  describe("checkpoint 3B: withdrawal requests on separate connections", () => {
    type Funded = Awaited<ReturnType<typeof fundedPartner>>
    const policy = () => runAs(founder, () => setWithdrawalPolicy({ enabled: true, invoiceRequired: true, approvalReference: "TEST ONLY payout policy" }))
    const ask = (p: Funded, ref: string, extra: Record<string, unknown> = {}) => runAs(p.actor, () => requestWithdrawal({ all: true, invoiceReference: `${suffix}-${ref}`, ...extra }))
    const live = async (partnerId: string) => (await pool.query("select count(*)::int c from expansion_withdrawal_entries w join expansion_withdrawal_requests r on r.id=w.request_id where r.partner_id=$1 and w.released_at is null", [partnerId])).rows[0].c
    /** A second £300 ledger entry so a partner has two independently reservable entries. */
    async function withSecondEntry(p: Funded, tag: string) {
      const invoice = await createInvoice({ clientId, items: [{ title: "TEST ONLY final", quantity: 1, unitAmount: 100000 }] }, founder.id)
      await transitionInvoice(invoice.id, "issue", founder.id)
      await runAs(founder, () => allocateExpansionInvoice({ contractId: p.contractId, invoiceId: invoice.id, milestone: "final", netPence: "100000", evidenceReference: "TEST ONLY reviewed allocation" }))
      await runAs(founder, () => verifyExpansionPayment({ contractId: p.contractId, invoiceId: invoice.id, milestone: "final", reference: `${suffix}-${tag}-second`, netPence: "100000", grossPence: "100000", evidenceReference: "TEST ONLY receipt", confirmed: true }))
      return p
    }
    const refund = (p: Funded, ref: string, extra: Record<string, unknown> = {}) => runAs(founder, () => refundExpansionPayment({ paymentId: p.paymentId, reference: `${suffix}-${ref}`, reason: "TEST ONLY verified refund", netPence: "20000", ...extra }))

    it("two simultaneous requests for the same balance reserve it once", async () => {
      await policy(); const p = await fundedPartner("w1")
      const results = await race([() => ask(p, "w1-a"), () => ask(p, "w1-b")])
      expectSingleWinner(results, /no positive available commission/)
      expect(await live(p.partnerId)).toBe(1)
    })
    it("overlapping explicit entry requests reserve each ledger entry at most once", async () => {
      await policy(); const p = await withSecondEntry(await fundedPartner("w3"), "w3")
      const ids = (await pool.query<{ id: string }>("select id from expansion_commission_ledger where partner_id=$1 order by id", [p.partnerId])).rows.map(r => r.id)
      expect(ids).toHaveLength(2)
      const results = await race([() => runAs(p.actor, () => requestWithdrawal({ ledgerIds: ids, invoiceReference: `${suffix}-w3-a` })), () => runAs(p.actor, () => requestWithdrawal({ ledgerIds: [ids[0]], invoiceReference: `${suffix}-w3-b` }))])
      expectSingleWinner(results, /no longer available/)
      expect(await live(p.partnerId)).toBeGreaterThanOrEqual(1)
    })
    it("a withdrawal request versus founder payout preparation: exactly one allocates the commission", async () => {
      await policy(); const p = await fundedPartner("w2")
      const results = await race<unknown>([() => ask(p, "w2-req"), () => prepare(p.partnerId, "w2-founder")])
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
      const claimed = (await pool.query("select (select count(*) from expansion_payout_claims pc join expansion_commission_ledger l on l.id=pc.ledger_id where l.partner_id=$1)::int payout,(select count(*) from expansion_withdrawal_entries w join expansion_withdrawal_requests r on r.id=w.request_id where r.partner_id=$1 and w.released_at is null)::int reserved", [p.partnerId])).rows[0]
      expect(claimed.payout + claimed.reserved).toBe(1)
    })
    it("duplicate simultaneous replay yields one reservation", async () => {
      await policy(); const p = await fundedPartner("w9")
      const results = await race([() => ask(p, "w9"), () => ask(p, "w9")])
      expect(results.every(r => r.status === "fulfilled")).toBe(true)
      const values = results.map(r => r.status === "fulfilled" ? r.value : null)
      expect(values.filter(v => v?.replayed === false)).toHaveLength(1)
      expect(await live(p.partnerId)).toBe(1)
    })
    it("request versus a partial refund: the dispute gate holds in either order", async () => {
      await policy(); const p = await fundedPartner("w4")
      const results = await race<Record<string, unknown>>([() => ask(p, "w4"), () => refund(p, "w4-refund")])
      expect(results[1].status).toBe("fulfilled")
      if (results[0].status === "fulfilled") {
        const id = String(results[0].value.requestId)
        await expect(runAs(founder, () => reviewWithdrawal({ requestId: id, decision: "approved", note: "TEST ONLY" }))).rejects.toMatchObject({ status: 409, message: expect.stringContaining("refund entitlement review") })
      } else expect(results[0].reason).toMatchObject({ status: 409, message: expect.stringContaining("refund entitlement review") })
      expect((await runAs(p.actor, () => getWithdrawalOverview())).policy.available).toBe(false)
    })
    it("request versus an unpaid-refund adjustment: commission is never both reserved and reduced", async () => {
      await policy(); const p = await fundedPartner("w5")
      const results = await race<Record<string, unknown>>([() => ask(p, "w5"), () => refund(p, "w5-adjust", { treatment: "adjust_unpaid", termsApprovalReference: refundClause })])
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
      const rejected = results.find(r => r.status === "rejected") as PromiseRejectedResult
      expect(rejected.reason).toMatchObject({ status: 409 })
      const ledgerTotal = (await pool.query("select coalesce(sum(amount_pence),0)::text t from expansion_commission_ledger where partner_id=$1", [p.partnerId])).rows[0].t
      expect(ledgerTotal).toBe(results[1].status === "fulfilled" ? "24000" : "30000")
      expect(await live(p.partnerId)).toBe(results[0].status === "fulfilled" ? 1 : 0)
    })
    it("approval versus refund review: payout preparation is blocked whichever wins", async () => {
      await policy(); const p = await fundedPartner("w6")
      const req = await ask(p, "w6")
      const results = await race<unknown>([() => runAs(founder, () => reviewWithdrawal({ requestId: req.requestId, decision: "approved", note: "TEST ONLY" })), () => refund(p, "w6-refund")])
      expect(results[1].status).toBe("fulfilled")
      await expect(runAs(founder, () => prepareWithdrawalPayout({ requestId: req.requestId }))).rejects.toMatchObject({ status: 409 })
      expect((await pool.query("select count(*)::int c from expansion_payouts where partner_id=$1", [p.partnerId])).rows[0].c).toBe(0)
    })
    it("cancellation versus payout preparation: exactly one outcome", async () => {
      await policy(); const p = await fundedPartner("w7")
      const req = await ask(p, "w7")
      await runAs(founder, () => reviewWithdrawal({ requestId: req.requestId, decision: "approved", note: "TEST ONLY" }))
      const results = await race<unknown>([() => runAs(p.actor, () => cancelWithdrawal({ requestId: req.requestId })), () => runAs(founder, () => prepareWithdrawalPayout({ requestId: req.requestId }))])
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
      const status = (await pool.query("select status from expansion_withdrawal_requests where id=$1", [req.requestId])).rows[0].status
      expect(status).toBe(results[0].status === "fulfilled" ? "cancelled" : "payout_prepared")
      expect(await live(p.partnerId)).toBe(results[0].status === "fulfilled" ? 0 : 1)
    })
    it("cancellation versus settlement: a prepared request can never be cancelled, and settlement is unaffected", async () => {
      await policy(); const p = await fundedPartner("w8")
      const req = await ask(p, "w8")
      await runAs(founder, () => reviewWithdrawal({ requestId: req.requestId, decision: "approved", note: "TEST ONLY" }))
      const payout = await runAs(founder, () => prepareWithdrawalPayout({ requestId: req.requestId }))
      await runAs(founder, () => approveExpansionPayout({ payoutId: payout.payoutId }))
      const results = await race<unknown>([() => runAs(p.actor, () => cancelWithdrawal({ requestId: req.requestId })), () => runAs(founder, () => settleExpansionPayout({ payoutId: payout.payoutId, settlementReference: `${suffix}-w8-settlement` }))])
      expect(results[0].status).toBe("rejected"); expect(results[1].status).toBe("fulfilled")
      expect((await runAs(p.actor, () => getWithdrawalOverview())).balances).toMatchObject({ paidPence: "30000", availablePence: "0" })
    })
    it("commission is reallocated after an authorised cancellation, and released history is preserved", async () => {
      await policy(); const p = await fundedPartner("w10")
      const first = await ask(p, "w10-a")
      await runAs(p.actor, () => cancelWithdrawal({ requestId: first.requestId }))
      const second = await ask(p, "w10-b")
      expect(second.requestId).not.toBe(first.requestId)
      const rows = await pool.query("select count(*)::int total,count(*) filter (where released_at is null)::int live from expansion_withdrawal_entries w join expansion_withdrawal_requests r on r.id=w.request_id where r.partner_id=$1", [p.partnerId])
      expect(rows.rows[0]).toEqual({ total: 2, live: 1 })
    })
    it("partners cannot use withdrawals to reach another partner's commission or mutate founder-only state", async () => {
      await policy(); const a = await fundedPartner("w11a"), b = await fundedPartner("w11b")
      const bEntry = (await pool.query<{ id: string }>("select id from expansion_commission_ledger where partner_id=$1", [b.partnerId])).rows[0].id
      await expect(runAs(a.actor, () => requestWithdrawal({ ledgerIds: [bEntry], invoiceReference: `${suffix}-w11-x` }))).rejects.toMatchObject({ status: 409 })
      const req = await ask(a, "w11")
      await expect(runAs(b.actor, () => cancelWithdrawal({ requestId: req.requestId }))).rejects.toMatchObject({ status: 404 })
      await expect(runAs(a.actor, () => reviewWithdrawal({ requestId: req.requestId, decision: "approved", note: "self" }))).rejects.toThrow()
      expect((await pool.query("select status from expansion_withdrawal_requests where id=$1", [req.requestId])).rows[0].status).toBe("submitted")
    })
  })

  describe("checkpoint 3E: market and exclusivity gates versus acceptance on separate connections", () => {
    const enable = () => runAs(founder, () => founderMutation({ action: "set_plan_enabled", planKey: "standard-v2", enabled: true, reason: "TEST ONLY 3E" }))
    async function approvedOpportunity(tag: string, extra: Record<string, unknown> = {}) {
      const id = await runAs(first, async () => {
        const rec = await partnerMutation({ action: "register", country: "GB", businessName: `TEST ONLY gate ${suffix} ${tag}`, website: `gate-${suffix}-${tag}.example`, industry: `Sector ${suffix} ${tag}`, region: "Nottingham", ...extra })
        await partnerMutation({ action: "discovery", id: rec.id, discovery: { objectives: "Test", pages: "Five", functionality: "Form", budget: "Subject", timescale: "Assessed", decisionProcess: "Owner" } })
        await partnerMutation({ action: "submit_scope", id: rec.id, summary: "TEST ONLY scope." })
        return String(rec.id)
      })
      const week = (await pool.query<{ next: string }>("select (max(period)+7)::text as next from expansion_capacity")).rows[0].next
      await runAs(founder, () => founderMutation({ action: "capacity", period: week, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY 3E allocation" }))
      await approve(id, week)
      return id
    }
    const accept = (id: string) => runAs(founder, () => founderMutation({ action: "accept_contract", id, clientId, plan: { plan: "standard-v2" }, agreementReference: `TEST ONLY 3E ${suffix}` }))
    const contracts = async (id: string) => (await pool.query("select count(*)::int c from expansion_contracts where opportunity_id=$1", [id])).rows[0].c

    it("Case L: a restriction created concurrently with acceptance is either seen by acceptance or committed after it, never lost", async () => {
      await enable(); const id = await approvedOpportunity("race-ex")
      const protectedClient = (await pool.query<{ id: number }>("insert into clients(name,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) values($1,$2,'1 Test Street','Nottingham','NG1 1AA','United Kingdom') returning id", [`TEST ONLY protected ${suffix}`, `P${suffix.toUpperCase()}`])).rows[0].id
      const create = () => runAs(founder, () => founderMutation({ action: "create_exclusivity", clientId: protectedClient, sector: `Sector ${suffix} race-ex`, area: "Nottingham", contractualReference: "TEST ONLY clause", effectiveFrom: "2020-01-01" }))
      const results = await race<unknown>([() => accept(id), create])
      expect(results[1].status).toBe("fulfilled")
      if (results[0].status === "fulfilled") expect(await contracts(id)).toBe(1)
      else { expect(results[0].reason).toMatchObject({ status: 409, message: expect.stringContaining("exclusivity") }); expect(await contracts(id)).toBe(0) }
      // Afterwards, with the restriction committed, acceptance of a second matching opportunity is blocked for certain.
      const second = await approvedOpportunity("race-ex2", { industry: `Sector ${suffix} race-ex` })
      await expect(accept(second)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("exclusivity") })
      expect(await contracts(second)).toBe(0)
      await pool.query("update expansion_exclusivities set status='ended',ended_at=now() where sector like $1", [`Sector ${suffix}%`])
    })
    it("Case M: suspending a market concurrently with acceptance leaves a consistent outcome and then blocks acceptance", async () => {
      await enable(); const id = await approvedOpportunity("race-mk")
      const suspend = () => runAs(founder, () => founderMutation({ action: "set_market", countryCode: "GB", countryName: "United Kingdom", status: "suspended", planKeys: ["standard-v2", "growth-only-v1", "bespoke-v1"], legalReviewed: true, accountingReviewed: true, privacyReviewed: true, operationsReviewed: true, approvalReference: "TEST ONLY suspension" }))
      try {
        const results = await race<unknown>([() => accept(id), suspend])
        expect(results[1].status).toBe("fulfilled")
        if (results[0].status === "fulfilled") expect(await contracts(id)).toBe(1)
        else { expect(results[0].reason).toMatchObject({ status: 409, message: expect.stringContaining("not approved") }); expect(await contracts(id)).toBe(0) }
        const next = await approvedOpportunity("race-mk2")
        await expect(accept(next)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("not approved") })
      } finally {
        await pool.query("update expansion_markets set status='approved',approved_by=$1,approval_reference='TEST ONLY restored' where country_code='GB'", [founder.id])
      }
    })
  })

  describe("checkpoint 3 review fixes on real PostgreSQL", () => {
    const policy = () => runAs(founder, () => setWithdrawalPolicy({ enabled: true, invoiceRequired: true, approvalReference: "TEST ONLY payout policy" }))
    it("negative refund adjustments always travel with a withdrawal request", async () => {
      await policy(); const p = await fundedPartner("rv-neg")
      await runAs(founder, () => refundExpansionPayment({ paymentId: p.paymentId, reference: `${suffix}-rv-neg-refund`, reason: "TEST ONLY verified refund", netPence: "20000", treatment: "adjust_unpaid", termsApprovalReference: refundClause }))
      const entries = (await pool.query<{ id: string; amount_pence: string }>("select id,amount_pence::text from expansion_commission_ledger where partner_id=$1 order by amount_pence desc", [p.partnerId])).rows
      expect(entries.map(e => e.amount_pence)).toEqual(["30000", "-6000"])
      const req = await runAs(p.actor, () => requestWithdrawal({ ledgerIds: [entries[0].id], invoiceReference: `${suffix}-rv-neg` }))
      expect(req.amountPence).toBe("24000")
      expect((await pool.query("select count(*)::int c from expansion_withdrawal_entries where request_id=$1 and released_at is null", [req.requestId])).rows[0].c).toBe(2)
    })
    it("the database itself refuses a reservation on another partner's commission", async () => {
      await policy(); const a = await fundedPartner("rv-own-a"), b = await fundedPartner("rv-own-b")
      const req = await runAs(a.actor, () => requestWithdrawal({ all: true, invoiceReference: `${suffix}-rv-own` }))
      const bEntry = (await pool.query<{ id: string }>("select id from expansion_commission_ledger where partner_id=$1", [b.partnerId])).rows[0].id
      await expect(pool.query("insert into expansion_withdrawal_entries(id,request_id,ledger_id) values($1,$2,$3)", [randomUUID(), req.requestId, bEntry])).rejects.toThrow("own commission")
    })
    it("a founder can revoke an approved request so reservations never stay stuck", async () => {
      await policy(); const p = await fundedPartner("rv-revoke")
      const req = await runAs(p.actor, () => requestWithdrawal({ all: true, invoiceReference: `${suffix}-rv-revoke` }))
      await runAs(founder, () => reviewWithdrawal({ requestId: req.requestId, decision: "approved", note: "TEST ONLY" }))
      await runAs(founder, () => reviewWithdrawal({ requestId: req.requestId, decision: "rejected", note: "TEST ONLY revoked" }))
      expect((await pool.query("select count(*)::int c from expansion_withdrawal_entries where request_id=$1 and released_at is null", [req.requestId])).rows[0].c).toBe(0)
    })
    it("an unconfirmed partner-supplied market never passes the gate", async () => {
      const id = await runAs(first, async () => {
        const rec = await partnerMutation({ action: "register", country: "GB", businessName: `TEST ONLY unconfirmed ${suffix}`, website: `unconfirmed-${suffix}.example`, industry: "Unconfirmed", region: "Nowhere" })
        await partnerMutation({ action: "discovery", id: rec.id, discovery: { objectives: "T", pages: "F", functionality: "F", budget: "S", timescale: "A", decisionProcess: "O" } })
        await partnerMutation({ action: "submit_scope", id: rec.id, summary: "TEST ONLY scope." })
        return String(rec.id)
      })
      const week = (await pool.query<{ next: string }>("select (max(period)+7)::text as next from expansion_capacity")).rows[0].next
      await runAs(founder, () => founderMutation({ action: "capacity", period: week, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY" }))
      await runAs(founder, () => founderMutation({ action: "review_scope", id, decision: "approved", period: week, hours: 10, technicalConfirmed: true, commercialConfirmed: true, notes: "TEST ONLY reviewed" }))
      await runAs(founder, () => founderMutation({ action: "set_plan_enabled", planKey: "standard-v2", enabled: true, reason: "TEST ONLY" }))
      await expect(runAs(founder, () => founderMutation({ action: "accept_contract", id, clientId, plan: { plan: "standard-v2" }, agreementReference: "TEST ONLY" }))).rejects.toMatchObject({ status: 409, message: expect.stringContaining("not approved") })
    })
  })

  describe("checkpoint 4A: lock hierarchy on real PostgreSQL", () => {
    /** One partner, two contracts, and one issued invoice allocated across both: the only shape where invoice and partner locks can cross. */
    async function sharedInvoice(tag: string) {
      const p = await fundedPartner(tag)
      const opp2 = await submitted(`${tag}-c2`, p.actor)
      const week = (await pool.query<{ next: string }>("select (max(period)+7)::text as next from expansion_capacity")).rows[0].next
      await runAs(founder, () => founderMutation({ action: "capacity", period: week, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY 4A allocation" }))
      await approve(opp2, week)
      const second = await runAs(founder, () => founderMutation({ action: "accept_contract", id: opp2, clientId, terms: { ...standardCommissionTerms(), planVersion: "concurrency-approved-refund-v1", unpaidRefundApprovalReference: refundClause }, agreementReference: `TEST ONLY 4A ${suffix}-${tag}` })) as { id: string }
      const invoice = await createInvoice({ clientId, items: [{ title: "TEST ONLY shared", quantity: 1, unitAmount: 200000 }] }, founder.id)
      await transitionInvoice(invoice.id, "issue", founder.id)
      const alloc = (contractId: string, milestone: "deposit" | "final") => runAs(founder, () => allocateExpansionInvoice({ contractId, invoiceId: invoice.id, milestone, netPence: "100000", evidenceReference: "TEST ONLY shared allocation" }))
      await alloc(p.contractId, "final"); await alloc(second.id, "deposit")
      const first = await runAs(founder, () => verifyExpansionPayment({ contractId: p.contractId, invoiceId: invoice.id, milestone: "final", reference: `${suffix}-${tag}-x`, netPence: "100000", grossPence: "100000", evidenceReference: "TEST ONLY receipt", confirmed: true }))
      return { p, secondContractId: second.id, invoiceId: invoice.id, paymentX: first.paymentId }
    }
    it("a refund and a collection on one shared invoice never deadlock (repeated)", async () => {
      const deadlocks: string[] = []
      for (let i = 0; i < 6; i++) {
        const s = await sharedInvoice(`lh${i}`)
        const results = await race<unknown>([
          () => runAs(founder, () => refundExpansionPayment({ paymentId: s.paymentX, reference: `${suffix}-lh${i}-refund`, reason: "TEST ONLY refund", netPence: "20000" })),
          () => runAs(founder, () => verifyExpansionPayment({ contractId: s.secondContractId, invoiceId: s.invoiceId, milestone: "deposit", reference: `${suffix}-lh${i}-collect`, netPence: "100000", grossPence: "100000", evidenceReference: "TEST ONLY receipt", confirmed: true })),
        ])
        for (const r of results) if (r.status === "rejected" && (String((r.reason as { cause?: { code?: string } })?.cause?.code) === "40P01" || /deadlock/i.test(String((r.reason as Error)?.message)))) deadlocks.push(`iteration ${i}`)
        const failures = results.flatMap(r => r.status === "rejected" ? [String((r.reason as Error)?.message)] : [])
        expect({ iteration: i, failures }).toEqual({ iteration: i, failures: [] })
      }
      expect(deadlocks).toEqual([])
    })
    it("pairwise stress across refund, withdrawal, payout and cancellation: no deadlock, no double allocation", async () => {
      await runAs(founder, () => setWithdrawalPolicy({ enabled: true, invoiceRequired: true, approvalReference: "TEST ONLY policy" }))
      type Funded = Awaited<ReturnType<typeof fundedPartner>>
      const ops: Record<string, (p: Funded, tag: string) => Promise<unknown>> = {
        ask: (p, t) => runAs(p.actor, () => requestWithdrawal({ all: true, invoiceReference: `${suffix}-${t}-ask` })),
        payout: (p, t) => runAs(founder, () => prepareExpansionPayout({ partnerId: p.partnerId, invoiceReference: `${suffix}-${t}-pay`, invoiceNetPence: "30000" })),
        refund: (p, t) => runAs(founder, () => refundExpansionPayment({ paymentId: p.paymentId, reference: `${suffix}-${t}-rf`, reason: "TEST ONLY", netPence: "20000" })),
        adjust: (p, t) => runAs(founder, () => refundExpansionPayment({ paymentId: p.paymentId, reference: `${suffix}-${t}-adj`, reason: "TEST ONLY", netPence: "10000", treatment: "adjust_unpaid", termsApprovalReference: refundClause })),
        cancelContract: (p, t) => runAs(founder, () => founderMutation({ action: "cancel_contract", id: p.opportunityId, reason: `TEST ONLY ${t}`, deliveryReviewed: true })),
        collect: (p, t) => runAs(founder, () => verifyExpansionPayment({ contractId: p.contractId, invoiceId: p.invoiceId, milestone: "deposit", reference: `${suffix}-${t}-dup`, netPence: "100000", grossPence: "120000", evidenceReference: "TEST ONLY", confirmed: true })),
      }
      const pairs: Array<[string, string]> = [["ask", "payout"], ["ask", "refund"], ["ask", "adjust"], ["payout", "adjust"], ["payout", "refund"], ["ask", "cancelContract"], ["payout", "cancelContract"], ["adjust", "cancelContract"], ["adjust", "adjust"], ["collect", "adjust"]]
      const deadlocks: string[] = []
      for (const [a, b] of pairs) for (let i = 0; i < 2; i++) {
        const tag = `st-${a}-${b}-${i}`, p = await fundedPartner(tag)
        const results = await race<unknown>([() => ops[a](p, `${tag}a`), () => ops[b](p, `${tag}b`)])
        for (const r of results) if (r.status === "rejected") {
          const reason = r.reason as { cause?: { code?: string }; status?: number; message?: string }
          if (reason?.cause?.code === "40P01" || /deadlock/i.test(String(reason?.message))) deadlocks.push(`${a}/${b}`)
          else expect([400, 409]).toContain(reason?.status)   // only deliberate business refusals
        }
      }
      expect(deadlocks).toEqual([])
      const doubled = await pool.query("select count(*)::int c from expansion_commission_ledger l where exists(select 1 from expansion_payout_claims pc where pc.ledger_id=l.id) and exists(select 1 from expansion_withdrawal_entries w join expansion_withdrawal_requests r on r.id=w.request_id where w.ledger_id=l.id and w.released_at is null and r.payout_id is null)")
      expect(doubled.rows[0].c).toBe(0)
    })
  })

  describe("checkpoint 4B: achievements and referrals on separate connections", () => {
    type Funded = Awaited<ReturnType<typeof fundedPartner>>
    /** An accepted contract with a verified collection for a NEW canonical client (or a supplied one). */
    async function contractFor(p: Funded, tag: string, existingClient?: number) {
      const cid = existingClient ?? (await pool.query<{ id: number }>("insert into clients(name,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) values($1,$2,'1 Test Street','Nottingham','NG1 1AA','United Kingdom') returning id", [`TEST ONLY 4B ${suffix} ${tag}`, `Q${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`])).rows[0].id
      const opp = await submitted(`4b-${tag}`, p.actor)
      const week = (await pool.query<{ next: string }>("select (max(period)+7)::text as next from expansion_capacity")).rows[0].next
      await runAs(founder, () => founderMutation({ action: "capacity", period: week, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY 4B" }))
      await approve(opp, week)
      const accepted = await runAs(founder, () => founderMutation({ action: "accept_contract", id: opp, clientId: cid, terms: { ...standardCommissionTerms(), planVersion: "concurrency-approved-refund-v1", unpaidRefundApprovalReference: refundClause }, agreementReference: `TEST ONLY 4B ${suffix}-${tag}` })) as { id: string }
      const invoice = await createInvoice({ clientId: cid, items: [{ title: "TEST ONLY 4B deposit", quantity: 1, unitAmount: 100000 }] }, founder.id)
      await transitionInvoice(invoice.id, "issue", founder.id)
      await runAs(founder, () => allocateExpansionInvoice({ contractId: accepted.id, invoiceId: invoice.id, milestone: "deposit", netPence: "100000", evidenceReference: "TEST ONLY 4B allocation" }))
      await runAs(founder, () => verifyExpansionPayment({ contractId: accepted.id, invoiceId: invoice.id, milestone: "deposit", reference: `${suffix}-4b-${tag}`, netPence: "100000", grossPence: "100000", evidenceReference: "TEST ONLY receipt", confirmed: true }))
      return { contractId: accepted.id, clientId: cid }
    }
    const qualify = (contractId: string) => runAs(founder, () => decideQualification({ contractId, decision: "qualified", note: "TEST ONLY evidence" }))
    const ledgerTotal = async (partnerId: string) => (await pool.query<{ t: string }>("select coalesce(sum(amount_pence),0)::text t from expansion_commission_ledger where partner_id=$1", [partnerId])).rows[0].t

    it("the same canonical client can be counted once, even when two founders decide simultaneously", async () => {
      const p = await fundedPartner("q-dup")
      const a = await contractFor(p, "q-dup-a"); const b = await contractFor(p, "q-dup-b", a.clientId)
      const results = await race<unknown>([() => qualify(a.contractId), () => qualify(b.contractId)])
      expectSingleWinner(results, /already counted/)
      expect((await pool.query("select count(*)::int c from expansion_client_qualifications where client_id=$1 and status='qualified'", [a.clientId])).rows[0].c).toBe(1)
    })
    it("concurrent qualifications create each conditional reward once, and commission is untouched (£300 stays £300)", async () => {
      const p = await fundedPartner("q-rw")
      const before = await ledgerTotal(p.partnerId)
      const contracts = [await contractFor(p, "q-rw-1"), await contractFor(p, "q-rw-2"), await contractFor(p, "q-rw-3")]
      const beforeQualify = await ledgerTotal(p.partnerId)
      const results = await race<unknown>(contracts.map(c => () => qualify(c.contractId)))
      expect(results.every(r => r.status === "fulfilled")).toBe(true)
      expect((await pool.query("select milestone_clients,status from expansion_achievement_rewards where partner_id=$1 order by milestone_clients", [p.partnerId])).rows).toEqual([{ milestone_clients: 1, status: "conditional" }])
      expect(await ledgerTotal(p.partnerId)).toBe(beforeQualify)    // qualification and rewards never write the commission ledger
      expect(before).toBe("30000")
      const ov = await runAs(p.actor, () => getProgrammeOverview())
      expect(ov.qualifiedClients).toBe(3); expect(ov.approvedBonusPence).toBe(0)
      expect((await pool.query("select count(*)::int c from expansion_payouts where partner_id=$1", [p.partnerId])).rows[0].c).toBe(0)
    })
    it("the database refuses a qualification for another partner's contract", async () => {
      const a = await fundedPartner("q-own-a"), b = await fundedPartner("q-own-b")
      await expect(pool.query("insert into expansion_client_qualifications(id,partner_id,client_id,contract_id,status,net_collected_pence,note,decided_by) values($1,$2,$3,$4,'qualified',100000,'x',$5)", [randomUUID(), a.partnerId, clientId, b.contractId, founder.id])).rejects.toThrow("must belong to this partner")
    })
    it("a revocation racing a reward decision leaves a consistent, gated outcome", async () => {
      const p = await fundedPartner("q-revoke")
      const c = await contractFor(p, "q-revoke-1"); const q = await qualify(c.contractId)
      const reward = (await pool.query<{ id: string }>("select id from expansion_achievement_rewards where partner_id=$1", [p.partnerId])).rows[0].id
      const results = await race<unknown>([() => runAs(founder, () => revokeQualification({ qualificationId: q.qualificationId, reason: "TEST ONLY" })), () => runAs(founder, () => reviewAchievementReward({ rewardId: reward, decision: "under_review" }))])
      expect(results.some(r => r.status === "fulfilled")).toBe(true)
      const status = (await pool.query("select status from expansion_achievement_rewards where id=$1", [reward])).rows[0].status
      expect(["rejected", "under_review"]).toContain(status)
      expect((await pool.query("select status from expansion_client_qualifications where id=$1", [q.qualificationId])).rows[0].status).toBe("revoked")
      // whichever order ran, an unapproved programme can never have approved it
      await expect(runAs(founder, () => reviewAchievementReward({ rewardId: reward, decision: "approved" }))).rejects.toMatchObject({ status: 409 })
    })
    it("two simultaneous attributions of one applicant admit exactly one referrer, and approvals race to one winner", async () => {
      const a = await fundedPartner("rf-a"), b = await fundedPartner("rf-b")
      const codeA = await runAs(a.actor, () => createReferralCode()), codeB = await runAs(b.actor, () => createReferralCode())
      expect(codeA.code).not.toBe(codeB.code)
      const app = { rows: [{ id: await application(`TEST ONLY referred ${suffix}`, `referred-${suffix}@example.invalid`, "under_review") }] }
      const results = await race<unknown>([() => runAs(founder, () => attributeReferral({ applicationId: app.rows[0].id, code: codeA.code })), () => runAs(founder, () => attributeReferral({ applicationId: app.rows[0].id, code: codeB.code }))])
      expectSingleWinner(results, /cannot be reassigned/)
      expect((await pool.query("select count(*)::int c from expansion_referrals where application_id=$1", [app.rows[0].id])).rows[0].c).toBe(1)
      const prog = await runAs(founder, () => createProgramme({ label: `TEST ONLY ${suffix}` }))
      expect(prog.version).toBeGreaterThan(0)   // left unapproved: draft versions never gate or enable anything
    })
  })

  describe("checkpoint 5A: review flags, reward withdrawal, meeting history and safe errors on real PostgreSQL", () => {
    /** An accepted, collected contract for a NEW canonical client (qualification counts each client once). */
    async function ownContract(p: Awaited<ReturnType<typeof fundedPartner>>, tag: string) {
      const cid = (await pool.query<{ id: number }>("insert into clients(name,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) values($1,$2,'1 Test Street','Nottingham','NG1 1AA','United Kingdom') returning id", [`TEST ONLY 5A ${suffix} ${tag}`, `F${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`])).rows[0].id
      const opp = await submitted(`5a-${tag}`, p.actor)
      const week = (await pool.query<{ next: string }>("select (max(period)+7)::text as next from expansion_capacity")).rows[0].next
      await runAs(founder, () => founderMutation({ action: "capacity", period: week, hours: 10, commitmentsReviewed: true, rationale: "TEST ONLY 5A" }))
      await approve(opp, week)
      const accepted = await runAs(founder, () => founderMutation({ action: "accept_contract", id: opp, clientId: cid, terms: { ...standardCommissionTerms(), planVersion: "concurrency-approved-refund-v1", unpaidRefundApprovalReference: refundClause }, agreementReference: `TEST ONLY 5A ${suffix}-${tag}` })) as { id: string }
      const invoice = await createInvoice({ clientId: cid, items: [{ title: "TEST ONLY 5A deposit", quantity: 1, unitAmount: 100000 }] }, founder.id)
      await transitionInvoice(invoice.id, "issue", founder.id)
      await runAs(founder, () => allocateExpansionInvoice({ contractId: accepted.id, invoiceId: invoice.id, milestone: "deposit", netPence: "100000", evidenceReference: "TEST ONLY 5A allocation" }))
      const col = await runAs(founder, () => verifyExpansionPayment({ contractId: accepted.id, invoiceId: invoice.id, milestone: "deposit", reference: `${suffix}-5a-${tag}`, netPence: "100000", grossPence: "120000", evidenceReference: "TEST ONLY receipt", confirmed: true }))
      return { contractId: accepted.id, paymentId: col.paymentId }
    }
    const qualifyOwn = (contractId: string) => runAs(founder, () => decideQualification({ contractId, decision: "qualified", note: "TEST ONLY evidence" }))
    const refundOf = (paymentId: string, ref: string, net: string, gross: string) => runAs(founder, () => refundExpansionPayment({ paymentId, reference: `${suffix}-5a-${ref}`, netPence: net, grossPence: gross, reason: "TEST ONLY verified refund" }))
    const flagsOf = (contractId: string) => pool.query<{ id: string; status: string; reason: string; resolution: string | null }>("select f.id,f.status,f.reason,f.resolution from expansion_qualification_flags f join expansion_client_qualifications q on q.id=f.qualification_id where q.contract_id=$1 order by f.created_at", [contractId])
    it("a real partial refund raises exactly one review flag; maintaining it keeps the qualification, and a later full refund raises a new one that revocation resolves", async () => {
      const p = await fundedPartner("5a-refund")
      const c = await ownContract(p, "5a-refund")
      await qualifyOwn(c.contractId)
      await refundOf(c.paymentId, "partial", "20000", "24000")
      expect((await flagsOf(c.contractId)).rows.map(r => [r.reason, r.status])).toEqual([["refund", "open"]])
      const first = (await flagsOf(c.contractId)).rows[0].id
      await expect(runAs(founder, () => resolveQualificationFlag({ flagId: first, resolution: "maintained", note: "" }))).rejects.toMatchObject({ status: 400 })
      await runAs(founder, () => resolveQualificationFlag({ flagId: first, resolution: "maintained", note: "TEST ONLY partial refund does not alter the qualifying collection" }))
      expect((await pool.query("select status from expansion_client_qualifications where contract_id=$1", [c.contractId])).rows[0].status).toBe("qualified")
      await expect(runAs(founder, () => resolveQualificationFlag({ flagId: first, resolution: "maintained", note: "TEST ONLY again" }))).rejects.toMatchObject({ status: 409 })
      await refundOf(c.paymentId, "remainder", "80000", "96000")
      const flags = (await flagsOf(c.contractId)).rows
      expect(flags.map(r => r.status)).toEqual(["resolved", "open"])
      await runAs(founder, () => resolveQualificationFlag({ flagId: flags[1].id, resolution: "revoked", note: "TEST ONLY full refund: client no longer a paying customer" }))
      expect((await pool.query("select status from expansion_client_qualifications where contract_id=$1", [c.contractId])).rows[0].status).toBe("revoked")
      expect((await flagsOf(c.contractId)).rows.map(r => r.status)).toEqual(["resolved", "resolved"])
    })
    it("two founders resolving the same flag on separate connections: one winner", async () => {
      const p = await fundedPartner("5a-flag-race")
      const c = await ownContract(p, "5a-flag-race")
      await qualifyOwn(c.contractId); await refundOf(c.paymentId, "race", "20000", "24000")
      const id = (await flagsOf(c.contractId)).rows[0].id
      const results = await race<unknown>([() => runAs(founder, () => resolveQualificationFlag({ flagId: id, resolution: "maintained", note: "TEST ONLY a" })), () => runAs(founder, () => resolveQualificationFlag({ flagId: id, resolution: "revoked", note: "TEST ONLY b" }))])
      expectSingleWinner(results, /already been resolved/)
    })
    it("a partner cannot resolve flags", async () => {
      const p = await fundedPartner("5a-flag-auth")
      const c = await ownContract(p, "5a-flag-auth")
      await expect(runAs(p.actor, () => resolveQualificationFlag({ flagId: randomUUID(), resolution: "maintained", note: "x" }))).rejects.toThrow("Forbidden")
    })
    it("an approved reward whose qualification is revoked cannot progress and is withdrawn only with a new recorded reason", async () => {
      const p = await fundedPartner("5a-withdraw")
      const c = await ownContract(p, "5a-withdraw")
      const q = await qualifyOwn(c.contractId)
      const prog = await runAs(founder, () => createProgramme({ label: `TEST ONLY 5A ${suffix}` }))
      await runAs(founder, () => approveProgramme({ version: prog.version, approvalReference: `TEST ONLY ${suffix}` }))
      const reward = (await pool.query<{ id: string }>("select id from expansion_achievement_rewards where partner_id=$1", [p.partnerId])).rows[0].id
      await runAs(founder, () => reviewAchievementReward({ rewardId: reward, decision: "under_review" }))
      await runAs(founder, () => reviewAchievementReward({ rewardId: reward, decision: "approved", note: "TEST ONLY approved on evidence" }))
      await runAs(founder, () => revokeQualification({ qualificationId: q.qualificationId, reason: "TEST ONLY entered in error" }))
      await expect(runAs(founder, () => reviewAchievementReward({ rewardId: reward, decision: "fulfilled" }))).rejects.toMatchObject({ status: 409, message: expect.stringContaining("disputed, revoked or awaiting review") })
      await expect(runAs(founder, () => reviewAchievementReward({ rewardId: reward, decision: "withdrawn" }))).rejects.toMatchObject({ status: 400 })
      // the database itself refuses a withdrawal that re-uses the approval note
      await expect(pool.query("update expansion_achievement_rewards set status='withdrawn' where id=$1", [reward])).rejects.toThrow(/recorded reason/)
      await runAs(founder, () => reviewAchievementReward({ rewardId: reward, decision: "withdrawn", note: "TEST ONLY qualification revoked; no entitlement" }))
      expect((await pool.query("select status,review_note from expansion_achievement_rewards where id=$1", [reward])).rows[0]).toEqual({ status: "withdrawn", review_note: "TEST ONLY qualification revoked; no entitlement" })
    })
    it("a closed meeting's content changes only through an audited founder correction", async () => {
      const p = await fundedPartner("5a-meeting")
      const m = await runAs(p.actor, () => requestMeeting({ meetingType: "joint_sales", preferredSlots: ["2100-02-01T10:00:00Z"], timeZone: "Europe/London", purpose: "TEST ONLY original purpose" }))
      await runAs(founder, () => decideMeeting({ meetingId: m.meetingId, decision: "decline", note: "TEST ONLY not available" }))
      await expect(pool.query("update expansion_meeting_requests set purpose='tampered' where id=$1", [m.meetingId])).rejects.toThrow()
      await expect(runAs(p.actor, () => correctMeeting({ meetingId: m.meetingId, purpose: "x", reason: "x" }))).rejects.toThrow("Forbidden")
      await expect(runAs(founder, () => correctMeeting({ meetingId: m.meetingId, purpose: "TEST ONLY corrected", reason: "" }))).rejects.toMatchObject({ status: 400 })
      await runAs(founder, () => correctMeeting({ meetingId: m.meetingId, purpose: "TEST ONLY corrected purpose", reason: "TEST ONLY clarified wording" }))
      expect((await pool.query("select purpose,status from expansion_meeting_requests where id=$1", [m.meetingId])).rows[0]).toEqual({ purpose: "TEST ONLY corrected purpose", status: "declined" })
      const c = (await pool.query("select before_value->>'purpose' b,after_value->>'purpose' a,reason from expansion_meeting_corrections where meeting_id=$1", [m.meetingId])).rows
      expect(c).toEqual([{ b: "TEST ONLY original purpose", a: "TEST ONLY corrected purpose", reason: "TEST ONLY clarified wording" }])
    })
    it("database refusals reach callers only as safe, generic messages; an invalid sector id is a clear 400", async () => {
      await expect(runAs(founder, () => founderMutation({ action: "add_sector_alias", sectorId: "no-such-sector", alias: "synthetic alias" }))).rejects.toMatchObject({ status: expect.any(Number) })
      const bad = await runAs(founder, () => founderMutation({ action: "add_sector_alias", sectorId: "no-such-sector", alias: "synthetic alias" })).catch(e => e)
      expect(bad.status).toBeGreaterThanOrEqual(400); expect(bad.status).toBeLessThan(500)
      expect(String(bad.message)).not.toMatch(/violates|constraint|relation "|sql|select |insert /i)
      const dup = await pool.query("insert into expansion_qualification_flags(id,qualification_id,reason) values($1,$1,'refund')", [randomUUID()]).catch(e => e)
      const t = translateDbError(dup)
      expect(t).toMatchObject({ status: 409 }); expect(t!.message).not.toMatch(/expansion_|constraint|violates|key/i)
    })
  })

  describe("checkpoint 5B: researched prospect allocation on separate connections", () => {
    const today = new Date().toISOString().slice(0, 10)
    const founder2: Actor = { id: randomUUID(), role: "owner", active: true, sessionVersion: 1, displayName: `Concurrency founder two ${suffix}` }
    const setMarket = (code: string, status: "approved" | "suspended") => runAs(founder, () => founderMutation({ action: "set_market", countryCode: code, countryName: `Testland ${code}`, status, planKeys: ["standard-v2"], legalReviewed: true, accountingReviewed: true, privacyReviewed: true, operationsReviewed: true, approvalReference: `TEST ONLY ${suffix} ${status}` }))
    async function activePartner(tag: string) {
      const actor: Actor = { id: randomUUID(), role: "independent_partner", active: true, sessionVersion: 1, displayName: `TEST ONLY 5B ${tag} ${suffix}` }
      const email = `alloc-${actor.id}@example.invalid`
      const applicantId = await application(actor.displayName, email)
      const partnerId = randomUUID()
      await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login',$4,true,1)", [actor.id, email, actor.displayName, actor.role])
      await pool.query("insert into expansion_partners(id,user_id,application_id,agreement_version,confirmed_at,activated_at) values($1,$2,$3,'test-reviewed-v1',now(),now())", [partnerId, actor.id, applicantId])
      return { actor, partnerId }
    }
    let n = 0
    const fresh = (tag: string, extra: Record<string, unknown> = {}) => ({ businessName: `TEST ONLY research ${suffix} ${tag}`, website: `research-${suffix}-${tag}.example`, industry: `Sector ${suffix} ${tag}`, country: "QA", region: "Testshire", area: `Area ${suffix} ${tag}`, publicSource: "TEST ONLY public directory listing", researchedOn: today, partnerNotes: `Public notes ${tag}`, internalNotes: `INTERNAL ${tag}`, ...extra })
    const mk = async (tag: string, extra: Record<string, unknown> = {}) => (await runAs(founder, () => createCandidate(fresh(`${tag}${++n}`, extra)))).id
    const screen = (id: string) => runAs(founder, () => recordScreening({ candidateId: id, outcome: "evidenced", evidence: "TEST ONLY screening evidence reviewed by a founder" }))
    const eligible = async (tag: string, extra: Record<string, unknown> = {}) => { const id = await mk(tag, extra); await screen(id); await runAs(founder, () => markCandidateEligible({ candidateId: id })); return id }
    const allocate = (id: string, partnerId: string, as: Actor = founder) => runAs(as, () => allocateCandidate({ candidateId: id, partnerId }))
    const state = async (id: string) => (await pool.query("select status,allocated_partner_id from expansion_research_candidates where id=$1", [id])).rows[0]
    const events = async (id: string) => (await pool.query<{ event: string }>("select event from expansion_candidate_events where candidate_id=$1 order by created_at,id", [id])).rows.map(r => r.event)
    const opportunityOf = async (id: string) => (await pool.query("select id,partner_id,status from expansion_opportunities where research_candidate_id=$1", [id])).rows
    /** After a race the candidate is either still eligible (the other change committed after) or was demoted by the refused allocation: both must block. */
    const assertBlocked = async (id: string, partnerId: string, pattern: RegExp) => {
      const st = (await state(id)).status
      if (st === "eligible") await expect(allocate(id, partnerId)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(pattern) })
      else { expect(st).toBe("draft"); await expect(runAs(founder, () => markCandidateEligible({ candidateId: id }))).rejects.toMatchObject({ status: 409, message: expect.stringMatching(pattern) }) }
    }
    beforeAll(async () => {
      await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login','owner',true,1)", [founder2.id, `concurrency-${founder2.id}@example.invalid`, founder2.displayName])
      await setMarket("QA", "approved")
    }, 30000)

    it("runs the whole workflow: screening is mandatory, allocation reuses the canonical CRM, and only the allocated partner sees the research", async () => {
      const a = await activePartner("flow-a"), b = await activePartner("flow-b")
      const id = await mk("flow")
      await expect(runAs(founder, () => markCandidateEligible({ candidateId: id }))).rejects.toMatchObject({ status: 409, message: expect.stringContaining("screening") })
      await expect(allocate(id, a.partnerId)).rejects.toMatchObject({ status: 409 })        // not eligible yet
      await screen(id)
      await runAs(founder, () => markCandidateEligible({ candidateId: id }))
      const result = await allocate(id, a.partnerId) as { opportunityId: string }
      const prospect = (await pool.query("select p.owner_user_id,p.source::text src,o.customer_country,o.customer_country_confirmed_by from expansion_opportunities o join prospects p on p.id=o.prospect_id where o.id=$1", [result.opportunityId])).rows[0]
      expect(prospect).toMatchObject({ owner_user_id: a.actor.id, src: "other", customer_country: "QA", customer_country_confirmed_by: founder.id })
      const mine = await runAs(a.actor, () => partnerSnapshot())
      const row = (mine.opportunities as Array<Record<string, unknown>>).find(o => o.id === result.opportunityId)!
      expect(row).toMatchObject({ allocated: true, research_notes: expect.stringContaining("Public notes"), research_source: "TEST ONLY public directory listing" })
      expect(JSON.stringify(mine)).not.toContain("INTERNAL")
      expect(((await runAs(b.actor, () => partnerSnapshot())).opportunities as unknown[]).some(o => (o as { id: string }).id === result.opportunityId)).toBe(false)
      // the partner continues in the existing workflow
      await runAs(a.actor, () => partnerMutation({ action: "stage", id: result.opportunityId, status: "contacted" }))
      expect(await events(id)).toEqual(["created", "screening_recorded", "marked_eligible", "allocated"])
    })
    it("two founders allocating the same candidate to different partners: exactly one winner, one opportunity", async () => {
      const a = await activePartner("two-a"), b = await activePartner("two-b"); const id = await eligible("two")
      const results = await race<unknown>([() => allocate(id, a.partnerId, founder), () => allocate(id, b.partnerId, founder2)])
      expectSingleWinner(results, /already been allocated/)
      expect(await opportunityOf(id)).toHaveLength(1)
      expect((await state(id)).status).toBe("allocated")
    })
    it("duplicate allocation requests for the same partner: one winner", async () => {
      const a = await activePartner("dup"); const id = await eligible("dup")
      const results = await race<unknown>([() => allocate(id, a.partnerId), () => allocate(id, a.partnerId)])
      expectSingleWinner(results, /already been allocated/)
      expect(await opportunityOf(id)).toHaveLength(1)
    })
    it("allocation racing an independent partner registration of the same business: the domain is held exactly once", async () => {
      const a = await activePartner("reg-a"), b = await activePartner("reg-b"); const id = await eligible("reg")
      const domain = `research-${suffix}-reg${n}.example`
      const results = await race<unknown>([() => allocate(id, a.partnerId), () => runAs(b.actor, () => partnerMutation({ action: "register", country: "QA", businessName: `Independent ${suffix} reg`, website: domain }))])
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
      expect((await pool.query("select count(*)::int c from expansion_opportunities where normalized_domain=$1", [domain])).rows[0].c).toBe(1)
      expect((await pool.query("select count(*)::int c from prospects where website_url=$1", [`https://${domain}`])).rows[0].c).toBe(1)
    })
    it("an existing client or an already registered prospect blocks eligibility and allocation, and a lapsed eligibility is withdrawn", async () => {
      const a = await activePartner("conf-a")
      const named = await mk("client-name")
      await pool.query("insert into clients(name,invoice_client_code,billing_address_line_1,billing_city,billing_postcode,billing_country) values($1,$2,'1 Test Street','Nottingham','NG1 1AA','United Kingdom')", [`TEST ONLY research ${suffix} client-name${n}`, `C${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`])
      await screen(named)
      await expect(runAs(founder, () => markCandidateEligible({ candidateId: named }))).rejects.toMatchObject({ status: 409, message: expect.stringContaining("existing ScaleSmiths client") })
      // eligible first, then a partner independently registers the same business: allocation must refuse and demote
      const id = await eligible("prospect"); const domain = `research-${suffix}-prospect${n}.example`
      await runAs(a.actor, () => partnerMutation({ action: "register", country: "QA", businessName: `Independent ${suffix} prospect`, website: domain }))
      await expect(allocate(id, a.partnerId)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("existing prospect") })
      expect((await state(id)).status).toBe("draft")
      expect(await opportunityOf(id)).toHaveLength(0)
    })
    it("suppression applied during allocation: either seen, or committed after; never allocated once suppressed", async () => {
      const a = await activePartner("sup"); const id = await eligible("sup"); const domain = `research-${suffix}-sup${n}.example`
      const results = await race<unknown>([() => allocate(id, a.partnerId), () => runAs(founder, () => founderMutation({ action: "suppress", domain, reason: "TEST ONLY suppression" }))])
      expect(results[1].status).toBe("fulfilled")
      if ((await state(id)).status === "allocated") await runAs(founder, () => releaseCandidate({ candidateId: id, note: "TEST ONLY suppressed meanwhile" }))
      else expect(results[0]).toMatchObject({ status: "rejected" })
      await assertBlocked(id, a.partnerId, /suppression/)
    })
    it("market revocation during allocation: consistent, and unapproved or unknown markets fail closed", async () => {
      const a = await activePartner("mkt"); await setMarket("QB", "approved")
      const id = await eligible("mkt", { country: "QB" })
      const results = await race<unknown>([() => allocate(id, a.partnerId), () => setMarket("QB", "suspended")])
      expect(results[1].status).toBe("fulfilled")
      if ((await state(id)).status === "allocated") await runAs(founder, () => releaseCandidate({ candidateId: id, note: "TEST ONLY market suspended meanwhile" }))
      await assertBlocked(id, a.partnerId, /market is not approved/)
      const unknown = await mk("mkt-unknown", { country: "QC" })   // never configured: research may be recorded, sales are not authorised
      await screen(unknown)
      await expect(runAs(founder, () => markCandidateEligible({ candidateId: unknown }))).rejects.toMatchObject({ status: 409, message: expect.stringContaining("market is not approved") })
    })
    it("an exclusivity introduced during allocation is seen or committed after, never lost; restricted candidates are never clearable", async () => {
      const a = await activePartner("ex"); const sector = `Sector ${suffix} exr`, area = `Area ${suffix} exr`
      const id = await eligible("exr", { industry: sector, area })
      const create = () => runAs(founder, () => founderMutation({ action: "create_exclusivity", clientId, sector, area, contractualReference: "TEST ONLY clause", effectiveFrom: "2020-01-01" }))
      try {
        const results = await race<unknown>([() => allocate(id, a.partnerId), create])
        expect(results[1].status).toBe("fulfilled")
        if ((await state(id)).status === "allocated") await runAs(founder, () => releaseCandidate({ candidateId: id, note: "TEST ONLY restriction introduced meanwhile" }))
        await assertBlocked(id, a.partnerId, /exclusivity/)
        const ex = (await pool.query<{ id: string }>("select id from expansion_exclusivities where sector=$1 and status='active'", [sector])).rows[0].id
        await expect(runAs(founder, () => clearCandidateExclusivity({ candidateId: id, exclusivityId: ex, reference: "TEST ONLY attempt" }))).rejects.toMatchObject({ status: 409, message: expect.stringContaining("restriction") })
      } finally { await pool.query("update expansion_exclusivities set status='ended',ended_at=now() where status='active' and sector like $1", [`Sector ${suffix}%`]) }
    })
    it("an unclassified, uncertain match needs founder review and carries the decision onto the opportunity", async () => {
      const a = await activePartner("rev"); const area = `Area ${suffix} rev`
      // unclassified candidate, wording differs from the exclusivity: absence of a shared word is not proof of no conflict
      await runAs(founder, () => founderMutation({ action: "create_exclusivity", clientId, sector: `Protected ${suffix} sector`, area, contractualReference: "TEST ONLY clause", effectiveFrom: "2020-01-01" }))
      try {
        const id = await mk("rev", { industry: "Something described differently", area }); await screen(id)
        await expect(runAs(founder, () => markCandidateEligible({ candidateId: id }))).rejects.toMatchObject({ status: 409, message: expect.stringContaining("exclusivity review") })
        const ex = (await pool.query<{ id: string }>("select id from expansion_exclusivities where sector=$1 and status='active'", [`Protected ${suffix} sector`])).rows[0].id
        await runAs(founder, () => clearCandidateExclusivity({ candidateId: id, exclusivityId: ex, reference: "TEST ONLY founder review: different business activity" }))
        await runAs(founder, () => markCandidateEligible({ candidateId: id }))
        const out = await allocate(id, a.partnerId) as { opportunityId: string }
        expect((await pool.query("select decision from expansion_exclusivity_decisions where opportunity_id=$1", [out.opportunityId])).rows).toEqual([{ decision: "cleared" }])
        // the partner never learns why: no exclusivity detail is in their snapshot
        expect(JSON.stringify(await runAs(a.actor, () => partnerSnapshot()))).not.toMatch(/Protected|exclusiv/i)
      } finally { await pool.query("update expansion_exclusivities set status='ended',ended_at=now() where status='active' and sector like $1", [`Protected ${suffix}%`]) }
    })
    it("release versus reassignment: exactly one wins and ownership stays consistent", async () => {
      const a = await activePartner("rel-a"), b = await activePartner("rel-b"); const id = await eligible("rel")
      await allocate(id, a.partnerId)
      const results = await race<unknown>([() => runAs(founder, () => releaseCandidate({ candidateId: id, note: "TEST ONLY release" })), () => runAs(founder2, () => reassignCandidate({ candidateId: id, partnerId: b.partnerId, note: "TEST ONLY reassign" }))])
      expectSingleWinner(results, /changed hands|released/)
      const st = await state(id), opp = (await opportunityOf(id))[0]
      if (st.status === "allocated") expect(opp.partner_id).toBe(b.partnerId); else { expect(st.status).toBe("eligible"); expect(opp.status).toBe("withdrawn") }
      // a released candidate can be allocated again and revives the SAME canonical opportunity
      if (st.status === "eligible") { await allocate(id, b.partnerId); expect((await opportunityOf(id))).toHaveLength(1); expect((await opportunityOf(id))[0]).toMatchObject({ partner_id: b.partnerId, status: "registered" }) }
      expect((await events(id)).filter(e => ["released", "reassigned"].includes(e))).toHaveLength(1)
    })
    it("a prospect the partner has worked on cannot be released or moved, and the database refuses a direct ownership change", async () => {
      const a = await activePartner("work-a"), b = await activePartner("work-b"); const id = await eligible("work")
      const out = await allocate(id, a.partnerId) as { opportunityId: string }
      await expect(pool.query("update expansion_opportunities set partner_id=$1 where id=$2", [b.partnerId, out.opportunityId])).rejects.toThrow(/cannot change partner/)
      await runAs(a.actor, () => partnerMutation({ action: "discovery", id: out.opportunityId, discovery: { objectives: "Test", pages: "Five", functionality: "Form", budget: "Subject", timescale: "Assessed", decisionProcess: "Owner" } }))
      await expect(runAs(founder, () => releaseCandidate({ candidateId: id, note: "TEST ONLY too late" }))).rejects.toMatchObject({ status: 409, message: expect.stringContaining("already worked") })
      await expect(runAs(founder, () => reassignCandidate({ candidateId: id, partnerId: b.partnerId, note: "TEST ONLY too late" }))).rejects.toMatchObject({ status: 409 })
      expect((await state(id)).allocated_partner_id).toBe(a.partnerId)
    })
    it("authorisation: partners and the unauthenticated cannot administer, a revoked partner receives nothing, and partner A cannot reach partner B's allocation", async () => {
      const a = await activePartner("auth-a"), b = await activePartner("auth-b"), revoked = await activePartner("auth-r")
      const id = await eligible("auth"); const out = await allocate(id, b.partnerId) as { opportunityId: string }
      await expect(runAs(a.actor, () => allocateCandidate({ candidateId: id, partnerId: a.partnerId }))).rejects.toThrow("Forbidden")
      await expect(runAs(a.actor, () => getResearchAdmin())).rejects.toThrow("Forbidden")
      await expect(runAs(a.actor, () => createCandidate(fresh("x")))).rejects.toThrow("Forbidden")
      await expect(allocateCandidate({ candidateId: id, partnerId: a.partnerId })).rejects.toThrow()          // no actor at all
      await expect(runAs(a.actor, () => partnerMutation({ action: "stage", id: out.opportunityId, status: "contacted" }))).rejects.toMatchObject({ status: 404 })
      await expect(runAs(a.actor, () => partnerMutation({ action: "discovery", id: out.opportunityId, discovery: { objectives: "x" } }))).rejects.toMatchObject({ status: 404 })
      expect(((await runAs(a.actor, () => partnerSnapshot())).opportunities as unknown[]).length).toBe(0)
      const other = await eligible("auth2")
      await pool.query("update admin_users set active=false where id=$1", [revoked.actor.id])
      await expect(allocate(other, revoked.partnerId)).rejects.toMatchObject({ status: 409, message: expect.stringContaining("not active") })
      expect((await state(other)).status).toBe("eligible")
      await expect(runAs(revoked.actor, () => partnerSnapshot())).rejects.toBeTruthy()
    })
    it("an excluded candidate is closed, and screening failure withdraws eligibility", async () => {
      const id = await eligible("excl")
      await runAs(founder, () => recordScreening({ candidateId: id, outcome: "failed", evidence: "TEST ONLY screening reason recorded" }))
      expect((await state(id)).status).toBe("draft")
      await runAs(founder, () => excludeCandidate({ candidateId: id, reason: "TEST ONLY not suitable" }))
      await expect(runAs(founder, () => markCandidateEligible({ candidateId: id }))).rejects.toMatchObject({ status: 409 })
      await expect(pool.query("update expansion_research_candidates set status='draft' where id=$1", [id])).rejects.toThrow(/closed/)
      await expect(pool.query("delete from expansion_candidate_events where candidate_id=$1", [id])).rejects.toThrow()
    })
  })
})
