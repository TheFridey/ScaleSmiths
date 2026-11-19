import "server-only"
import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { type AdminRole } from "@/lib/admin-users"
import { hasCapability } from "@/lib/rbac"
import { ExpansionError } from "@/lib/expansion"
import { safeDbMessage } from "@/lib/db-errors"
import { requireCapability } from "./rbac"

/*
 * Founding Partner recognition (checkpoint 5). Entirely founder-controlled: nomination, evidence, review, decision, approved benefits,
 * fulfilment history, correction and revocation. Never granted by application order, activation date or a numeric threshold, and never
 * implies equity, ownership, directorship, employment or guaranteed income. Benefits are manual records; nothing is paid or provisioned here.
 * Lock order (LOCK-HIERARCHY.md): admin_users (share) -> expansion_partners (update) -> recognition row.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
type Actor = Awaited<ReturnType<typeof requireCapability>>
export const BADGE_VERSION = "founding-partner-v1"
export class RecognitionError extends ExpansionError { constructor(message: string, status = 400) { super(message, status); this.name = "RecognitionError" } }
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
const conflict = (message: string): never => { throw new RecognitionError(message, 409) }
const uuid = (value: unknown) => { if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new RecognitionError("A valid record identifier is required."); return value.toLowerCase() }
/** Wording that would misstate what recognition is. Rejected wherever founders write free text that a partner or the public may later see. */
const FORBIDDEN = /\b(equity|shares?|shareholder|stock|ownership|owner|co-?owner|director(ship)?|employee|employment|salary|guaranteed|guarantee|profit[- ]?share|partnership interest)\b/i
const text = (value: unknown, label: string, max = 2000, min = 1) => {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) throw new RecognitionError(`${label} is required (${min > 1 ? `${min} to ` : "up to "}${max} characters).`)
  return value.trim()
}
const publicText = (value: unknown, label: string, max: number, min = 5) => {
  const v = text(value, label, max, min)
  if (FORBIDDEN.test(v)) throw new RecognitionError(`${label} must not suggest equity, ownership, directorship, employment or guaranteed income. Recognition carries none of these.`)
  return v
}
const dbMessage = (error: unknown, fallback: string) => safeDbMessage(error, fallback)
const audit = (tx: Executor, actorId: string, entity: string, action: string, details: unknown) =>
  tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actorId},${entity},${action},${JSON.stringify(details)}::jsonb)`)
async function founderGuard(tx: Executor, actor: Actor) {
  const [user] = await rows(tx, sql`select role::text,active,session_version from admin_users where id=${actor.id} for share`)
  if (!user?.active || user.session_version !== actor.sessionVersion || !hasCapability(user.role as AdminRole, "expansion.manage")) throw new RecognitionError("Founder authority was revoked.", 403)
}
/** Locks the recognition's partner then the recognition itself, in hierarchy order, and returns the locked row. */
async function lockRecognition(tx: Executor, id: string) {
  const [source] = await rows(tx, sql`select r.partner_id,p.user_id from expansion_recognitions r join expansion_partners p on p.id=r.partner_id where r.id=${id}`)
  if (!source) throw new RecognitionError("Recognition not found.", 404)
  await tx.execute(sql`select id from admin_users where id=${String(source.user_id)} for share`)
  await tx.execute(sql`select id from expansion_partners where id=${String(source.partner_id)} for update`)
  return (await rows(tx, sql`select * from expansion_recognitions where id=${id} for update`))[0]
}

export async function nominateFoundingPartner(input: { partnerId: string; rationale: string }) {
  const actor = await requireCapability("expansion.manage"), partnerId = uuid(input.partnerId)
  const rationale = text(input.rationale, "Nomination rationale", 3000, 10)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [owner] = await rows(tx, sql`select user_id from expansion_partners where id=${partnerId}`)
    if (!owner) throw new RecognitionError("Partner not found.", 404)
    await tx.execute(sql`select id from admin_users where id=${String(owner.user_id)} for share`)
    const [partner] = await rows(tx, sql`select p.id from expansion_partners p join admin_users u on u.id=p.user_id where p.id=${partnerId} and p.activated_at is not null and u.active and u.role::text='independent_partner' for update of p`)
    if (!partner) conflict("Only an active partner can be nominated.")
    const id = randomUUID()
    try { await tx.execute(sql`insert into expansion_recognitions(id,partner_id,rationale,nominated_by) values(${id},${partnerId},${rationale},${actor.id})`) }
    catch (error) { throw new RecognitionError(dbMessage(error, "That nomination could not be recorded."), 409) }
    await audit(tx, actor.id, id, "recognition_nominated", { partnerId })
    return { id }
  })
}

export async function addRecognitionEvidence(input: { recognitionId: string; description: string; reference?: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.recognitionId)
  const description = text(input.description, "Evidence", 2000, 5), reference = input.reference ? text(input.reference, "Reference", 300) : null
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const r = await lockRecognition(tx, id)
    if (!["nominated", "under_review"].includes(String(r.status))) conflict("Evidence is recorded before the decision.")
    await tx.execute(sql`insert into expansion_recognition_evidence(id,recognition_id,description,reference,added_by) values(${randomUUID()},${id},${description},${reference},${actor.id})`)
    await audit(tx, actor.id, id, "recognition_evidence_added", {})
    return { id }
  })
}

export async function startRecognitionReview(input: { recognitionId: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.recognitionId)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const r = await lockRecognition(tx, id)
    if (r.status === "under_review") return { id, replayed: true }
    if (r.status !== "nominated") conflict("Only a new nomination can enter review.")
    await tx.execute(sql`update expansion_recognitions set status='under_review' where id=${id}`)
    await audit(tx, actor.id, id, "recognition_review_started", {})
    return { id, replayed: false }
  })
}

export async function decideRecognition(input: { recognitionId: string; decision: string; note: string; recognitionDate?: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.recognitionId)
  if (!["approved", "rejected"].includes(input.decision)) throw new RecognitionError("Choose approved or rejected.")
  const note = text(input.note, "Decision and reason", 2000, 5)
  const date = input.recognitionDate ? text(input.recognitionDate, "Recognition date", 10) : null
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) throw new RecognitionError("Enter a real recognition date.")
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const r = await lockRecognition(tx, id)
    if (r.status !== "under_review") conflict("Start the review before deciding.")
    // The partner must still be active at the moment recognition is granted.
    if (input.decision === "approved" && !(await rows(tx, sql`select 1 from expansion_partners p join admin_users u on u.id=p.user_id where p.id=${String(r.partner_id)} and u.active and p.activated_at is not null`))[0]) conflict("The partner is no longer active, so recognition cannot be granted.")
    try {
      if (input.decision === "approved") await tx.execute(sql`update expansion_recognitions set status='approved',decided_by=${actor.id},decided_at=now(),decision_note=${note},recognition_date=coalesce(${date}::date,(now() at time zone 'Europe/London')::date),badge_version=${BADGE_VERSION} where id=${id}`)
      else await tx.execute(sql`update expansion_recognitions set status='rejected',decided_by=${actor.id},decided_at=now(),decision_note=${note} where id=${id}`)
    } catch (error) { throw new RecognitionError(dbMessage(error, "This decision is not permitted."), 409) }
    await audit(tx, actor.id, id, `recognition_${input.decision}`, { note })
    return { id, status: input.decision }
  })
}

export async function approveRecognitionBenefit(input: { recognitionId: string; benefit: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.recognitionId)
  const benefit = publicText(input.benefit, "Benefit", 500)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const r = await lockRecognition(tx, id)
    if (r.status !== "approved") conflict("Benefits can be approved only for an approved recognition.")
    const benefitId = randomUUID()
    try { await tx.execute(sql`insert into expansion_recognition_benefits(id,recognition_id,benefit,approved_by) values(${benefitId},${id},${benefit},${actor.id})`) }
    catch (error) { throw new RecognitionError(dbMessage(error, "That benefit could not be recorded."), 409) }
    await audit(tx, actor.id, id, "recognition_benefit_approved", { benefitId })
    return { id, benefitId }
  })
}

export async function recordBenefitFulfilment(input: { benefitId: string; outcome: string; note: string }) {
  const actor = await requireCapability("expansion.manage"), benefitId = uuid(input.benefitId)
  if (!["fulfilled", "withdrawn"].includes(input.outcome)) throw new RecognitionError("Choose fulfilled or withdrawn.")
  const note = publicText(input.note, "Fulfilment note", 1000, 3)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [benefit] = await rows(tx, sql`select recognition_id from expansion_recognition_benefits where id=${benefitId}`)
    if (!benefit) throw new RecognitionError("Benefit not found.", 404)
    const r = await lockRecognition(tx, String(benefit.recognition_id))
    if (r.status !== "approved") conflict("Fulfilment is recorded only while the recognition is approved.")
    if ((await rows(tx, sql`select 1 from expansion_recognition_fulfilments where benefit_id=${benefitId}`))[0]) conflict("This benefit already has a recorded outcome.")
    await tx.execute(sql`insert into expansion_recognition_fulfilments(id,benefit_id,outcome,note,recorded_by) values(${randomUUID()},${benefitId},${input.outcome},${note},${actor.id})`)
    await audit(tx, actor.id, String(benefit.recognition_id), `recognition_benefit_${input.outcome}`, { benefitId })
    return { benefitId, outcome: input.outcome }
  })
}

export async function correctRecognition(input: { recognitionId: string; recognitionDate?: string; rationale?: string; reason: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.recognitionId)
  const reason = text(input.reason, "Reason for the correction", 1000, 5)
  const rationale = input.rationale ? text(input.rationale, "Corrected rationale", 3000, 10) : null
  const date = input.recognitionDate ? text(input.recognitionDate, "Recognition date", 10) : null
  if (!rationale && !date) throw new RecognitionError("Give a corrected rationale or recognition date.")
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) throw new RecognitionError("Enter a real recognition date.")
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const r = await lockRecognition(tx, id)
    if (r.status !== "approved") conflict("Only an approved recognition can be corrected.")
    const after = { rationale: rationale ?? r.rationale, recognitionDate: date ?? String(r.recognition_date).slice(0, 10) }
    await tx.execute(sql`insert into expansion_recognition_corrections(id,recognition_id,before_value,after_value,reason,corrected_by) values(${randomUUID()},${id},${JSON.stringify({ rationale: r.rationale, recognitionDate: String(r.recognition_date).slice(0, 10) })}::jsonb,${JSON.stringify(after)}::jsonb,${reason},${actor.id})`)
    await tx.execute(sql`select set_config('app.recognition_correction','verified',true)`)
    try { await tx.execute(sql`update expansion_recognitions set rationale=${after.rationale as string},recognition_date=${after.recognitionDate as string}::date where id=${id}`) }
    catch (error) { throw new RecognitionError(dbMessage(error, "This correction is not permitted."), 409) }
    await audit(tx, actor.id, id, "recognition_corrected", { reason })
    return { id, corrected: true }
  })
}

export async function revokeRecognition(input: { recognitionId: string; reason: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.recognitionId)
  const reason = text(input.reason, "Reason for revocation", 1000, 5)
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const r = await lockRecognition(tx, id)
    if (r.status === "revoked") return { id, replayed: true }
    if (r.status !== "approved") conflict("Only an approved recognition can be revoked.")
    try { await tx.execute(sql`update expansion_recognitions set status='revoked',revoked_by=${actor.id},revoked_at=now(),revoke_reason=${reason} where id=${id}`) }
    catch (error) { throw new RecognitionError(dbMessage(error, "This revocation is not permitted."), 409) }
    await audit(tx, actor.id, id, "recognition_revoked", { reason })
    return { id, replayed: false }
  })
}

export async function getRecognitionAdmin() {
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await founderGuard(tx, actor)
    const recognitions = await rows(tx, sql`select r.id,r.partner_id,u.display_name partner_name,r.status,r.rationale,r.nominated_at,r.recognition_date,r.decision_note,r.revoke_reason from expansion_recognitions r join expansion_partners p on p.id=r.partner_id join admin_users u on u.id=p.user_id order by r.nominated_at desc limit 200`)
    const evidence = await rows(tx, sql`select e.recognition_id,e.description,e.reference,e.created_at from expansion_recognition_evidence e order by e.created_at`)
    const benefits = await rows(tx, sql`select b.id,b.recognition_id,b.benefit,f.outcome,f.note fulfilment_note,f.created_at fulfilled_at from expansion_recognition_benefits b left join expansion_recognition_fulfilments f on f.benefit_id=b.id order by b.created_at`)
    const corrections = await rows(tx, sql`select recognition_id,reason,created_at from expansion_recognition_corrections order by created_at`)
    const partners = await rows(tx, sql`select p.id,u.display_name from expansion_partners p join admin_users u on u.id=p.user_id where p.activated_at is not null and u.active and u.role::text='independent_partner' order by u.display_name`)
    return { recognitions, evidence, benefits, corrections, partners }
  })
}

/** What the partner sees about themselves: only an approved recognition, its date and benefits. Never the nomination rationale, evidence or founder notes. */
export async function getPartnerRecognition() {
  const actor = await requireCapability("expansion.partner")
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from admin_users where id=${actor.id} for share`)
    const [partner] = await rows(tx, sql`select p.id from expansion_partners p join admin_users u on u.id=p.user_id where p.user_id=${actor.id} and p.activated_at is not null and u.active and u.session_version=${actor.sessionVersion} and u.role::text='independent_partner'`)
    if (!partner) throw new RecognitionError("Active partner profile required.", 403)
    const [recognition] = await rows(tx, sql`select id,kind,recognition_date,badge_version from expansion_recognitions where partner_id=${String(partner.id)} and status='approved'`)
    if (!recognition) return { recognition: null, benefits: [] }
    const benefits = await rows(tx, sql`select b.benefit,coalesce(f.outcome,'approved') status from expansion_recognition_benefits b left join expansion_recognition_fulfilments f on f.benefit_id=b.id where b.recognition_id=${String(recognition.id)} order by b.created_at`)
    return { recognition: { kind: recognition.kind, recognitionDate: String(recognition.recognition_date).slice(0, 10), badgeVersion: recognition.badge_version }, benefits }
  })
}
