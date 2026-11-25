import "server-only"
import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { hasCapability } from "@/lib/rbac"
import { type AdminRole } from "@/lib/admin-users"
import { ExpansionError } from "@/lib/expansion"
import { ACKNOWLEDGED_STEPS, deriveJourney, isAcknowledgedStep, isRequestableToolkitItem, PARTNER_REQUEST_NOTE, type AgreementFact, type JourneyFacts, type PartnerJourney, type ToolkitRecord } from "@/lib/partner-journey"
import { partnerAcademyEnabled, partnerGuard, partnerKnowledgeEnabled, partnerResourcesEnabled } from "./empower-partner"
import { partnerObjectionsEnabled } from "./empower-objections"
import { lessonCompletionCounts } from "./empower-academy"
import { partnerWorkspaceEnabled } from "./empower-guidance"
import { partnerPipelineEnabled } from "./partner-pipeline"
import { partnerPerformanceEnabled } from "./partner-performance"
import { partnerAgreementOverview } from "./partner-agreements"
import { getPartnerProfile } from "./expansion-profiles"
import { requireCapability } from "./rbac"

/*
 * Operation EMPOWER B2.10: the server half of the partner journey. Gathers authoritative facts for ONE partner (the caller) and
 * hands them to the pure deriveJourney(). Partner writes here are limited to (a) acknowledging a required step and (b) asking
 * for a manual toolkit item. Neither activates anyone, provisions anything, sends a message or touches commission.
 */
type Executor = Pick<AdminDatabaseTransaction, "execute">
type Row = Record<string, unknown>
const rows = async (tx: Executor, query: SQL): Promise<Row[]> => (await tx.execute(query)).rows as Row[]
export class JourneyError extends ExpansionError { constructor(message: string, status = 400) { super(message, status); this.name = "JourneyError" } }

const today = sql`(now() at time zone 'UTC')::date`
const servable = (kind: string) => sql`select v.title, v.fields from empower_content_versions v join empower_content_items i on i.id=v.item_id
  where v.status='published' and v.review_by >= ${today} and i.audience in ('partner_only','client_facing') and i.kind=${kind}`

async function partnerFacts(tx: Executor, partnerId: string) {
  const [acks, toolkit, referral, meetings, allocated, opportunities, markets, courses, lessons, resources, knowledge, objections] = await Promise.all([
    rows(tx, sql`select step_key,completed_at from expansion_onboarding_progress where partner_id=${partnerId}`),
    rows(tx, sql`select item_key,status,detail,completed_at from expansion_toolkit_items where partner_id=${partnerId}`),
    rows(tx, sql`select code from expansion_referral_codes where partner_id=${partnerId}`),
    rows(tx, sql`select meeting_type,count(*)::int n from expansion_meeting_requests where partner_id=${partnerId} and status in ('requested','under_review','info_required','alternative_proposed','confirmed') group by meeting_type`),
    rows(tx, sql`select count(*)::int n from expansion_research_candidates where status='allocated' and allocated_partner_id=${partnerId}`),
    rows(tx, sql`select count(*)::int n from expansion_opportunities where partner_id=${partnerId}`),
    rows(tx, sql`select country_name from expansion_markets where status='approved' order by country_name`),
    rows(tx, servable("course")),
    lessonCompletionCounts(tx, partnerId),
    rows(tx, servable("resource")),
    rows(tx, servable("knowledge")),
    rows(tx, servable("objection")),
  ])
  const acknowledged: JourneyFacts["acknowledged"] = {}
  for (const a of acks) if (isAcknowledgedStep(a.step_key)) acknowledged[a.step_key] = new Date(String(a.completed_at)).toISOString()
  const toolkitMap: Record<string, ToolkitRecord> = {}
  for (const t of toolkit) toolkitMap[String(t.item_key)] = { status: String(t.status), detail: t.detail == null ? null : String(t.detail), completedAt: t.completed_at == null ? null : String(t.completed_at) }
  const byType: Record<string, number> = {}
  for (const m of meetings) byType[String(m.meeting_type)] = Number(m.n)
  const labels = resources.map((r) => `${String(r.title ?? "")} ${String(((r.fields ?? {}) as { category?: string }).category ?? "")}`.trim()).filter(Boolean)
  return {
    acknowledged, toolkit: toolkitMap, referralCode: referral[0] ? String(referral[0].code) : null,
    meetings: { open: Object.values(byType).reduce((a, b) => a + b, 0), byType },
    allocatedProspects: Number(allocated[0]?.n ?? 0), opportunities: Number(opportunities[0]?.n ?? 0), approvedMarkets: markets.map((m) => String(m.country_name)),
    content: { courses: courses.length, lessonsCompleted: lessons.get(partnerId) ?? 0, resources: resources.length, resourceLabels: labels, knowledgeArticles: knowledge.length, objectionResponses: objections.length },
  }
}

