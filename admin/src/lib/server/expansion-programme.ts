import "server-only"
import { randomBytes, randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { type AdminRole } from "@/lib/admin-users"
import { hasCapability } from "@/lib/rbac"
import { ExpansionError } from "@/lib/expansion"
import { requireCapability } from "./rbac"
import { cumulativeBonusPence, isReferralCode, progressTowardsNext, PROPOSED_MILESTONES, referralCodeFromBytes, REFERRAL_THRESHOLD, type MilestoneDefinition } from "@/lib/expansion-programme"

/*
 * Achievements and referrals (checkpoint 4B). Progress is COUNTED from founder-decided qualification rows on real accepted contracts with
 * verified collections; there is no editable counter. Nothing here creates a payable liability: rewards are records with database-gated
 * statuses, and financial or referral rewards cannot be approved unless an approved programme version explicitly enables them.
 * Lock order follows LOCK-HIERARCHY.md: admin_users (share) -> partner (update) -> reward/qualification rows.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
type Actor = Awaited<ReturnType<typeof requireCapability>>
export class ProgrammeError extends ExpansionError { constructor(message: string, status = 400) { super(message, status); this.name = "ProgrammeError" } }
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
const conflict = (message: string): never => { throw new ProgrammeError(message, 409) }
const uuid = (value: unknown) => { if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ProgrammeError("A valid record identifier is required."); return value.toLowerCase() }
const text = (value: unknown, label: string, max = 2000) => { if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new ProgrammeError(`${label} is required (maximum ${max} characters).`); return value.trim() }
async function founderGuard(tx: Executor, actor: Actor) {
  const [user] = await rows(tx, sql`select role::text,active,session_version from admin_users where id=${actor.id} for share`)
  if (!user?.active || user.session_version !== actor.sessionVersion || !hasCapability(user.role as AdminRole, "expansion.manage")) throw new ProgrammeError("Founder authority was revoked.", 403)
}
async function partnerGuard(tx: Executor, actor: Actor) {
  await tx.execute(sql`select id from admin_users where id=${actor.id} for share`)
  const [partner] = await rows(tx, sql`select p.id from expansion_partners p join admin_users u on u.id=p.user_id where p.user_id=${actor.id} and p.activated_at is not null and u.active=true and u.session_version=${actor.sessionVersion} and u.role::text='independent_partner'`)
  if (!partner) throw new ProgrammeError("Active partner profile required.", 403)
  return String(partner.id)
}
const audit = (tx: Executor, actorId: string, entity: string, action: string, details: unknown) =>
  tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actorId},${entity},${action},${JSON.stringify(details)}::jsonb)`)
/** The database's own refusal text, from node-postgres (error.cause) or any driver exposing it on the error. */
const dbMessage = (error: unknown, fallback: string) => { const e = error as { cause?: { message?: string }; message?: string }; const m = e.cause?.message ?? e.message ?? fallback; return /^Failed query/.test(m) ? fallback : m }
const lockPartner = (tx: Executor, id: string) => tx.execute(sql`select id from expansion_partners where id=${id} for update`)

async function activeProgramme(tx: Executor) {
  const [programme] = await rows(tx, sql`select * from expansion_achievement_programmes where approved order by version desc limit 1`)
  if (!programme) return { version: null as number | null, milestones: PROPOSED_MILESTONES as readonly MilestoneDefinition[], programme: null as Row | null }
  const milestones = (await rows(tx, sql`select clients,kind,reward_pence,label from expansion_achievement_milestones where programme_version=${Number(programme.version)} order by clients`))
    .map(m => ({ clients: Number(m.clients), kind: m.kind as MilestoneDefinition["kind"], rewardPence: Number(m.reward_pence), label: String(m.label) }))
  return { version: Number(programme.version), milestones, programme }
}
const qualifiedCount = async (tx: Executor, partnerId: string) => Number((await rows(tx, sql`select count(*)::int c from expansion_client_qualifications where partner_id=${partnerId} and status='qualified'`))[0].c)

/** Idempotent: creates missing conditional rewards, and withdraws unapproved ones whose threshold is no longer met. Never approves anything. */
async function syncRewards(tx: Executor, partnerId: string) {
  const count = await qualifiedCount(tx, partnerId)
  const { version, milestones } = await activeProgramme(tx)
  for (const m of milestones) {
    if (m.clients > count) continue
    const [existing] = await rows(tx, sql`select id from expansion_achievement_rewards where partner_id=${partnerId} and milestone_clients=${m.clients} and status<>'rejected'`)
    if (!existing) await tx.execute(sql`insert into expansion_achievement_rewards(id,partner_id,programme_version,milestone_clients,kind,reward_pence,label) values(${randomUUID()},${partnerId},${version},${m.clients},${m.kind},${m.rewardPence},${m.label}) on conflict do nothing`)
  }
  for (const r of await rows(tx, sql`select id,milestone_clients from expansion_achievement_rewards where partner_id=${partnerId} and status in ('conditional','under_review')`)) {
    if (Number(r.milestone_clients) > count) await tx.execute(sql`update expansion_achievement_rewards set status='rejected',review_note='Withdrawn automatically: the qualifying-client threshold is no longer met.',updated_at=now() where id=${String(r.id)}`)
  }
}
async function syncReferralRewards(tx: Executor, referredPartnerId: string) {
  const count = await qualifiedCount(tx, referredPartnerId)
  const [referral] = await rows(tx, sql`select r.id from expansion_referrals r join expansion_partners p on p.application_id=r.application_id where p.id=${referredPartnerId}`)
  if (!referral) return
  if (count >= REFERRAL_THRESHOLD) await tx.execute(sql`insert into expansion_referral_rewards(id,referral_id) values(${randomUUID()},${String(referral.id)}) on conflict do nothing`)
  else await tx.execute(sql`update expansion_referral_rewards set status='rejected',review_note='Withdrawn automatically: the referred partner is below the qualifying-client threshold.',updated_at=now() where referral_id=${String(referral.id)} and status in ('conditional','under_review')`)
}

export async function getProgrammeOverview() {
  const actor = await requireCapability("expansion.partner")
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    const partnerId = await partnerGuard(tx, actor)
    const count = await qualifiedCount(tx, partnerId)
    const { version, milestones, programme } = await activeProgramme(tx)
    const rewards = await rows(tx, sql`select id,milestone_clients,kind,reward_pence,label,status,review_note,fulfilled_at from expansion_achievement_rewards where partner_id=${partnerId} order by milestone_clients`)
    const approved = rewards.filter(r => r.kind === "bonus" && ["approved", "fulfilment_pending", "fulfilled"].includes(String(r.status)))
    const [code] = await rows(tx, sql`select code from expansion_referral_codes where partner_id=${partnerId}`)
    // Referral visibility is deliberately coarse: a coarse stage and a count. No names, finances, customers or notes of referred partners.
    const referred = await rows(tx, sql`select case when p.activated_at is not null then 'activated' else 'in_review' end stage,
      coalesce((select count(*) from expansion_client_qualifications q where q.partner_id=p.id and q.status='qualified'),0)::int qualified,
      rw.status reward_status
      from expansion_referrals r join partner_applications a on a.id=r.application_id left join expansion_partners p on p.application_id=r.application_id and p.activated_at is not null
      left join expansion_referral_rewards rw on rw.referral_id=r.id where r.referrer_partner_id=${partnerId} order by r.created_at`)
    return {
      qualifiedClients: count,
      programme: { version, approved: Boolean(programme), financialRewardsEnabled: Boolean(programme?.financial_rewards_enabled), referralRewardsEnabled: Boolean(programme?.referral_rewards_enabled), planned: !programme },
      milestones: milestones.map(m => ({ ...m, reached: m.clients <= count, reward: rewards.find(r => Number(r.milestone_clients) === m.clients && r.status !== "rejected") ?? null })),
      next: progressTowardsNext(count, milestones),
      plannedCumulativeBonusPence: cumulativeBonusPence(count, milestones),
      approvedBonusPence: approved.reduce((sum, r) => sum + Number(r.reward_pence), 0),
      rewards,
      referral: { code: code ? String(code.code) : null, referred: referred.map(r => ({ stage: r.stage, qualifiedClients: Number(r.qualified), threshold: REFERRAL_THRESHOLD, rewardStatus: r.reward_status ?? null })) },
    }
  })
}

