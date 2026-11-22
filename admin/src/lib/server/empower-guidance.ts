import "server-only"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { ContentError, courseLessonIds, expandQuery, searchQuery, type Synonym } from "@/lib/empower-content"
import { discoveryGaps, explain, guidancePlanFor, MEETING_GUIDANCE, MEETING_OBJECTIONS, MEETING_STATUS, OPPORTUNITY_STATUS, type GuidancePlan } from "@/lib/partner-guidance"
import { partnerAcademyEnabled, partnerGuard, partnerKnowledgeEnabled, partnerResourcesEnabled } from "./empower-partner"
import { continueLearningFor } from "./empower-academy"
import { partnerObjectionsEnabled } from "./empower-objections"
import { agreementStatusFor } from "./partner-agreements-core"
import { agreementState } from "@/lib/partner-agreements"
import { requireCapability } from "./rbac"

/*
 * Operation Empower B1.6: one partner workspace over the existing systems. Nothing here stores new state or changes any commercial,
 * meeting or learning record: it reads approved content (published, in review date, in a switched-on module), the partner's own
 * opportunities and meetings, and the Academy's existing continue-learning pointer. OFF unless PARTNER_UNIFIED_WORKSPACE_ENABLED=true.
 *
 * Client-safe copy is decided here, never in the browser: a Knowledge Base client explanation on a client-facing entry, or the summary
 * of a client-facing resource, or the founder-approved client line of an objection response. Lessons, courses, partner-only entries
 * and answers are never offered for copying.
 *
 * B1.7: approved B1.5 objection responses take part in search, contextual guidance and Today under their own switch
 * (PARTNER_OBJECTION_HANDLING_ENABLED) and the same servability rule as the objection workspace: published, in review date and
 * partner-only. An objection response is partner guidance; only its client line (B1.5 field `client_line`, checked by the
 * database for partner-only wording) is ever offered for copying, and its partner explanation is labelled partner-only.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
export const partnerWorkspaceEnabled = () => process.env.PARTNER_UNIFIED_WORKSPACE_ENABLED === "true"
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
const SERVABLE = sql`v.status='published' and v.review_by >= (now() at time zone 'UTC')::date`
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const GUIDANCE_TYPES = ["answer", "resource", "lesson", "course", "objection"] as const
export type GuidanceType = (typeof GUIDANCE_TYPES)[number]

export type GuidanceItem = {
  type: GuidanceType; title: string; summary: string; category: string | null; audience: "client_facing" | "partner_only"
  approvedAt: string | null; reviewBy: string | null; href: string; copy: string | null
}

async function partner() {
  if (!partnerWorkspaceEnabled()) throw new ContentError("The partner workspace is not available yet.", 404)
  return requireCapability("expansion.partner")
}
const modules = () => ({ resources: partnerResourcesEnabled(), knowledge: partnerKnowledgeEnabled(), academy: partnerAcademyEnabled(), objections: partnerObjectionsEnabled() })
const availability = () => { const m = modules(); return { answers: m.knowledge, resources: m.resources, academy: m.academy, objections: m.objections } }
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)
const plain = (s: string, n = 220) => { const t = s.replace(/[#*_`>\[\]()|-]+/g, " ").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t }

/** The one place that decides copyable client text. */
export function clientSafeCopy(kind: string, audience: string, fields: Record<string, unknown>): string | null {
  // An objection response is always partner-only; its client line is the one field written and checked to be said to a client.
  if (kind === "objection") { if (audience !== "partner_only") return null; const t = String(fields.client_line ?? "").trim(); return t || null }
  if (audience !== "client_facing") return null
  if (kind === "knowledge") { const t = String(fields.client_explanation ?? "").trim(); return t && !/^none\b/i.test(t) ? t : null }
  if (kind === "resource") { const t = String(fields.summary ?? "").trim(); return t || null }
  return null
}

