import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const F1 = "10000000-0000-4000-8000-000000000001", F2 = "10000000-0000-4000-8000-000000000005", USER_A = "10000000-0000-4000-8000-000000000002", USER_B = "10000000-0000-4000-8000-000000000003"
const PA = "20000000-0000-4000-8000-000000000001", PB = "20000000-0000-4000-8000-000000000002"
const OPP_SCOPE = "30000000-0000-4000-8000-000000000001", OPP_STALE = "30000000-0000-4000-8000-000000000002", OPP_WON = "30000000-0000-4000-8000-000000000003", OPP_APPROVED = "30000000-0000-4000-8000-000000000004"
const state = vi.hoisted(() => ({ database: null as import("@electric-sql/pglite").PGlite | null, actor: { id: "", role: "owner", sessionVersion: 1, active: true } }))
vi.mock("@/lib/db", () => ({ db: { transaction: async (op: (tx: { execute: (q: SQL) => Promise<unknown> }) => Promise<unknown>) => state.database!.transaction(async tx => op({ execute: async s => { const q = new PgDialect().sqlToQuery(s); return tx.query(q.sql, q.params) } })) } }))
vi.mock("./rbac", () => ({ requireCapability: async (c: string) => {
  if ((c === "expansion.manage" && !["owner", "administrator"].includes(state.actor.role)) || (c === "expansion.partner" && state.actor.role !== "independent_partner")) throw new Error("Forbidden capability")
  return { ...state.actor }
} }))
// The Commission centre's own summary, stubbed with fixed figures: the command centre must pass them through unchanged.
vi.mock("./expansion-finance", () => ({ getExpansionFinance: async () => ({ partners: [{ id: "20000000-0000-4000-8000-000000000001", earned_pence: "70500", paid_pence: "0" }], payments: [], payouts: [] }) }))
import { assignFounder, founderCommandCentre } from "./sales-command"

const q = (sql: string, params: unknown[] = []) => state.database!.query(sql, params)
const asFounder = (id = F1) => { state.actor = { id, role: "owner", sessionVersion: 1, active: true } }
const NOW = new Date("2026-11-22T12:00:00Z")
const ago = (days: number) => new Date(NOW.getTime() - days * 86400000).toISOString()

