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
async function register(suffix = "one") { return partnerMutation({ action: "register", businessName: `Example ${suffix}`, website: `https://www.example-${suffix}.co.uk/path`, contactName: "Director", contactEmail: `director@example-${suffix}.co.uk`, region: "Nottingham", industry: "Local services" }) }
async function submitted(suffix = "one") {
  asPartner()
  const record = await register(suffix)
  await partnerMutation({ action: "discovery", id: record.id, discovery })
  await partnerMutation({ action: "submit_scope", id: record.id, summary: "Five approved service pages and enquiry form; integrations subject to technical review." })
  return String(record.id)
}
const capacity = (hours = 10) => founderMutation({ action: "capacity", period: "2026-11-23", hours, commitmentsReviewed: true, rationale: "Remaining allocation after existing projects, retainers and founder availability" })
const approval = (id: string, hours = 10) => founderMutation({ action: "review_scope", id, decision: "approved", period: "2026-11-23", hours, technicalConfirmed: true, commercialConfirmed: true, notes: "Technical feasibility, effort, scope, migration risk, price and delivery reviewed" })

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
  }, 30000)
  beforeEach(async () => {
    asFounder()
    await state.database!.exec("truncate expansion_audit,expansion_suppressions,expansion_resources,expansion_contracts,expansion_reservations,expansion_capacity,expansion_opportunities,expansion_partners,commercial_contracts,commercial_contacts,prospects,clients,partner_applications,admin_users restart identity cascade")
    await state.database!.query("insert into admin_users values($1,'owner',true,1,'Founder','founder@example.invalid'),($2,'independent_partner',true,1,'Partner A','a@example.invalid'),($3,'independent_partner',true,1,'Partner B','b@example.invalid')", [FOUNDER, USER, OTHER_USER])
    await state.database!.exec("insert into partner_applications(name,email,status) values('Partner A','a@example.invalid','activated'),('Partner B','b@example.invalid','activated'); insert into clients(id,name) values(1,'Canonical client');")
    await state.database!.query("insert into expansion_partners(id,user_id,application_id,agreement_version,confirmed_at,activated_at) values($1,$2,1,'test-approved-v1',now(),now()),($3,$4,2,'test-approved-v1',now(),now())", [PARTNER, USER, OTHER_PARTNER, OTHER_USER])
  })
  afterAll(async () => { await state.database?.close() })

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
})