async function shapeItems(tx: Executor, found: Row[]): Promise<GuidanceItem[]> {
  const lessons = found.filter((r) => r.kind === "lesson")
  const courses = lessons.length ? await rows(tx, sql`select i.slug,v.fields from empower_content_versions v join empower_content_items i on i.id=v.item_id where i.kind='course' and ${SERVABLE} order by i.slug`) : []
  const out: GuidanceItem[] = []
  for (const r of found) {
    const f = (r.fields ?? {}) as Record<string, unknown>, kind = String(r.kind), audience = String(r.audience) as GuidanceItem["audience"]
    const base = { title: kind === "knowledge" ? String(f.question ?? r.title) : kind === "objection" ? String(f.concern ?? r.title) : String(r.title), category: null as string | null, audience, approvedAt: iso(r.approved_at), reviewBy: r.review_by ? String(r.review_by).slice(0, 10) : null, copy: clientSafeCopy(kind, audience, f) }
    if (kind === "knowledge") out.push({ ...base, type: "answer", summary: plain(String(f.answer ?? "")), category: (f.topic as string) ?? null, href: `/partner/knowledge?q=${encodeURIComponent(base.title)}` })
    else if (kind === "resource") out.push({ ...base, type: "resource", summary: plain(String(f.summary ?? r.body ?? "")), category: (f.category as string) ?? null, href: `/partner/resources/${String(r.slug)}` })
    else if (kind === "objection") out.push({ ...base, type: "objection", summary: plain(String(f.guidance ?? "")), category: (f.category as string) ?? null, href: `/partner/objections?q=${encodeURIComponent(base.title)}` })
    else if (kind === "course") out.push({ ...base, type: "course", summary: plain(String(r.body ?? "")), category: (f.category as string) ?? null, href: `/partner/academy/${String(r.slug)}` })
    else if (kind === "lesson") {
      const course = courses.find((c) => courseLessonIds(c.fields).includes(String(r.item_id)))
      if (course) out.push({ ...base, type: "lesson", summary: plain(String(r.body ?? "")), category: null, href: `/partner/academy/${String(course.slug)}?lesson=${String(r.item_id)}` })
    }
  }
  return out
}

function kindFilter(types: readonly GuidanceType[]) {
  const m = modules(), kinds: string[] = []
  if (m.knowledge && types.includes("answer")) kinds.push("knowledge")
  if (m.resources && types.includes("resource")) kinds.push("resource")
  if (m.academy && types.includes("lesson")) kinds.push("lesson")
  if (m.academy && types.includes("course")) kinds.push("course")
  if (m.objections && types.includes("objection")) kinds.push("objection")
  // Lessons and courses are partner learning; only partner-only lessons are ever served (as in the Academy). Objection responses are
  // served only when partner-only, exactly as the objection workspace does (a legacy client-facing row is never served).
  return kinds.length ? sql`and i.kind in (${sql.join(kinds.map((k) => sql`${k}`), sql`,`)}) and (i.kind <> 'lesson' or i.audience='partner_only') and (i.kind <> 'objection' or i.audience='partner_only')` : null
}
/** A text[] literal with one bound parameter per element (drizzle would otherwise expand a JS array into a bare list). */
const textArray = (xs: readonly string[]) => sql`array[${sql.join(xs.map((x) => sql`${x}`), sql`,`)}]::text[]`
const COLUMNS = sql`i.id item_id,i.kind,i.slug,i.audience,v.title,v.body,v.fields,v.approved_at,v.review_by`

