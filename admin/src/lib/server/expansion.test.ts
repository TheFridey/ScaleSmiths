import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { standardCommissionTerms } from "../expansion-finance"

const FOUNDER = "10000000-0000-4000-8000-000000000001"
const USER = "10000000-0000-4000-8000-000000000002"
const OTHER_USER = "10000000-0000-4000-8000-000000000003"
const PARTNER = "20000000-0000-4000-8000-000000000001"
const OTHER_PARTNER = "20000000-0000-4000-8000-000000000002"
const state = vi.hoisted(() => ({ database: null as PGlite | null, actor: { id: "10000000-0000-4000-8000-000000000001", role: "owner", active: true, sessionVersion: 1, displayName: "Founder" } }))
function execute(statement: SQL) { const query = new PgDialect().sqlToQuery(statement); return state.database!.query(query.sql, query.params) }
vi.mock("@/lib/db", () => ({ db: {
  execute: (statement: SQL) => execute(statement),
  transaction: (operation: (tx: { execute: (query: SQL) => Promise<unknown> }) => Promise<unknown>) => state.database!.transaction(async tx => operation({
    execute: async statement => { const query = new PgDialect().sqlToQuery(statement); return tx.query(query.sql, query.params) },
  })),
} }))
vi.mock("./rbac", () => ({ requireCapability: async (capability: string) => {
  if ((capability === "expansion.manage" && state.actor.role !== "owner") || (capability === "expansion.partner" && state.actor.role !== "independent_partner")) throw new Error("Forbidden capability")
  return { ...state.actor }
} }))
vi.mock("./partner-invitations", () => ({ issueInvitation: vi.fn() }))
import { founderMutation, founderSnapshot, partnerMutation, partnerSnapshot } from "./expansion"

const discovery = { objectives: "Qualified enquiries", pages: "Five service pages", functionality: "Contact form", budget: "Standard package subject to approval", timescale: "Flexible after assessed availability", decisionProcess: "Director approves scope", integrations: "Booking integration requires technical review" }
function asFounder() { state.actor = { id: FOUNDER, role: "owner", active: true, sessionVersion: 1, displayName: "Founder" } }
function asPartner(id = USER) { state.actor = { id, role: "independent_partner", active: true, sessionVersion: 1, displayName: id === USER ? "Partner A" : "Partner B" } }
async function register(suffix = "one") { return partnerMutation({ action: "register", country: "GB", businessName: `Example ${suffix}`, website: `https://www.example-${suffix}.co.uk/path`, contactName: "Director", contactEmail: `director@example-${suffix}.co.uk`, region: "Nottingham", industry: "Local services" }) }
async function submitted(suffix = "one") {
  asPartner()
  const record = await register(suffix)
  await partnerMutation({ action: "discovery", id: record.id, discovery })
  await partnerMutation({ action: "submit_scope", id: record.id, summary: "Five approved service pages and enquiry form; integrations subject to technical review." })
  return String(record.id)
}
const capacity = (hours = 10) => founderMutation({ action: "capacity", period: "2026-11-23", hours, commitmentsReviewed: true, rationale: "Remaining allocation after existing projects, retainers and founder availability" })
const confirmMarket = (id: string) => state.database!.query("update expansion_opportunities set customer_country_confirmed_by=$1 where id=$2 and customer_country is not null", [FOUNDER, id])
const approval = async (id: string, hours = 10) => { const r = await founderMutation({ action: "review_scope", id, decision: "approved", period: "2026-11-23", hours, technicalConfirmed: true, commercialConfirmed: true, notes: "Technical feasibility, effort, scope, migration risk, price and delivery reviewed" }); await confirmMarket(id); return r }

