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
import { getPartnerFinance, verifyExpansionPayment } from "../../src/lib/server/expansion-finance"
import { activatePartnerInvitation } from "../../src/lib/server/partner-invitations"
import { createInvoice, transitionInvoice } from "../../src/lib/server/invoices"

// Deliberately independent from DATABASE_URL / TEST_DATABASE_URL. This suite never provisions,
// truncates, drops or migrates the shared database; fixtures are additive and visibly test-labelled.
export function safeExpansionConcurrencyUrl(value: string | undefined): string {
  if (!value) throw new Error("EXPANSION_TEST_DATABASE_URL is required for this explicit disposable database test.")
  const url = new URL(value)
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.port !== "55440" || url.pathname !== "/ss_expansion_test") throw new Error("Expansion concurrency tests require the explicit loopback:55440/ss_expansion_test disposable database.")
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
async function submitted(tag: string) {
  return runAs(first, async () => {
    const record = await partnerMutation({ action: "register", businessName: `TEST ONLY concurrency ${suffix} ${tag}`, website: `concurrency-${suffix}-${tag}.example`, contactName: "Test director" })
    await partnerMutation({ action: "discovery", id: record.id, discovery: { objectives: "Test enquiries", pages: "Five", functionality: "Contact form", budget: "Subject to founder approval", timescale: "Assessed availability", decisionProcess: "Director" } })
    await partnerMutation({ action: "submit_scope", id: record.id, summary: "TEST ONLY five-page approved scope" })
    return record.id
  })
}
const approve = (id: string, deliveryPeriod: string, hours = 10) => runAs(founder, () => founderMutation({ action: "review_scope", id, decision: "approved", period: deliveryPeriod, hours, technicalConfirmed: true, commercialConfirmed: true, notes: "TEST ONLY reviewed technical feasibility, price, delivery effort and commercial terms" }))

describe.skipIf(!process.env.EXPANSION_TEST_DATABASE_URL)("Expansion real separate-connection PostgreSQL races", () => {
  beforeAll(async () => {
    const url = safeExpansionConcurrencyUrl(process.env.EXPANSION_TEST_DATABASE_URL)
    pool = new Pool({ connectionString: url, max: 8, options: "-c app.access_mode=internal_write", connectionTimeoutMillis: 5000 })
    const identity = await pool.query<{ name: string }>("select current_database() name")
    if (identity.rows[0]?.name !== "ss_expansion_test") throw new Error("Unexpected database; refusing test mutations.")
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
    const applicantId = await application(`TEST ONLY activation ${suffix}`, `activate-${suffix}@example.invalid`, "onboarding")
    const invitation = await runAs(founder, () => founderMutation({ action: "invite", id: applicantId, agreementVersion: "test-reviewed-v1" }))
    const token = String((invitation as { invitationToken: string }).invitationToken)
    const results = await race([() => activatePartnerInvitation(token, "TestOnly!Activation-A-123"), () => activatePartnerInvitation(token, "TestOnly!Activation-B-123")])
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1)
    const identity = await pool.query("select u.active,u.session_version,p.invitation_hash,p.invitation_expires_at,p.activated_at is not null as activated from expansion_partners p join admin_users u on u.id=p.user_id where p.application_id=$1", [applicantId])
    expect(identity.rows).toEqual([{ active: true, session_version: 2, invitation_hash: null, invitation_expires_at: null, activated: true }])
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
})
