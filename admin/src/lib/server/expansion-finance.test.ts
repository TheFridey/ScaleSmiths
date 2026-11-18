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
const OPPORTUNITY = "30000000-0000-4000-8000-000000000001"
const CONTRACT = "40000000-0000-4000-8000-000000000001"

const state = vi.hoisted(() => ({
  database: null as PGlite | null,
  actor: { id: "10000000-0000-4000-8000-000000000001", role: "owner", sessionVersion: 1, active: true },
}))
vi.mock("@/lib/db", () => ({ db: {
  transaction: async (operation: (tx: { execute: (query: SQL) => Promise<unknown> }) => Promise<unknown>) => state.database!.transaction(async (tx) => operation({
    execute: async (statement) => { const query = new PgDialect().sqlToQuery(statement); return tx.query(query.sql, query.params) },
  })),
} }))
vi.mock("./rbac", () => ({ requireCapability: async (capability: string) => {
  if ((capability === "expansion.manage" && state.actor.role !== "owner") || (capability === "expansion.partner" && state.actor.role !== "independent_partner")) throw new Error("Forbidden capability")
  return { ...state.actor }
} }))

import { approveExpansionPayout, getExpansionFinance, getPartnerFinance, prepareExpansionPayout, refundExpansionPayment, settleExpansionPayout, verifyExpansionPayment } from "./expansion-finance"

const payment = (milestone: "deposit" | "final" | "first_retainer" = "deposit", amount = "100000", reference = "bank-deposit-1") => ({ contractId: CONTRACT, invoiceId: 1, milestone, netPence: amount, grossPence: amount, reference, evidenceReference: "Bank statement verified by founder", confirmed: true })
function asPartner(id = USER) { state.actor = { id, role: "independent_partner", sessionVersion: 1, active: true } }

