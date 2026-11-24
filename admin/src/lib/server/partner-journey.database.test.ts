import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const FOUNDER = "10000000-0000-4000-8000-000000000001", USER_A = "10000000-0000-4000-8000-000000000002", USER_B = "10000000-0000-4000-8000-000000000003"
const PARTNER_A = "20000000-0000-4000-8000-000000000001", PARTNER_B = "20000000-0000-4000-8000-000000000002"
const state = vi.hoisted(() => ({ database: null as import("@electric-sql/pglite").PGlite | null, actor: { id: "", role: "independent_partner", sessionVersion: 1, active: true, displayName: "A" } }))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/db", () => ({ db: { transaction: async (op: (tx: { execute: (q: SQL) => Promise<unknown> }) => Promise<unknown>) => state.database!.transaction(async tx => op({ execute: async s => { const q = new PgDialect().sqlToQuery(s); return tx.query(q.sql, q.params) } })) } }))
vi.mock("./rbac", () => ({ requireCapability: async (c: string) => {
  if (c === "expansion.partner" && state.actor.role !== "independent_partner") throw new Error("Forbidden capability")
  if (c === "expansion.manage" && state.actor.role !== "owner") throw new Error("Forbidden capability")
  return { ...state.actor }
} }))
vi.mock("./partner-agreements", () => ({ partnerAgreementOverview: async () => ({ state: "accepted" }) }))
vi.mock("./expansion-profiles", () => ({ getPartnerProfile: async () => ({ eligible: false, versions: [], publication: null }) }))
import { acknowledgeOnboardingStep, getOnboardingAdmin, getPartnerJourney, requestToolkitItem } from "./partner-journey"

const q = <T extends object = Record<string, unknown>>(text: string, params: unknown[] = []) => state.database!.query<T>(text, params)
const as = (id: string, role = "independent_partner") => { state.actor = { id, role, sessionVersion: 1, active: true, displayName: id === USER_A ? "Alex" : "Blake" } }