/** Unified, deterministic search: exact title, question or alias first; then full-text rank with active synonyms; ties by type and slug. */
export async function searchGuidance(input: { q?: unknown; type?: unknown }) {
  const actor = await partner()
  const q = searchQuery(input.q)
  const type = input.type == null || input.type === "" || input.type === "all" ? null : (GUIDANCE_TYPES as readonly string[]).includes(String(input.type)) ? String(input.type) as GuidanceType : (() => { throw new ContentError("Choose a valid content type.") })()
  return db.transaction(async (tx) => {
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await partnerGuard(tx, actor)
    const kinds = kindFilter(type ? [type] : GUIDANCE_TYPES)
    const available = availability()
    if (!kinds) return { query: q, type, available, results: [] as GuidanceItem[] }
    let found: Row[]
    if (q) {
      const synonyms: Synonym[] = (await rows(tx, sql`select term,expansion from empower_search_synonyms where active order by term`)).map((r) => ({ term: String(r.term), expansion: String(r.expansion) }))
      const raw = q.toLowerCase().replace(/[?!.]+$/, "").trim()
      const aliases = sql`jsonb_array_elements_text(case when jsonb_typeof(v.fields->'aliases')='array' then v.fields->'aliases' else '[]'::jsonb end)`
      found = await rows(tx, sql`with q as (select websearch_to_tsquery('english', ${expandQuery(q, synonyms)}) query, ${raw} raw)
        select ${COLUMNS},
          (case when lower(regexp_replace(coalesce(v.fields->>'question', v.fields->>'concern', v.title), '[?!.]+$', '')) = q.raw or lower(v.title) = q.raw then 100
                when exists (select 1 from ${aliases} a(alias) where lower(regexp_replace(a.alias, '[?!.]+$', '')) = q.raw) then 90 else 0 end)
          + ts_rank_cd(empower_search_document(v.title,v.body,v.fields), q.query, 32) rank
        from empower_content_versions v join empower_content_items i on i.id=v.item_id cross join q
        where ${SERVABLE} ${kinds}
          and (empower_search_document(v.title,v.body,v.fields) @@ q.query or lower(v.title) = q.raw
               or exists (select 1 from ${aliases} a(alias) where lower(regexp_replace(a.alias, '[?!.]+$', '')) = q.raw))
        order by rank desc, array_position(array['knowledge','objection','resource','lesson','course']::text[], i.kind), i.slug limit 60`)
    } else {
      found = await rows(tx, sql`select ${COLUMNS} from empower_content_versions v join empower_content_items i on i.id=v.item_id
        where ${SERVABLE} ${kinds} order by v.approved_at desc, i.slug limit 12`)
    }
    // Fetched with headroom: lessons outside a published course are dropped while shaping, then the page is capped at 30.
    return { query: q, type, available, results: (await shapeItems(tx, found)).slice(0, 30) }
  })
}

/** Approved guidance for a plan: Knowledge Base by topic, objection responses by category, resources by the plan's fixed vocabulary, courses by category. */
async function guidanceForPlan(tx: Executor, plan: Pick<GuidancePlan, "knowledgeTopics" | "searchTerms" | "courseCategories" | "objectionCategories">) {
  const m = modules(), found: Row[] = []
  if (m.knowledge && plan.knowledgeTopics.length) found.push(...await rows(tx, sql`select ${COLUMNS} from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where i.kind='knowledge' and ${SERVABLE} and v.fields->>'topic' in (${sql.join(plan.knowledgeTopics.map((t) => sql`${t}`), sql`,`)})
    order by array_position(${textArray(plan.knowledgeTopics)}, v.fields->>'topic'), i.slug limit 6`))
  // Objection categories come from the fixed rule table, never from prospect text.
  if (m.objections && plan.objectionCategories.length) found.push(...await rows(tx, sql`select ${COLUMNS} from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where i.kind='objection' and i.audience='partner_only' and ${SERVABLE} and v.fields->>'category' in (${sql.join(plan.objectionCategories.map((c) => sql`${c}`), sql`,`)})
    order by array_position(${textArray(plan.objectionCategories)}, v.fields->>'category'), i.slug limit 4`))
  // Vocabulary terms are fixed words from the mapping table (letters only), joined as OR; prospect text is never used here.
  const terms = plan.searchTerms.filter((t) => /^[a-z]{2,30}$/.test(t))
  if (m.resources && terms.length) found.push(...await rows(tx, sql`select ${COLUMNS} from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where i.kind='resource' and ${SERVABLE} and empower_search_document(v.title,v.body,v.fields) @@ to_tsquery('english', ${terms.join(" | ")})
    order by ts_rank_cd(empower_search_document(v.title,v.body,v.fields), to_tsquery('english', ${terms.join(" | ")}), 32) desc, i.slug limit 4`))
  if (m.academy && plan.courseCategories.length) found.push(...await rows(tx, sql`select ${COLUMNS} from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where i.kind='course' and ${SERVABLE} and v.fields->>'category' in (${sql.join(plan.courseCategories.map((c) => sql`${c}`), sql`,`)})
    order by array_position(${textArray(plan.courseCategories)}, v.fields->>'category'), i.slug limit 4`))
  return shapeItems(tx, found)
}