export async function createReferralCode() {
  const actor = await requireCapability("expansion.partner")
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    await lockPartner(tx, partnerId)
    const [existing] = await rows(tx, sql`select code from expansion_referral_codes where partner_id=${partnerId}`)
    if (existing) return { code: String(existing.code), created: false }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = referralCodeFromBytes(randomBytes(8))
      const inserted = await rows(tx, sql`insert into expansion_referral_codes(partner_id,code) values(${partnerId},${code}) on conflict do nothing returning code`)
      if (inserted[0]) { await audit(tx, actor.id, partnerId, "referral_code_created", { code }); return { code, created: true } }
    }
    return conflict("Could not allocate a unique referral code; try again.")
  })
}

export async function createProgramme(input: { label: string; minQualifyingCollectedPence?: number }) {
  const actor = await requireCapability("expansion.manage")
  const label = text(input.label, "Programme label", 120)
  const min = input.minQualifyingCollectedPence === undefined ? null : Number(input.minQualifyingCollectedPence)
  if (min !== null && (!Number.isSafeInteger(min) || min <= 0)) throw new ProgrammeError("The minimum qualifying collection must be a positive integer number of pence.")
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [created] = await rows(tx, sql`insert into expansion_achievement_programmes(label,min_qualifying_collected_pence,created_by) values(${label},${min},${actor.id}) returning version`)
    for (const m of PROPOSED_MILESTONES) await tx.execute(sql`insert into expansion_achievement_milestones(programme_version,clients,kind,reward_pence,label) values(${Number(created.version)},${m.clients},${m.kind},${m.rewardPence},${m.label})`)
    await audit(tx, actor.id, String(created.version), "programme_drafted", { label, min })
    return { version: Number(created.version) }
  })
}

