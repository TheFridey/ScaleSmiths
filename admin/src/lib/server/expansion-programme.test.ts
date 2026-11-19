import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { PgDialect } from "drizzle-orm/pg-core"
import type { SQL } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const FOUNDER = "10000000-0000-4000-8000-000000000001", USER_A = "10000000-0000-4000-8000-000000000002", USER_B = "10000000-0000-4000-8000-000000000003"
const PARTNER_A = "20000000-0000-4000-8000-000000000001", PARTNER_B = "20000000-0000-4000-8000-000000000002"
const state = vi.hoisted(() => ({ database: null as import("@electric-sql/pglite").PGlite | null, actor: { id: "10000000-0000-4000-8000-000000000001", role: "owner", sessionVersion: 1, active: true } }))
vi.mock("@/lib/db", () => ({ db: { transaction: async (op: (tx: { execute: (q: SQL) => Promise<unknown> }) => Promise<unknown>) => state.database!.transaction(async tx => op({ execute: async s => { const q = new PgDialect().sqlToQuery(s); return tx.query(q.sql, q.params) } })) } }))
vi.mock("./rbac", () => ({ requireCapability: async (c: string) => {
  if ((c === "expansion.manage" && state.actor.role !== "owner") || (c === "expansion.partner" && state.actor.role !== "independent_partner")) throw new Error("Forbidden capability")
  return { ...state.actor }
} }))
import { approveProgramme, attributeReferral, createProgramme, createReferralCode, decideQualification, getProgrammeAdmin, getProgrammeOverview, revokeQualification, reviewAchievementReward, reviewReferralReward } from "./expansion-programme"

