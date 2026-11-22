import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

/** Operation Ascend B2.4, Journey C at the service level: synthetic invoices and verified collections, reversals, commission, forecasts. */
const F1 = "10000000-0000-4000-8000-000000000001", USER_A = "10000000-0000-4000-8000-000000000002", FIN = "10000000-0000-4000-8000-000000000006"
const state = vi.hoisted(() => ({ database: null as import("@electric-sql/pglite").PGlite | null, actor: { id: "", role: "owner", sessionVersion: 1, active: true } }))
vi.mock("@/lib/db", () => ({ db: { transaction: async (op: (tx: { execute: (q: SQL) => Promise<unknown> }) => Promise<unknown>) => state.database!.transaction(async tx => op({ execute: async s => { const q = new PgDialect().sqlToQuery(s); return tx.query(q.sql, q.params) } })) } }))
vi.mock("./rbac", () => ({ requireCapability: async (c: string) => {
  if ((c === "expansion.manage" && !["owner", "administrator"].includes(state.actor.role)) || (c === "expansion.partner" && state.actor.role !== "independent_partner")) throw new Error("Forbidden capability")
  return { ...state.actor }
} }))
// The Commission centre's own summary (earned from the ledger, paid from settled payouts); passed through unchanged.
vi.mock("./expansion-finance", () => ({ getExpansionFinance: async () => ({ partners: [{ id: "p1", earned_pence: "70500", paid_pence: "30000" }, { id: "p2", earned_pence: "-6000", paid_pence: "0" }], payments: [], payouts: [] }) }))
import { revenueIntelligence, saveForecastAssumptions } from "./revenue-intelligence"

const q = (sql: string, params: unknown[] = []) => state.database!.query(sql, params)
const NOW = new Date("2026-11-22T12:00:00Z")
const FINANCIAL = ["invoices", "commercial_payments", "commercial_contracts", "expansion_payment_events", "expansion_contracts", "commercial_forecasts"]
const fingerprint = async () => Object.fromEntries(await Promise.all(FINANCIAL.map(async (t) => [t, ((await q(`select md5(coalesce(string_agg(x::text,'|' order by x::text),'')) h from ${t} x`)).rows[0] as { h: string }).h])))
const assumptions = { scenario: "baseline", stageBasisPoints: { qualified: 1000, scope_submitted: 3000, approved: 7000 }, averageValuePence: "300000", monthlyRetentionBasisPoints: 9500, horizonMonths: 3, rationale: "TEST ONLY founder estimate" }