export async function approveProgramme(input: { version: number; approvalReference: string; financialRewardsEnabled?: boolean; referralRewardsEnabled?: boolean }) {
  const actor = await requireCapability("expansion.manage")
  const ref = text(input.approvalReference, "Approval reference", 500)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [programme] = await rows(tx, sql`select approved from expansion_achievement_programmes where version=${Number(input.version)} for update`)
    if (!programme) throw new ProgrammeError("Programme version not found.", 404)
    if (programme.approved) conflict("This programme version is already approved and immutable.")
    await tx.execute(sql`update expansion_achievement_programmes set approved=true,approval_reference=${ref},approved_by=${actor.id},financial_rewards_enabled=${input.financialRewardsEnabled === true},referral_rewards_enabled=${input.referralRewardsEnabled === true} where version=${Number(input.version)}`)
    await audit(tx, actor.id, String(input.version), "programme_approved", { ref, financial: input.financialRewardsEnabled === true, referral: input.referralRewardsEnabled === true })
    return { version: Number(input.version), approved: true }
  })
}

async function contractFacts(tx: Executor, contractId: string) {
  const [c] = await rows(tx, sql`select c.id,c.client_id,o.partner_id,
      coalesce((select sum(e.net_pence) from expansion_payment_events e where e.contract_id=c.id),0)::bigint net,
      exists(select 1 from expansion_contract_cancellations x where x.contract_id=c.id) cancelled,
      exists(select 1 from expansion_payment_events e where e.contract_id=c.id and e.refund_treatment='manual_review'
        and not exists(select 1 from commercial_audit a where a.entity='partner_finance' and a.record_id=e.id::text and a.action='refund_entitlement_retained')) refund_review
    from expansion_contracts c join expansion_opportunities o on o.id=c.opportunity_id where c.id=${contractId}`)
  return c
}

export async function decideQualification(input: { contractId: string; decision: "qualified" | "rejected"; note: string }) {
  const actor = await requireCapability("expansion.manage"), contractId = uuid(input.contractId)
  const note = text(input.note, "Qualification evidence and decision", 2000)
  if (!["qualified", "rejected"].includes(input.decision)) throw new ProgrammeError("Choose qualified or rejected.")
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const first = await contractFacts(tx, contractId)
    if (!first) throw new ProgrammeError("Contract not found.", 404)
    const partnerId = String(first.partner_id)
    await lockPartner(tx, partnerId)
    await tx.execute(sql`select id from expansion_contracts where id=${contractId} for update`)   // serialises with cancel_contract, which locks the same row
    const c = await contractFacts(tx, contractId)
    const { version, programme } = await activeProgramme(tx)
    if (input.decision === "qualified") {
      if (c.cancelled) conflict("A cancelled contract cannot qualify.")
      if (c.refund_review) conflict("Resolve the outstanding refund review before qualifying this client.")
      if (BigInt(String(c.net)) <= BigInt(0)) conflict("A qualifying client needs verified net collections on the accepted contract.")
      const min = programme?.min_qualifying_collected_pence
      if (min != null && BigInt(String(c.net)) < BigInt(Number(min))) conflict(`Verified collections are below the programme minimum.`)
      const [dup] = await rows(tx, sql`select id from expansion_client_qualifications where client_id=${Number(c.client_id)} and status='qualified'`)
      if (dup) conflict("This canonical client is already counted as a qualifying client.")
    }
    const id = randomUUID()
    await tx.execute(sql`insert into expansion_client_qualifications(id,partner_id,client_id,contract_id,status,programme_version,net_collected_pence,note,decided_by) values(${id},${partnerId},${Number(c.client_id)},${contractId},${input.decision},${version},${String(c.net)}::bigint,${note},${actor.id})`)
    if (input.decision === "qualified") { await syncRewards(tx, partnerId); await syncReferralRewards(tx, partnerId) }
    await audit(tx, actor.id, id, `qualification_${input.decision}`, { contractId, note, netCollectedPence: String(c.net) })
    return { qualificationId: id, status: input.decision }
  })
}

