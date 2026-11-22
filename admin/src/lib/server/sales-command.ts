import "server-only"
import { randomUUID } from "node:crypto"
import { sql, type SQL } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { ExpansionError } from "@/lib/expansion"
import { hasCapability } from "@/lib/rbac"
import type { AdminRole } from "@/lib/admin-users"
import { explain, MEETING_STATUS, OPPORTUNITY_STATUS } from "@/lib/partner-guidance"
import {
  ageInDays, ASSISTANCE_MEETING_TYPES, assignmentProblem, hrefFor, OPEN_STATUSES, PROPOSAL_FOLLOW_UP_AFTER_DAYS, QUEUE_KINDS, sortQueue, STALLED_AFTER_DAYS,
  type AssignmentInput, type QueueItem,
} from "@/lib/sales-command"
import { getExpansionFinance } from "./expansion-finance"
import { requireCapability } from "./rbac"

/*
 * Operation Ascend B2.3: the founder sales command centre. It reads existing records, links each item to where it is decided,
 * and adds one write: which founder is handling an opportunity internally (never the partner's ownership or entitlement).
 * Commission figures come from getExpansionFinance, the same function behind the Commission centre. Learning progress is
 * never read. OFF unless FOUNDER_SALES_COMMAND_ENABLED=true.
 */
type Row = Record<string, unknown>
type Executor = Pick<AdminDatabaseTransaction, "execute">
export const founderSalesCommandEnabled = () => process.env.FOUNDER_SALES_COMMAND_ENABLED === "true"
const rows = async (tx: Executor, q: SQL): Promise<Row[]> => (await tx.execute(q)).rows as Row[]
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null)
const OPEN = sql.join(OPEN_STATUSES.map((s) => sql`${s}`), sql`,`)
const ASSIST = sql.join(ASSISTANCE_MEETING_TYPES.map((s) => sql`${s}`), sql`,`)

async function founder() {
  if (!founderSalesCommandEnabled()) throw new ExpansionError("The sales command centre is not available yet.", 404)
  return requireCapability("expansion.manage")
}
async function liveFounder(tx: Executor, actor: Awaited<ReturnType<typeof requireCapability>>) {
  const [u] = await rows(tx, sql`select role,active,session_version from admin_users where id=${actor.id} for share`)
  if (!u?.active || u.session_version !== actor.sessionVersion || !hasCapability(u.role as AdminRole, "expansion.manage")) throw new ExpansionError("Workspace authority was revoked.", 403)
}
const currentAssignments = (tx: Executor) => rows(tx, sql`select a.id,a.opportunity_id,a.assignee_id,u.display_name assignee_name,a.reason,a.created_at from expansion_founder_assignments a
  left join admin_users u on u.id=a.assignee_id where not exists(select 1 from expansion_founder_assignments n where n.supersedes_id=a.id)`)