describe("Operation Ascend B2.3 founder sales command centre (PGlite)", () => {
  beforeAll(async () => {
    state.database = new PGlite()
    await state.database.exec(`
      create function commercial_history_immutable() returns trigger language plpgsql as $$ begin raise exception 'Commercial history is append-only'; end $$;
      create table admin_users(id uuid primary key,role text,active boolean,session_version integer,display_name text);
      create table expansion_partners(id uuid primary key,user_id uuid references admin_users(id),activated_at timestamptz,operating_country text);
      create table prospects(id integer primary key,business_name text);
      create table expansion_opportunities(id uuid primary key,partner_id uuid references expansion_partners(id),prospect_id integer,status text,scope jsonb default '{}',updated_at timestamptz default now());
      create table expansion_meeting_requests(id uuid primary key,partner_id uuid,opportunity_id uuid,meeting_type text,status text,created_at timestamptz default now());
      create table expansion_audit(id serial primary key,actor_id uuid,entity_id text,action text,details jsonb,created_at timestamptz default now());
      create table expansion_opportunity_interactions(id uuid primary key,opportunity_id uuid,created_at timestamptz default now());
      create table partner_applications(id serial primary key,name text,status text,submitted_at timestamptz default now());
      create table partner_notifications(id uuid primary key,kind text,status text,partner_id uuid,application_id integer,updated_at timestamptz default now());
    `)
    await state.database.exec(readFileSync(new URL("../../../drizzle/0100_ascend_founder_assignments.sql", import.meta.url), "utf8"))
  }, 30000)
  beforeEach(async () => {
    vi.stubEnv("FOUNDER_SALES_COMMAND_ENABLED", "true")
    await q("truncate expansion_founder_assignments,expansion_audit,expansion_opportunity_interactions,expansion_meeting_requests,partner_notifications,partner_applications,expansion_opportunities,prospects,expansion_partners,admin_users restart identity cascade")
    await q("insert into admin_users values($1,'owner',true,1,'Founder One'),($2,'administrator',true,1,'Founder Two'),($3,'independent_partner',true,1,'Zara Partner'),($4,'independent_partner',true,1,'Adam Partner')", [F1, F2, USER_A, USER_B])
    await q("insert into expansion_partners values($1,$2,now(),'GB'),($3,$4,null,null)", [PA, USER_A, PB, USER_B])
    await q("insert into prospects values(1,'Scope Co'),(2,'Quiet Co'),(3,'Won Co'),(4,'Approved Co')")
    await q("insert into expansion_opportunities(id,partner_id,prospect_id,status,scope,updated_at) values($1,$2,1,'scope_submitted','{\"technicalFlags\":[\"migration\"]}',$3),($4,$2,2,'discovery','{}',$5),($6,$2,3,'contract_accepted','{}',$3),($7,$2,4,'approved','{}',$8)",
      [OPP_SCOPE, PA, ago(2), OPP_STALE, ago(30), OPP_WON, OPP_APPROVED, ago(10)])
    await q("insert into expansion_meeting_requests values(gen_random_uuid(),$1,$2,'technical_scoping','requested',$3),(gen_random_uuid(),$1,null,'joint_sales','under_review',$4)", [PA, OPP_SCOPE, ago(1), ago(3)])
    await q("insert into partner_applications(name,status,submitted_at) values('Applicant One','submitted',$1),('Done','activated',$1)", [ago(5)])
    await q("insert into partner_notifications values(gen_random_uuid(),'invitation','failed',$1,null,$2),(gen_random_uuid(),'activated','sent',$1,null,$2)", [PA, ago(1)])
    asFounder()
  })
  afterEach(() => { vi.unstubAllEnvs() })
  afterAll(async () => { await state.database?.close() })

  it("is off by default and founder-only", async () => {
    vi.stubEnv("FOUNDER_SALES_COMMAND_ENABLED", "")
    await expect(founderCommandCentre(NOW)).rejects.toMatchObject({ status: 404 })
    vi.stubEnv("FOUNDER_SALES_COMMAND_ENABLED", "true")
    state.actor = { id: USER_A, role: "independent_partner", sessionVersion: 1, active: true }
    await expect(founderCommandCentre(NOW)).rejects.toThrow("Forbidden")
    asFounder(); await q("update admin_users set active=false where id=$1", [F1])
    await expect(founderCommandCentre(NOW)).rejects.toMatchObject({ status: 403 })
  })

  it("counts real records and builds a queue in the published order with real destinations", async () => {
    const c = await founderCommandCentre(NOW)
    expect(c.overview).toMatchObject({ activeOpportunities: 3, awaitingReview: 1, technicalScoping: 1, meetingsToConfirm: 1, assistanceRequests: 1, proposalsAwaitingAction: 1,
      confirmedOutcomes: 1, stalled: 1, applicationsToReview: 1, invitedNotActivated: 1, failedNotifications: 1 })
    expect(c.queue.map((i) => i.kind)).toEqual(["assistance", "meeting", "scope_review", "notification_failed", "application", "proposal_follow_up", "stalled"])
    expect(c.queue[0]).toMatchObject({ title: "Scope Co", href: `/expansion?tab=pipeline&opportunity=${OPP_SCOPE}`, ageDays: 1 })
    expect(c.queue[1]).toMatchObject({ title: "No linked prospect", href: "/expansion?tab=operations" })
    expect(c.queue.find((i) => i.kind === "scope_review")?.tags).toEqual(["technical"])
    expect(c.queue.find((i) => i.kind === "stalled")).toMatchObject({ title: "Quiet Co", ageDays: 30 })
    for (const i of c.queue) expect(i.href).toMatch(/^\/expansion\?tab=(pipeline&opportunity=[0-9a-f-]{36}|operations|recruitment)$/)
  })

  it("an interaction or audit entry stops an opportunity counting as stalled", async () => {
    await q("insert into expansion_opportunity_interactions values(gen_random_uuid(),$1,$2)", [OPP_STALE, ago(3)])
    expect((await founderCommandCentre(NOW)).overview.stalled).toBe(0)
  })

  it("lists partners alphabetically with the Commission centre's figures and no learning data", async () => {
    const c = await founderCommandCentre(NOW)
    expect(c.partners.map((p) => p.name)).toEqual(["Adam Partner", "Zara Partner"])
    expect(c.partners[1]).toMatchObject({ status: "Active", region: "GB", openOpportunities: 3, confirmedOutcomes: 1, openHelpRequests: 1, commission: { earnedPence: "70500", paidPence: "0" } })
    expect(c.partners[0]).toMatchObject({ status: "Invited", commission: { earnedPence: "0", paidPence: "0" } })
    expect(JSON.stringify(c)).not.toMatch(/academy|lesson|learning_progress/i)
  })

  it("assigns, reassigns and releases with history, reason and audit; partner ownership never changes", async () => {
    const first = await assignFounder({ opportunityId: OPP_SCOPE, assigneeId: F2, reason: "Covers technical scoping", expectedCurrentId: null })
    let c = await founderCommandCentre(NOW)
    expect(c.queue.find((i) => i.kind === "scope_review")?.assignment).toMatchObject({ id: first.id, assigneeName: "Founder Two" })
    await expect(assignFounder({ opportunityId: OPP_SCOPE, assigneeId: F1, reason: "Stale view", expectedCurrentId: null })).rejects.toMatchObject({ status: 409 })
    await expect(assignFounder({ opportunityId: OPP_SCOPE, assigneeId: F2, reason: "Same again", expectedCurrentId: first.id })).rejects.toMatchObject({ status: 409 })
    const second = await assignFounder({ opportunityId: OPP_SCOPE, assigneeId: F1, reason: "Founder Two on leave", expectedCurrentId: first.id })
    await assignFounder({ opportunityId: OPP_SCOPE, assigneeId: null, reason: "Released after review", expectedCurrentId: second.id })
    c = await founderCommandCentre(NOW)
    expect(c.queue.find((i) => i.kind === "scope_review")?.assignment).toMatchObject({ assigneeId: null })
    expect((await q("select count(*)::int n from expansion_founder_assignments")).rows[0]).toEqual({ n: 3 })
    expect((await q("select count(*)::int n from expansion_audit where action='founder_assignment' and entity_id=$1", [OPP_SCOPE])).rows[0]).toEqual({ n: 3 })
    expect((await q("select partner_id from expansion_opportunities where id=$1", [OPP_SCOPE])).rows[0]).toEqual({ partner_id: PA })
    await expect(q("update expansion_founder_assignments set reason='edited'")).rejects.toThrow("append-only")
    await expect(q("delete from expansion_founder_assignments")).rejects.toThrow("append-only")
  })

  it("admits exactly one of two simultaneous assignments made from the same view", async () => {
    const results = await Promise.allSettled([
      assignFounder({ opportunityId: OPP_STALE, assigneeId: F1, reason: "Mine", expectedCurrentId: null }),
      assignFounder({ opportunityId: OPP_STALE, assigneeId: F2, reason: "No, mine", expectedCurrentId: null }),
    ])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect((await q("select count(*)::int n from expansion_founder_assignments where opportunity_id=$1", [OPP_STALE])).rows[0]).toEqual({ n: 1 })
  })

  it("the database refuses a second root or a cross-opportunity chain even without the service", async () => {
    await assignFounder({ opportunityId: OPP_SCOPE, assigneeId: F1, reason: "First", expectedCurrentId: null })
    await expect(q("insert into expansion_founder_assignments(id,opportunity_id,assignee_id,assigned_by,reason) values(gen_random_uuid(),$1,$2,$2,'second root')", [OPP_SCOPE, F2])).rejects.toThrow()
    const [root] = (await q("select id from expansion_founder_assignments where opportunity_id=$1", [OPP_SCOPE])).rows as { id: string }[]
    await expect(q("insert into expansion_founder_assignments(id,opportunity_id,assignee_id,assigned_by,reason,supersedes_id) values(gen_random_uuid(),$1,$2,$2,'cross',$3)", [OPP_STALE, F2, root.id])).rejects.toThrow("same opportunity")
  })

  it("refuses partners, inactive or non-founder assignees, and unknown opportunities", async () => {
    await expect(assignFounder({ opportunityId: OPP_SCOPE, assigneeId: USER_A, reason: "Partner", expectedCurrentId: null })).rejects.toThrow("active founder")
    await expect(assignFounder({ opportunityId: "30000000-0000-4000-8000-00000000ffff", assigneeId: F1, reason: "Missing", expectedCurrentId: null })).rejects.toMatchObject({ status: 404 })
    state.actor = { id: USER_A, role: "independent_partner", sessionVersion: 1, active: true }
    await expect(assignFounder({ opportunityId: OPP_SCOPE, assigneeId: F1, reason: "Partner tries", expectedCurrentId: null })).rejects.toThrow("Forbidden")
    expect((await q("select count(*)::int n from expansion_founder_assignments")).rows[0]).toEqual({ n: 0 })
  })
})