export async function revokeQualification(input: { qualificationId: string; reason: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.qualificationId)
  const reason = text(input.reason, "Revocation reason", 1000)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [source] = await rows(tx, sql`select partner_id from expansion_client_qualifications where id=${id}`)
    if (!source) throw new ProgrammeError("Qualification not found.", 404)
    await lockPartner(tx, String(source.partner_id))
    const updated = await rows(tx, sql`update expansion_client_qualifications set status='revoked',revoked_by=${actor.id},revoked_at=now(),revoke_reason=${reason} where id=${id} and status='qualified' returning id`)
    if (!updated[0]) conflict("Only a qualified client can be revoked.")
    await syncRewards(tx, String(source.partner_id)); await syncReferralRewards(tx, String(source.partner_id))
    await audit(tx, actor.id, id, "qualification_revoked", { reason })
    return { qualificationId: id, status: "revoked" }
  })
}

export async function reviewAchievementReward(input: { rewardId: string; decision: "under_review" | "approved" | "rejected" | "fulfilment_pending" | "fulfilled"; note?: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.rewardId)
  if (!["under_review", "approved", "rejected", "fulfilment_pending", "fulfilled"].includes(input.decision)) throw new ProgrammeError("Choose a valid reward decision.")
  const note = input.note === undefined || input.note === "" ? null : text(input.note, "Note", 2000)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [source] = await rows(tx, sql`select partner_id from expansion_achievement_rewards where id=${id}`)
    if (!source) throw new ProgrammeError("Reward not found.", 404)
    await lockPartner(tx, String(source.partner_id))
    const [reward] = await rows(tx, sql`select status from expansion_achievement_rewards where id=${id} for update`)
    if (reward.status === input.decision) return { rewardId: id, status: input.decision, replayed: true }
    // The database enforces the transition table and the approved-programme / financial-enabled gates; surface its refusal as a conflict.
    try {
      await tx.execute(sql`update expansion_achievement_rewards set status=${input.decision},reviewed_by=${actor.id},review_note=coalesce(${note},review_note),fulfilled_at=${input.decision === "fulfilled" ? sql`now()` : sql`fulfilled_at`},updated_at=now(),
        programme_version=coalesce(programme_version,${["approved", "fulfilment_pending", "fulfilled"].includes(input.decision) ? (await activeProgramme(tx)).version : null}) where id=${id}`)
    } catch (error) { throw new ProgrammeError(dbMessage(error, "This reward decision is not permitted."), 409) }
    await audit(tx, actor.id, id, `reward_${input.decision}`, { note })
    return { rewardId: id, status: input.decision, replayed: false }
  })
}

export async function attributeReferral(input: { applicationId: number; code: string }) {
  const actor = await requireCapability("expansion.manage")
  if (!Number.isSafeInteger(input.applicationId) || input.applicationId <= 0 || !isReferralCode(input.code)) throw new ProgrammeError("Enter an application and a valid referral code.")
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [owner] = await rows(tx, sql`select partner_id from expansion_referral_codes where code=${input.code}`)
    if (!owner) throw new ProgrammeError("Referral code not found.", 404)
    await lockPartner(tx, String(owner.partner_id))
    // Same row lock the invitation flow takes, so attribution and invitation cannot both pass the not-yet-activated check.
    if (!(await rows(tx, sql`select id from partner_applications where id=${input.applicationId} for update`))[0]) throw new ProgrammeError("Application not found.", 404)
    const [existing] = await rows(tx, sql`select id,referrer_partner_id from expansion_referrals where application_id=${input.applicationId}`)
    if (existing) { if (String(existing.referrer_partner_id) === String(owner.partner_id)) return { referralId: String(existing.id), replayed: true }; conflict("This applicant is already attributed to a different partner. Attribution cannot be reassigned.") }
    const id = randomUUID()
    try { await tx.execute(sql`insert into expansion_referrals(id,referrer_partner_id,application_id,code,attributed_by) values(${id},${String(owner.partner_id)},${input.applicationId},${input.code},${actor.id})`) }
    catch (error) { const m = dbMessage(error, "This attribution is not permitted."); throw new ProgrammeError(/duplicate key|unique/i.test(m) ? "This applicant is already attributed to a different partner. Attribution cannot be reassigned." : m, 409) }
    await audit(tx, actor.id, id, "referral_attributed", { applicationId: input.applicationId, code: input.code })
    return { referralId: id, replayed: false }
  })
}

