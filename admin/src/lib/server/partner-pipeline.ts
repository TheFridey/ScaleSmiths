import "server-only"
import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { ExpansionError } from "@/lib/expansion"
import { explain, OPPORTUNITY_STATUS } from "@/lib/partner-guidance"
import {
  attentionFor, columnFor, INTERACTION_KINDS, meetingLabel, meetingState, missingScopeFields, timelineEntry, transitionBlockedReason, transitionOptions,
  PIPELINE_COLUMNS, type PipelineCard, type PipelineMeeting, type TimelineEntry, type TimelineSource,
} from "@/lib/partner-pipeline"
import { partnerGuard } from "./empower-partner"
import { requireCapability } from "./rbac"

/*
 * Operation Ascend B2.1: the partner pipeline. Reads only the signed-in partner's own opportunities, meetings, interactions,
 * audit entries and payment-verification dates. The only writes are the partner's own interaction log and follow-up date;
 * stage changes, scope submission and founder-assistance requests keep using the existing authorised commands
 * (partnerMutation, requestMeeting), so this module can never bypass ownership, commercial clearance or the finance engine.
 * OFF unless PARTNER_PIPELINE_ENABLED=true. Another partner's opportunity is indistinguishable from a missing one (404).
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
export const partnerPipelineEnabled = () => process.env.PARTNER_PIPELINE_ENABLED === "true"
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Bounded so a partner's pipeline is always one cheap, indexed read (expansion_opportunities_partner_idx). */
export const PIPELINE_LIMIT = 500

async function partner() {
  if (!partnerPipelineEnabled()) throw new ExpansionError("The pipeline is not available yet.", 404)
  return requireCapability("expansion.partner")
}
async function guard(tx: Executor, actor: Awaited<ReturnType<typeof requireCapability>>) {
  try { return await partnerGuard(tx, actor) } catch { throw new ExpansionError("An active partner account is required.", 403) }
}
const toMeeting = (m: Row): PipelineMeeting => ({ id: String(m.id), status: String(m.status), meetingType: String(m.meeting_type), confirmedStart: iso(m.confirmed_start), proposedStart: iso(m.proposed_start), createdAt: iso(m.created_at)! })

export async function partnerPipeline(now = new Date()) {
  const actor = await partner()
  return db.transaction(async (tx) => {
    const partnerId = await guard(tx, actor)
    const opportunities = await rows(tx, sql`select o.id,o.status,o.discovery,o.created_at,o.updated_at,p.business_name,p.industry,p.next_follow_up_at,
        greatest(o.updated_at,(select max(a.created_at) from expansion_audit a where a.entity_id=o.id::text),(select max(i.created_at) from expansion_opportunity_interactions i where i.opportunity_id=o.id)) last_activity
      from expansion_opportunities o join prospects p on p.id=o.prospect_id left join expansion_research_candidates rc on rc.id=o.research_candidate_id
      where o.partner_id=${partnerId} and (o.research_candidate_id is null or (rc.status='allocated' and rc.allocated_partner_id=o.partner_id))
      order by o.created_at desc limit ${PIPELINE_LIMIT}`)
    const meetings = await rows(tx, sql`select id,opportunity_id,status,meeting_type,confirmed_start,proposed_start,created_at from expansion_meeting_requests
      where partner_id=${partnerId} and opportunity_id is not null and status not in ('declined','cancelled','completed') order by created_at desc limit 1000`)
    const byOpportunity = new Map<string, PipelineMeeting[]>()
    for (const m of meetings) { const k = String(m.opportunity_id); byOpportunity.set(k, [...(byOpportunity.get(k) ?? []), toMeeting(m)]) }
    const cards: PipelineCard[] = opportunities.map((o) => {
      const status = String(o.status), ms = byOpportunity.get(String(o.id)) ?? [], state = meetingState(ms, now)
      return {
        id: String(o.id), businessName: String(o.business_name), status, statusLabel: explain(OPPORTUNITY_STATUS, status).label, column: columnFor(status),
        createdAt: iso(o.created_at)!, updatedAt: iso(o.updated_at)!, lastActivity: iso(o.last_activity ?? o.updated_at)!, followUp: iso(o.next_follow_up_at),
        meeting: state, meetingLabel: meetingLabel(state), attention: attentionFor({ status, discovery: o.discovery, followUp: iso(o.next_follow_up_at), meetings: ms }, now),
        industry: o.industry ? String(o.industry) : null, transitions: transitionOptions(status),
      }
    })
    return { columns: PIPELINE_COLUMNS.map(({ key, label, meaning }) => ({ key, label, meaning })), cards, truncated: opportunities.length >= PIPELINE_LIMIT }
  })
}

