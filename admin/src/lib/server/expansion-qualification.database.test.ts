import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const FOUNDER = "10000000-0000-4000-8000-000000000001", USER_A = "10000000-0000-4000-8000-000000000002", PARTNER_A = "20000000-0000-4000-8000-000000000001"
const OPP = "30000000-0000-4000-8000-000000000001"
const state = vi.hoisted(() => ({ database: null as import("@electric-sql/pglite").PGlite | null, actor: { id: "", role: "owner", sessionVersion: 1, active: true } }))
vi.mock("@/lib/db", () => ({ db: { transaction: async (op: (tx: { execute: (q: SQL) => Promise<unknown> }) => Promise<unknown>) => state.database!.transaction(async tx => op({ execute: async s => { const q = new PgDialect().sqlToQuery(s); return tx.query(q.sql, q.params) } })) } }))
vi.mock("./rbac", () => ({ requireCapability: async (c: string) => {
  if ((c === "expansion.manage" && state.actor.role !== "owner") || (c === "expansion.partner" && state.actor.role !== "independent_partner")) throw new Error("Forbidden capability")
  return { ...state.actor }
} }))
import { founderQualification } from "./expansion-qualification"

const q = (sql: string, params: unknown[] = []) => state.database!.query(sql, params)
const DISCOVERY = { objectives: "Win more local enquiries online", pages: "Home, services, contact", timescale: "Spring", ownerAge: "62" }

describe("Operation Ascend B2.2 founder qualification inspection (PGlite)", () => {
  beforeAll(async () => {
    state.database = new PGlite()
    await state.database.exec(`
      create table admin_users(id uuid primary key,role text,active boolean,session_version integer,display_name text);
      create table expansion_partners(id uuid primary key,user_id uuid references admin_users(id));
      create table prospects(id integer primary key,business_name text,website_url text);
      create table expansion_opportunities(id uuid primary key,partner_id uuid,prospect_id integer,status text,discovery jsonb,scope_version integer default 0);
    `)
  }, 30000)
  beforeEach(async () => {
    vi.stubEnv("PARTNER_QUALIFICATION_ENABLED", "true")
    await q("truncate expansion_opportunities,prospects,expansion_partners,admin_users")
    await q("insert into admin_users values($1,'owner',true,1,'Founder'),($2,'independent_partner',true,1,'Partner A')", [FOUNDER, USER_A])
    await q("insert into expansion_partners values($1,$2)", [PARTNER_A, USER_A])
    await q("insert into prospects values(1,'Alpha Plumbing','https://alpha.example')")
    await q("insert into expansion_opportunities(id,partner_id,prospect_id,status,discovery) values($1,$2,1,'discovery',$3)", [OPP, PARTNER_A, JSON.stringify(DISCOVERY)])
    state.actor = { id: FOUNDER, role: "owner", sessionVersion: 1, active: true }
  })
  afterEach(() => { vi.unstubAllEnvs() })
  afterAll(async () => { await state.database?.close() })

  it("is off by default", async () => {
    vi.stubEnv("PARTNER_QUALIFICATION_ENABLED", "")
    await expect(founderQualification(OPP)).rejects.toMatchObject({ status: 404 })
  })
  it("shows founders the factors and how each was derived, ignoring personal fields", async () => {
    const r = await founderQualification(OPP)
    expect(r.opportunity).toMatchObject({ businessName: "Alpha Plumbing", partnerName: "Partner A", statusLabel: "Discovery in progress" })
    expect(Object.fromEntries(r.qualification.factors.map((f) => [f.id, f.met]))).toEqual({ requirement: true, service_fit: true, decision: false, timeline: true, documented: false, scope_ready: false })
    expect(JSON.stringify(r)).not.toContain("62")
  })
  it("refuses partners, revoked founders, unknown and malformed ids, and writes nothing", async () => {
    state.actor = { id: USER_A, role: "independent_partner", sessionVersion: 1, active: true }
    await expect(founderQualification(OPP)).rejects.toThrow("Forbidden")
    state.actor = { id: FOUNDER, role: "owner", sessionVersion: 1, active: true }
    await q("update admin_users set session_version=2 where id=$1", [FOUNDER])
    await expect(founderQualification(OPP)).rejects.toMatchObject({ status: 403 })
    await q("update admin_users set session_version=1 where id=$1", [FOUNDER])
    for (const id of ["30000000-0000-4000-8000-00000000ffff", "x", null]) await expect(founderQualification(id)).rejects.toMatchObject({ status: 404 })
    expect((await q("select status,discovery from expansion_opportunities")).rows).toEqual([{ status: "discovery", discovery: DISCOVERY }])
  })
})
