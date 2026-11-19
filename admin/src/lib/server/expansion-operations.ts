import "server-only"
import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { type AdminRole } from "@/lib/admin-users"
import { hasCapability } from "@/lib/rbac"
import { ExpansionError } from "@/lib/expansion"
import { safeDbMessage } from "@/lib/db-errors"
import { requireCapability } from "./rbac"
import { isTimeZone, isToolkitKey, MEETING_TRANSITIONS, MEETING_TYPES, TOOLKIT_CATALOGUE, TOOLKIT_STATUSES } from "@/lib/expansion-operations"

/*
 * Onboarding toolkit and meeting requests (checkpoint 4C). Both are MANUAL records: nothing is provisioned, purchased, scheduled in an
 * external calendar or sent. Lock order: admin_users (share) -> partner row -> request row (LOCK-HIERARCHY.md).
 * Founder involvement in a meeting never touches commission: these tables have no relationship to the commission ledger.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
type Actor = Awaited<ReturnType<typeof requireCapability>>
export class OperationsError extends ExpansionError { constructor(message: string, status = 400) { super(message, status); this.name = "OperationsError" } }
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
const conflict = (message: string): never => { throw new OperationsError(message, 409) }
const uuid = (value: unknown) => { if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new OperationsError("A valid record identifier is required."); return value.toLowerCase() }
const text = (value: unknown, label: string, max = 2000) => { if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new OperationsError(`${label} is required (maximum ${max} characters).`); return value.trim() }
const optional = (value: unknown, label: string, max = 2000) => (value === undefined || value === null || value === "" ? null : text(value, label, max))
const dbMessage = (error: unknown, fallback: string) => safeDbMessage(error, fallback)
async function founderGuard(tx: Executor, actor: Actor) {
  const [user] = await rows(tx, sql`select role::text,active,session_version from admin_users where id=${actor.id} for share`)
  if (!user?.active || user.session_version !== actor.sessionVersion || !hasCapability(user.role as AdminRole, "expansion.manage")) throw new OperationsError("Founder authority was revoked.", 403)
}
async function partnerGuard(tx: Executor, actor: Actor) {
  await tx.execute(sql`select id from admin_users where id=${actor.id} for share`)
  const [partner] = await rows(tx, sql`select p.id from expansion_partners p join admin_users u on u.id=p.user_id where p.user_id=${actor.id} and p.activated_at is not null and u.active=true and u.session_version=${actor.sessionVersion} and u.role::text='independent_partner'`)
  if (!partner) throw new OperationsError("Active partner profile required.", 403)
  return String(partner.id)
}
const lockPartner = (tx: Executor, id: string) => tx.execute(sql`select id from expansion_partners where id=${id} for update`)
const audit = (tx: Executor, actorId: string, entity: string, action: string, details: unknown) =>
  tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actorId},${entity},${action},${JSON.stringify(details)}::jsonb)`)

/** Partner view: every catalogue item with its actual status. An item nobody has recorded is "planned", or "available" only when the feature is built into this software. */
export async function getToolkit() {
  const actor = await requireCapability("expansion.partner")
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    const recorded = await rows(tx, sql`select t.item_key,t.status,t.detail,t.completed_at,t.updated_at,r.title resource_title from expansion_toolkit_items t left join expansion_resources r on r.id=t.resource_id and r.status='published' and r.audience='partner' where t.partner_id=${partnerId}`)
    return TOOLKIT_CATALOGUE.map((item) => {
      const row = recorded.find((r) => r.item_key === item.key)
      return { key: item.key, label: item.label, status: String(row?.status ?? (item.builtIn ? "available" : "planned")), detail: row?.detail ?? null, completedAt: row?.completed_at ?? null, resourceTitle: row?.resource_title ?? null, recorded: Boolean(row) }
    })
  })
}