const features = (): JourneyFacts["features"] => ({
  academy: partnerAcademyEnabled(), resources: partnerResourcesEnabled(), knowledge: partnerKnowledgeEnabled(), objections: partnerObjectionsEnabled(),
  pipeline: partnerPipelineEnabled(), performance: partnerPerformanceEnabled(), guidance: partnerWorkspaceEnabled(), profilePublication: process.env.PARTNER_PROFILE_PUBLICATION_ENABLED === "true",
})

function profileFact(profile: Awaited<ReturnType<typeof getPartnerProfile>>): JourneyFacts["profile"] {
  const p = profile as unknown as { eligible?: boolean; publication?: { status?: string } | null; versions?: { status?: string }[] }
  const open = (p.versions ?? []).find((v) => ["draft", "changes_requested", "submitted"].includes(String(v.status)))
  return { eligible: Boolean(p.eligible), status: p.publication?.status === "live" ? "live" : open ? String(open.status) : null }
}

/** The calling partner's journey. */
export async function getPartnerJourney(): Promise<PartnerJourney & { displayName: string }> {
  const actor = await requireCapability("expansion.partner")
  const [agreement, profile] = await Promise.all([
    partnerAgreementOverview().then((o) => o.state as AgreementFact).catch(() => "unknown" as const),
    getPartnerProfile(),
  ])
  const facts = await db.transaction(async (tx) => partnerFacts(tx, await partnerGuard(tx, actor)))
  return { displayName: actor.displayName, ...deriveJourney({ displayName: actor.displayName, agreement, features: features(), profile: profileFact(profile), ...facts }) }
}

/** The partner acknowledges a required step. Idempotent: a second acknowledgement keeps the first timestamp. */
export async function acknowledgeOnboardingStep(input: { step?: unknown }) {
  const actor = await requireCapability("expansion.partner")
  if (!isAcknowledgedStep(input.step)) throw new JourneyError(`Choose one of: ${ACKNOWLEDGED_STEPS.join(", ")}.`)
  const step = input.step
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    await tx.execute(sql`insert into expansion_onboarding_progress(partner_id,step_key,completed_by) values(${partnerId},${step},${actor.id}) on conflict (partner_id,step_key) do nothing`)
    await tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actor.id},${partnerId},'onboarding_step_acknowledged',${JSON.stringify({ step })}::jsonb)`)
    return { step }
  })
}

/**
 * The partner asks for a manual toolkit item (email, digital card, CircleCard). Records intent only, as 'awaiting_approval'.
 * A request never overwrites a founder's record: once a founder has recorded anything for the item, the partner cannot change it.
 */
export async function requestToolkitItem(input: { itemKey?: unknown; note?: unknown }) {
  const actor = await requireCapability("expansion.partner")
  if (!isRequestableToolkitItem(input.itemKey)) throw new JourneyError("This item cannot be requested here.")
  const itemKey = input.itemKey
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim().slice(0, 500) : PARTNER_REQUEST_NOTE
  return db.transaction(async (tx) => {
    const partnerId = await partnerGuard(tx, actor)
    await tx.execute(sql`select id from expansion_partners where id=${partnerId} for update`)
    const inserted = await rows(tx, sql`insert into expansion_toolkit_items(id,partner_id,item_key,status,detail,updated_by) values(${randomUUID()},${partnerId},${itemKey},'awaiting_approval',${note},${actor.id})
      on conflict (partner_id,item_key) do nothing returning item_key`)
    if (!inserted.length) throw new JourneyError("This item has already been requested or recorded by ScaleSmiths.", 409)
    await tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actor.id},${partnerId},'toolkit_item_requested',${JSON.stringify({ itemKey })}::jsonb)`)
    return { itemKey, status: "awaiting_approval" }
  })
}

