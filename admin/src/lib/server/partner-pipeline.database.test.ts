import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const FOUNDER = "10000000-0000-4000-8000-000000000001", USER_A = "10000000-0000-4000-8000-000000000002", USER_B = "10000000-0000-4000-8000-000000000003", USER_S = "10000000-0000-4000-8000-000000000004"
const PARTNER_A = "20000000-0000-4000-8000-000000000001", PARTNER_B = "20000000-0000-4000-8000-000000000002", PARTNER_S = "20000000-0000-4000-8000-000000000004"
const OPP_A = "30000000-0000-4000-8000-000000000001", OPP_B = "30000000-0000-4000-8000-000000000002", OPP_HIDDEN = "30000000-0000-4000-8000-000000000003"
const state = vi.hoisted(() => ({ database: null as import("@electric-sql/pglite").PGlite | null, actor: { id: "", role: "independent_partner", sessionVersion: 1, active: true } }))
vi.mock("@/lib/db", () => ({ db: { transaction: async (op: (tx: { execute: (q: SQL) => Promise<unknown> }) => Promise<unknown>) => state.database!.transaction(async tx => op({ execute: async s => { const q = new PgDialect().sqlToQuery(s); return tx.query(q.sql, q.params) } })) } }))
vi.mock("./rbac", () => ({ requireCapability: async (c: string) => {
  if (c === "expansion.partner" && state.actor.role !== "independent_partner") throw new Error("Forbidden capability")
  return { ...state.actor }
} }))
import { partnerOpportunityDetail, partnerPipeline, recordInteraction, scheduleFollowUp } from "./partner-pipeline"

const q = <T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []) => state.database!.query<T>(sql, params)
const as = (id: string, role = "independent_partner") => { state.actor = { id, role, sessionVersion: 1, active: true } }
const NOW = new Date()
const day = (offset: number) => new Date(NOW.getTime() + offset * 86400000).toISOString().slice(0, 10)