export async function setToolkitItem(input: { partnerId: string; itemKey: string; status: string; detail?: string; resourceId?: string }) {
  const actor = await requireCapability("expansion.manage"), partnerId = uuid(input.partnerId)
  if (!isToolkitKey(input.itemKey) || !(TOOLKIT_STATUSES as readonly string[]).includes(input.status)) throw new OperationsError("Choose a toolkit item and a valid status.")
  const detail = optional(input.detail, "Fulfilment detail")
  if (["available", "completed"].includes(input.status) && !detail) throw new OperationsError("Record the fulfilment evidence before marking an item available or completed. Nothing is claimed as provisioned without it.")
  const resourceId = input.resourceId ? uuid(input.resourceId) : null
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    await lockPartner(tx, partnerId)
    if (!(await rows(tx, sql`select id from expansion_partners where id=${partnerId} and activated_at is not null`))[0]) throw new OperationsError("Choose an activated partner.", 404)
    if (resourceId && !(await rows(tx, sql`select id from expansion_resources where id=${resourceId} and status='published' and audience='partner'`))[0]) throw new OperationsError("Associate a published partner resource.")
    await tx.execute(sql`insert into expansion_toolkit_items(id,partner_id,item_key,status,detail,resource_id,completed_at,updated_by)
      values(${randomUUID()},${partnerId},${input.itemKey},${input.status},${detail},${resourceId},${input.status === "completed" ? sql`now()` : null},${actor.id})
      on conflict(partner_id,item_key) do update set status=excluded.status,detail=coalesce(excluded.detail,expansion_toolkit_items.detail),resource_id=coalesce(excluded.resource_id,expansion_toolkit_items.resource_id),completed_at=excluded.completed_at,updated_by=excluded.updated_by,updated_at=now()`)
    await audit(tx, actor.id, partnerId, "toolkit_item_set", { itemKey: input.itemKey, status: input.status, detail })
    return { partnerId, itemKey: input.itemKey, status: input.status }
  })
}

export async function getToolkitAdmin() {
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const partners = await rows(tx, sql`select p.id,u.display_name from expansion_partners p join admin_users u on u.id=p.user_id where p.activated_at is not null order by u.display_name`)
    const items = await rows(tx, sql`select partner_id,item_key,status,detail,completed_at from expansion_toolkit_items`)
    return { partners: partners.map((p) => ({ id: String(p.id), name: String(p.display_name), items: TOOLKIT_CATALOGUE.map((c) => { const r = items.find((i) => String(i.partner_id) === String(p.id) && i.item_key === c.key); return { key: c.key, label: c.label, status: String(r?.status ?? (c.builtIn ? "available" : "planned")), detail: r?.detail ?? null, recorded: Boolean(r) } }) })) }
  })
}

export async function requestMeeting(input: { meetingType: string; opportunityId?: string; preferredSlots: string[]; timeZone: string; purpose: string; context?: string; requestedFounderId?: string }) {
  const actor = await requireCapability("expansion.partner")
  if (!(MEETING_TYPES as readonly string[]).includes(input.meetingType)) throw new OperationsError("Choose a meeting type.")
  if (!isTimeZone(input.timeZone)) throw new OperationsError("Choose a valid time zone, for example Europe/London.")
  const slots = Array.isArray(input.preferredSlots) ? input.preferredSlots.map((slot) => text(slot, "Preferred date and time", 60)) : []
  if (slots.length < 1 || slots.length > 5 || slots.some((slot) => Number.isNaN(Date.parse(slot)))) throw new OperationsError("Give one to five preferred dates and times.")
  const purpose = text(input.purpose, "Meeting purpose", 2000), context = optional(input.context, "Supporting information", 4000)
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    await lockPartner(tx, partnerId)
    const opportunityId = input.opportunityId ? uuid(input.opportunityId) : null
    if (opportunityId && !(await rows(tx, sql`select id from expansion_opportunities where id=${opportunityId} and partner_id=${partnerId}`))[0]) throw new OperationsError("Choose one of your own opportunities.", 404)
    const founderId = input.requestedFounderId ? uuid(input.requestedFounderId) : null
    if (founderId && !(await rows(tx, sql`select id from admin_users where id=${founderId} and active and role::text in ('owner','administrator')`))[0]) throw new OperationsError("Choose a founder.")
    const [open] = await rows(tx, sql`select count(*)::int c from expansion_meeting_requests where partner_id=${partnerId} and status in ('requested','under_review','info_required','alternative_proposed')`)
    if (Number(open.c) >= 10) conflict("You have too many open meeting requests. Wait for responses before sending more.")
    const id = randomUUID()
    await tx.execute(sql`insert into expansion_meeting_requests(id,partner_id,opportunity_id,meeting_type,preferred_slots,time_zone,purpose,context,requested_founder) values(${id},${partnerId},${opportunityId},${input.meetingType},${JSON.stringify(slots)}::jsonb,${input.timeZone},${purpose},${context},${founderId})`)
    await audit(tx, actor.id, id, "meeting_requested", { meetingType: input.meetingType, opportunityId })
    return { meetingId: id }
  })
}