const ownOpportunity = async (tx: Executor, partnerId: string, id: string) => (await rows(tx, sql`select o.id,o.status,o.discovery,o.scope,o.created_at,p.business_name,p.website_url,p.industry
  from expansion_opportunities o join prospects p on p.id=o.prospect_id where o.id=${id} and o.partner_id=${partnerId}`))[0]

/** Contextual guidance for one of the partner's own opportunities. Another partner's opportunity is indistinguishable from a missing one. */
export async function opportunityGuidance(opportunityId: unknown) {
  const actor = await partner()
  if (typeof opportunityId !== "string" || !UUID.test(opportunityId)) throw new ContentError("Opportunity not found.", 404)
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    const o = await ownOpportunity(tx, partnerId, opportunityId)
    if (!o) throw new ContentError("Opportunity not found.", 404)
    const plan = guidancePlanFor(o.discovery, { website: o.website_url })
    const meetings = await rows(tx, sql`select id,meeting_type,status,confirmed_start,proposed_start,created_at from expansion_meeting_requests where partner_id=${partnerId} and opportunity_id=${opportunityId} order by created_at desc limit 10`)
    return {
      opportunity: { id: String(o.id), businessName: String(o.business_name), status: explain(OPPORTUNITY_STATUS, o.status), statusKey: String(o.status) },
      reasons: plan.rules, escalation: plan.escalation, discoveryGaps: discoveryGaps(o.discovery),
      guidance: await guidanceForPlan(tx, plan),
      meetings: meetings.map((m) => ({ id: String(m.id), type: String(m.meeting_type), status: explain(MEETING_STATUS, m.status), statusKey: String(m.status), confirmedStart: iso(m.confirmed_start), proposedStart: iso(m.proposed_start) })),
    }
  })
}

/** Preparation for one of the partner's own meetings. */
export async function meetingPreparation(meetingId: unknown) {
  const actor = await partner()
  if (typeof meetingId !== "string" || !UUID.test(meetingId)) throw new ContentError("Meeting not found.", 404)
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    const [m] = await rows(tx, sql`select id,meeting_type,status,purpose,preferred_slots,time_zone,founder_note,proposed_start,confirmed_start,opportunity_id,created_at from expansion_meeting_requests where id=${meetingId} and partner_id=${partnerId}`)
    if (!m) throw new ContentError("Meeting not found.", 404)
    const o = m.opportunity_id ? await ownOpportunity(tx, partnerId, String(m.opportunity_id)) : undefined
    const plan = o ? guidancePlanFor(o.discovery, { website: o.website_url }) : null
    const byType = MEETING_GUIDANCE[String(m.meeting_type)] ?? { knowledgeTopics: [], courseCategories: [], searchTerms: [] }
    const byTypeObjections = MEETING_OBJECTIONS[String(m.meeting_type)] ?? []
    const merged = {
      knowledgeTopics: [...new Set([...byType.knowledgeTopics, ...(plan?.knowledgeTopics ?? [])])],
      searchTerms: [...new Set([...byType.searchTerms, ...(plan?.searchTerms ?? [])])],
      courseCategories: [...new Set([...byType.courseCategories, ...(plan?.courseCategories ?? [])])],
      objectionCategories: [...new Set([...byTypeObjections, ...(plan?.objectionCategories ?? [])])],
    }
    const discovery = (o?.discovery ?? {}) as Record<string, unknown>
    const recorded = Object.entries(discovery).filter(([, v]) => typeof v === "string" && v.trim()).map(([field, value]) => ({ field, value: String(value).slice(0, 600) }))
    return {
      meeting: { id: String(m.id), type: String(m.meeting_type), status: explain(MEETING_STATUS, m.status), statusKey: String(m.status), purpose: String(m.purpose ?? ""),
        confirmedStart: iso(m.confirmed_start), proposedStart: iso(m.proposed_start), timeZone: String(m.time_zone ?? ""), founderNote: m.founder_note ? String(m.founder_note) : null },
      opportunity: o ? { id: String(o.id), businessName: String(o.business_name), status: explain(OPPORTUNITY_STATUS, o.status), recorded, gaps: discoveryGaps(o.discovery) } : null,
      reasons: plan?.rules ?? [], guidance: await guidanceForPlan(tx, merged),
    }
  })
}