describe("Operation Ascend B2.1 partner pipeline (PGlite)", () => {
  beforeAll(async () => {
    state.database = new PGlite()
    await state.database.exec(`
      create function commercial_history_immutable() returns trigger language plpgsql as $$ begin raise exception 'Commercial history is append-only'; end $$;
      create table admin_users(id uuid primary key,role text,active boolean,session_version integer,display_name text);
      create table expansion_partners(id uuid primary key,user_id uuid references admin_users(id),activated_at timestamptz);
      create table prospects(id integer primary key,business_name text,website_url text,industry text,location text,next_follow_up_at timestamptz,updated_at timestamptz default now());
      create table expansion_research_candidates(id uuid primary key,status text,allocated_partner_id uuid);
      create table expansion_opportunities(id uuid primary key,partner_id uuid references expansion_partners(id),prospect_id integer references prospects(id),status text not null default 'registered',discovery jsonb not null default '{}',research_candidate_id uuid,created_at timestamptz default now(),updated_at timestamptz default now());
      create table expansion_meeting_requests(id uuid primary key,partner_id uuid,opportunity_id uuid,meeting_type text,status text,confirmed_start timestamptz,proposed_start timestamptz,created_at timestamptz default now());
      create table expansion_contracts(id uuid primary key,opportunity_id uuid);
      create table expansion_payment_events(id uuid primary key,contract_id uuid,net_pence bigint,reverses_event_id uuid,created_at timestamptz default now());
      create table expansion_audit(id serial primary key,actor_id uuid,entity_id text,action text,details jsonb,created_at timestamptz default now());
    `)
    await state.database.exec(readFileSync(new URL("../../../drizzle/0098_ascend_pipeline_interactions.sql", import.meta.url), "utf8"))
  }, 30000)
  beforeEach(async () => {
    vi.stubEnv("PARTNER_PIPELINE_ENABLED", "true")
    await q("truncate expansion_opportunity_interactions,expansion_audit,expansion_payment_events,expansion_contracts,expansion_meeting_requests,expansion_opportunities,expansion_research_candidates,prospects,expansion_partners,admin_users restart identity cascade")
    await q("insert into admin_users values($1,'owner',true,1,'Founder'),($2,'independent_partner',true,1,'A'),($3,'independent_partner',true,1,'B'),($4,'independent_partner',false,1,'Suspended')", [FOUNDER, USER_A, USER_B, USER_S])
    await q("insert into expansion_partners values($1,$2,now()),($3,$4,now()),($5,$6,now())", [PARTNER_A, USER_A, PARTNER_B, USER_B, PARTNER_S, USER_S])
    await q("insert into prospects(id,business_name,website_url,industry) values(1,'Alpha Plumbing','https://alpha.example','Trades'),(2,'Bravo Bakery','https://bravo.example','Food'),(3,'Hidden Research','https://hidden.example',null)")
    await q("insert into expansion_research_candidates values('40000000-0000-4000-8000-000000000001','offered',null)")
    await q("insert into expansion_opportunities(id,partner_id,prospect_id,status) values($1,$2,1,'scope_submitted'),($3,$4,2,'registered')", [OPP_A, PARTNER_A, OPP_B, PARTNER_B])
    await q("insert into expansion_opportunities(id,partner_id,prospect_id,status,research_candidate_id) values($1,$2,3,'registered','40000000-0000-4000-8000-000000000001')", [OPP_HIDDEN, PARTNER_A])
    await q("insert into expansion_audit(actor_id,entity_id,action,details) values($1,$2,'prospect_registered','{}'),($3,$2,'scope_reviewed','{\"decision\":\"more_information\",\"notes\":\"INTERNAL margin note\"}'),($3,$2,'opportunity_sector_classified','{\"sector\":\"protected\"}')", [USER_A, OPP_A, FOUNDER])
    await q("insert into expansion_contracts values('50000000-0000-4000-8000-000000000001',$1)", [OPP_A])
    await q("insert into expansion_payment_events(id,contract_id,net_pence) values('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',100000)")
    as(USER_A)
  })
  afterEach(() => { vi.unstubAllEnvs() })
  afterAll(async () => { await state.database?.close() })

  it("is off by default", async () => {
    vi.stubEnv("PARTNER_PIPELINE_ENABLED", "")
    await expect(partnerPipeline()).rejects.toThrow("not available")
    await expect(partnerOpportunityDetail(OPP_A)).rejects.toThrow("not available")
    await expect(recordInteraction({ opportunityId: OPP_A, kind: "call", summary: "x", occurredOn: day(0) })).rejects.toThrow("not available")
  })

  it("shows a partner only their own opportunities, never unallocated research", async () => {
    const a = await partnerPipeline()
    expect(a.cards.map((c) => c.id)).toEqual([OPP_A])
    expect(a.cards[0]).toMatchObject({ column: "review", statusLabel: "Under review", transitions: [] })
    as(USER_B)
    expect((await partnerPipeline()).cards.map((c) => c.id)).toEqual([OPP_B])
  })

  it("treats another partner's opportunity exactly like a missing one", async () => {
    as(USER_B)
    for (const id of [OPP_A, OPP_HIDDEN, "30000000-0000-4000-8000-00000000ffff", "not-a-uuid", "' or 1=1 --"]) await expect(partnerOpportunityDetail(id)).rejects.toMatchObject({ message: "Opportunity not found.", status: 404 })
    await expect(recordInteraction({ opportunityId: OPP_A, kind: "call", summary: "probe", occurredOn: day(0) })).rejects.toMatchObject({ status: 404 })
    await expect(scheduleFollowUp({ opportunityId: OPP_A, date: day(3) })).rejects.toMatchObject({ status: 404 })
    expect((await q("select count(*)::int c from expansion_opportunity_interactions")).rows[0]).toEqual({ c: 0 })
    expect((await q("select next_follow_up_at from prospects where id=1")).rows[0]).toEqual({ next_follow_up_at: null })
  })

  it("refuses suspended partners and non-partner roles", async () => {
    as(USER_S)
    await expect(partnerPipeline()).rejects.toMatchObject({ status: 403 })
    as(FOUNDER, "owner")
    await expect(partnerPipeline()).rejects.toThrow("Forbidden")
  })

  it("builds a partner-safe timeline: no founder notes, no classification, no amounts", async () => {
    const d = await partnerOpportunityDetail(OPP_A)
    expect(d.timeline.map((t) => t.label).sort()).toEqual(["Prospect registered", "Qualifying payment verified", "ScaleSmiths asked for more information"])
    const text = JSON.stringify(d)
    expect(text).not.toMatch(/INTERNAL|margin|protected|100000/)
    expect(d.transitions.allowed).toEqual([])
    expect(d.transitions.blocked.find((b) => b.to === "withdrawn")?.reason).toMatch(/founder decision/)
  })

  it("records interactions append-only, audits without the text, and never changes the opportunity", async () => {
    const before = (await q("select status,updated_at from expansion_opportunities where id=$1", [OPP_A])).rows[0]
    await recordInteraction({ opportunityId: OPP_A, kind: "call", summary: "  Spoke to the owner <script>alert(1)</script>  ", occurredOn: day(0) })
    const [row] = (await q<{ summary: string; partner_id: string }>("select summary,partner_id from expansion_opportunity_interactions")).rows
    expect(row).toEqual({ summary: "Spoke to the owner <script>alert(1)</script>", partner_id: PARTNER_A })
    const [auditRow] = (await q<{ details: Record<string, unknown> }>("select details from expansion_audit where action='interaction_recorded'")).rows
    expect(JSON.stringify(auditRow.details)).not.toMatch(/Spoke/)
    expect((await q("select status,updated_at from expansion_opportunities where id=$1", [OPP_A])).rows[0]).toEqual(before)
    await expect(q("update expansion_opportunity_interactions set summary='edited'")).rejects.toThrow("append-only")
    await expect(q("delete from expansion_opportunity_interactions")).rejects.toThrow("append-only")
    expect((await partnerOpportunityDetail(OPP_A)).interactions).toHaveLength(1)
  })

  it("validates interaction input", async () => {
    await expect(recordInteraction({ opportunityId: OPP_A, kind: "sms", summary: "x", occurredOn: day(0) })).rejects.toThrow("type of interaction")
    await expect(recordInteraction({ opportunityId: OPP_A, kind: "call", summary: "   ", occurredOn: day(0) })).rejects.toThrow("Summary")
    await expect(recordInteraction({ opportunityId: OPP_A, kind: "call", summary: "x".repeat(2001), occurredOn: day(0) })).rejects.toThrow("Summary")
    await expect(recordInteraction({ opportunityId: OPP_A, kind: "call", summary: "x", occurredOn: day(5) })).rejects.toThrow("future")
    await expect(recordInteraction({ opportunityId: OPP_A, kind: "call", summary: "x", occurredOn: "2026-02-30" })).rejects.toThrow("valid")
  })

  it("the database refuses an interaction attached to another partner's opportunity", async () => {
    await expect(q("insert into expansion_opportunity_interactions(id,opportunity_id,partner_id,kind,summary,occurred_on,created_by) values(gen_random_uuid(),$1,$2,'note','x',current_date,$3)", [OPP_B, PARTNER_A, USER_A])).rejects.toThrow("must own")
  })

  it("sets and clears a follow-up reminder on the partner's own prospect, and refuses closed opportunities", async () => {
    as(USER_B)
    await scheduleFollowUp({ opportunityId: OPP_B, date: day(3) })
    expect((await partnerPipeline()).cards[0].followUp?.slice(0, 10)).toBe(day(3))
    await scheduleFollowUp({ opportunityId: OPP_B, date: "" })
    expect((await partnerPipeline()).cards[0].followUp).toBeNull()
    await expect(scheduleFollowUp({ opportunityId: OPP_B, date: day(400) })).rejects.toThrow("twelve months")
    await q("update expansion_opportunities set status='withdrawn' where id=$1", [OPP_B])
    await expect(scheduleFollowUp({ opportunityId: OPP_B, date: day(3) })).rejects.toMatchObject({ status: 409 })
    expect((await q("select count(*)::int c from expansion_audit where action='follow_up_scheduled'")).rows[0]).toEqual({ c: 2 })
  })

  it("surfaces meetings and attention from real records only", async () => {
    as(USER_B)
    expect((await partnerPipeline()).cards[0].attention.map((a) => a.key)).toEqual(["discovery"])
    await q("insert into expansion_meeting_requests(id,partner_id,opportunity_id,meeting_type,status) values(gen_random_uuid(),$1,$2,'commercial_assistance','alternative_proposed')", [PARTNER_B, OPP_B])
    const [card] = (await partnerPipeline()).cards
    expect(card.meeting).toBe("awaiting_you")
    expect(card.attention.map((a) => a.key)).toEqual(["meeting", "discovery"])
  })
})