async function ownOpportunity(tx: Executor, partnerId: string, id: unknown, lock = false) {
  if (typeof id !== "string" || !UUID.test(id)) throw new ExpansionError("Opportunity not found.", 404)
  const [o] = await rows(tx, sql`select o.id,o.status,o.discovery,o.prospect_id,o.created_at,p.business_name,p.website_url,p.industry,p.location,p.next_follow_up_at
    from expansion_opportunities o join prospects p on p.id=o.prospect_id left join expansion_research_candidates rc on rc.id=o.research_candidate_id
    where o.id=${id} and o.partner_id=${partnerId} and (o.research_candidate_id is null or (rc.status='allocated' and rc.allocated_partner_id=o.partner_id)) ${lock ? sql`for update of o` : sql``}`)
  if (!o) throw new ExpansionError("Opportunity not found.", 404)
  return o
}

/** One opportunity: its partner-safe timeline, meetings, interactions and the stages the partner may (and may not) choose. */
export async function partnerOpportunityDetail(id: unknown) {
  const actor = await partner()
  return db.transaction(async (tx) => {
    const partnerId = await guard(tx, actor)
    const o = await ownOpportunity(tx, partnerId, id)
    const oid = String(o.id)
    const meetings = await rows(tx, sql`select id,status,meeting_type,confirmed_start,proposed_start,created_at from expansion_meeting_requests where partner_id=${partnerId} and opportunity_id=${oid} order by created_at desc limit 50`)
    const meetingIds = meetings.map((m) => String(m.id))
    // Audit rows for this opportunity and its meetings. Founder notes, pricing and classification details are dropped by timelineEntry.
    const audit = await rows(tx, sql`select action,details,created_at,(actor_id=${actor.id}) by_partner from expansion_audit
      where entity_id=${oid} ${meetingIds.length ? sql`or entity_id in (${sql.join(meetingIds.map((m) => sql`${m}`), sql`,`)})` : sql``} order by created_at desc, id desc limit 200`)
    // Payment verification dates only: no amounts, references or evidence (the partner's finance view is the place for money).
    const payments = await rows(tx, sql`select e.created_at,(e.reverses_event_id is not null) reversal from expansion_payment_events e join expansion_contracts c on c.id=e.contract_id where c.opportunity_id=${oid} order by e.created_at desc limit 50`)
    const interactions = await rows(tx, sql`select id,kind,summary,occurred_on,created_at from expansion_opportunity_interactions where opportunity_id=${oid} and partner_id=${partnerId} order by created_at desc limit 100`)
    const sources: TimelineSource[] = [
      ...audit.map((a) => ({ action: String(a.action), details: a.details, createdAt: iso(a.created_at)!, byPartner: a.by_partner === true })),
      ...payments.map((p) => ({ action: p.reversal ? "payment_reversed" : "payment_verified", details: {}, createdAt: iso(p.created_at)!, byPartner: false })),
    ]
    const timeline = sources.map(timelineEntry).filter((e): e is TimelineEntry => e !== null).sort((a, b) => b.at.localeCompare(a.at))
    const status = String(o.status)
    const allowed = transitionOptions(status)
    const blocked = ["contacted", "discovery", "qualified", "scope_submitted", "approved", "contract_accepted", "closed_lost", "withdrawn"]
      .filter((to) => to !== status && !allowed.some((a) => a.to === to)).map((to) => ({ to, label: explain(OPPORTUNITY_STATUS, to).label, reason: transitionBlockedReason(status, to)! }))
    return {
      opportunity: { id: oid, businessName: String(o.business_name), website: o.website_url ? String(o.website_url) : null, industry: o.industry ? String(o.industry) : null, region: o.location ? String(o.location) : null,
        status, statusLabel: explain(OPPORTUNITY_STATUS, status).label, statusMeaning: explain(OPPORTUNITY_STATUS, status).meaning, column: columnFor(status), createdAt: iso(o.created_at), followUp: iso(o.next_follow_up_at),
        missingForScope: missingScopeFields(o.discovery) },
      transitions: { allowed, blocked },
      meetings: meetings.map(toMeeting),
      interactions: interactions.map((i) => ({ id: String(i.id), kind: String(i.kind), summary: String(i.summary), occurredOn: String(i.occurred_on).slice(0, 10), createdAt: iso(i.created_at) })),
      timeline,
    }
  })
}