export async function founderCommandCentre(now = new Date()) {
  const actor = await founder()
  const data = await db.transaction(async (tx) => {
    // One consistent snapshot for every count and list (must be the transaction's first statement).
    await tx.execute(sql`set transaction isolation level repeatable read`)
    await liveFounder(tx, actor)
    const [counts] = await rows(tx, sql`select
        count(*) filter (where status in (${OPEN}) or status in ('scope_submitted','approved'))::int active,
        count(*) filter (where status='scope_submitted')::int awaiting_review,
        count(*) filter (where status='scope_submitted' and jsonb_array_length(coalesce(scope->'technicalFlags','[]'::jsonb))>0)::int technical_scoping,
        count(*) filter (where status='approved')::int proposals_awaiting,
        count(*) filter (where status='contract_accepted')::int confirmed_outcomes
      from expansion_opportunities`)
    const meetings = await rows(tx, sql`select m.id,m.meeting_type,m.status,m.created_at,m.opportunity_id,u.display_name partner_name,p.business_name from expansion_meeting_requests m
      join expansion_partners ep on ep.id=m.partner_id join admin_users u on u.id=ep.user_id left join expansion_opportunities o on o.id=m.opportunity_id left join prospects p on p.id=o.prospect_id
      where m.status in ('requested','under_review','info_required','alternative_proposed') order by m.created_at limit 200`)
    const scopes = await rows(tx, sql`select o.id,o.updated_at,o.scope,u.display_name partner_name,p.business_name from expansion_opportunities o join expansion_partners ep on ep.id=o.partner_id
      join admin_users u on u.id=ep.user_id join prospects p on p.id=o.prospect_id where o.status='scope_submitted' order by o.updated_at limit 200`)
    const proposals = await rows(tx, sql`select o.id,o.updated_at,u.display_name partner_name,p.business_name from expansion_opportunities o join expansion_partners ep on ep.id=o.partner_id
      join admin_users u on u.id=ep.user_id join prospects p on p.id=o.prospect_id where o.status='approved' and o.updated_at < ${new Date(now.getTime() - PROPOSAL_FOLLOW_UP_AFTER_DAYS * 86400000).toISOString()}::timestamptz order by o.updated_at limit 200`)
    const stalled = await rows(tx, sql`select o.id,o.status,o.last_activity,u.display_name partner_name,p.business_name from (
        select o.*,greatest(o.updated_at,(select max(a.created_at) from expansion_audit a where a.entity_id=o.id::text),(select max(i.created_at) from expansion_opportunity_interactions i where i.opportunity_id=o.id)) last_activity
        from expansion_opportunities o where o.status in (${OPEN})) o
      join expansion_partners ep on ep.id=o.partner_id join admin_users u on u.id=ep.user_id join prospects p on p.id=o.prospect_id
      where o.last_activity < ${new Date(now.getTime() - STALLED_AFTER_DAYS * 86400000).toISOString()}::timestamptz order by o.last_activity limit 200`)
    const applications = await rows(tx, sql`select id,name,status,submitted_at from partner_applications where status in ('submitted','under_review') order by submitted_at limit 200`)
    const failed = await rows(tx, sql`select n.id,n.kind,n.updated_at,coalesce(u.display_name,a.name) who from partner_notifications n left join expansion_partners ep on ep.id=n.partner_id
      left join admin_users u on u.id=ep.user_id left join partner_applications a on a.id=n.application_id where n.status='failed' order by n.updated_at limit 200`)
    const [onboarding] = await rows(tx, sql`select count(*) filter (where p.activated_at is null)::int invited_not_activated from expansion_partners p`)
    const partners = await rows(tx, sql`select p.id,u.display_name,u.active,p.activated_at,p.operating_country,
        (select count(*) from expansion_opportunities o where o.partner_id=p.id and (o.status in (${OPEN}) or o.status in ('scope_submitted','approved')))::int open_opportunities,
        (select count(*) from expansion_opportunities o where o.partner_id=p.id and o.status='contract_accepted')::int confirmed_outcomes,
        (select count(*) from expansion_meeting_requests m where m.partner_id=p.id and m.status in ('requested','under_review','info_required','alternative_proposed') and m.meeting_type in (${ASSIST}))::int open_help_requests
      from expansion_partners p join admin_users u on u.id=p.user_id order by u.display_name, p.id limit 1000`)
    const founders = await rows(tx, sql`select id,display_name from admin_users where active and role::text in ('owner','administrator') order by display_name`)
    return { counts, meetings, scopes, proposals, stalled, applications, failed, onboarding, partners, founders, assignments: await currentAssignments(tx) }
  })
  // The Commission centre's own function, so this view can never disagree with it. Read separately (it runs its own guard).
  const finance = await getExpansionFinance()
  const commission = new Map((finance.partners as Row[]).map((p) => [String(p.id), { earnedPence: String(p.earned_pence), paidPence: String(p.paid_pence) }]))
  const assignment = new Map(data.assignments.map((a) => [String(a.opportunity_id), { id: String(a.id), assigneeId: a.assignee_id ? String(a.assignee_id) : null, assigneeName: a.assignee_name ? String(a.assignee_name) : null, reason: String(a.reason), at: iso(a.created_at) }]))

  const items: QueueItem[] = [
    ...data.meetings.map((m): QueueItem => ({ kind: (ASSISTANCE_MEETING_TYPES as readonly string[]).includes(String(m.meeting_type)) ? "assistance" : "meeting", id: `meeting:${m.id}`,
      title: m.business_name ? String(m.business_name) : "No linked prospect", partnerName: String(m.partner_name), since: iso(m.created_at)!, href: m.opportunity_id ? hrefFor.opportunity(String(m.opportunity_id)) : hrefFor.meetings(),
      detail: `${String(m.meeting_type).replaceAll("_", " ")} · ${explain(MEETING_STATUS, m.status).label}`, opportunityId: m.opportunity_id ? String(m.opportunity_id) : null, tags: [] })),
    ...data.scopes.map((o): QueueItem => {
      const flags = ((o.scope as Row | null)?.technicalFlags as string[] | undefined) ?? []
      return { kind: "scope_review", id: `scope:${o.id}`, title: String(o.business_name), partnerName: String(o.partner_name), since: iso(o.updated_at)!, href: hrefFor.opportunity(String(o.id)),
        detail: flags.length ? `Technical scoping: ${flags.join(", ")}` : null, opportunityId: String(o.id), tags: flags.length ? ["technical"] : [] }
    }),
    ...data.failed.map((n): QueueItem => ({ kind: "notification_failed", id: `notification:${n.id}`, title: String(n.kind).replaceAll("_", " "), partnerName: n.who ? String(n.who) : null, since: iso(n.updated_at)!, href: hrefFor.recruitment(), detail: null, opportunityId: null, tags: [] })),
    ...data.applications.map((a): QueueItem => ({ kind: "application", id: `application:${a.id}`, title: String(a.name), partnerName: null, since: iso(a.submitted_at)!, href: hrefFor.recruitment(), detail: String(a.status).replaceAll("_", " "), opportunityId: null, tags: [] })),
    ...data.proposals.map((o): QueueItem => ({ kind: "proposal_follow_up", id: `proposal:${o.id}`, title: String(o.business_name), partnerName: String(o.partner_name), since: iso(o.updated_at)!, href: hrefFor.opportunity(String(o.id)), detail: "Approved; no contract recorded", opportunityId: String(o.id), tags: [] })),
    ...data.stalled.map((o): QueueItem => ({ kind: "stalled", id: `stalled:${o.id}`, title: String(o.business_name), partnerName: String(o.partner_name), since: iso(o.last_activity)!, href: hrefFor.opportunity(String(o.id)), detail: explain(OPPORTUNITY_STATUS, o.status).label, opportunityId: String(o.id), tags: [] })),
  ]
  const queue = sortQueue(items).map((i) => ({ ...i, ageDays: ageInDays(i.since, now), assignment: i.opportunityId ? assignment.get(i.opportunityId) ?? null : null }))
  const help = queue.filter((i) => i.kind === "assistance").length
  return {
    generatedAt: now.toISOString(), rules: QUEUE_KINDS, thresholds: { stalledAfterDays: STALLED_AFTER_DAYS, proposalFollowUpAfterDays: PROPOSAL_FOLLOW_UP_AFTER_DAYS },
    overview: {
      activeOpportunities: Number(data.counts.active), awaitingReview: Number(data.counts.awaiting_review), technicalScoping: Number(data.counts.technical_scoping),
      meetingsToConfirm: queue.filter((i) => i.kind === "meeting").length, assistanceRequests: help, proposalsAwaitingAction: Number(data.counts.proposals_awaiting),
      confirmedOutcomes: Number(data.counts.confirmed_outcomes), stalled: data.stalled.length, applicationsToReview: data.applications.length,
      invitedNotActivated: Number(data.onboarding.invited_not_activated), failedNotifications: data.failed.length,
    },
    queue,
    // Alphabetical, never ranked. No Academy or learning data is read for this view.
    partners: data.partners.map((p) => ({ id: String(p.id), name: String(p.display_name), status: !p.active ? "Inactive" : p.activated_at ? "Active" : "Invited", region: p.operating_country ? String(p.operating_country) : null,
      openOpportunities: Number(p.open_opportunities), confirmedOutcomes: Number(p.confirmed_outcomes), openHelpRequests: Number(p.open_help_requests), commission: commission.get(String(p.id)) ?? { earnedPence: "0", paidPence: "0" } })),
    founders: data.founders.map((f) => ({ id: String(f.id), name: String(f.display_name) })),
  }
}