export async function reviewReferralReward(input: { rewardId: string; decision: "under_review" | "approved" | "rejected" | "fulfilled"; note?: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.rewardId)
  if (!["under_review", "approved", "rejected", "fulfilled"].includes(input.decision)) throw new ProgrammeError("Choose a valid reward decision.")
  const note = input.note === undefined || input.note === "" ? null : text(input.note, "Note", 2000)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [reward] = await rows(tx, sql`select rw.status,r.referrer_partner_id from expansion_referral_rewards rw join expansion_referrals r on r.id=rw.referral_id where rw.id=${id}`)
    if (!reward) throw new ProgrammeError("Referral reward not found.", 404)
    await lockPartner(tx, String(reward.referrer_partner_id))
    const { version } = await activeProgramme(tx)
    if (reward.status === input.decision) return { rewardId: id, status: input.decision, replayed: true }
    try { await tx.execute(sql`update expansion_referral_rewards set status=${input.decision},reviewed_by=${actor.id},review_note=coalesce(${note},review_note),programme_version=${version},updated_at=now() where id=${id}`) }
    catch (error) { throw new ProgrammeError(dbMessage(error, "This reward decision is not permitted."), 409) }
    await audit(tx, actor.id, id, `referral_reward_${input.decision}`, { note })
    return { rewardId: id, status: input.decision, replayed: false }
  })
}

export async function getProgrammeAdmin() {
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await founderGuard(tx, actor)
    const programmes = await rows(tx, sql`select version,label,approved,financial_rewards_enabled,referral_rewards_enabled,min_qualifying_collected_pence,approval_reference from expansion_achievement_programmes order by version desc`)
    const candidates = await rows(tx, sql`select c.id contract_id,u.display_name partner_name,cl.name client_name,c.accepted_at,
        coalesce((select sum(e.net_pence) from expansion_payment_events e where e.contract_id=c.id),0)::text net_collected_pence,
        exists(select 1 from expansion_contract_cancellations x where x.contract_id=c.id) cancelled,
        exists(select 1 from expansion_payment_events e where e.contract_id=c.id and e.refund_treatment='manual_review' and not exists(select 1 from commercial_audit a where a.entity='partner_finance' and a.record_id=e.id::text and a.action='refund_entitlement_retained')) refund_review,
        (select q.status from expansion_client_qualifications q where q.contract_id=c.id order by q.decided_at desc limit 1) decision
      from expansion_contracts c join expansion_opportunities o on o.id=c.opportunity_id join expansion_partners p on p.id=o.partner_id join admin_users u on u.id=p.user_id join clients cl on cl.id=c.client_id order by c.accepted_at desc limit 200`)
    const rewards = await rows(tx, sql`select r.id,u.display_name partner_name,r.milestone_clients,r.kind,r.reward_pence,r.label,r.status,r.review_note,r.programme_version,
        (select count(*) from expansion_client_qualifications q where q.partner_id=r.partner_id and q.status='qualified')::int qualified from expansion_achievement_rewards r join expansion_partners p on p.id=r.partner_id join admin_users u on u.id=p.user_id order by r.created_at desc limit 200`)
    const referrals = await rows(tx, sql`select r.id,ru.display_name referrer_name,a.name applicant_name,a.status application_status,r.code,pp.id referred_partner_id,
        coalesce((select count(*) from expansion_client_qualifications q where q.partner_id=pp.id and q.status='qualified'),0)::int qualified,
        rw.id reward_id,rw.status reward_status from expansion_referrals r join expansion_partners rp on rp.id=r.referrer_partner_id join admin_users ru on ru.id=rp.user_id
        join partner_applications a on a.id=r.application_id left join expansion_partners pp on pp.application_id=r.application_id left join expansion_referral_rewards rw on rw.referral_id=r.id order by r.created_at desc limit 200`)
    const openApplications = await rows(tx, sql`select a.id,a.name,a.status from partner_applications a where a.status not in ('activated','declined','withdrawn','archived') and not exists(select 1 from expansion_referrals r where r.application_id=a.id) order by a.submitted_at desc limit 100`)
    return { programmes, candidates, rewards, referrals, openApplications }
  })
}