const asFounder = () => { state.actor = { id: FOUNDER, role: "owner", sessionVersion: 1, active: true } }
const asPartner = (id = USER_A) => { state.actor = { id, role: "independent_partner", sessionVersion: 1, active: true } }
const q = <T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []) => state.database!.query<T>(sql, params)
const contractId = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`
/** n accepted contracts for a partner, each for its own canonical client, each with a verified £1,000 net collection. */
async function seedContracts(partnerId: string, from: number, n: number, collected = 100000) {
  for (let i = from; i < from + n; i++) {
    await q("insert into clients(id,name) values($1,$2) on conflict do nothing", [i, `Client ${i}`])
    await q("insert into expansion_opportunities(id,partner_id) values($1,$2)", [`30000000-0000-4000-8000-${String(i).padStart(12, "0")}`, partnerId])
    await q("insert into expansion_contracts(id,opportunity_id,client_id) values($1,$2,$3)", [contractId(i), `30000000-0000-4000-8000-${String(i).padStart(12, "0")}`, i])
    if (collected > 0) await q("insert into expansion_payment_events(id,contract_id,net_pence) values($1,$2,$3)", [`50000000-0000-4000-8000-${String(i).padStart(12, "0")}`, contractId(i), collected])
  }
}
const qualify = async (i: number) => { asFounder(); return decideQualification({ contractId: contractId(i), decision: "qualified", note: "Synthetic evidence reviewed" }) }

describe("achievements and referrals: derived qualification and gated rewards", () => {
  beforeAll(async () => {
    state.database = new PGlite()
    await state.database.exec(`
      create table admin_users(id uuid primary key,role text,active boolean,session_version integer,display_name text,email text);
      create table clients(id integer primary key,name text);
      create table partner_applications(id serial primary key,name text,email text,status text default 'submitted',submitted_at timestamptz default now());
      create table expansion_partners(id uuid primary key,user_id uuid references admin_users(id),application_id integer references partner_applications(id),activated_at timestamptz);
      create table expansion_opportunities(id uuid primary key,partner_id uuid references expansion_partners(id));
      create table expansion_contracts(id uuid primary key,opportunity_id uuid references expansion_opportunities(id),client_id integer references clients(id),accepted_at timestamptz default now());
      create table expansion_contract_cancellations(contract_id uuid primary key references expansion_contracts(id));
      create table expansion_payment_events(id uuid primary key,contract_id uuid references expansion_contracts(id),net_pence bigint,refund_treatment text);
      create table commercial_audit(id serial primary key,entity text,record_id text,action text);
      create table expansion_audit(id serial primary key,actor_id uuid,entity_id text,action text,details jsonb);
    `)
    await state.database.exec(readFileSync(new URL("../../../drizzle/0079_expansion_achievements_referrals.sql", import.meta.url), "utf8"))
  }, 30000)
  beforeEach(async () => {
    await q("truncate expansion_referral_rewards,expansion_referrals,expansion_referral_codes,expansion_achievement_rewards,expansion_client_qualifications,expansion_achievement_milestones,expansion_achievement_programmes,expansion_payment_events,expansion_contract_cancellations,expansion_contracts,expansion_opportunities,expansion_partners,partner_applications,clients,admin_users,commercial_audit,expansion_audit restart identity cascade")
    await q("insert into admin_users values($1,'owner',true,1,'Founder','founder@example.invalid'),($2,'independent_partner',true,1,'Partner A','a@example.invalid'),($3,'independent_partner',true,1,'Partner B','b@example.invalid')", [FOUNDER, USER_A, USER_B])
    await q("insert into partner_applications(id,name,email,status) values(1,'Partner A','a@example.invalid','activated'),(2,'Partner B','b@example.invalid','activated')")
    await q("insert into expansion_partners(id,user_id,application_id,activated_at) values($1,$2,1,now()),($3,$4,2,now())", [PARTNER_A, USER_A, PARTNER_B, USER_B])
    asFounder()
  })
  afterAll(async () => { await state.database?.close() })

  it("derives progress from founder-decided qualifications on real contracts, never an editable counter", async () => {
    await seedContracts(PARTNER_A, 1, 12)
    asPartner(); expect((await getProgrammeOverview()).qualifiedClients).toBe(0)
    await qualify(1)
    asPartner(); let o = await getProgrammeOverview()
    expect(o.qualifiedClients).toBe(1); expect(o.programme).toMatchObject({ planned: true, approved: false })
    expect(o.milestones[0]).toMatchObject({ clients: 1, reached: true }); expect(o.milestones[0].reward).toMatchObject({ status: "conditional" })
    for (const i of [2, 3, 4, 5]) await qualify(i)
    asPartner(); o = await getProgrammeOverview()
    expect(o.next).toMatchObject({ remaining: 5, next: { clients: 10 } })
    expect(o.rewards.map(r => [r.milestone_clients, r.status])).toEqual([[1, "conditional"], [5, "conditional"]])
    for (const i of [6, 7, 8, 9, 10]) await qualify(i)
    asPartner(); o = await getProgrammeOverview()
    expect(o.qualifiedClients).toBe(10); expect(o.rewards.find(r => r.kind === "bonus")).toMatchObject({ milestone_clients: 10, reward_pence: 25000, status: "conditional" })
    expect(o.approvedBonusPence).toBe(0)   // reaching a threshold creates no entitlement
    expect(o.plannedCumulativeBonusPence).toBe(25000)
  })
  it("refuses cancelled, uncollected, refund-disputed, repeated-client and below-minimum qualifications", async () => {
    await seedContracts(PARTNER_A, 1, 6); await seedContracts(PARTNER_A, 7, 1, 0)
    await q("insert into expansion_contract_cancellations(contract_id) values($1)", [contractId(1)])
    asFounder(); await expect(decideQualification({ contractId: contractId(1), decision: "qualified", note: "x" })).rejects.toThrow("cancelled")
    await expect(decideQualification({ contractId: contractId(7), decision: "qualified", note: "x" })).rejects.toThrow("verified net collections")
    await q("insert into expansion_payment_events(id,contract_id,net_pence,refund_treatment) values('50000000-0000-4000-8000-000000000099',$1,-1000,'manual_review')", [contractId(2)])
    await expect(decideQualification({ contractId: contractId(2), decision: "qualified", note: "x" })).rejects.toThrow("refund review")
    await qualify(3)
    await q("insert into expansion_opportunities(id,partner_id) values('30000000-0000-4000-8000-000000000100',$1)", [PARTNER_A])
    await q("insert into expansion_contracts(id,opportunity_id,client_id) values($1,'30000000-0000-4000-8000-000000000100',3)", [contractId(100)])
    await q("insert into expansion_payment_events(id,contract_id,net_pence) values('50000000-0000-4000-8000-000000000100',$1,500000)", [contractId(100)])
    await expect(decideQualification({ contractId: contractId(100), decision: "qualified", note: "same client, second project" })).rejects.toThrow("already counted")
    await expect(decideQualification({ contractId: contractId(3), decision: "qualified", note: "replay" })).rejects.toThrow("already counted")
    const prog = await createProgramme({ label: "v1", minQualifyingCollectedPence: 200000 }); await approveProgramme({ version: prog.version, approvalReference: "SYNTHETIC" })
    await expect(decideQualification({ contractId: contractId(4), decision: "qualified", note: "x" })).rejects.toThrow("below the programme minimum")
    expect((await q<{ c: number }>("select count(*)::int c from expansion_client_qualifications where status='qualified'")).rows[0].c).toBe(1)
  })
  it("revocation lowers the count and withdraws unapproved thresholds, and decisions are immutable history", async () => {
    await seedContracts(PARTNER_A, 1, 5)
    for (const i of [1, 2, 3, 4, 5]) await qualify(i)
    const five = (await q<{ id: string; status: string }>("select id,status from expansion_achievement_rewards where milestone_clients=5")).rows[0]
    expect(five.status).toBe("conditional")
    const qid = (await q<{ id: string }>("select id from expansion_client_qualifications where contract_id=$1", [contractId(5)])).rows[0].id
    await revokeQualification({ qualificationId: qid, reason: "Contract rescinded by the client" })
    expect((await q<{ status: string }>("select status from expansion_achievement_rewards where id=$1", [five.id])).rows[0].status).toBe("rejected")
    await expect(revokeQualification({ qualificationId: qid, reason: "again" })).rejects.toThrow("Only a qualified client")
    await expect(q("update expansion_client_qualifications set note='rewritten' where id=$1", [qid])).rejects.toThrow("immutable")
    await expect(q("delete from expansion_client_qualifications")).rejects.toThrow("append-only")
    await qualify(5).catch(() => undefined)   // a client may be re-decided after revocation
    asPartner(); expect((await getProgrammeOverview()).qualifiedClients).toBeGreaterThanOrEqual(4)
  })
  it("rewards stay unapprovable until a programme is approved, and financial rewards need explicit activation", async () => {
    await seedContracts(PARTNER_A, 1, 10)
    for (let i = 1; i <= 10; i++) await qualify(i)
    const reward = async (clients: number) => (await q<{ id: string }>("select id from expansion_achievement_rewards where milestone_clients=$1 and status<>'rejected'", [clients])).rows[0].id
    const polo = await reward(1), bonus = await reward(10)
    await reviewAchievementReward({ rewardId: polo, decision: "under_review" })
    await expect(reviewAchievementReward({ rewardId: polo, decision: "approved" })).rejects.toThrow("approved programme")
    const v1 = await createProgramme({ label: "Scale Your Future v1" }); await approveProgramme({ version: v1.version, approvalReference: "SYNTHETIC board note", financialRewardsEnabled: false })
    await reviewAchievementReward({ rewardId: polo, decision: "approved", note: "Non-financial recognition approved" })
    expect((await q<{ programme_version: number }>("select programme_version from expansion_achievement_rewards where id=$1", [polo])).rows[0].programme_version).toBe(v1.version)
    await reviewAchievementReward({ rewardId: bonus, decision: "under_review" })
    await expect(reviewAchievementReward({ rewardId: bonus, decision: "approved" })).rejects.toThrow("Financial rewards are not enabled")
    await expect(q("update expansion_achievement_rewards set status='approved' where id=$1", [bonus])).rejects.toThrow()          // direct SQL cannot bypass the gate either
    await expect(reviewAchievementReward({ rewardId: bonus, decision: "fulfilled" })).rejects.toThrow()                         // no skipping states
    expect(await reviewAchievementReward({ rewardId: polo, decision: "approved" })).toMatchObject({ replayed: true })
    await reviewAchievementReward({ rewardId: polo, decision: "fulfilled" })
    await expect(reviewAchievementReward({ rewardId: polo, decision: "rejected" })).rejects.toThrow()
    asPartner(); const o = await getProgrammeOverview()
    expect(o.approvedBonusPence).toBe(0); expect(o.programme).toMatchObject({ approved: true, financialRewardsEnabled: false })
  })
  it("an approved programme version and its milestones are immutable; a later version may enable financial rewards", async () => {
    const one = await createProgramme({ label: "v1" }); await approveProgramme({ version: one.version, approvalReference: "SYNTHETIC" })
    await expect(q(`update expansion_achievement_programmes set financial_rewards_enabled=true where version=${one.version}`)).rejects.toThrow()
    await expect(q(`update expansion_achievement_milestones set reward_pence=1 where programme_version=${one.version} and clients=10`)).rejects.toThrow("immutable")
    await expect(q(`delete from expansion_achievement_milestones where programme_version=${one.version}`)).rejects.toThrow("immutable")
    await expect(approveProgramme({ version: one.version, approvalReference: "again" })).rejects.toThrow("already approved")
    await expect(q("insert into expansion_achievement_programmes(label,financial_rewards_enabled,created_by) values('bad',true,$1)", [FOUNDER])).rejects.toThrow()   // cannot enable rewards unapproved
    const two = await createProgramme({ label: "v2" }); await approveProgramme({ version: two.version, approvalReference: "SYNTHETIC accounting-approved", financialRewardsEnabled: true })
    await seedContracts(PARTNER_A, 1, 10); for (let i = 1; i <= 10; i++) await qualify(i)
    const bonus = (await q<{ id: string }>("select id from expansion_achievement_rewards where milestone_clients=10")).rows[0].id
    await reviewAchievementReward({ rewardId: bonus, decision: "under_review" }); await reviewAchievementReward({ rewardId: bonus, decision: "approved" })
    asPartner(); expect((await getProgrammeOverview()).approvedBonusPence).toBe(25000)
  })
  it("prevents duplicate rewards, in the service and in the database", async () => {
    await seedContracts(PARTNER_A, 1, 5); for (let i = 1; i <= 5; i++) await qualify(i)
    expect((await q<{ c: number }>("select count(*)::int c from expansion_achievement_rewards")).rows[0].c).toBe(2)
    await expect(q("insert into expansion_achievement_rewards(id,partner_id,milestone_clients,kind,label) values(gen_random_uuid(),$1,1,'polo','duplicate')", [PARTNER_A])).rejects.toThrow()
    await expect(q("update expansion_achievement_rewards set reward_pence=5 where milestone_clients=5")).rejects.toThrow()
  })
  it("referral: unique code, founder attribution before activation, no self-referral or reassignment", async () => {
    asPartner(); const code = await createReferralCode(); expect(code).toMatchObject({ created: true }); expect(await createReferralCode()).toEqual({ code: code.code, created: false })
    await q("insert into partner_applications(id,name,email,status) values(3,'Applicant C','c@example.invalid','under_review'),(4,'Self','a@example.invalid','submitted'),(5,'Late','late@example.invalid','activated')")
    asFounder()
    await expect(attributeReferral({ applicationId: 4, code: code.code })).rejects.toThrow("cannot refer themselves")
    await expect(attributeReferral({ applicationId: 5, code: code.code })).rejects.toThrow("before the applicant is activated")
    await expect(attributeReferral({ applicationId: 1, code: code.code })).rejects.toThrow()
    await expect(attributeReferral({ applicationId: 3, code: "SS-AAAAAAAA" })).rejects.toThrow("not found")
    const first = await attributeReferral({ applicationId: 3, code: code.code })
    expect(await attributeReferral({ applicationId: 3, code: code.code })).toMatchObject({ replayed: true, referralId: first.referralId })
    asPartner(USER_B); const other = await createReferralCode(); asFounder()
    await expect(attributeReferral({ applicationId: 3, code: other.code })).rejects.toThrow("cannot be reassigned")
    for (const sql of ["update expansion_referrals set referrer_partner_id='" + PARTNER_B + "'", "delete from expansion_referrals"]) await expect(q(sql)).rejects.toThrow("immutable")
  })
  it("Case K: five qualifying clients make a £250 reward reviewable, never payable, with no recurring referral commission", async () => {
    asPartner(); const code = await createReferralCode()
    await q("insert into partner_applications(id,name,email,status) values(3,'Referred Partner','referred@example.invalid','under_review')")
    asFounder(); await attributeReferral({ applicationId: 3, code: code.code })
    // vetting is ordinary: the application becomes a partner only through the existing activation flow (simulated here as the resulting row)
    await q("update partner_applications set status='activated' where id=3")
    await q("insert into admin_users values('10000000-0000-4000-8000-000000000004','independent_partner',true,1,'Referred','referred@example.invalid')")
    await q("insert into expansion_partners(id,user_id,application_id,activated_at) values('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004',3,now())")
    const referred = "20000000-0000-4000-8000-000000000003"
    await seedContracts(referred, 20, 5)
    for (let i = 20; i < 24; i++) await qualify(i)
    expect((await q("select * from expansion_referral_rewards")).rows).toEqual([])
    await qualify(24)
    const reward = (await q<{ id: string; status: string; amount_pence: number }>("select id,status,amount_pence from expansion_referral_rewards")).rows[0]
    expect(reward).toMatchObject({ status: "conditional", amount_pence: 25000 })
    await qualify(24).catch(() => undefined)
    expect((await q<{ c: number }>("select count(*)::int c from expansion_referral_rewards")).rows[0].c).toBe(1)
    await reviewReferralReward({ rewardId: reward.id, decision: "under_review" })
    await expect(reviewReferralReward({ rewardId: reward.id, decision: "approved" })).rejects.toThrow("not enabled")
    const pv = await createProgramme({ label: "v1" }); await approveProgramme({ version: pv.version, approvalReference: "SYNTHETIC", referralRewardsEnabled: true })
    await reviewReferralReward({ rewardId: reward.id, decision: "approved", note: "Evidence reviewed" })
    expect((await q("select * from expansion_referral_rewards where id=$1 and status='approved'", [reward.id])).rows).toHaveLength(1)
    // privacy: the referrer sees a coarse stage and a count only
    asPartner(); const view = await getProgrammeOverview()
    expect(view.referral.referred).toEqual([{ stage: "activated", qualifiedClients: 5, threshold: 5, rewardStatus: "approved" }])
    expect(JSON.stringify(view)).not.toMatch(/Referred Partner|referred@example|Client 2/)
    // the referred partner cannot see or alter the referrer's records
    asPartner(USER_B); expect((await getProgrammeOverview()).referral.referred).toEqual([])
  })
  it("withdraws an unapproved referral reward when the referred partner falls below five", async () => {
    asPartner(); const code = await createReferralCode()
    await q("insert into partner_applications(id,name,email,status) values(3,'R','r@example.invalid','under_review')"); asFounder(); await attributeReferral({ applicationId: 3, code: code.code })
    await q("insert into admin_users values('10000000-0000-4000-8000-000000000004','independent_partner',true,1,'R','r@example.invalid')")
    await q("update partner_applications set status='activated' where id=3")
    await q("insert into expansion_partners(id,user_id,application_id,activated_at) values('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004',3,now())")
    await seedContracts("20000000-0000-4000-8000-000000000003", 20, 5); for (let i = 20; i < 25; i++) await qualify(i)
    expect((await q("select status from expansion_referral_rewards")).rows).toEqual([{ status: "conditional" }])
    const qid = (await q<{ id: string }>("select id from expansion_client_qualifications where contract_id=$1", [contractId(24)])).rows[0].id
    await revokeQualification({ qualificationId: qid, reason: "Cancelled" })
    expect((await q("select status from expansion_referral_rewards")).rows).toEqual([{ status: "rejected" }])
  })
  it("authorisation: partners cannot decide, approve or enable anything; founders cannot use partner views; partners see only their own", async () => {
    await seedContracts(PARTNER_A, 1, 1); await seedContracts(PARTNER_B, 50, 1)
    asPartner()
    await expect(decideQualification({ contractId: contractId(1), decision: "qualified", note: "self" })).rejects.toThrow("Forbidden capability")
    await expect(createProgramme({ label: "x" })).rejects.toThrow("Forbidden capability")
    await expect(approveProgramme({ version: 1, approvalReference: "x", financialRewardsEnabled: true })).rejects.toThrow("Forbidden capability")
    await expect(reviewAchievementReward({ rewardId: contractId(1), decision: "approved" })).rejects.toThrow("Forbidden capability")
    await expect(getProgrammeAdmin()).rejects.toThrow("Forbidden capability")
    asFounder(); await expect(getProgrammeOverview()).rejects.toThrow("Forbidden capability"); await expect(createReferralCode()).rejects.toThrow("Forbidden capability")
    await qualify(1); asPartner(USER_B); expect((await getProgrammeOverview()).qualifiedClients).toBe(0)
    asFounder(); const admin = await getProgrammeAdmin(); expect(admin.candidates).toHaveLength(2)
    await q("update expansion_partners set activated_at=null where id=$1", [PARTNER_B]); asPartner(USER_B)
    await expect(getProgrammeOverview()).rejects.toThrow("Active partner profile")
  })
})