/**
 * Assign (or release) the founder handling an opportunity. Compare-and-set on the current assignment: a stale view gets 409
 * and the database's unique constraints refuse a concurrent duplicate. The partner, ownership and commission are not touched.
 */
export async function assignFounder(input: AssignmentInput) {
  const actor = await founder()
  const problem = assignmentProblem(input)
  if (problem) throw new ExpansionError(problem, problem === "Opportunity not found." ? 404 : 400)
  const opportunityId = input.opportunityId as string, assigneeId = input.assigneeId as string | null, expected = input.expectedCurrentId as string | null
  return db.transaction(async (tx) => {
    await liveFounder(tx, actor)
    const [o] = await rows(tx, sql`select id from expansion_opportunities where id=${opportunityId} for update`)
    if (!o) throw new ExpansionError("Opportunity not found.", 404)
    if (assigneeId) {
      const [f] = await rows(tx, sql`select role from admin_users where id=${assigneeId} and active`)
      if (!f || !hasCapability(f.role as AdminRole, "expansion.manage")) throw new ExpansionError("Choose an active founder.")
    }
    const [current] = await rows(tx, sql`select a.id,a.assignee_id from expansion_founder_assignments a where a.opportunity_id=${opportunityId} and not exists(select 1 from expansion_founder_assignments n where n.supersedes_id=a.id)`)
    if ((current ? String(current.id) : null) !== expected) throw new ExpansionError("Someone else changed this assignment. Reload to see the current one.", 409)
    if ((current?.assignee_id ? String(current.assignee_id) : null) === assigneeId) throw new ExpansionError(assigneeId ? "That founder is already assigned." : "Nobody is assigned.", 409)
    if (!current && !assigneeId) throw new ExpansionError("Nobody is assigned.", 409)
    const id = randomUUID()
    await tx.execute(sql`insert into expansion_founder_assignments(id,opportunity_id,assignee_id,assigned_by,reason,supersedes_id) values(${id},${opportunityId},${assigneeId},${actor.id},${(input.reason as string).trim()},${expected})`)
    await tx.execute(sql`insert into expansion_audit(actor_id,entity_id,action,details) values(${actor.id},${opportunityId},'founder_assignment',${JSON.stringify({ assignmentId: id, assigneeId, previousAssignmentId: expected })}::jsonb)`)
    return { id }
  })
}