type PartnerMeetingAction = "cancel" | "add_information" | "accept_alternative" | "decline_alternative"
export async function respondToMeeting(input: { meetingId: string; response: PartnerMeetingAction; message?: string }) {
  const actor = await requireCapability("expansion.partner"), id = uuid(input.meetingId)
  if (!["cancel", "add_information", "accept_alternative", "decline_alternative"].includes(input.response)) throw new OperationsError("Choose a valid response.")
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    await lockPartner(tx, partnerId)
    const [meeting] = await rows(tx, sql`select status,proposed_start,context from expansion_meeting_requests where id=${id} and partner_id=${partnerId} for update`)
    if (!meeting) throw new OperationsError("Meeting request not found.", 404)
    const message = optional(input.message, "Message", 2000)
    const status = String(meeting.status)
    const update = (set: SQL) => tx.execute(sql`update expansion_meeting_requests set ${set},updated_at=now() where id=${id}`)
    try {
      if (input.response === "cancel") { if (!["requested", "under_review", "info_required", "alternative_proposed", "confirmed"].includes(status)) conflict("This request can no longer be cancelled."); await update(sql`status='cancelled'`) }
      else if (input.response === "add_information") { if (status !== "info_required") conflict("The founder has not asked for more information."); if (!message) throw new OperationsError("Add the requested information."); await update(sql`status='requested',context=${[meeting.context, message].filter(Boolean).join("\n\n")}`) }
      else { if (status !== "alternative_proposed") conflict("There is no proposed alternative to answer."); if (input.response === "accept_alternative" && new Date(String(meeting.proposed_start)).getTime() < Date.now()) conflict("That proposed time has passed. Ask the founders for a new time."); await update(input.response === "accept_alternative" ? sql`status='confirmed',confirmed_start=proposed_start` : sql`status='requested'`) }
    } catch (error) { if (error instanceof OperationsError) throw error; throw new OperationsError(dbMessage(error, "This response is not permitted."), 409) }
    await audit(tx, actor.id, id, `meeting_${input.response}`, { message })
    return { meetingId: id, action: input.response }
  })
}

type FounderMeetingAction = "review" | "request_information" | "propose_alternative" | "confirm" | "decline" | "cancel" | "complete"
export async function decideMeeting(input: { meetingId: string; decision: FounderMeetingAction; note?: string; start?: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.meetingId)
  const map: Record<string, string> = { review: "under_review", request_information: "info_required", propose_alternative: "alternative_proposed", confirm: "confirmed", decline: "declined", cancel: "cancelled", complete: "completed" }
  if (!map[input.decision]) throw new OperationsError("Choose a valid decision.")
  const note = optional(input.note, "Note", 2000)
  if (["request_information", "decline", "cancel"].includes(input.decision) && !note) throw new OperationsError("Explain the decision to the partner.")
  const start = input.start ? new Date(input.start) : null
  if (["propose_alternative", "confirm"].includes(input.decision) && (!start || Number.isNaN(start.getTime()) || start.getTime() < Date.now())) throw new OperationsError("Give a real future date and time. Availability is never assumed.")
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [source] = await rows(tx, sql`select partner_id from expansion_meeting_requests where id=${id}`)
    if (!source) throw new OperationsError("Meeting request not found.", 404)
    await lockPartner(tx, String(source.partner_id))
    const [meeting] = await rows(tx, sql`select status from expansion_meeting_requests where id=${id} for update`)
    const target = map[input.decision]
    if (meeting.status === target && input.decision !== "propose_alternative") return { meetingId: id, status: target, replayed: true }
    if (!MEETING_TRANSITIONS[String(meeting.status)]?.includes(target)) conflict(`A ${String(meeting.status).replaceAll("_", " ")} request cannot be ${target.replaceAll("_", " ")}.`)
    try {
      const proposed = input.decision === "propose_alternative" ? sql`${start!.toISOString()}::timestamptz` : sql`proposed_start`
      const confirmed = input.decision === "confirm" ? sql`${start!.toISOString()}::timestamptz` : sql`confirmed_start`
      await tx.execute(sql`update expansion_meeting_requests set status=${target},founder_note=coalesce(${note},founder_note),proposed_start=${proposed},confirmed_start=${confirmed},updated_at=now() where id=${id}`)
    } catch (error) { throw new OperationsError(dbMessage(error, "This decision is not permitted."), 409) }
    await audit(tx, actor.id, id, `meeting_${input.decision}`, { note, start: start?.toISOString() ?? null })
    return { meetingId: id, status: target, replayed: false }
  })
}