/** The partner's day: their own agreement state, open opportunities and meetings, where to continue learning, and newly approved guidance. */
export async function partnerToday() {
  const actor = await partner()
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    const opportunities = await rows(tx, sql`select o.id,o.status,o.created_at,p.business_name,p.next_follow_up_at from expansion_opportunities o join prospects p on p.id=o.prospect_id
      where o.partner_id=${partnerId} and o.status not in ('closed_lost','withdrawn') order by (o.status in ('more_information','bespoke_required')) desc, o.created_at desc limit 8`)
    const meetings = await rows(tx, sql`select m.id,m.meeting_type,m.status,m.confirmed_start,m.proposed_start,m.created_at,p.business_name from expansion_meeting_requests m
      left join expansion_opportunities o on o.id=m.opportunity_id left join prospects p on p.id=o.prospect_id
      where m.partner_id=${partnerId} and m.status in ('requested','under_review','info_required','alternative_proposed','confirmed')
        and not (m.status='confirmed' and m.confirmed_start < now() - interval '1 day')
      order by (m.status='confirmed') desc, coalesce(m.confirmed_start,m.proposed_start,m.created_at) limit 8`)
    // Learning records are read only by the Academy service (Academy isolation rule); this asks it for the partner's own pointers.
    const continueLearning = modules().academy ? await continueLearningFor(tx, partnerId) : []
    const kinds = kindFilter(GUIDANCE_TYPES)
    // B1.7: read from the partner's own agreement records (never inferred from an invitation); no other partner's record is reachable.
    const agreement = await agreementStatusFor(tx, partnerId)
    const recent = kinds ? await shapeItems(tx, await rows(tx, sql`select ${COLUMNS} from empower_content_versions v join empower_content_items i on i.id=v.item_id where ${SERVABLE} ${kinds} order by v.approved_at desc, i.slug limit 5`)) : []
    return {
      agreement,
      opportunities: opportunities.map((o) => ({ id: String(o.id), businessName: String(o.business_name), status: explain(OPPORTUNITY_STATUS, o.status), statusKey: String(o.status), followUp: iso(o.next_follow_up_at) })),
      meetings: meetings.map((m) => ({ id: String(m.id), type: String(m.meeting_type), businessName: m.business_name ? String(m.business_name) : null, status: explain(MEETING_STATUS, m.status), statusKey: String(m.status), confirmedStart: iso(m.confirmed_start), proposedStart: iso(m.proposed_start) })),
      continueLearning,
      recentGuidance: recent,
      available: availability(),
    }
  })
}

/**
 * Founder operations queue over existing records. Private Academy progress is never read here.
 * B1.7 adds applications awaiting a decision, activated partners whose agreement needs attention, and partner emails that were not
 * delivered (failed, or switched on without a provider), so founders can see and act on them where they already work (Recruitment).
 * No recipient address or message body is read: partner_notifications holds neither.
 */
