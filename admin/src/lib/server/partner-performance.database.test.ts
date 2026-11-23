import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const USER_A = "10000000-0000-4000-8000-000000000002"
const USER_B = "10000000-0000-4000-8000-000000000003"
const PA = "20000000-0000-4000-8000-000000000001"
const PB = "20000000-0000-4000-8000-000000000002"
const state = vi.hoisted(() => ({
  database: null as import("@electric-sql/pglite").PGlite | null,
  actor: { id: "10000000-0000-4000-8000-000000000002", role: "independent_partner", active: true, sessionVersion: 1 },
}))
vi.mock("@/lib/db", () => ({
  db: { transaction: async (op: (tx: { execute: (query: SQL) => Promise<unknown> }) => Promise<unknown>) =>
    state.database!.transaction(async (tx) => op({ execute: async (statement) => {
      const q = new PgDialect().sqlToQuery(statement)
      return tx.query(q.sql, q.params)
    } })) },
}))
vi.mock("./rbac", () => ({ requireCapability: async (capability: string) => {
  if (capability !== "expansion.partner" || state.actor.role !== "independent_partner") throw new Error("Partner authority required.")
  return { ...state.actor }
} }))
vi.mock("./empower-partner", () => ({ partnerGuard: async (_tx: unknown, actor: { id: string; active: boolean; sessionVersion: number }) => {
  if (!actor.active || actor.sessionVersion !== 1) throw new Error("Active partner required.")
  if (actor.id === USER_A) return PA
  if (actor.id === USER_B) return PB
  throw new Error("Partner not found.")
} }))
// The existing finance and programme services own this data. This service must not recalculate it.
vi.mock("./expansion-finance", () => ({ getPartnerFinance: async () => ({
  earnedPence: state.actor.id === USER_A ? "70500" : "900",
  paidPence: state.actor.id === USER_A ? "30000" : "0",
  unpaidPence: state.actor.id === USER_A ? "40500" : "900",
  conditionalPence: "0", earnedThisMonthPence: "70500", paidThisMonthPence: "30000",
  ledger: state.actor.id === USER_A ? [{ amount_pence: "70500", created_at: "2026-11-21T12:00:00Z" }] : [],
  payouts: state.actor.id === USER_A ? [{ amount_pence: "30000", paid_at: "2026-11-21T15:00:00Z", status: "paid" }] : [],
  refunds: [],
}) }))
vi.mock("./expansion-programme", () => ({ getProgrammeOverview: async () => ({
  qualifiedClients: state.actor.id === USER_A ? 1 : 0,
  programme: { approved: false },
  milestones: [],
  rewards: [],
}) }))
import { partnerPerformance } from "./partner-performance"
const query = (statement: string, params: unknown[] = []) => state.database!.query(statement, params)
const NOW = new Date("2026-11-23T12:00:00Z")
describe("B2.5 partner performance (real SQL/PGlite projection)", () => {
  beforeAll(async () => {
    state.database = new PGlite()
    await state.database.exec(String.raw`
      create table prospects(id integer primary key, next_follow_up_at timestamptz);
      create table expansion_opportunities(id uuid primary key, partner_id uuid, prospect_id integer, status text, created_at timestamptz);
      create table expansion_meeting_requests(id uuid primary key, partner_id uuid, status text, created_at timestamptz, confirmed_start timestamptz);
      create table expansion_contracts(id uuid primary key, opportunity_id uuid, accepted_at timestamptz);
      insert into prospects values (1,'2026-11-20T10:00:00Z'),(2,null),(3,null);
      insert into expansion_opportunities values
       ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',1,'qualified','2026-11-22T10:00:00Z'),
       ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',2,'contract_accepted','2026-11-12T10:00:00Z'),
       ('30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002',3,'registered','2026-11-22T10:00:00Z');
      insert into expansion_meeting_requests values
       ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','confirmed','2026-11-21T10:00:00Z','2026-11-22T11:00:00Z'),
       ('40000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','requested','2026-11-22T11:00:00Z',null);
      insert into expansion_contracts values
       ('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','2026-11-21T12:00:00Z');
    `)
  })
  afterAll(async () => { await state.database?.close() })
  beforeEach(() => { vi.stubEnv("PARTNER_PERFORMANCE_ENABLED", "true"); state.actor = { id: USER_A, role: "independent_partner", active: true, sessionVersion: 1 } })
  it("fails closed while disabled or on invalid period", async () => {
    vi.stubEnv("PARTNER_PERFORMANCE_ENABLED", "false")
    await expect(partnerPerformance("30d", NOW)).rejects.toThrow(/not available/)
    vi.stubEnv("PARTNER_PERFORMANCE_ENABLED", "true")
    await expect(partnerPerformance("banana", NOW)).rejects.toThrow(/valid performance period/)
  })
  it("returns only owned records and passes Commission Centre money unchanged", async () => {
    const before = (await query("select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) h from expansion_opportunities t")).rows[0]
    const a = await partnerPerformance("30d", NOW)
    expect(a.metrics).toMatchObject({ registered: 2, active: 1, requestedMeetings: 1, confirmedMeetings: 1, acceptedContracts: 1,
      earnedPence: "70500", paidPence: "30000", outstandingPence: "40500", earnedInPeriodPence: "70500" })
    expect(a.distribution.total).toBe(2)
    expect(a.distribution.kind).toBe("current_state_only")
    expect(a.recognition.qualifiedClients).toBe(1)
    expect(a.attention.followUpsDue).toBe(1)
    state.actor = { id: USER_B, role: "independent_partner", active: true, sessionVersion: 1 }
    const b = await partnerPerformance("30d", NOW)
    expect(b.metrics).toMatchObject({ registered: 1, active: 1, requestedMeetings: 1, confirmedMeetings: 0, acceptedContracts: 0, earnedPence: "900" })
    expect(b.distribution.total).toBe(1)
    expect((await query("select md5(coalesce(string_agg(t::text,'|' order by t.id),'')) h from expansion_opportunities t")).rows[0]).toEqual(before)
  })
  it("refuses inactive and stale identities", async () => {
    state.actor.active = false
    await expect(partnerPerformance("30d", NOW)).rejects.toThrow(/Active partner/)
    state.actor.active = true
    state.actor.sessionVersion = 9
    await expect(partnerPerformance("30d", NOW)).rejects.toThrow(/Active partner/)
  })
})