/** Founder view: one onboarding checklist row per activated partner, plus pending toolkit requests. */
export async function getOnboardingAdmin() {
  const actor = await requireCapability("expansion.manage")
  return db.transaction(async (tx) => {
    const [user] = await rows(tx, sql`select role::text,active,session_version from admin_users where id=${actor.id} for share`)
    if (!user?.active || user.session_version !== actor.sessionVersion || !hasCapability(user.role as AdminRole, "expansion.manage")) throw new JourneyError("Founder authority was revoked.", 403)
    const partners = await rows(tx, sql`select p.id,u.display_name,p.activated_at,(p.agreement_acceptance_id is not null) agreement_accepted,
        (select count(*)::int from expansion_onboarding_progress o where o.partner_id=p.id) acknowledged,
        (select count(*)::int from expansion_opportunities x where x.partner_id=p.id) opportunities,
        (select count(*)::int from expansion_meeting_requests m where m.partner_id=p.id and m.status in ('requested','under_review','info_required')) open_requests,
        (select count(*)::int from expansion_toolkit_items t where t.partner_id=p.id and t.status='awaiting_approval') toolkit_requests
      from expansion_partners p join admin_users u on u.id=p.user_id where p.activated_at is not null order by u.display_name`)
    const lessons = await lessonCompletionCounts(tx)
    const total = ACKNOWLEDGED_STEPS.length + 1
    // Applicants still on the way in: application, review, invitation, account set-up and market, in one row each.
    const applicants = await rows(tx, sql`select a.id, a.name, a.status, a.submitted_at, a.onboarding_confirmations, a.residence_country,
        p.id partner_id, p.operating_country, p.invitation_expires_at, (p.invitation_hash is not null) invitation_outstanding, p.activated_at, (p.agreement_content_version_id is not null) agreement_issued,
        m.status market_status
      from partner_applications a left join expansion_partners p on p.application_id = a.id left join expansion_markets m on m.country_code = coalesce(p.operating_country, a.residence_country)
      where a.status not in ('activated','declined','withdrawn','archived') order by a.submitted_at desc limit 200`)
    const [queue] = await rows(tx, sql`select
        (select count(*)::int from partner_applications where status in ('submitted','under_review','information_requested','conversation_arranged','assessment_in_progress')) applications_to_review,
        (select count(*)::int from partner_applications where status in ('approved_in_principle','agreement_pending','onboarding')) applicants_to_onboard,
        (select count(*)::int from empower_content_versions v join empower_content_items i on i.id = v.item_id where v.status = 'in_review' and i.kind <> 'agreement') content_in_review,
        (select count(*)::int from empower_content_versions v join empower_content_items i on i.id = v.item_id where v.status = 'approved' and i.kind <> 'agreement') content_to_publish,
        (select count(*)::int from empower_content_versions v join empower_content_items i on i.id = v.item_id where i.kind = 'agreement' and v.status in ('draft','in_review','approved')) agreement_versions_in_progress,
        (select count(*)::int from empower_content_versions v join empower_content_items i on i.id = v.item_id where i.kind = 'agreement' and partner_agreement_current(v.id)) agreements_current,
        (select count(*)::int from expansion_markets where status = 'approved') markets_approved,
        (select count(*)::int from expansion_markets where status = 'under_review') markets_under_review,
        (select count(*)::int from expansion_toolkit_items where status = 'awaiting_approval') toolkit_requests,
        (select count(*)::int from expansion_meeting_requests where status in ('requested','under_review','info_required')) meeting_requests`)
    const confirmations = (value: unknown) => { const c = (value ?? {}) as Record<string, unknown>; return ["agreement", "legal", "independentStatus", "operations"].filter((k) => c[k] === true).length }
    return {
      queue: Object.fromEntries(Object.entries(queue ?? {}).map(([k, v]) => [k, Number(v)])),
      applicants: applicants.map((a) => ({ id: Number(a.id), name: String(a.name), status: String(a.status), submittedAt: new Date(String(a.submitted_at)).toISOString(), confirmations: confirmations(a.onboarding_confirmations),
        invitation: a.activated_at ? "activated" : a.invitation_outstanding === true ? (new Date(String(a.invitation_expires_at)) > new Date() ? "issued" : "expired") : a.partner_id ? "not_outstanding" : "not_issued",
        agreementIssued: a.agreement_issued === true, market: a.market_status ? String(a.market_status) : "unknown" })),
      requiredSteps: total,
      partners: partners.map((p) => {
        const completed = Number(p.acknowledged) + (p.agreement_accepted === true ? 1 : 0)
        return { id: String(p.id), name: String(p.display_name), activatedAt: p.activated_at ? new Date(String(p.activated_at)).toISOString() : null, agreementAccepted: p.agreement_accepted === true,
          completed, percent: Math.round((completed / total) * 100), lessons: lessons.get(String(p.id)) ?? 0, opportunities: Number(p.opportunities), openRequests: Number(p.open_requests), toolkitRequests: Number(p.toolkit_requests) }
      }),
    }
  })
}