describe("production partner financial service against PostgreSQL via PGlite", () => {
  beforeAll(async () => {
    const database = state.database = new PGlite()
    // Canonical prerequisites are a minimal schema fixture; all financial SQL/constraints/triggers below are production migration/source.
    await database.exec(`
      create table admin_users(id uuid primary key,role text,active boolean,session_version integer,display_name text);
      create table clients(id integer primary key);
      create table invoices(id integer primary key,client_id integer references clients(id),total integer,status text,client_name_snapshot text not null default 'DEMO Client');
      create table expansion_partners(id uuid primary key,user_id uuid references admin_users(id),activated_at timestamptz,created_at timestamptz default now());
      create table expansion_opportunities(id uuid primary key,partner_id uuid references expansion_partners(id));
      create table expansion_contracts(id uuid primary key,opportunity_id uuid references expansion_opportunities(id),client_id integer references clients(id),terms jsonb,accepted_at timestamptz);
      create table commercial_payments(id serial primary key,client_id integer references clients(id),invoice_id integer references invoices(id),category text,amount integer not null check(amount<>0),evidence text,reference text unique,reverses_payment_id integer unique references commercial_payments(id),actor_user_id uuid references admin_users(id),received_at timestamptz,check((amount>0 and reverses_payment_id is null) or (amount<0 and reverses_payment_id is not null)));
      create table commercial_audit(id serial primary key,actor_user_id uuid references admin_users(id),entity text,record_id text,action text,after_value jsonb);
      create function commercial_history_immutable() returns trigger language plpgsql as $$ begin raise exception 'Commercial history is append-only'; end $$;
      create table expansion_resources(id uuid primary key,title text,version integer,category text,audience text,content text,status text,created_by uuid,created_at timestamptz default now());
    `)
    await database.exec(readFileSync(new URL("../../../drizzle/0069_expansion_finance.sql", import.meta.url), "utf8"))
    await database.exec(readFileSync(new URL("../../../drizzle/0070_expansion_cancellations.sql", import.meta.url), "utf8"))
  }, 30000)
  beforeEach(async () => {
    state.actor = { id: FOUNDER, role: "owner", sessionVersion: 1, active: true }
    await state.database!.exec("truncate expansion_contract_cancellations,expansion_payout_entries,expansion_payouts,expansion_commission_ledger,expansion_payment_events,commercial_payments,commercial_audit,expansion_contracts,expansion_opportunities,expansion_partners,invoices,clients,admin_users restart identity cascade")
    await state.database!.query("insert into admin_users values($1,'owner',true,1,'Founder'),($2,'independent_partner',true,1,'Partner A'),($3,'independent_partner',true,1,'Partner B')", [FOUNDER, USER, OTHER_USER])
    await state.database!.query("insert into expansion_partners(id,user_id,activated_at) values($1,$2,now()),($3,$4,now())", [PARTNER, USER, OTHER_PARTNER, OTHER_USER])
    await state.database!.exec("insert into clients(id) values(1),(2); insert into invoices(id,client_id,total,status) values(1,1,235000,'issued'),(2,2,100000,'issued'),(3,1,100000,'draft')")
    await state.database!.query("insert into expansion_opportunities values($1,$2)", [OPPORTUNITY, PARTNER])
    await state.database!.query("insert into expansion_contracts values($1,$2,1,$3,now())", [CONTRACT, OPPORTUNITY, JSON.stringify(standardCommissionTerms())])
  })
  afterAll(async () => { await state.database?.close() })

  it("executes £705 journey, replay, manual approval, settlement and partner reconciliation", async () => {
    const deposit = await verifyExpansionPayment(payment())
    expect(deposit.commissionPence).toBe("30000")
    expect((await verifyExpansionPayment(payment())).replayed).toBe(true)
    await verifyExpansionPayment(payment("final", "100000", "bank-final-1"))
    await verifyExpansionPayment(payment("first_retainer", "35000", "bank-retainer-1"))
    const prepared = await prepareExpansionPayout({ partnerId: PARTNER, invoiceReference: "PARTNER-A-001" })
    expect(prepared.amountPence).toBe("70500")
    await approveExpansionPayout({ payoutId: prepared.payoutId })
    await settleExpansionPayout({ payoutId: prepared.payoutId, settlementReference: "MANUALLY-VERIFIED-SETTLEMENT-001" })
    asPartner()
    const summary = await getPartnerFinance()
    expect([summary.earnedPence, summary.paidPence, summary.unpaidPence, summary.conditionalPence]).toEqual(["70500", "70500", "0", "0"])
    expect(summary.ledger).toHaveLength(3)
    expect(summary.ledger.map(row=>row.client_name)).toEqual(['DEMO Client','DEMO Client','DEMO Client'])
    state.actor = { id: FOUNDER, role: "owner", sessionVersion: 1, active: true }
    expect((await getExpansionFinance()).payments.map(row=>row.client_name)).toEqual(['DEMO Client','DEMO Client','DEMO Client'])
    // Model legacy collection rows with no invoice metadata; enrichment must never remove financial history.
    await state.database!.exec('update commercial_payments set invoice_id=null')
    asPartner()
    const withoutMetadata=await getPartnerFinance()
    expect(withoutMetadata.ledger.map(row=>row.client_name)).toEqual([null,null,null])
    expect([withoutMetadata.earnedPence,withoutMetadata.paidPence,withoutMetadata.unpaidPence]).toEqual(['70500','70500','0'])
    state.actor = { id: FOUNDER, role: "owner", sessionVersion: 1, active: true }
    expect((await getExpansionFinance()).payments).toHaveLength(3)
  })
  it("rejects conflicting replay, excess collection and unrelated/draft invoice without extra revenue", async () => {
    await verifyExpansionPayment(payment())
    await expect(verifyExpansionPayment({ ...payment(), netPence: "99999" })).rejects.toThrow("different details")
    await expect(verifyExpansionPayment(payment("deposit", "1", "excess"))).rejects.toThrow("approved milestone")
    await expect(verifyExpansionPayment({ ...payment("final", "100000", "other-client"), invoiceId: 2 })).rejects.toThrow("issued invoice")
    await expect(verifyExpansionPayment({ ...payment("final", "100000", "draft"), invoiceId: 3 })).rejects.toThrow("issued invoice")
    expect((await state.database!.query("select * from commercial_payments")).rows).toHaveLength(1)
  })
  it("uses VAT-exclusive receipts and cumulative partial rounding with transaction rollback", async () => {
    await verifyExpansionPayment({ ...payment("deposit", "1", "part-1"), grossPence: "2" })
    await verifyExpansionPayment(payment("deposit", "1", "part-2"))
    await verifyExpansionPayment(payment("deposit", "99998", "part-3"))
    asPartner()
    expect((await getPartnerFinance()).earnedPence).toBe("30000")
    state.actor = { id: FOUNDER, role: "owner", sessionVersion: 1, active: true }
    await expect(verifyExpansionPayment({ ...payment("final", "100000", "bad-vat"), grossPence: "99999" })).rejects.toThrow("VAT-exclusive")
  })
  it("denies financial mutation by a partner and hides another partner's records", async () => {
    await verifyExpansionPayment(payment())
    asPartner(OTHER_USER)
    expect((await getPartnerFinance()).ledger).toEqual([])
    expect((await getPartnerFinance()).earnedPence).toBe("0")
    await expect(getPartnerFinance(USER)).rejects.toThrow("access denied")
    await expect(verifyExpansionPayment(payment())).rejects.toThrow("Forbidden")
    await expect(getExpansionFinance()).rejects.toThrow("Forbidden")
  })
  it("appends a full approved refund, replays once and rejects bypass reversal and history rewrite", async () => {
    const original = await verifyExpansionPayment(payment())
    await expect(state.database!.query("insert into commercial_payments(client_id,invoice_id,category,amount,evidence,reference,reverses_payment_id,actor_user_id,received_at) select client_id,invoice_id,category,-amount,'bypass','bypass-ref',id,actor_user_id,now() from commercial_payments limit 1")).rejects.toThrow("financial reconciliation")
    const refund = { paymentId: original.paymentId, reference: "refund-1", reason: "Refund verified against bank statement", termsApprovalReference: "Founder reviewed clause 4 and approved full reversal" }
    expect((await refundExpansionPayment(refund)).commissionPence).toBe("-30000")
    expect((await refundExpansionPayment(refund)).replayed).toBe(true)
    await expect(refundExpansionPayment({ ...refund, reference: "refund-2" })).rejects.toThrow("already been refunded")
    await expect(state.database!.exec("update expansion_commission_ledger set amount_pence=1")).rejects.toThrow("append-only")
    asPartner()
    expect((await getPartnerFinance()).earnedPence).toBe("0")
  })
  it("prevents duplicate payouts, direct settlement and refunds of reserved entitlement", async () => {
    const original = await verifyExpansionPayment(payment())
    const payout = await prepareExpansionPayout({ partnerId: PARTNER, invoiceReference: "INV-001" })
    expect((await prepareExpansionPayout({ partnerId: PARTNER, invoiceReference: "INV-001" })).replayed).toBe(true)
    await expect(prepareExpansionPayout({ partnerId: PARTNER, invoiceReference: "INV-002" })).rejects.toThrow("No positive")
    await expect(settleExpansionPayout({ payoutId: payout.payoutId, settlementReference: "bank" })).rejects.toThrow("manually approved")
    await expect(refundExpansionPayment({ paymentId: original.paymentId, reference: "refund", reason: "approved", termsApprovalReference: "agreement" })).rejects.toThrow("prepared payout")
  })
  it("freezes payout allocations at approval and rejects a mismatched prepared total", async () => {
    await verifyExpansionPayment(payment())
    const payout = await prepareExpansionPayout({ partnerId: PARTNER, invoiceReference: "INV-LOCKED" })
    await approveExpansionPayout({ payoutId: payout.payoutId })
    await verifyExpansionPayment(payment("final", "100000", "final-after-approval"))
    await expect(state.database!.query("insert into expansion_payout_entries(payout_id,ledger_id) select $1,l.id from expansion_commission_ledger l where not exists(select 1 from expansion_payout_entries e where e.ledger_id=l.id) limit 1", [payout.payoutId])).rejects.toThrow("unapproved payout")
    const mismatched = "50000000-0000-4000-8000-000000000001"
    await state.database!.query("insert into expansion_payouts(id,partner_id,amount_pence,invoice_reference,prepared_by) values($1,$2,1,'MISMATCH',$3)", [mismatched, PARTNER, FOUNDER])
    await expect(approveExpansionPayout({ payoutId: mismatched })).rejects.toThrow("does not reconcile")
  })
  it("rejects commission allocation to another partner's prepared payout", async () => {
    await verifyExpansionPayment(payment())
    const payoutId = "50000000-0000-4000-8000-000000000002"
    await state.database!.query("insert into expansion_payouts(id,partner_id,amount_pence,invoice_reference,prepared_by) values($1,$2,30000,'CROSS-PARTNER',$3)", [payoutId, OTHER_PARTNER, FOUNDER])
    await expect(state.database!.query("insert into expansion_payout_entries(payout_id,ledger_id) select $1,id from expansion_commission_ledger limit 1", [payoutId])).rejects.toThrow("same partner")
  })
  it("rechecks revocation and commission plan at the transaction boundary", async () => {
    await state.database!.query("update admin_users set active=false where id=$1", [FOUNDER])
    await expect(verifyExpansionPayment(payment())).rejects.toThrow("revoked")
    await state.database!.query("update admin_users set active=true where id=$1", [FOUNDER])
    await state.database!.query("update expansion_contracts set accepted_at=null where id=$1", [CONTRACT])
    await expect(verifyExpansionPayment(payment())).rejects.toThrow("accepted")
  })
  it("cancels conditional entitlement while preserving earned liability and approved refund history", async () => {
    const original = await verifyExpansionPayment(payment())
    await state.database!.query("insert into expansion_contract_cancellations(contract_id,reason,created_by) values($1,'Signed cancellation approved by founder',$2)", [CONTRACT, FOUNDER])
    expect(await verifyExpansionPayment(payment())).toEqual({paymentId:original.paymentId,replayed:true})
    await expect(verifyExpansionPayment({...payment(),evidenceReference:'Changed historical evidence'})).rejects.toThrow('different details')
    await expect(verifyExpansionPayment(payment("final", "100000", "cancelled-final"))).rejects.toThrow("cancelled")
    expect((await state.database!.query('select count(*)::integer count from expansion_payment_events')).rows).toEqual([{count:1}])
    expect((await state.database!.query('select count(*)::integer count,sum(amount_pence)::text amount from expansion_commission_ledger')).rows).toEqual([{count:1,amount:'30000'}])
    asPartner()
    const statement = await getPartnerFinance()
    expect([statement.earnedPence, statement.unpaidPence, statement.conditionalPence]).toEqual(["30000", "30000", "0"])
    expect(statement.ledger[0].rate_bps).toBe("3000")
    state.actor = { id: FOUNDER, role: "owner", sessionVersion: 1, active: true }
    expect((await refundExpansionPayment({ paymentId: original.paymentId, reference: "cancelled-refund", reason: "Approved refund after cancellation", termsApprovalReference: "Reviewed cancellation clause" })).commissionPence).toBe("-30000")
  })
})
