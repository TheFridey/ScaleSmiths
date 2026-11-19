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
import { allocateExpansionInvoice, approveExpansionPayout, cancelExpansionPayout, getPartnerFinance, prepareExpansionPayout, refundExpansionPayment, settleExpansionPayout, verifyExpansionPayment } from "../../src/lib/server/expansion-finance"
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
    const record = await partnerMutation({ action: "register", businessName: `TEST ONLY concurrency ${suffix} ${tag}`, website: `concurrency-${suffix}-${tag}.example`, contactName: "Test director" })
    await partnerMutation({ action: "discovery", id: record.id, discovery: { objectives: "Test enquiries", pages: "Five", functionality: "Contact form", budget: "Subject to founder approval", timescale: "Assessed availability", decisionProcess: "Director" } })
    await partnerMutation({ action: "submit_scope", id: record.id, summary: "TEST ONLY five-page approved scope" })
    return record.id
  })
}
const approve = (id: string, deliveryPeriod: string, hours = 10) => runAs(founder, () => founderMutation({ action: "review_scope", id, decision: "approved", period: deliveryPeriod, hours, technicalConfirmed: true, commercialConfirmed: true, notes: "TEST ONLY reviewed technical feasibility, price, delivery effort and commercial terms" }))

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
})