describe("production Expansion prospect/scope/capacity service against PostgreSQL via PGlite", () => {
  beforeAll(async () => {
    state.database = new PGlite()
    // Existing-domain prerequisites are fixtures. New tables, constraints and immutable-history triggers use the actual forward migration.
    await state.database.exec(`
      create type admin_user_role as enum('owner','administrator','viewer');
      create table admin_users(id uuid primary key,role admin_user_role,active boolean,session_version integer,display_name text,email text);
      create table partner_applications(id serial primary key,name text,email text,status text,onboarding_confirmations jsonb default '{}',submitted_at timestamptz default now());
      create table clients(id serial primary key,name text);
      create type prospect_stage as enum('found','contacted','qualified','lost','proposal_required','won');
      create table prospects(id serial primary key,business_name text not null,website_url text,contact_name text,contact_email text,location text,industry text,owner_user_id uuid references admin_users(id),source text,next_follow_up_at timestamptz,stage prospect_stage not null default 'found',converted_client_id integer references clients(id),won_at timestamptz,updated_at timestamptz default now());
      create table prospect_conversions(id serial primary key,prospect_id integer unique references prospects(id),client_id integer references clients(id),actor_user_id uuid references admin_users(id),client_action text,metadata_json jsonb);
      create table commercial_contacts(id serial primary key,email text,suppressed boolean default false);
      create table commercial_contracts(id serial primary key,client_id integer references clients(id),prospect_id integer references prospects(id),category text,status text,monthly_amount integer,one_off_amount integer,evidence text,starts_at timestamptz,actor_user_id uuid references admin_users(id));
      create function commercial_history_immutable() returns trigger language plpgsql as $$ begin raise exception 'Commercial history is append-only'; end $$;
    `)
    await state.database.exec(readFileSync(new URL("../../../drizzle/0068_expansion_foundation.sql", import.meta.url), "utf8"))
    // 0073 also widens a finance-table constraint (covered in expansion-finance.test.ts); this suite needs only its plan-settings table.
    const plans = readFileSync(new URL("../../../drizzle/0073_expansion_commercial_plans.sql", import.meta.url), "utf8")
    await state.database.exec(plans.slice(plans.indexOf("CREATE TABLE expansion_plan_settings")))
    await state.database.exec(readFileSync(new URL("../../../drizzle/0074_expansion_allowances_and_additional_claims.sql", import.meta.url), "utf8"))
    await state.database.exec(readFileSync(new URL("../../../drizzle/0076_expansion_market_and_exclusivity_gates.sql", import.meta.url), "utf8"))
    await state.database.exec(readFileSync(new URL("../../../drizzle/0077_expansion_gate_hardening.sql", import.meta.url), "utf8"))
  }, 30000)
  beforeEach(async () => {
    asFounder()
    await state.database!.exec("truncate expansion_exclusivity_decisions,expansion_exclusivities,expansion_markets,expansion_discount_reservations,expansion_discount_policies,expansion_additional_claims,expansion_audit,expansion_suppressions,expansion_resources,expansion_contracts,expansion_reservations,expansion_capacity,expansion_opportunities,expansion_partners,commercial_contracts,commercial_contacts,prospects,clients,partner_applications,admin_users restart identity cascade")
    await state.database!.query("insert into admin_users values($1,'owner',true,1,'Founder','founder@example.invalid'),($2,'independent_partner',true,1,'Partner A','a@example.invalid'),($3,'independent_partner',true,1,'Partner B','b@example.invalid')", [FOUNDER, USER, OTHER_USER])
    await state.database!.exec("insert into partner_applications(name,email,status) values('Partner A','a@example.invalid','activated'),('Partner B','b@example.invalid','activated'); insert into clients(id,name) values(1,'Canonical client');")
    await state.database!.query("insert into expansion_partners(id,user_id,application_id,agreement_version,confirmed_at,activated_at) values($1,$2,1,'test-approved-v1',now(),now()),($3,$4,2,'test-approved-v1',now(),now())", [PARTNER, USER, OTHER_PARTNER, OTHER_USER])
  })
  afterAll(async () => { await state.database?.close() })
  beforeEach(async () => { await state.database!.query("insert into expansion_markets(country_code,country_name,status,plan_keys,legal_reviewed,accounting_reviewed,privacy_reviewed,operations_reviewed,approval_reference,approved_by) values('GB','United Kingdom','approved','{standard-v2,growth-only-v1,bespoke-v1}',true,true,true,true,'SYNTHETIC market approval',$1)", [FOUNDER]) })
  beforeEach(async () => { await state.database!.exec("truncate expansion_plan_settings; insert into expansion_plan_settings(plan_key) values('standard-v2'),('growth-only-v1'),('bespoke-v1')") })

  it("persists canonical prospect, discovery, technical flags, founder approval, reservation and accepted immutable contract", async () => {
    const id = await submitted()
    const [prospect] = (await state.database!.query("select * from prospects")).rows as Record<string, unknown>[]
    expect(prospect.website_url).toBe("https://example-one.co.uk")
    expect(prospect.owner_user_id).toBe(USER)
    asFounder()
    await capacity()
    await approval(id)
    const accepted = await founderMutation({ action: "accept_contract", id, clientId: 1, terms: standardCommissionTerms(), agreementReference: "Signed agreement and approved scope V1" })
    const acceptedId = String((accepted as { id: string }).id)
    const contracts = (await state.database!.query("select * from commercial_contracts")).rows as Record<string, unknown>[]
    expect(contracts).toHaveLength(1)
    expect([contracts[0].one_off_amount, contracts[0].monthly_amount]).toEqual([200000, 35000])
    const [canonical] = (await state.database!.query("select stage,converted_client_id,won_at is not null as won from prospects where id=$1", [prospect.id])).rows
    expect(canonical).toEqual({stage:'won',converted_client_id:1,won:true})
    const [conversion] = (await state.database!.query("select * from prospect_conversions where prospect_id=$1", [prospect.id])).rows as Record<string,unknown>[]
    expect([conversion.client_id,conversion.actor_user_id,conversion.client_action]).toEqual([1,FOUNDER,'linked'])
    expect(conversion.metadata_json).toMatchObject({source:'operation-expansion',contractId:acceptedId,scopeVersion:1})
    const [reservation] = (await state.database!.query("select * from expansion_reservations")).rows as Record<string, unknown>[]
    expect([reservation.hours, reservation.status]).toEqual([10, "confirmed"])
    const [contract] = (await state.database!.query("select * from expansion_contracts where id=$1", [acceptedId])).rows as Record<string, unknown>[]
    expect(contract.scope_version).toBe(1)
    expect((contract.scope_snapshot as Record<string, unknown>).technicalFlags).toEqual(["booking"])
    await expect(state.database!.query("update expansion_contracts set agreement_reference='silently rewritten' where id=$1", [acceptedId])).rejects.toThrow("append-only")
    asPartner()
    await expect(partnerMutation({ action: "discovery", id, discovery })).rejects.toThrow("locked")
    await expect(partnerMutation({ action: "stage", id, status: "contract_accepted" })).rejects.toThrow("approved commercial workflow")
    const snapshot = await partnerSnapshot()
    expect(snapshot.opportunities).toHaveLength(1)
    expect(snapshot.opportunities[0]).not.toHaveProperty("review_notes")
  })
  it("does not expose or mutate another partner's prospect, discovery or approved resources", async () => {
    const id = await submitted()
    asFounder()
    await founderMutation({ action: "resource", title: "Published handbook", category: "Handbook", version: 1, audience: "partner", status: "published", content: "Approved testing resource" })
    await founderMutation({ action: "resource", title: "Internal draft", category: "Handbook", version: 2, audience: "partner", status: "draft", content: "Never disclose draft" })
    await founderMutation({ action: "resource", title: "Client-only guide", category: "Handbook", version: 1, audience: "client", status: "published", content: "Never disclose client-only content to partners" })
    asPartner(OTHER_USER)
    const snapshot = await partnerSnapshot()
    expect(snapshot.opportunities).toEqual([])
    expect(snapshot.resources.map(row => row.title)).toEqual(["Published handbook"])
    expect(snapshot.resources[0].status).toBe("published")
    await expect(partnerMutation({ action: "discovery", id, discovery })).rejects.toThrow("not found")
    await expect(founderSnapshot()).rejects.toThrow("Forbidden")
    await expect(founderMutation({ action: "preview_applicant_retention" })).rejects.toThrow("Forbidden")
    await expect(founderMutation({ action: "purge_applicants", confirmed: true })).rejects.toThrow("Forbidden")
    await expect(founderMutation({ action: "capacity", period: "2026-11-23", hours: 9999, commitmentsReviewed: true, rationale: "Partner cannot approve this" })).rejects.toThrow("Forbidden")
  })
  it("returns the same confidential response for duplicate domains, suppressed domains and suppressed contacts", async () => {
    asPartner()
    await register()
    const generic = "This business already has an existing ScaleSmiths relationship. Please contact commercial support if you believe this is incorrect."
    asPartner(OTHER_USER)
    await expect(partnerMutation({ action: "register", businessName: "A different confidential name", website: "EXAMPLE-one.co.uk" })).rejects.toThrow(generic)
    asFounder()
    await founderMutation({ action: "suppress", domain: "suppressed.co.uk", reason: "Approved suppression request" })
    await state.database!.exec("insert into commercial_contacts(email,suppressed) values('suppressed-contact@example.invalid',true)")
    asPartner()
    await expect(partnerMutation({ action: "register", businessName: "Suppressed business", website: "suppressed.co.uk" })).rejects.toThrow(generic)
    await expect(partnerMutation({ action: "register", businessName: "Another business", website: "different.co.uk", contactEmail: "suppressed-contact@example.invalid" })).rejects.toThrow(generic)
    expect((await state.database!.query("select * from prospects")).rows).toHaveLength(1)
  })
  it("admits exactly one of simultaneously submitted duplicate registrations", async () => {
    asPartner()
    const results = await Promise.allSettled([register("race"), register("race")])
    expect(results.filter(row => row.status === "fulfilled")).toHaveLength(1)
    expect(results.filter(row => row.status === "rejected")).toHaveLength(1)
    expect((await state.database!.query("select * from prospects")).rows).toHaveLength(1)
  })
  it("prevents overselling the last slot and lowering allocation below reserved hours", async () => {
    const first = await submitted("first"), second = await submitted("second")
    asFounder()
    await capacity(10)
    // PGlite queues transactions on one PostgreSQL backend. This tests simultaneous command submission;
    // separate-connection PostgreSQL lock contention remains an additional integration requirement.
    const results = await Promise.allSettled([approval(first, 10), approval(second, 10)])
    expect(results.filter(row => row.status === "fulfilled")).toHaveLength(1)
    expect(results.filter(row => row.status === "rejected")).toHaveLength(1)
    expect((await state.database!.query("select sum(hours)::integer as hours from expansion_reservations where status<>'released'")).rows).toEqual([{ hours: 10 }])
    await expect(capacity(9)).rejects.toThrow("existing reservations")
  })
  it("rolls back approval when capacity is exhausted and rejects acceptance without scope approval", async () => {
    const id = await submitted()
    asFounder()
    await capacity(0)
    await expect(approval(id)).rejects.toThrow("Insufficient")
    expect((await state.database!.query("select status from expansion_opportunities where id=$1", [id])).rows).toEqual([{ status: "scope_submitted" }])
    expect((await state.database!.query("select * from expansion_reservations")).rows).toEqual([])
    await expect(founderMutation({ action: "accept_contract", id, clientId: 1, terms: standardCommissionTerms(), agreementReference: "Cannot bypass approval" })).rejects.toThrow("Approve scope")
  })
  it("rejects disabled persisted partners even if a previously issued session passed the outer guard", async () => {
    asPartner()
    await state.database!.query("update admin_users set active=false where id=$1", [USER])
    await expect(register()).rejects.toThrow("revoked")
    expect((await state.database!.query("select * from prospects")).rows).toEqual([])
  })
  it("rejects accepting a prospect already mapped to another canonical client", async () => {
    const id=await submitted()
    asFounder()
    await capacity()
    await approval(id)
    await state.database!.exec("insert into clients(id,name) values(2,'Another canonical client')")
    await state.database!.query("update prospects set converted_client_id=2 where id=(select prospect_id from expansion_opportunities where id=$1)",[id])
    await expect(founderMutation({action:'accept_contract',id,clientId:1,terms:standardCommissionTerms(),agreementReference:'Must not overwrite existing client mapping'})).rejects.toThrow('different client')
    expect((await state.database!.query('select * from expansion_contracts')).rows).toEqual([])
    await state.database!.query("update prospects set converted_client_id=null where id=(select prospect_id from expansion_opportunities where id=$1)",[id])
    await state.database!.query("insert into prospect_conversions(prospect_id,client_id,actor_user_id,client_action,metadata_json) select prospect_id,2,$2,'linked','{}' from expansion_opportunities where id=$1",[id,FOUNDER])
    await expect(founderMutation({action:'accept_contract',id,clientId:1,terms:standardCommissionTerms(),agreementReference:'Must not overwrite conversion history'})).rejects.toThrow('different client')
    expect((await state.database!.query('select * from commercial_contracts')).rows).toEqual([])
  })

  describe("checkpoint 2A: founder-approved commercial plans", () => {
    const enable = (planKey: string, enabled = true) => founderMutation({ action: "set_plan_enabled", planKey, enabled, reason: "Synthetic approval for test" })
    const ready = async () => { const id = await submitted(); asFounder(); await capacity(); await approval(id); return id }
    it("refuses a plan that is disabled by default, then accepts it once a founder enables it", async () => {
      const id = await ready()
      await expect(founderMutation({ action: "accept_contract", id, clientId: 1, plan: { plan: "standard-v2" }, agreementReference: "Signed" })).rejects.toThrow("not enabled")
      await enable("standard-v2")
      const accepted = await founderMutation({ action: "accept_contract", id, clientId: 1, plan: { plan: "standard-v2", scheduleId: "deposit-completion" }, agreementReference: "Signed" })
      const [contract] = (await state.database!.query("select terms from expansion_contracts where id=$1", [String((accepted as { id: string }).id)])).rows as Array<{ terms: { planVersion: string; commitment: Record<string, unknown> } }>
      expect(contract.terms.planVersion).toBe("standard-v2.deposit-completion")
      expect(contract.terms.commitment).toMatchObject({ currency: "GBP", minTermMonths: 12, minimumContractValuePence: "620000", buildInstalments: ["75000", "125000"] })
    })
    it("derives canonical pricing server-side and ignores client-supplied pricing or rate overrides", async () => {
      const id = await ready(); await enable("standard-v2")
      await founderMutation({ action: "accept_contract", id, clientId: 1, plan: { plan: "standard-v2" }, commercialPricing: { websitePence: 1, monthlyPence: 1 }, rateBps: 9000, agreementReference: "Signed" })
      const [row] = (await state.database!.query("select one_off_amount,monthly_amount from commercial_contracts")).rows
      expect(row).toEqual({ one_off_amount: 200000, monthly_amount: 35000 })
      expect((await state.database!.query("select terms->>'rateBps' r from expansion_contracts")).rows).toEqual([{ r: "3000" }])
    })
    it("rejects unapproved discounts, mixed legacy/plan input and custom schedules without approval", async () => {
      const id = await ready(); await enable("standard-v2")
      await expect(founderMutation({ action: "accept_contract", id, clientId: 1, plan: { plan: "standard-v2", buildFeePence: 150000 }, agreementReference: "Signed" })).rejects.toThrow("discount allowance")
      await expect(founderMutation({ action: "accept_contract", id, clientId: 1, plan: { plan: "standard-v2" }, terms: standardCommissionTerms(), agreementReference: "Signed" })).rejects.toThrow("not both")
      await expect(founderMutation({ action: "accept_contract", id, clientId: 1, plan: { plan: "standard-v2", scheduleId: "custom", buildInstalmentsPence: [100000, 100000] }, agreementReference: "Signed" })).rejects.toThrow("approval reference")
      expect((await state.database!.query("select count(*)::int c from expansion_contracts")).rows).toEqual([{ c: 0 }])
    })
    it("accepts Growth Partnership-only with no build price and a recorded £4,200 commitment", async () => {
      const id = await ready(); await enable("growth-only-v1")
      const accepted = await founderMutation({ action: "accept_contract", id, clientId: 1, plan: { plan: "growth-only-v1" }, agreementReference: "Signed" })
      expect((await state.database!.query("select one_off_amount,monthly_amount from commercial_contracts")).rows).toEqual([{ one_off_amount: 0, monthly_amount: 35000 }])
      const [c] = (await state.database!.query("select terms->'commitment'->>'minimumContractValuePence' v from expansion_contracts where id=$1", [String((accepted as { id: string }).id)])).rows
      expect(c).toEqual({ v: "420000" })
    })
    it("keeps legacy standard-v1 acceptance working without any plan setting", async () => {
      const id = await ready()
      await founderMutation({ action: "accept_contract", id, clientId: 1, terms: standardCommissionTerms(), agreementReference: "Historical v1" })
      expect((await state.database!.query("select terms->>'planVersion' v, terms ? 'commitment' c from expansion_contracts")).rows).toEqual([{ v: "standard-v1", c: false }])
    })
    it("denies plan administration and plan-based acceptance to partners", async () => {
      const id = await ready(); await enable("standard-v2")
      asPartner()
      await expect(enable("standard-v2", false)).rejects.toThrow()
      await expect(founderMutation({ action: "accept_contract", id, clientId: 1, plan: { plan: "standard-v2" }, agreementReference: "x" })).rejects.toThrow()
      asFounder()
      await expect(founderMutation({ action: "set_plan_enabled", planKey: "nonsense", enabled: true, reason: "x" })).rejects.toThrow("known commercial plan")
    })
  })

  describe("checkpoint 2B: discount allowances", () => {
    const enable = () => founderMutation({ action: "set_plan_enabled", planKey: "standard-v2", enabled: true, reason: "Synthetic approval for test" })
    const policy = (over: Record<string, unknown> = {}) => founderMutation({ action: "set_discount_policy", partnerId: PARTNER, periodStart: "2020-01-01", periodEnd: "2099-01-01", allowanceCount: 1, permittedFeesPence: [150000, 0], approvalReference: "SYNTHETIC allowance approval", ...over })
    const ready = async (tag: string) => { const id = await submitted(tag); asFounder(); await capacity(30); await approval(id); return id }
    const reserve = (id: string, feePence: number) => founderMutation({ action: "reserve_discount", id, feePence, reason: "Synthetic commercial reason" })
    const accept = (id: string, plan: Record<string, unknown>) => founderMutation({ action: "accept_contract", id, clientId: 1, plan, agreementReference: "Signed" })

    it("defaults to no allowance: nothing can be reserved until a founder approves a policy", async () => {
      const id = await ready("a"); await enable()
      await expect(reserve(id, 150000)).rejects.toThrow("No approved discount allowance")
      await expect(accept(id, { plan: "standard-v2", buildFeePence: 150000 })).rejects.toThrow("discount allowance")
    })
    it("enforces permitted fees, the allowance count and release/reuse", async () => {
      const a = await ready("a"), b = await ready("b"); await enable(); await policy()
      await expect(reserve(a, 100000)).rejects.toThrow("not a permitted discount")
      await reserve(a, 150000)
      await expect(reserve(a, 150000)).rejects.toThrow("already has an active")
      await expect(reserve(b, 150000)).rejects.toThrow("exhausted")
      await founderMutation({ action: "release_discount", id: a, reason: "Customer declined" })
      await reserve(b, 150000)
    })
    it("consumes the reservation on acceptance, stores the discounted commitment and makes the reservation immutable", async () => {
      const id = await ready("a"); await enable(); await policy(); await reserve(id, 150000)
      // A client-supplied approval field is ignored; the mismatching fee is refused.
      await expect(accept(id, { plan: "standard-v2", buildFeePence: 100000, approvedDiscountFeePence: 100000 })).rejects.toThrow("does not match")
      const accepted = await accept(id, { plan: "standard-v2", buildFeePence: 150000, approvedDiscountFeePence: 999 })
      const [c] = (await state.database!.query("select terms from expansion_contracts where id=$1", [String((accepted as { id: string }).id)])).rows as Array<{ terms: { planVersion: string; commitment: Record<string, unknown> } }>
      expect(c.terms.planVersion).toBe("standard-v2.d150000")
      expect(c.terms.commitment).toMatchObject({ buildPence: "150000", minTermMonths: 12, minimumContractValuePence: "570000" })
      const [r] = (await state.database!.query("select status,contract_id from expansion_discount_reservations")).rows as Array<{ status: string; contract_id: string }>
      expect(r.status).toBe("consumed"); expect(r.contract_id).toBe((accepted as { id: string }).id)
      await expect(state.database!.query("update expansion_discount_reservations set status='released'")).rejects.toThrow("immutable")
      await expect(state.database!.query("delete from expansion_discount_reservations")).rejects.toThrow("append-only")
      await expect(founderMutation({ action: "release_discount", id, reason: "x" })).rejects.toThrow("no unconsumed")
    })
    it("Case F: an approved free build still requires approved scope, capacity, an enabled plan and records a £4,200-plus commitment", async () => {
      const id = await ready("a"); await policy(); await reserve(id, 0)
      await expect(accept(id, { plan: "standard-v2", buildFeePence: 0 })).rejects.toThrow("not enabled")
      await enable()
      await accept(id, { plan: "standard-v2", buildFeePence: 0 })
      expect((await state.database!.query("select one_off_amount,monthly_amount from commercial_contracts")).rows).toEqual([{ one_off_amount: 0, monthly_amount: 35000 }])
      expect((await state.database!.query("select terms->'commitment'->>'minimumContractValuePence' v from expansion_contracts")).rows).toEqual([{ v: "420000" }])
    })
    it("protects policies: no overlap, no lowering below use, no expired reservations, partners denied", async () => {
      const id = await ready("a"); await enable(); await policy(); await reserve(id, 150000)
      await expect(policy({ periodStart: "2021-01-01" })).rejects.toThrow("overlap")
      await expect(policy({ allowanceCount: 0 })).rejects.toThrow("lowered")
      await expect(policy({ permittedFeesPence: [200000] })).rejects.toThrow("below the standard")
      asPartner()
      await expect(policy()).rejects.toThrow()
      await expect(reserve(id, 150000)).rejects.toThrow()
      expect((await partnerSnapshot()).discountAllowances).toEqual([expect.objectContaining({ allowance_count: 1, used: 1 })])
      asFounder(); await state.database!.exec("update expansion_discount_policies set period_end='2020-06-01'")
      await expect(accept(id, { plan: "standard-v2", buildFeePence: 150000 })).rejects.toThrow("expired")
    })
  })
  describe("checkpoint 2B: existing-customer additional opportunities", () => {
    const claim = (over: Record<string, unknown> = {}) => partnerMutation({ action: "request_additional", businessName: "Canonical Client Ltd", website: "https://existing-customer.example", projectLabel: "Booking platform", contribution: "Introduced the director and led the booking requirements meeting.", ...over })
    const review = (claimId: string, over: Record<string, unknown> = {}) => founderMutation({ action: "review_additional", claimId, decision: "approved", clientId: 1, attributionConfirmed: true, notes: "Attribution evidence reviewed: introduction email chain.", ...over })
    it("returns an identical acknowledgement for a fresh and an already-claimed project, storing one claim", async () => {
      asPartner(); const first = await claim(); const second = await claim()
      expect(Object.keys(first).sort()).toEqual(Object.keys(second).sort()); expect(second.received).toBe(true)
      expect((await state.database!.query("select count(*)::int c from expansion_additional_claims")).rows).toEqual([{ c: 1 }])
      asPartner(OTHER_USER); await claim()
      expect((await state.database!.query("select count(*)::int c from expansion_additional_claims")).rows).toEqual([{ c: 1 }])
      expect((await partnerSnapshot()).additionalClaims).toEqual([])
    })
    it("approval reuses the canonical client, creates a separately attributed opportunity and an ordinary duplicate stays blocked", async () => {
      asPartner(); const { id: claimId } = await claim(); asFounder()
      await expect(review(String(claimId), { attributionConfirmed: false })).rejects.toThrow("Confirm documented")
      await expect(review(String(claimId), { clientId: 999 })).rejects.toThrow("existing canonical client")
      const approved = await review(String(claimId)) as { opportunityId: string }
      const [opp] = (await state.database!.query("select partner_id,client_id,additional_claim_id,status from expansion_opportunities where id=$1", [approved.opportunityId])).rows as Array<Record<string, unknown>>
      expect(opp).toMatchObject({ partner_id: PARTNER, client_id: 1, additional_claim_id: claimId, status: "registered" })
      expect((await state.database!.query("select count(*)::int c from clients")).rows).toEqual([{ c: 1 }])
      asPartner(OTHER_USER)
      await expect(partnerMutation({ action: "register", businessName: "Another", website: "existing-customer.example" })).rejects.toThrow("existing ScaleSmiths relationship")
      asFounder()
      await expect(review(String(claimId))).rejects.toThrow("pending")
      await expect(state.database!.query("update expansion_additional_claims set review_notes='rewritten'")).rejects.toThrow("immutable")
    })
    it("rejection creates no opportunity or commission path, and a later claim for the same project is allowed", async () => {
      asPartner(); const { id: claimId } = await claim(); asFounder()
      await review(String(claimId), { decision: "rejected", notes: "Existing relationship; no new work." })
      expect((await state.database!.query("select count(*)::int c from expansion_opportunities")).rows).toEqual([{ c: 0 }])
      asPartner(); await claim()
      expect((await state.database!.query("select count(*)::int c from expansion_additional_claims")).rows).toEqual([{ c: 2 }])
    })
    it("requires the attributed client at contract acceptance and denies partner review", async () => {
      await state.database!.exec("insert into clients(id,name) values(2,'Other client')")
      asPartner(); const { id: claimId } = await claim()
      await expect(review(String(claimId))).rejects.toThrow()
      asFounder(); const { opportunityId } = await review(String(claimId)) as { opportunityId: string }
      await founderMutation({ action: "set_plan_enabled", planKey: "bespoke-v1", enabled: true, reason: "Synthetic" })
      await founderMutation({ action: "set_opportunity_market", id: opportunityId, countryCode: "GB" })
      await founderMutation({ action: "capacity", period: "2026-11-23", hours: 30, commitmentsReviewed: true, rationale: "Synthetic allocation" })
      asPartner(); await partnerMutation({ action: "discovery", id: opportunityId, discovery }); await partnerMutation({ action: "submit_scope", id: opportunityId, summary: "Booking platform, approved separately." })
      asFounder(); await approval(opportunityId)
      const plan = { plan: "bespoke-v1", buildInstalmentsPence: [500000, 500000] }
      await expect(founderMutation({ action: "accept_contract", id: opportunityId, clientId: 2, plan, agreementReference: "Signed" })).rejects.toThrow("attributed existing client")
      await founderMutation({ action: "accept_contract", id: opportunityId, clientId: 1, plan, agreementReference: "Signed" })
      expect((await state.database!.query("select count(*)::int c from expansion_contracts")).rows).toEqual([{ c: 1 }])
    })
  })

  describe("checkpoint 3E: fail-closed market and exclusivity gates", () => {
    const enable = () => founderMutation({ action: "set_plan_enabled", planKey: "standard-v2", enabled: true, reason: "Synthetic" })
    const ready = async (tag: string, extra: Record<string, unknown> = {}) => {
      asPartner(); const rec = await partnerMutation({ action: "register", country: "GB", businessName: `Gate ${tag}`, website: `gate-${tag}.example`, region: "Nottingham", industry: "Plumbing & Heating", ...extra })
      await partnerMutation({ action: "discovery", id: rec.id, discovery }); await partnerMutation({ action: "submit_scope", id: rec.id, summary: "Approved scope." })
      asFounder(); await capacity(30); await approval(String(rec.id)); await enable(); return String(rec.id)
    }
    const accept = (id: string) => founderMutation({ action: "accept_contract", id, clientId: 1, plan: { plan: "standard-v2" }, agreementReference: "Signed" })
    const market = (over: Record<string, unknown> = {}) => founderMutation({ action: "set_market", countryCode: "FR", countryName: "France", status: "approved", planKeys: ["standard-v2"], legalReviewed: true, accountingReviewed: true, privacyReviewed: true, operationsReviewed: true, approvalReference: "SYNTHETIC approval", ...over })
    const exclusivity = (over: Record<string, unknown> = {}) => founderMutation({ action: "create_exclusivity", clientId: 2, sector: "Plumbing and Heating", area: "Nottingham", contractualReference: "SYNTHETIC agreement clause 9", effectiveFrom: "2020-01-01", ...over })

    it("Case M: unknown, unapproved and wrongly-planned markets cannot be accepted; only an approved market can", async () => {
      const unknown = await ready("unknown", { country: undefined }); await expect(accept(unknown)).rejects.toThrow("not approved for this plan")
      const fr = await ready("fr", { country: "FR" }); await expect(accept(fr)).rejects.toThrow("not approved for this plan")
      await market({ status: "under_review", legalReviewed: false, approvalReference: undefined, planKeys: [] }); await expect(accept(fr)).rejects.toThrow("not approved")
      await market({ planKeys: ["bespoke-v1"] }); await expect(accept(fr)).rejects.toThrow("not approved")
      await market({ status: "suspended" }); await expect(accept(fr)).rejects.toThrow("not approved")
      await market(); await accept(fr)
      expect((await state.database!.query("select count(*)::int c from expansion_contracts")).rows).toEqual([{ c: 1 }])
      await founderMutation({ action: "set_opportunity_market", id: unknown, countryCode: "GB" }); await accept(unknown)
    })
    it("refuses to approve a market without every review, a reference and a plan, in the service and the database", async () => {
      for (const over of [{ legalReviewed: false }, { accountingReviewed: false }, { privacyReviewed: false }, { operationsReviewed: false }, { approvalReference: undefined }, { planKeys: [] }]) await expect(market(over)).rejects.toThrow("needs legal, accounting, privacy and operational review")
      await expect(state.database!.query("insert into expansion_markets(country_code,country_name,status) values('DE','Germany','approved')")).rejects.toThrow()
      await expect(market({ countryCode: "FRA" })).rejects.toThrow("two-letter")
    })
    it("Case L: a confirmed restriction blocks acceptance until a founder approves an exception, without disclosing the customer", async () => {
      await state.database!.exec("insert into clients(id,name) values(2,'Confidential Competitor Ltd')")
      const id = await ready("restricted"); await exclusivity()
      await expect(accept(id)).rejects.toThrow("unresolved customer exclusivity review")
      await expect(accept(id)).rejects.not.toThrow(/Confidential Competitor/)
      const exclusivityId = (await state.database!.query<{ id: string }>("select id from expansion_exclusivities")).rows[0].id
      await expect(founderMutation({ action: "decide_exclusivity", id, exclusivityId, decision: "cleared", reference: "x" })).rejects.toThrow("approved exception")
      expect((await founderSnapshot()).exclusivityStatus[id]).toBe("restricted")
      asPartner(); const snap = await partnerSnapshot()
      expect(snap).not.toHaveProperty("commercialChecks"); expect(JSON.stringify(snap)).not.toMatch(/Confidential Competitor|SYNTHETIC agreement|Plumbing and Heating/)
      await expect(founderMutation({ action: "decide_exclusivity", id, exclusivityId, decision: "exception_approved", reference: "x" })).rejects.toThrow()
      asFounder(); await founderMutation({ action: "decide_exclusivity", id, exclusivityId, decision: "exception_approved", reference: "SYNTHETIC founder exception with the protected customer's consent" })
      expect((await founderSnapshot()).exclusivityStatus[id]).toBe("exception_approved")
      await accept(id)
    })
    it("uncertain matches need founder review, ended or unrelated exclusivities do not block, and a customer's own is ignored", async () => {
      await state.database!.exec("insert into clients(id,name) values(2,'Other Customer')")
      const unknownArea = await ready("unknown-area", { region: "" }); await exclusivity()
      await expect(accept(unknownArea)).rejects.toThrow("exclusivity review")
      const exclusivityId = (await state.database!.query<{ id: string }>("select id from expansion_exclusivities")).rows[0].id
      await founderMutation({ action: "decide_exclusivity", id: unknownArea, exclusivityId, decision: "cleared", reference: "SYNTHETIC reviewed: different location confirmed with partner" })
      await accept(unknownArea)
      const unrelated = await ready("dentist", { industry: "Dentistry" }); await accept(unrelated)
      const ended = await ready("ended"); await founderMutation({ action: "end_exclusivity", exclusivityId, reason: "Agreement expired" })
      await expect(founderMutation({ action: "decide_exclusivity", id: ended, exclusivityId, decision: "cleared", reference: "x" })).rejects.toThrow("active exclusivity")
      await accept(ended)
    })
    it("decisions are immutable and exclusivity and market administration are founder-only", async () => {
      await state.database!.exec("insert into clients(id,name) values(2,'Other Customer')")
      const id = await ready("immutable"); await exclusivity()
      const exclusivityId = (await state.database!.query<{ id: string }>("select id from expansion_exclusivities")).rows[0].id
      await founderMutation({ action: "decide_exclusivity", id, exclusivityId, decision: "exception_approved", reference: "SYNTHETIC exception" })
      await expect(state.database!.query("update expansion_exclusivity_decisions set decision='cleared'")).rejects.toThrow("append-only")
      await expect(state.database!.query("delete from expansion_exclusivity_decisions")).rejects.toThrow("append-only")
      asPartner()
      for (const input of [{ action: "set_market", countryCode: "FR", countryName: "France", status: "approved" }, { action: "create_exclusivity", clientId: 1 }, { action: "end_exclusivity", exclusivityId }, { action: "set_opportunity_market", id, countryCode: "GB" }]) await expect(founderMutation(input)).rejects.toThrow()
    })
    it("a partner cannot register an invalid market code", async () => {
      asPartner(); await expect(partnerMutation({ action: "register", country: "United Kingdom", businessName: "Bad", website: "bad.example" })).rejects.toThrow("ISO country code")
    })
    it("a partner-supplied country is not trusted until a founder confirms it", async () => {
      asPartner(); const rec = await partnerMutation({ action: "register", country: "GB", businessName: "Unconfirmed", website: "unconfirmed.example", industry: "X", region: "Y" })
      await partnerMutation({ action: "discovery", id: rec.id, discovery }); await partnerMutation({ action: "submit_scope", id: rec.id, summary: "Scope." })
      asFounder(); await capacity(30)
      await founderMutation({ action: "review_scope", id: rec.id, decision: "approved", period: "2026-11-23", hours: 10, technicalConfirmed: true, commercialConfirmed: true, notes: "Reviewed" }); await enable()
      await expect(accept(String(rec.id))).rejects.toThrow("not approved for this plan")
      await founderMutation({ action: "set_opportunity_market", id: rec.id, countryCode: "GB" }); await accept(String(rec.id))
    })
    it("a decision is final: a second decision conflicts instead of silently succeeding", async () => {
      await state.database!.exec("insert into clients(id,name) values(2,'Other Customer')")
      const id = await ready("final", { region: "" }); await exclusivity()
      const exclusivityId = (await state.database!.query<{ id: string }>("select id from expansion_exclusivities")).rows[0].id
      await founderMutation({ action: "decide_exclusivity", id, exclusivityId, decision: "cleared", reference: "first" })
      await expect(founderMutation({ action: "decide_exclusivity", id, exclusivityId, decision: "exception_approved", reference: "second" })).rejects.toThrow("already recorded")
    })
    it("rejects impossible calendar dates for an exclusivity", async () => {
      await state.database!.exec("insert into clients(id,name) values(2,'Other Customer')")
      await expect(exclusivity({ effectiveFrom: "2026-02-31" })).rejects.toThrow("valid effective dates")
    })
  })
})