describe("Operation Ascend B2.4 revenue intelligence (PGlite)", () => {
  beforeAll(async () => {
    state.database = new PGlite()
    await state.database.exec(`
      create function commercial_history_immutable() returns trigger language plpgsql as $$ begin raise exception 'Commercial history is append-only'; end $$;
      create table admin_users(id uuid primary key,role text,active boolean,session_version integer,display_name text);
      create table invoices(id serial primary key,status text,total integer);
      create table commercial_payments(id serial primary key,invoice_id integer,category text,amount integer,received_at timestamptz);
      create table commercial_contracts(id serial primary key,client_id integer,category text,status text,monthly_amount integer,one_off_amount integer,starts_at timestamptz,ends_at timestamptz);
      create table commercial_forecasts(id serial primary key,amount integer,expected_at timestamptz);
      create table expansion_opportunities(id uuid primary key,status text);
      create table expansion_contracts(id uuid primary key,commercial_contract_id integer);
      create table expansion_payment_events(id uuid primary key,commercial_payment_id integer);
      create table expansion_audit(id serial primary key,actor_id uuid,entity_id text,action text,details jsonb,created_at timestamptz default now());
    `)
    await state.database.exec(readFileSync(new URL("../../../drizzle/0101_ascend_forecast_assumptions.sql", import.meta.url), "utf8"))
  }, 30000)
  beforeEach(async () => {
    vi.stubEnv("REVENUE_INTELLIGENCE_ENABLED", "true")
    await q("truncate expansion_forecast_assumptions,expansion_audit,expansion_payment_events,expansion_contracts,expansion_opportunities,commercial_forecasts,commercial_contracts,commercial_payments,invoices,admin_users restart identity")
    await q("insert into admin_users values($1,'owner',true,1,'Founder One'),($2,'independent_partner',true,1,'Partner'),($3,'finance',true,1,'Finance Only')", [F1, USER_A, FIN])
    // Invoices: one issued and part-paid, one issued unpaid, one paid, one void, one draft.
    await q("insert into invoices(status,total) values('issued',100000),('issued',50000),('paid',30000),('void',99999),('draft',77777)")
    // Verified collections (pence): a part payment, a full payment, a retainer, a build and a reversal of the build.
    await q(`insert into commercial_payments(invoice_id,category,amount,received_at) values
      (1,'website_build',40000,'2026-10-05T10:00:00Z'),(3,'website_build',30000,'2026-11-02T10:00:00Z'),(null,'retainer',25000,'2026-11-10T10:00:00Z'),
      (null,'website_build',20000,'2026-09-01T10:00:00Z'),(null,'website_build',-20000,'2026-09-15T10:00:00Z'),(null,'growth_audit',5000,'2025-01-01T10:00:00Z')`)
    await q("insert into expansion_payment_events values(gen_random_uuid(),2),(gen_random_uuid(),3)")
    await q(`insert into commercial_contracts(client_id,category,status,monthly_amount,one_off_amount,starts_at,ends_at) values
      (1,'retainer','confirmed',25000,0,'2026-01-01Z',null),(2,'premium_partnership','confirmed',50000,0,'2026-06-01Z',null),(3,'retainer','ended',10000,0,'2025-01-01Z','2026-01-01Z'),(4,'website_build','confirmed',0,300000,'2026-03-01Z',null)`)
    await q("insert into commercial_forecasts(amount,expected_at) values(12000,'2026-12-15Z'),(99999,'2027-06-01Z')")
    await q("insert into expansion_opportunities values(gen_random_uuid(),'qualified'),(gen_random_uuid(),'qualified'),(gen_random_uuid(),'scope_submitted'),(gen_random_uuid(),'approved'),(gen_random_uuid(),'contract_accepted'),(gen_random_uuid(),'closed_lost'),(gen_random_uuid(),'withdrawn')")
    await q("insert into expansion_contracts values(gen_random_uuid(),4)")
    state.actor = { id: F1, role: "owner", sessionVersion: 1, active: true }
  })
  afterEach(() => { vi.unstubAllEnvs() })
  afterAll(async () => { await state.database?.close() })

  it("is off by default and refuses partners, finance-only staff and revoked founders", async () => {
    vi.stubEnv("REVENUE_INTELLIGENCE_ENABLED", "")
    await expect(revenueIntelligence(NOW)).rejects.toMatchObject({ status: 404 })
    vi.stubEnv("REVENUE_INTELLIGENCE_ENABLED", "true")
    for (const actor of [{ id: USER_A, role: "independent_partner" }, { id: FIN, role: "finance" }]) {
      state.actor = { ...actor, sessionVersion: 1, active: true }
      await expect(revenueIntelligence(NOW)).rejects.toThrow("Forbidden")
      await expect(saveForecastAssumptions(assumptions)).rejects.toThrow("Forbidden")
    }
    state.actor = { id: F1, role: "owner", sessionVersion: 1, active: true }
    await q("update admin_users set session_version=2 where id=$1", [F1])
    await expect(revenueIntelligence(NOW)).rejects.toMatchObject({ status: 403 })
  })

  it("C2-C5 reports collected revenue, reversals, outstanding invoices and commission from the authoritative records", async () => {
    const r = await revenueIntelligence(NOW)
    expect(r.actual).toMatchObject({
      collectedPence: "100000", reversalsPence: "-20000", partnerAttributedPence: "55000",
      recurringCollectedPence: "25000", oneOffBuildCollectedPence: "70000",
      outstandingInvoicedPence: "110000", outstandingInvoices: 2,
      monthlyRecurringPence: "75000", retainedClients: 2,
      commission: { earnedPence: "64500", paidPence: "30000", liabilityPence: "34500" },
    })
    expect(r.actual.byCategory).toEqual([{ category: "retainer", pence: "25000" }, { category: "premium_partnership", pence: "0" }, { category: "website_build", pence: "70000" }, { category: "growth_audit", pence: "5000" }, { category: "performance", pence: "0" }])
    // Last twelve London months only: the January 2025 audit payment is excluded; the September build and its reversal net to zero.
    expect(r.actual.byMonth).toEqual([{ month: "2026-09", pence: "0" }, { month: "2026-10", pence: "40000" }, { month: "2026-11", pence: "55000" }])
  })

  it("C6 never invents a conversion rate, discloses every input and keeps Command Centre estimates separate", async () => {
    const r = await revenueIntelligence(NOW)
    expect(r.forecastInputs.stageCounts).toEqual({ qualified: 2, scope_submitted: 1, approved: 1 })
    expect(r.forecastInputs.history).toMatchObject({ basisPoints: null, closed: 3 })
    expect(r.forecastInputs.historicalAverageOneOffPence).toBeNull()
    expect(r.forecastInputs.commandCentreExpected).toMatchObject({ count: 1, pence: "12000" })
    expect(r.scenarios.every((s) => s.projection === null)).toBe(true)
  })

  it("C7-C8 saving and changing scenarios creates assumption versions only; no financial record changes", async () => {
    const before = await fingerprint()
    expect(await saveForecastAssumptions(assumptions)).toMatchObject({ version: 1 })
    expect(await saveForecastAssumptions({ ...assumptions, stageBasisPoints: { ...assumptions.stageBasisPoints, approved: 5000 }, rationale: "TEST ONLY more cautious" })).toMatchObject({ version: 2 })
    await saveForecastAssumptions({ ...assumptions, scenario: "optimistic", rationale: "TEST ONLY upside" })
    const r = await revenueIntelligence(NOW)
    const baseline = r.scenarios.find((s) => s.scenario === "baseline")!
    expect(baseline.saved).toMatchObject({ version: 2, rationale: "TEST ONLY more cautious", by: "Founder One" })
    // 2 × £3,000 × 10% + 1 × £3,000 × 30% + 1 × £3,000 × 50% + recurring £750/month at 95% for 3 months (71250 + 67687 + 64302).
    expect(baseline.projection!.lines.map((l) => l.pence)).toEqual(["60000", "90000", "150000", "203239"])
    expect(r.scenarios.find((s) => s.scenario === "conservative")!.projection).toBeNull()
    expect(await fingerprint()).toEqual(before)
    expect((await q("select count(*)::int n from expansion_audit where action='forecast_assumptions_saved'")).rows[0]).toEqual({ n: 3 })
    await expect(q("update expansion_forecast_assumptions set approved_bp=0")).rejects.toThrow("append-only")
  })

  it("validates assumptions and requires a rationale", async () => {
    await expect(saveForecastAssumptions({ ...assumptions, horizonMonths: 99 })).rejects.toThrow("horizon")
    await expect(saveForecastAssumptions({ ...assumptions, rationale: " " })).rejects.toThrow("Explain")
    await expect(saveForecastAssumptions({ ...assumptions, averageValuePence: "1e9" })).rejects.toThrow("whole pence")
    expect((await q("select count(*)::int n from expansion_forecast_assumptions")).rows[0]).toEqual({ n: 0 })
  })
})