const dateOnly = (v: unknown, label: string) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ExpansionError(`Choose a valid ${label}.`)
  const d = new Date(`${v}T00:00:00Z`)
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw new ExpansionError(`Choose a valid ${label}.`)
  return d
}
async function audit(tx: Executor, actorId: string, entity: string, action: string, details: unknown) {
  await tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actorId},${entity},${action},${JSON.stringify(details)}::jsonb)`)
}

/** Record a call, email or note against the partner's own opportunity. Append-only; it never changes the opportunity. */
export async function recordInteraction(input: { opportunityId?: unknown; kind?: unknown; summary?: unknown; occurredOn?: unknown }, now = new Date()) {
  const actor = await partner()
  if (typeof input.kind !== "string" || !(INTERACTION_KINDS as readonly string[]).includes(input.kind)) throw new ExpansionError("Choose the type of interaction.")
  if (typeof input.summary !== "string" || !input.summary.trim() || input.summary.trim().length > 2000) throw new ExpansionError("Summary is required (maximum 2000 characters).")
  const occurred = dateOnly(input.occurredOn, "interaction date")
  if (occurred.getTime() > now.getTime() + 86400000) throw new ExpansionError("An interaction cannot be in the future.")
  if (occurred.getTime() < now.getTime() - 366 * 86400000) throw new ExpansionError("Record interactions from the last twelve months.")
  return db.transaction(async (tx) => {
    const partnerId = await guard(tx, actor)
    const o = await ownOpportunity(tx, partnerId, input.opportunityId, true)
    const id = randomUUID()
    await tx.execute(sql`insert into expansion_opportunity_interactions(id,opportunity_id,partner_id,kind,summary,occurred_on,created_by) values(${id},${String(o.id)},${partnerId},${input.kind},${(input.summary as string).trim()},${input.occurredOn as string},${actor.id})`)
    // The audit entry records that an interaction happened, never its text.
    await audit(tx, actor.id, String(o.id), "interaction_recorded", { kind: input.kind, interactionId: id })
    return { id }
  })
}

/** Set or clear the partner's own follow-up reminder for one of their prospects. It is a reminder only; nothing is sent to anyone. */
export async function scheduleFollowUp(input: { opportunityId?: unknown; date?: unknown }, now = new Date()) {
  const actor = await partner()
  const clear = input.date === null || input.date === ""
  const date = clear ? null : dateOnly(input.date, "follow-up date")
  if (date && (date.getTime() < now.getTime() - 86400000 || date.getTime() > now.getTime() + 366 * 86400000)) throw new ExpansionError("Choose a follow-up date within the next twelve months.")
  return db.transaction(async (tx) => {
    const partnerId = await guard(tx, actor)
    const o = await ownOpportunity(tx, partnerId, input.opportunityId, true)
    if (columnFor(o.status) === "closed") throw new ExpansionError("This opportunity is closed.", 409)
    await tx.execute(sql`update prospects set next_follow_up_at=${date ? date.toISOString() : null},updated_at=now() where id=${o.prospect_id as number}`)
    await audit(tx, actor.id, String(o.id), "follow_up_scheduled", { cleared: clear })
    return { id: String(o.id), followUp: date ? date.toISOString() : null }
  })
}
