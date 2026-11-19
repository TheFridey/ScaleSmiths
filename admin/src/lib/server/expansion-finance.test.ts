import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { buildAcceptedTerms, standardCommissionTerms, type CommissionMilestone } from "../expansion-finance"

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

import { allocateExpansionInvoice, approveExpansionPayout, cancelExpansionPayout, getExpansionFinance, getPartnerFinance, prepareExpansionPayout, refundExpansionPayment, retainRefundEntitlement, settleExpansionPayout, verifyExpansionPayment } from "./expansion-finance"

const clause = "Synthetic accepted agreement clause 4"

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
    await database.exec(readFileSync(new URL("../../../drizzle/0071_expansion_financial_hardening.sql", import.meta.url), "utf8"))
    await database.exec(readFileSync(new URL("../../../drizzle/0073_expansion_commercial_plans.sql", import.meta.url), "utf8"))
  }, 30000)
  beforeEach(async () => {
    state.actor = { id: FOUNDER, role: "owner", sessionVersion: 1, active: true }
    await state.database!.exec("truncate expansion_contract_cancellations,expansion_payout_entries,expansion_payouts,expansion_commission_ledger,expansion_payment_events,commercial_payments,commercial_audit,expansion_contracts,expansion_opportunities,expansion_partners,invoices,clients,admin_users restart identity cascade")
    await state.database!.query("insert into admin_users values($1,'owner',true,1,'Founder'),($2,'independent_partner',true,1,'Partner A'),($3,'independent_partner',true,1,'Partner B')", [FOUNDER, USER, OTHER_USER])
    await state.database!.query("insert into expansion_partners(id,user_id,activated_at) values($1,$2,now()),($3,$4,now())", [PARTNER, USER, OTHER_PARTNER, OTHER_USER])
    await state.database!.exec("insert into clients(id) values(1),(2); insert into invoices(id,client_id,total,status) values(1,1,235000,'issued'),(2,2,100000,'issued'),(3,1,100000,'draft')")
    await state.database!.query("insert into expansion_opportunities values($1,$2)", [OPPORTUNITY, PARTNER])
    await state.database!.query("insert into expansion_contracts values($1,$2,1,$3,now())", [CONTRACT, OPPORTUNITY, JSON.stringify({...standardCommissionTerms(), unpaidRefundApprovalReference:clause})])
    for (const [milestone, amount] of Object.entries(standardCommissionTerms().milestones)) {
      await allocateExpansionInvoice({contractId:CONTRACT,invoiceId:1,milestone:milestone as "deposit"|"final"|"first_retainer",netPence:amount,evidenceReference:"Reviewed milestone breakdown"})
    }
  })
  afterAll(async () => { await state.database?.close() })

  it("executes £705 journey, replay, manual approval, settlement and partner reconciliation", async () => {
    const deposit = await verifyExpansionPayment(payment())
    expect(deposit.commissionPence).toBe("30000")
    expect((await verifyExpansionPayment(payment())).replayed).toBe(true)
    await verifyExpansionPayment(payment("final", "100000", "bank-final-1"))
    await verifyExpansionPayment(payment("first_retainer", "35000", "bank-retainer-1"))
    const prepared = await prepareExpansionPayout({ partnerId: PARTNER, invoiceReference: "PARTNER-A-001", invoiceNetPence: "70500" })
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
  it("rejects same-client receipts without a reviewed invoice allocation", async () => {
    await state.database!.exec("insert into invoices(id,client_id,total,status) values(4,1,100000,'issued')")
    await expect(verifyExpansionPayment({...payment(),invoiceId:4})).rejects.toThrow("reviewed allocation")
    await expect(allocateExpansionInvoice({contractId:CONTRACT,invoiceId:4,milestone:"deposit",netPence:"1",evidenceReference:"Exceeds accepted allocation"})).rejects.toThrow("approved milestone")
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
    const refund = { paymentId: original.paymentId, reference: "refund-1", reason: "Refund verified against bank statement", termsApprovalReference: clause, treatment: "adjust_unpaid" as const }
    expect((await refundExpansionPayment(refund)).commissionPence).toBe("-30000")
    expect((await refundExpansionPayment(refund)).replayed).toBe(true)
    await expect(refundExpansionPayment({ ...refund, reference: "refund-2" })).rejects.toThrow("already been refunded")
    await expect(state.database!.exec("update expansion_commission_ledger set amount_pence=1")).rejects.toThrow("append-only")
    asPartner()
    expect((await getPartnerFinance()).earnedPence).toBe("0")
  })
  it("prevents duplicate payouts, direct settlement and refunds of reserved entitlement", async () => {
    const original = await verifyExpansionPayment(payment())
    const payout = await prepareExpansionPayout({ partnerId: PARTNER, invoiceReference: "INV-001", invoiceNetPence: "30000" })
    expect((await prepareExpansionPayout({ partnerId: PARTNER, invoiceReference: "INV-001", invoiceNetPence: "30000" })).replayed).toBe(true)
    await expect(prepareExpansionPayout({ partnerId: PARTNER, invoiceReference: "INV-002", invoiceNetPence: "30000" })).rejects.toThrow("No positive")
    await expect(settleExpansionPayout({ payoutId: payout.payoutId, settlementReference: "bank" })).rejects.toThrow("manually approved")
    await expect(refundExpansionPayment({ paymentId: original.paymentId, reference: "refund", reason: "approved", termsApprovalReference: clause, treatment: "adjust_unpaid" })).rejects.toThrow("prepared payout")
  })
  it("freezes payout allocations at approval and rejects a mismatched prepared total", async () => {
    await verifyExpansionPayment(payment())
    const payout = await prepareExpansionPayout({ partnerId: PARTNER, invoiceReference: "INV-LOCKED", invoiceNetPence: "30000" })
    await approveExpansionPayout({ payoutId: payout.payoutId })
    await verifyExpansionPayment(payment("final", "100000", "final-after-approval"))
    await expect(state.database!.query("insert into expansion_payout_entries(payout_id,ledger_id) select $1,l.id from expansion_commission_ledger l where not exists(select 1 from expansion_payout_entries e where e.ledger_id=l.id) limit 1", [payout.payoutId])).rejects.toThrow("live prepared payout")
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
    expect((await refundExpansionPayment({ paymentId: original.paymentId, reference: "cancelled-refund", reason: "Approved refund after cancellation", termsApprovalReference: clause, treatment: "adjust_unpaid" })).commissionPence).toBe("-30000")
  })

  it("records partial VAT refunds, rejects invalid components and releases cancelled claims once", async () => {
    const original = await verifyExpansionPayment({...payment(),grossPence:"120000"})
    const prepared = await prepareExpansionPayout({partnerId:PARTNER,invoiceReference:"FIRST",invoiceNetPence:"30000"})
    const cancellation = {payoutId:prepared.payoutId,reason:"Correct invoice before approval",noExternalSettlement:true}
    expect(await cancelExpansionPayout(cancellation)).toMatchObject({status:"cancelled",replayed:false})
    expect(await cancelExpansionPayout(cancellation)).toMatchObject({replayed:true})
    await expect(approveExpansionPayout({payoutId:prepared.payoutId})).rejects.toThrow("prepared payout")
    const refund = {paymentId:original.paymentId,reference:"partial-refund",reason:"Matched synthetic bank refund",termsApprovalReference:clause,treatment:"adjust_unpaid" as const,netPence:"20000",grossPence:"24000"}
    await expect(refundExpansionPayment({...refund,grossPence:"41000"})).rejects.toThrow("VAT balance")
    expect(await refundExpansionPayment(refund)).toMatchObject({commissionPence:"-6000",calculatedAdjustmentPence:"-6000"})
    expect(await refundExpansionPayment(refund)).toMatchObject({replayed:true})
    await expect(refundExpansionPayment({...refund,netPence:"19000"})).rejects.toThrow("different details")
    expect(await refundExpansionPayment({...refund,reference:"partial-2",netPence:"10000",grossPence:"12000"})).toMatchObject({commissionPence:"-3000"})
    const replacement = await prepareExpansionPayout({partnerId:PARTNER,invoiceReference:"REPLACEMENT",invoiceNetPence:"21000"})
    expect(replacement.amountPence).toBe("21000")
    expect((await getExpansionFinance()).payouts.map(row=>row.status).sort()).toEqual(["cancelled","prepared"])
    await approveExpansionPayout(replacement)
    await expect(cancelExpansionPayout({...cancellation,payoutId:replacement.payoutId})).rejects.toThrow("Only a prepared")
    await settleExpansionPayout({...replacement,settlementReference:"MONITORED-BANK-1"})
    const remaining = await refundExpansionPayment({paymentId:original.paymentId,reference:"remaining",reason:"Remaining refund now recorded"})
    expect(remaining).toMatchObject({treatment:"manual_review",commissionPence:"0",calculatedAdjustmentPence:"-21000"})
    asPartner()
    expect(await getPartnerFinance()).toMatchObject({earnedPence:"21000",paidPence:"21000",unpaidPence:"0"})
  })

  it("preserves cap when retained or unreviewed cash refunds are replaced", async () => {
    const original = await verifyExpansionPayment(payment())
    const refund = await refundExpansionPayment({paymentId:original.paymentId,reference:"manual",reason:"Review needed",netPence:"20000"})
    expect(await verifyExpansionPayment(payment("deposit","20000","replacement"))).toMatchObject({commissionPence:"0"})
    const payout = {partnerId:PARTNER,invoiceReference:"AFTER-REVIEW",invoiceNetPence:"30000"}
    await expect(prepareExpansionPayout(payout)).rejects.toThrow("outstanding refund entitlement")
    const decision = {paymentId:refund.paymentId,evidenceReference:"Reviewed accepted terms preserve entitlement"}
    expect(await retainRefundEntitlement(decision)).toMatchObject({replayed:false})
    expect(await retainRefundEntitlement(decision)).toMatchObject({replayed:true})
    await expect(retainRefundEntitlement({...decision,evidenceReference:"Conflicting disposition"})).rejects.toThrow("different decision evidence")
    expect(await prepareExpansionPayout(payout)).toMatchObject({amountPence:"30000"})
  })

  it.each([
    {milestone:"final" as const, received:"100000", refunded:"20000", adjustment:"-6000"},
    {milestone:"first_retainer" as const, received:"35000", refunded:"5000", adjustment:"-1500"},
  ])("applies an authorised partial $milestone adjustment", async ({milestone,received,refunded,adjustment}) => {
    const original = await verifyExpansionPayment(payment(milestone,received,"collection"))
    const input = {paymentId:original.paymentId,reference:"partial",reason:"Verified cash refund",netPence:refunded,treatment:"adjust_unpaid" as const}
    await expect(refundExpansionPayment({...input,termsApprovalReference:"An unrelated clause"})).rejects.toThrow("does not authorise")
    expect(await refundExpansionPayment({...input,termsApprovalReference:clause})).toMatchObject({commissionPence:adjustment})
  })

  // ---- Checkpoint 2A: persisted journeys for the pooled commercial plans (real migrations, real service SQL) ----
  const adopt = async (terms: ReturnType<typeof buildAcceptedTerms>) => {
    await state.database!.query("update expansion_contracts set terms=$1::jsonb where id=$2", [JSON.stringify(terms), CONTRACT])
    await state.database!.exec("delete from commercial_audit")
  }
  const allocate = (m: CommissionMilestone, amount: string, invoiceId = 1) => allocateExpansionInvoice({ contractId: CONTRACT, invoiceId, milestone: m, netPence: amount, evidenceReference: "Reviewed milestone breakdown" })
  const collect = (m: CommissionMilestone, amount: string, reference: string, invoiceId = 1) => verifyExpansionPayment({ contractId: CONTRACT, invoiceId, milestone: m, netPence: amount, grossPence: amount, reference, evidenceReference: "Bank statement verified by founder", confirmed: true })
  const ledgerTotal = async () => (await state.database!.query<{ t: string }>("select coalesce(sum(amount_pence),0)::text t from expansion_commission_ledger")).rows[0].t

  it("Case B: standard-v2 persists the twelve-month commitment and earns exactly £705", async () => {
    const terms = buildAcceptedTerms({ plan: "standard-v2" }); await adopt(terms)
    for (const m of ["deposit", "final", "first_retainer"] as const) await allocate(m, terms.milestones[m])
    expect((await collect("deposit", "100000", "b-1")).commissionPence).toBe("30000")
    expect((await collect("final", "100000", "b-2")).commissionPence).toBe("30000")
    expect((await collect("first_retainer", "35000", "b-3")).commissionPence).toBe("10500")
    expect(await ledgerTotal()).toBe("70500")
    const stored = (await state.database!.query<{ terms: { commitment: { minimumContractValuePence: string; minTermMonths: number } } }>("select terms from expansion_contracts where id=$1", [CONTRACT])).rows[0].terms
    expect(stored.commitment).toMatchObject({ minimumContractValuePence: "620000", minTermMonths: 12 })
  })
  it("Case C: £750 / £1,250 schedule earns £225 + £375 + £105 and replays idempotently", async () => {
    const terms = buildAcceptedTerms({ plan: "standard-v2", scheduleId: "deposit-completion" }); await adopt(terms)
    for (const m of ["deposit", "final", "first_retainer"] as const) await allocate(m, terms.milestones[m])
    expect((await collect("deposit", "75000", "c-1")).commissionPence).toBe("22500")
    expect((await collect("deposit", "75000", "c-1")).replayed).toBe(true)
    expect((await collect("final", "125000", "c-2")).commissionPence).toBe("37500")
    expect((await collect("first_retainer", "35000", "c-3")).commissionPence).toBe("10500")
    expect(await ledgerTotal()).toBe("70500")
  })
  it("Case P: four £500 instalments on persisted invoices earn £150 x 4 + £105; overpayment is rejected", async () => {
    const terms = buildAcceptedTerms({ plan: "standard-v2", scheduleId: "custom", buildInstalmentsPence: [50000, 50000, 50000, 50000], scheduleApprovalReference: "SYNTHETIC approval" }); await adopt(terms)
    await allocate("deposit", "50000"); await allocate("interim", "100000"); await allocate("final", "50000"); await allocate("first_retainer", "35000")
    const results = [await collect("deposit", "50000", "p-1"), await collect("interim", "50000", "p-2"), await collect("interim", "50000", "p-3"), await collect("final", "50000", "p-4"), await collect("first_retainer", "35000", "p-5")]
    expect(results.map(r => r.commissionPence)).toEqual(["15000", "15000", "15000", "15000", "10500"])
    await expect(collect("final", "1", "p-6")).rejects.toThrow()
    expect(await ledgerTotal()).toBe("70500")
  })
  it("Cases D/F: Growth Partnership-only earns £105 on the first £350 and nothing on later payments or builds", async () => {
    await adopt(buildAcceptedTerms({ plan: "growth-only-v1" }))
    await allocate("first_retainer", "35000")
    expect((await collect("first_retainer", "35000", "d-1")).commissionPence).toBe("10500")
    await expect(collect("first_retainer", "35000", "d-2")).rejects.toThrow()
    await expect(allocate("deposit", "1")).rejects.toThrow()
    expect(await ledgerTotal()).toBe("10500")
  })
  it("Case G: bespoke £25,000 accrues only as milestones are collected, with no £705 cap", async () => {
    await state.database!.exec("insert into invoices(id,client_id,total,status) values(4,1,2500000,'issued')")
    await adopt(buildAcceptedTerms({ plan: "bespoke-v1", buildInstalmentsPence: [1000000, 500000, 1000000] }))
    await allocate("deposit", "1000000", 4); await allocate("interim", "500000", 4); await allocate("final", "1000000", 4)
    expect(await ledgerTotal()).toBe("0")
    expect((await collect("deposit", "1000000", "g-1", 4)).commissionPence).toBe("300000")
    expect(await ledgerTotal()).toBe("300000")
    await collect("interim", "500000", "g-2", 4); await collect("final", "1000000", "g-3", 4)
    expect(await ledgerTotal()).toBe("750000")
  })
  it("pooled rounding holds across milestones in the persisted ledger", async () => {
    await adopt(buildAcceptedTerms({ plan: "bespoke-v1", buildInstalmentsPence: [5, 5, 5, 5] }))
    await allocate("deposit", "5"); await allocate("interim", "10"); await allocate("final", "5")
    await collect("deposit", "5", "r-1"); await collect("interim", "5", "r-2"); await collect("interim", "5", "r-3"); await collect("final", "5", "r-4")
    expect(await ledgerTotal()).toBe("6")
  })
  it("Case O (pooled): a £200 partial refund calculates -£60 and is held for review without touching the ledger", async () => {
    await adopt(buildAcceptedTerms({ plan: "standard-v2", scheduleId: "deposit-completion" }))
    await allocate("deposit", "75000"); await allocate("final", "125000")
    await collect("deposit", "75000", "o-1"); const final = await collect("final", "125000", "o-2")
    const refund = await refundExpansionPayment({ paymentId: final.paymentId, reference: "o-refund", reason: "Verified £200 cash refund", netPence: "20000" })
    expect(refund).toMatchObject({ commissionPence: "0", calculatedAdjustmentPence: "-6000", treatment: "manual_review" })
    expect(await ledgerTotal()).toBe("60000")
  })
})