export async function getMeetings(scope: "partner" | "founder") {
  const actor = await requireCapability(scope === "partner" ? "expansion.partner" : "expansion.manage")
  return db.transaction(async (tx) => {
    if (scope === "founder") {
      await founderGuard(tx, actor)
      return rows(tx, sql`select m.id,u.display_name partner_name,m.meeting_type,m.preferred_slots,m.time_zone,m.purpose,m.context,m.status,m.founder_note,m.proposed_start,m.confirmed_start,m.created_at,p.business_name
        from expansion_meeting_requests m join expansion_partners ep on ep.id=m.partner_id join admin_users u on u.id=ep.user_id left join expansion_opportunities o on o.id=m.opportunity_id left join prospects p on p.id=o.prospect_id
        order by (m.status in ('requested','under_review','info_required')) desc,m.created_at desc limit 200`)
    }
    const partnerId = await partnerGuard(tx, actor)
    return rows(tx, sql`select m.id,m.meeting_type,m.preferred_slots,m.time_zone,m.purpose,m.status,m.founder_note,m.proposed_start,m.confirmed_start,m.created_at,p.business_name
      from expansion_meeting_requests m left join expansion_opportunities o on o.id=m.opportunity_id left join prospects p on p.id=o.prospect_id where m.partner_id=${partnerId} order by m.created_at desc limit 100`)
  })
}

/** The only way to change submitted meeting content: a founder correction with a recorded reason and the before/after values. */
export async function correctMeeting(input: { meetingId: string; purpose?: string; context?: string; reason: string }) {
  const actor = await requireCapability("expansion.manage"), id = uuid(input.meetingId)
  const reason = text(input.reason, "Reason for the correction", 1000)
  const purpose = optional(input.purpose, "Purpose"), context = optional(input.context, "Supporting information", 4000)
  if (!purpose && !context) throw new OperationsError("Give a corrected purpose or supporting information.")
  return db.transaction(async (tx) => {
    await founderGuard(tx, actor)
    const [source] = await rows(tx, sql`select partner_id from expansion_meeting_requests where id=${id}`)
    if (!source) throw new OperationsError("Meeting request not found.", 404)
    await lockPartner(tx, String(source.partner_id))
    const [meeting] = await rows(tx, sql`select purpose,context from expansion_meeting_requests where id=${id} for update`)
    await tx.execute(sql`insert into expansion_meeting_corrections(id,meeting_id,before_value,after_value,reason,corrected_by) values(${randomUUID()},${id},${JSON.stringify({ purpose: meeting.purpose, context: meeting.context })}::jsonb,${JSON.stringify({ purpose: purpose ?? meeting.purpose, context: context ?? meeting.context })}::jsonb,${reason},${actor.id})`)
    await tx.execute(sql`select set_config('app.meeting_correction','verified',true)`)
    try { await tx.execute(sql`update expansion_meeting_requests set purpose=coalesce(${purpose},purpose),context=coalesce(${context},context),updated_at=now() where id=${id}`) }
    catch (error) { throw new OperationsError(dbMessage(error, "This correction is not permitted."), 409) }
    await audit(tx, actor.id, id, "meeting_corrected", { reason })
    return { meetingId: id, corrected: true }
  })
}
