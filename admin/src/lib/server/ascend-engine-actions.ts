import "server-only"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { AscendFailure, validatePayload } from "@/lib/ascend-engine"
import { prepareDueReviewJobs } from "./ascend-review-queue"

/*
 * Handlers for the ASCEND action registry. Every handler is read-only analysis over aggregates, or internal B2.7
 * review preparation. None reads names, email addresses, phone numbers or notes, and none contacts anyone, moves
 * money, changes commission or changes a commercial record. Each finding states its source and its reasoning.
 */

type Row = Record<string, unknown>
type Finding = { kind: string; count: number; explanation: string; recommendedAction: string; href: string }
export type ActionResult = { summary: string; source: string; generatedAt: string; findings: Finding[]; metrics: Record<string, number> }
const rows = async (q: ReturnType<typeof sql>): Promise<Row[]> => (await db.execute(q)).rows as Row[]
const OPEN_STAGES = ["registered","contacted","discovery","qualified","scope_submitted","more_information","bespoke_required","deferred","approved"] as const

function check(signal: AbortSignal) { if (signal.aborted) throw new AscendFailure("deadline_exceeded", "The operation exceeded its execution time limit.") }

type Handler = (payload: Record<string, number | string>, scope: { markets: string[] }, signal: AbortSignal, now: Date) => Promise<ActionResult>
const HANDLERS: Record<string, Handler> = {
  async "ops.queue_health"(payload, _scope, signal, now) {
    const staleMinutes = Number(payload.staleWorkerMinutes)
    const [exec, review, workers] = await Promise.all([
      rows(sql`select status, count(*)::int c, min(available_at) oldest from ascend_executions group by status`),
      rows(sql`select status, count(*)::int c from ascend_review_jobs group by status`),
      rows(sql`select count(*) filter (where status <> 'stopped' and last_heartbeat_at < ${new Date(now.getTime() - staleMinutes * 60e3)})::int stale,
        count(*) filter (where status = 'active')::int active from ascend_workers`),
    ])
    check(signal)
    const n = (list: Row[], s: string) => Number(list.find((r) => r.status === s)?.c ?? 0)
    const metrics = { executionsQueued: n(exec, "queued") + n(exec, "retry_scheduled"), executionsDeadLettered: n(exec, "dead_lettered"), executionsAmbiguous: n(exec, "ambiguous"),
      executionsAwaitingApproval: n(exec, "pending_approval"), reviewTasksDead: n(review, "dead"), reviewTasksPending: n(review, "pending"), reviewTasksPrepared: n(review, "ready"),
      workersActive: Number(workers[0]?.active ?? 0), workersStale: Number(workers[0]?.stale ?? 0) }
    const findings: Finding[] = []
    if (metrics.executionsDeadLettered) findings.push({ kind: "dead_letters", count: metrics.executionsDeadLettered, explanation: "Executions exhausted their retries and stopped.", recommendedAction: "Inspect each dead letter's failure class before retrying.", href: "/expansion/automation/engine?status=dead_lettered" })
    if (metrics.executionsAmbiguous) findings.push({ kind: "ambiguous", count: metrics.executionsAmbiguous, explanation: "A worker stopped during work whose outcome cannot be inferred.", recommendedAction: "Reconcile each one against the underlying record.", href: "/expansion/automation/engine?status=ambiguous" })
    if (metrics.reviewTasksDead) findings.push({ kind: "review_dead_letters", count: metrics.reviewTasksDead, explanation: "B2.7 review tasks failed validation five times.", recommendedAction: "Open the founder review inbox and resolve them.", href: "/expansion/automation/review" })
    if (metrics.workersStale) findings.push({ kind: "stale_workers", count: metrics.workersStale, explanation: `Workers have not sent a heartbeat for over ${staleMinutes} minutes.`, recommendedAction: "Check the worker process (PM2) and its service identity.", href: "/expansion/automation/engine#workers" })
    return { summary: findings.length ? `${findings.length} operational issue(s) need founder attention.` : "No operational issues detected.", source: "ascend_executions, ascend_review_jobs, ascend_workers", generatedAt: now.toISOString(), findings, metrics }
  },

  async "pipeline.inactivity_scan"(payload, _scope, signal, now) {
    const days = Number(payload.inactiveDays)
    const cutoff = new Date(now.getTime() - days * 86400e3)
    const list = await rows(sql`select status, count(*)::int c from expansion_opportunities where status in (${sql.join(OPEN_STAGES.map((s) => sql`${s}`), sql`, `)}) and updated_at < ${cutoff} group by status order by status`)
    check(signal)
    const total = list.reduce((s, r) => s + Number(r.c), 0)
    const metrics: Record<string, number> = { inactiveOpportunities: total, thresholdDays: days }
    for (const r of list) metrics[`stage_${String(r.status)}`] = Number(r.c)
    const findings: Finding[] = total ? [{ kind: "inactive_pipeline", count: total, explanation: `Open opportunities have had no recorded update for more than ${days} days (by last update time; partner notes are not read).`, recommendedAction: "Review stalled stages in the founder sales command centre; any partner contact is a founder decision.", href: "/expansion/command" }] : []
    return { summary: total ? `${total} open opportunit${total === 1 ? "y has" : "ies have"} been inactive for over ${days} days.` : `No open opportunity has been inactive for over ${days} days.`, source: "expansion_opportunities.status, updated_at (aggregate only)", generatedAt: now.toISOString(), findings, metrics }
  },

  async "onboarding.progress_check"(payload, _scope, signal, now) {
    const days = Number(payload.pendingDays)
    const [r] = await rows(sql`select count(*) filter (where invitation_expires_at <= ${now})::int expired,
      count(*) filter (where invitation_expires_at > ${now} and created_at < ${new Date(now.getTime() - days * 86400e3)})::int waiting,
      count(*) filter (where invitation_expires_at > ${now})::int outstanding
      from expansion_partners where activated_at is null and invitation_hash is not null`)
    check(signal)
    const metrics = { expiredInvitations: Number(r?.expired ?? 0), invitationsWaitingBeyondThreshold: Number(r?.waiting ?? 0), outstandingInvitations: Number(r?.outstanding ?? 0), thresholdDays: days }
    const findings: Finding[] = []
    if (metrics.expiredInvitations) findings.push({ kind: "expired_invitations", count: metrics.expiredInvitations, explanation: "Approved applicants' invitations expired before activation.", recommendedAction: "Decide in Recruitment whether to reissue; nothing is reissued automatically.", href: "/expansion" })
    if (metrics.invitationsWaitingBeyondThreshold) findings.push({ kind: "slow_activation", count: metrics.invitationsWaitingBeyondThreshold, explanation: `Invited partners have not activated within ${days} days.`, recommendedAction: "Consider a personal check-in from a founder.", href: "/expansion" })
    return { summary: findings.length ? `${metrics.expiredInvitations + metrics.invitationsWaitingBeyondThreshold} invitation(s) need a founder decision.` : "Onboarding invitations are progressing normally.", source: "expansion_partners invitation and activation timestamps (aggregate only)", generatedAt: now.toISOString(), findings, metrics }
  },

  async "delivery.handoff_readiness"(_payload, _scope, signal, now) {
    const [r] = await rows(sql`select count(*)::int c from expansion_opportunities o where o.status = 'contract_accepted'
      and not exists (select 1 from expansion_delivery_handoffs h where h.opportunity_id = o.id)`)
    check(signal)
    const count = Number(r?.c ?? 0)
    return { summary: count ? `${count} accepted contract(s) await a founder delivery handoff.` : "Every accepted contract has been handed to delivery.", source: "expansion_opportunities, expansion_delivery_handoffs (aggregate only)", generatedAt: now.toISOString(),
      findings: count ? [{ kind: "handoff_pending", count, explanation: "Contracts are accepted but no delivery project has been linked.", recommendedAction: "Review readiness and approve handoffs in the delivery queue.", href: "/expansion/handoffs" }] : [], metrics: { awaitingHandoff: count } }
  },

  async "review.queue_preparation"(payload, _scope, signal, now) {
    const result = await prepareDueReviewJobs(Number(payload.batch), now)
    check(signal)
    return { summary: `Prepared ${result.prepared} review task(s); ${result.rejected} failed validation.`, source: "ascend_review_jobs (B2.7 founder review queue)", generatedAt: now.toISOString(),
      findings: result.prepared ? [{ kind: "review_prepared", count: result.prepared, explanation: "Review tasks were validated and are ready for founder review.", recommendedAction: "Open the founder review inbox.", href: "/expansion/automation/review" }] : [], metrics: { prepared: result.prepared, rejected: result.rejected } }
  },
}

/** Dispatch strictly through the registry: the payload is re-validated and unknown actions are refused. */
export async function runAscendAction(actionType: string, payload: Record<string, unknown>, scope: { markets: string[] }, signal: AbortSignal, now = new Date()): Promise<ActionResult> {
  const { spec, payload: clean } = validatePayload(actionType, payload)
  const handler = HANDLERS[spec.type]
  if (!handler) throw new AscendFailure("policy_rejection", "No handler is registered for this action.")
  check(signal)
  return handler(clean, scope, signal, now)
}
export const registeredHandlerTypes = () => Object.keys(HANDLERS)