export async function founderOperations(tx: Executor) {
  const meetings = await rows(tx, sql`select m.id,m.meeting_type,m.status,m.created_at,u.display_name partner_name,p.business_name from expansion_meeting_requests m
    join expansion_partners ep on ep.id=m.partner_id join admin_users u on u.id=ep.user_id left join expansion_opportunities o on o.id=m.opportunity_id left join prospects p on p.id=o.prospect_id
    where m.status in ('requested','under_review','info_required','alternative_proposed') order by m.created_at limit 50`)
  const scopes = await rows(tx, sql`select o.id,o.status,o.updated_at,u.display_name partner_name,p.business_name from expansion_opportunities o join expansion_partners ep on ep.id=o.partner_id
    join admin_users u on u.id=ep.user_id join prospects p on p.id=o.prospect_id where o.status in ('scope_submitted','bespoke_required') order by o.updated_at limit 50`)
  const inReview = await rows(tx, sql`select i.kind,i.slug,v.title,v.version,v.submitted_at from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where v.status in ('in_review','approved') order by v.submitted_at nulls last limit 50`)
  const expiring = await rows(tx, sql`select i.kind,i.slug,v.title,v.review_by from empower_content_versions v join empower_content_items i on i.id=v.item_id
    where v.status='published' and v.review_by <= (now() at time zone 'UTC')::date + 30 order by v.review_by, i.slug limit 50`)
  const applications = await rows(tx, sql`select id,name,status,submitted_at from partner_applications
    where status in ('submitted','under_review','information_requested') order by (status='submitted') desc, submitted_at limit 50`)
  const agreements = await rows(tx, sql`select p.id,u.display_name partner_name,p.agreement_content_version_id issued_id,coalesce(partner_agreement_current(p.agreement_content_version_id), false) issued_current,
      a.content_version_id accepted_id
    from expansion_partners p join admin_users u on u.id=p.user_id left join partner_agreement_acceptances a on a.id=p.agreement_acceptance_id and a.partner_id=p.id
    where p.activated_at is not null and u.active and p.agreement_content_version_id is not null
      and (a.content_version_id is distinct from p.agreement_content_version_id or not coalesce(partner_agreement_current(p.agreement_content_version_id), false))
    order by u.display_name limit 50`)
  const notifications = await rows(tx, sql`select n.id,n.kind,n.status,n.failure_reason,n.attempts,n.updated_at,coalesce(u.display_name,pa.name) recipient_name
    from partner_notifications n left join expansion_partners p on p.id=n.partner_id left join admin_users u on u.id=p.user_id left join partner_applications pa on pa.id=n.application_id
    where n.status in ('failed','not_configured') and n.updated_at > now() - interval '30 days' order by n.updated_at desc limit 50`)
  return {
    applications: applications.map((a) => ({ id: Number(a.id), name: String(a.name), status: String(a.status), submittedAt: iso(a.submitted_at) })),
    agreements: agreements.map((a) => ({ partnerId: String(a.id), partnerName: String(a.partner_name),
      state: agreementState({ issuedVersionId: String(a.issued_id), issuedCurrent: a.issued_current === true, acceptedVersionId: a.accepted_id ? String(a.accepted_id) : null }) })),
    notifications: notifications.map((n) => ({ id: String(n.id), kind: String(n.kind), status: String(n.status), reason: n.failure_reason ? String(n.failure_reason) : null, attempts: Number(n.attempts), at: iso(n.updated_at), recipientName: n.recipient_name ? String(n.recipient_name) : null })),
    meetings: meetings.map((m) => ({ ...m, status: explain(MEETING_STATUS, m.status), statusKey: String(m.status) })),
    scopes: scopes.map((o) => ({ ...o, status: explain(OPPORTUNITY_STATUS, o.status), statusKey: String(o.status) })),
    contentAwaitingDecision: inReview, contentExpiring: expiring,
  }
}