describe("Operation Empower B2.10 partner journey (PGlite)", () => {
  beforeAll(async () => {
    state.database = new PGlite()
    await state.database.exec(`
      create table admin_users(id uuid primary key,role text,active boolean,session_version integer,display_name text);
      create table partner_applications(id serial primary key,name text,status text,submitted_at timestamptz default now(),onboarding_confirmations jsonb default '{}',residence_country text);
      create table expansion_partners(id uuid primary key,user_id uuid references admin_users(id),activated_at timestamptz,agreement_acceptance_id uuid,application_id integer,operating_country text,invitation_hash text,invitation_expires_at timestamptz,agreement_content_version_id uuid);
      create function partner_agreement_current(p_version uuid) returns boolean language sql stable as $$ select false $$;
      create table expansion_resources(id uuid primary key,status text,audience text,title text);
      create table expansion_toolkit_items(id uuid primary key,partner_id uuid not null references expansion_partners(id),item_key text not null,status text not null check (status in ('not_requested','planned','awaiting_approval','in_preparation','available','completed','unavailable')),detail text,resource_id uuid,completed_at timestamptz,updated_by uuid not null references admin_users(id),updated_at timestamptz not null default now(),unique(partner_id,item_key),check (status not in ('available','completed') or (detail is not null and length(trim(detail))>0)));
      create table expansion_referral_codes(partner_id uuid primary key,code text);
      create table expansion_meeting_requests(id uuid primary key,partner_id uuid,meeting_type text,status text);
      create table expansion_research_candidates(id uuid primary key,status text,allocated_partner_id uuid);
      create table expansion_opportunities(id uuid primary key,partner_id uuid);
      create table expansion_markets(country_code text primary key,country_name text,status text);
      create table empower_content_items(id uuid primary key,kind text,audience text,slug text);
      create table empower_content_versions(id uuid primary key,item_id uuid,status text,review_by date,fields jsonb,title text);
      create table empower_academy_completions(id uuid primary key,partner_id uuid,lesson_version_id uuid);
      create table expansion_audit(id serial primary key,actor_id uuid,entity_id text,action text,details jsonb,created_at timestamptz default now());
    `)
    await state.database.exec(readFileSync(new URL("../../../drizzle/0105_partner_onboarding_progress.sql", import.meta.url), "utf8"))
  }, 30000)
  afterAll(async () => { await state.database?.close() })
  beforeEach(async () => {
    vi.stubEnv("PARTNER_ACADEMY_ENABLED", "true")
    await q("truncate expansion_onboarding_progress,expansion_toolkit_items,expansion_audit,empower_academy_completions,empower_content_versions,empower_content_items,expansion_markets,expansion_partners,partner_applications,admin_users restart identity cascade")
    await q("insert into admin_users values($1,'owner',true,1,'Founder'),($2,'independent_partner',true,1,'Alex'),($3,'independent_partner',true,1,'Blake')", [FOUNDER, USER_A, USER_B])
    await q("insert into expansion_partners values($1,$2,now(),null),($3,$4,now(),null)", [PARTNER_A, USER_A, PARTNER_B, USER_B])
    await q("insert into expansion_markets values('GB','United Kingdom','approved'),('US','United States','under_review')")
  })

  it("persists acknowledgements server-side and survives a fresh read (sign out and back in)", async () => {
    as(USER_A)
    expect((await getPartnerJourney()).completed).toBe(1) // agreement accepted (mocked), nothing acknowledged
    await acknowledgeOnboardingStep({ step: "how_you_earn" })
    await acknowledgeOnboardingStep({ step: "how_you_earn" }) // idempotent
    await acknowledgeOnboardingStep({ step: "commercial_boundaries" })
    await acknowledgeOnboardingStep({ step: "approved_markets" })
    const j = await getPartnerJourney()
    expect(j).toMatchObject({ completed: 4, total: 4, percent: 100, displayName: "Alex" })
    expect(j.required.find((s) => s.key === "approved_markets")!.detail).toContain("United Kingdom")
    expect(j.required.find((s) => s.key === "approved_markets")!.detail).not.toContain("United States")
    expect((await q("select count(*)::int n from expansion_audit where action='onboarding_step_acknowledged'")).rows[0]).toEqual({ n: 4 })
  })

  it("isolates partners: one partner's progress never appears for another", async () => {
    as(USER_A); await acknowledgeOnboardingStep({ step: "how_you_earn" })
    as(USER_B); expect((await getPartnerJourney()).required.find((s) => s.key === "how_you_earn")!.status).toBe("action_required")
  })

  it("rejects unknown steps and refuses to edit or delete history", async () => {
    as(USER_A)
    await expect(acknowledgeOnboardingStep({ step: "agreement" })).rejects.toThrow(/Choose one of/)
    await acknowledgeOnboardingStep({ step: "how_you_earn" })
    await expect(q("update expansion_onboarding_progress set completed_at=now() - interval '1 day'")).rejects.toThrow(/append-only/)
    await expect(q("delete from expansion_onboarding_progress")).rejects.toThrow(/append-only/)
    await expect(q("insert into expansion_onboarding_progress(partner_id,step_key,completed_by) values($1,'invented',$2)", [PARTNER_A, USER_A])).rejects.toThrow()
  })

  it("lets a partner request a manual item once, as awaiting approval, and never overwrite a founder record", async () => {
    as(USER_A)
    expect(await requestToolkitItem({ itemKey: "email" })).toEqual({ itemKey: "email", status: "awaiting_approval" })
    await expect(requestToolkitItem({ itemKey: "email" })).rejects.toThrow(/already been requested/)
    await expect(requestToolkitItem({ itemKey: "academy" })).rejects.toThrow(/cannot be requested/)
    await q("insert into expansion_toolkit_items(id,partner_id,item_key,status,detail,completed_at,updated_by) values(gen_random_uuid(),$1,'circlecard','completed','Issued in person',now(),$2)", [PARTNER_A, FOUNDER])
    await expect(requestToolkitItem({ itemKey: "circlecard" })).rejects.toThrow(/already been requested/)
    expect((await q("select status from expansion_toolkit_items where item_key='circlecard'")).rows[0]).toEqual({ status: "completed" })
    const j = await getPartnerJourney()
    expect(j.tools.find((t) => t.key === "email")!.status).toBe("awaiting_setup")
    expect(j.tools.find((t) => t.key === "circlecard")!.status).toBe("completed")
  })

  it("counts only published, in-date content", async () => {
    as(USER_A)
    await q(`insert into empower_content_items values('30000000-0000-4000-8000-000000000001','course','partner_only','c1'),('30000000-0000-4000-8000-000000000002','course','partner_only','c2'),('30000000-0000-4000-8000-000000000003','course','partner_only','c3')`)
    await q(`insert into empower_content_versions values(gen_random_uuid(),'30000000-0000-4000-8000-000000000001','published',current_date+30,'{}'),(gen_random_uuid(),'30000000-0000-4000-8000-000000000002','draft',current_date+30,'{}'),(gen_random_uuid(),'30000000-0000-4000-8000-000000000003','published',current_date-1,'{}')`)
    expect((await getPartnerJourney()).tools.find((t) => t.key === "academy")).toMatchObject({ status: "available", detail: "1 course ready. Learning is optional." })
  })

  it("restricts the founder checklist to founders and reports each partner's progress", async () => {
    as(USER_A); await acknowledgeOnboardingStep({ step: "how_you_earn" }); await requestToolkitItem({ itemKey: "business_card" })
    await expect(getOnboardingAdmin()).rejects.toThrow("Forbidden capability")
    as(FOUNDER, "owner")
    await expect(getPartnerJourney()).rejects.toThrow("Forbidden capability")
    const admin = await getOnboardingAdmin()
    expect(admin.requiredSteps).toBe(4)
    expect(admin.partners.find((p) => p.name === "Alex")).toMatchObject({ completed: 1, agreementAccepted: false, toolkitRequests: 1 })
    expect(admin.partners.find((p) => p.name === "Blake")).toMatchObject({ completed: 0 })
    expect(admin.queue).toMatchObject({ toolkit_requests: 1, markets_approved: 1, markets_under_review: 1, agreements_current: 0, applications_to_review: 0 })
    await q("insert into partner_applications(name,status,onboarding_confirmations,residence_country) values('Casey','under_review','{}','GB'),('Dana','onboarding','{\"agreement\":true,\"legal\":true,\"independentStatus\":true,\"operations\":true}','GB'),('Old','declined','{}','GB')")
    await q("insert into expansion_partners(id,application_id,operating_country,invitation_hash,invitation_expires_at) values('20000000-0000-4000-8000-000000000009',2,'GB','h',now()-interval '1 hour')")
    const later = await getOnboardingAdmin()
    expect(later.queue).toMatchObject({ applications_to_review: 1, applicants_to_onboard: 1 })
    const byName = (list: unknown[][]) => [...list].sort((x, y) => String(x[0]).localeCompare(String(y[0])))
    expect(byName(later.applicants.map((a) => [a.name, a.status, a.confirmations, a.invitation, a.market]))).toEqual([["Casey", "under_review", 0, "not_issued", "approved"], ["Dana", "onboarding", 4, "expired", "approved"]])
  })
})
