import "server-only"
import { sql, type SQL } from "drizzle-orm"
import { db } from "@/lib/db"
import { AscendFailure, MARKET_CODE, validatePayload } from "@/lib/ascend-engine"
import { prepareDueReviewJobs } from "./ascend-review-queue"

/*
 * Handlers for the ASCEND action registry. Analysis handlers are read-only aggregates; `review.queue_preparation`
 * writes internal B2.7 review-task state (never a business record). None reads names, email addresses, phone numbers
 * or notes, and none contacts anyone, moves money, changes commission or changes a commercial record.
 *
 * B2.9 hardening:
 *  - Analysis handlers run in a READ ONLY transaction, so "read-only" is enforced by PostgreSQL, not only by review.
 *  - That transaction carries a statement_timeout equal to the action's time limit, so the deadline is enforceable
 *    inside the database rather than only checked cooperatively between queries.
 *  - Partner-programme aggregates are restricted to the execution's declared market scope (partner operating market).
 */

type Row = Record<string, unknown>
type Finding = { kind: string; count: number; explanation: string; recommendedAction: string; href: string }
export type ActionResult = { summary: string; source: string; generatedAt: string; findings: Finding[]; metrics: Record<string, number> }
type Query = (q: SQL) => Promise<Row[]>
const OPEN_STAGES = ["registered","contacted","discovery","qualified","scope_submitted","more_information","bespoke_required","deferred","approved"] as const

function check(signal: AbortSignal) { if (signal.aborted) throw new AscendFailure("deadline_exceeded", "The operation exceeded its execution time limit.") }
/** Markets are validated two-letter codes; this re-checks them before they reach SQL. */
function inMarkets(column: SQL, markets: string[]) {
  if (!markets.length || markets.some((m) => !MARKET_CODE.test(m))) throw new AscendFailure("policy_rejection", "The execution has no valid market scope.")
  return sql`${column} in (${sql.join(markets.map((m) => sql`${m}`), sql`, `)})`
}

type Handler = (q: Query, payload: Record<string, number | string>, scope: { markets: string[] }, signal: AbortSignal, now: Date) => Promise<ActionResult>
type Registered = { mode: "read_only" | "internal_write"; run: Handler }

const HANDLERS: Record<string, Registered> = {
  "ops.queue_health": { mode: "read_only", async run(q, payload, _scope, signal, now) {
    // Engine-wide operational state; it holds no partner or market data, so the market scope does not narrow it.
    const staleMinutes = Number(payload.staleWorkerMinutes)
    const exec = await q(sql`select status, count(*)::int c, min(available_at) oldest from ascend_executions group by status`)
    const review = await q(sql`select status, count(*)::int c from ascend_review_jobs group by status`)
    const workers = await q(sql`select count(*) filter (where status <> 'stopped' and last_heartbeat_at < ${new Date(now.getTime() - staleMinutes * 60e3)})::int stale,
        count(*) filter (where status = 'active')::int active from ascend_workers`)
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
    return { summary: findings.length ? `${findings.length} operational issue(s) need founder attention.` : "No operational issues detected.", source: "ascend_executions, ascend_review_jobs, ascend_workers (engine-wide aggregate)", generatedAt: now.toISOString(), findings, metrics }
  } },

  "pipeline.inactivity_scan": { mode: "read_only", async run(q, payload, scope, signal, now) {
    const days = Number(payload.inactiveDays)
    const cutoff = new Date(now.getTime() - days * 86400e3)
    const list = await q(sql`select o.status, count(*)::int c from expansion_opportunities o join expansion_partners p on p.id = o.partner_id
      where o.status in (${sql.join(OPEN_STAGES.map((s) => sql`${s}`), sql`, `)}) and o.updated_at < ${cutoff} and ${inMarkets(sql`p.operating_country`, scope.markets)}
      group by o.status order by o.status`)
    check(signal)
    const total = list.reduce((s, r) => s + Number(r.c), 0)
    const metrics: Record<string, number> = { inactiveOpportunities: total, thresholdDays: days }
    for (const r of list) metrics[`stage_${String(r.status)}`] = Number(r.c)
    const findings: Finding[] = total ? [{ kind: "inactive_pipeline", count: total, explanation: `Open opportunities have had no recorded update for more than ${days} days (by last update time; partner notes are not read).`, recommendedAction: "Review stalled stages in the founder sales command centre; any partner contact is a founder decision.", href: "/expansion/command" }] : []
    return { summary: total ? `${total} open opportunit${total === 1 ? "y has" : "ies have"} been inactive for over ${days} days.` : `No open opportunity has been inactive for over ${days} days.`, source: `expansion_opportunities.status, updated_at for partners operating in ${scope.markets.join(", ")} (aggregate only)`, generatedAt: now.toISOString(), findings, metrics }
  } },

  "onboarding.progress_check": { mode: "read_only", async run(q, payload, scope, signal, now) {
    const days = Number(payload.pendingDays)
    const [r] = await q(sql`select count(*) filter (where invitation_expires_at <= ${now})::int expired,
      count(*) filter (where invitation_expires_at > ${now} and created_at < ${new Date(now.getTime() - days * 86400e3)})::int waiting,
      count(*) filter (where invitation_expires_at > ${now})::int outstanding
      from expansion_partners where activated_at is null and invitation_hash is not null and ${inMarkets(sql`operating_country`, scope.markets)}`)
    check(signal)
    const metrics = { expiredInvitations: Number(r?.expired ?? 0), invitationsWaitingBeyondThreshold: Number(r?.waiting ?? 0), outstandingInvitations: Number(r?.outstanding ?? 0), thresholdDays: days }
    const findings: Finding[] = []
    if (metrics.expiredInvitations) findings.push({ kind: "expired_invitations", count: metrics.expiredInvitations, explanation: "Approved applicants' invitations expired before activation.", recommendedAction: "Decide in Recruitment whether to reissue; nothing is reissued automatically.", href: "/expansion" })
    if (metrics.invitationsWaitingBeyondThreshold) findings.push({ kind: "slow_activation", count: metrics.invitationsWaitingBeyondThreshold, explanation: `Invited partners have not activated within ${days} days.`, recommendedAction: "Consider a personal check-in from a founder.", href: "/expansion" })
    return { summary: findings.length ? `${metrics.expiredInvitations + metrics.invitationsWaitingBeyondThreshold} invitation(s) need a founder decision.` : "Onboarding invitations are progressing normally.", source: `expansion_partners invitation and activation timestamps in ${scope.markets.join(", ")} (aggregate only)`, generatedAt: now.toISOString(), findings, metrics }
  } },

  "delivery.handoff_readiness": { mode: "read_only", async run(q, _payload, scope, signal, now) {
    const [r] = await q(sql`select count(*)::int c from expansion_opportunities o join expansion_partners p on p.id = o.partner_id
      where o.status = 'contract_accepted' and ${inMarkets(sql`p.operating_country`, scope.markets)}
      and not exists (select 1 from expansion_delivery_handoffs h where h.opportunity_id = o.id)`)
    check(signal)
    const count = Number(r?.c ?? 0)
    return { summary: count ? `${count} accepted contract(s) await a founder delivery handoff.` : "Every accepted contract has been handed to delivery.", source: `expansion_opportunities, expansion_delivery_handoffs for partners operating in ${scope.markets.join(", ")} (aggregate only)`, generatedAt: now.toISOString(),
      findings: count ? [{ kind: "handoff_pending", count, explanation: "Contracts are accepted but no delivery project has been linked.", recommendedAction: "Review readiness and approve handoffs in the delivery queue.", href: "/expansion/handoffs" }] : [], metrics: { awaitingHandoff: count } }
  } },

  // Not read-only: leases and settles rows in ascend_review_jobs and appends ascend_review_job_events (internal founder-review
  // state). It runs in its own short transactions, so its deadline stays cooperative (checked between tasks).
  "review.queue_preparation": { mode: "internal_write", async run(_q, payload, _scope, signal, now) {
    const result = await prepareDueReviewJobs(Number(payload.batch), now)
    check(signal)
    return { summary: `Prepared ${result.prepared} review task(s); ${result.rejected} failed validation.`, source: "ascend_review_jobs (B2.7 founder review queue)", generatedAt: now.toISOString(),
      findings: result.prepared ? [{ kind: "review_prepared", count: result.prepared, explanation: "Review tasks were validated and are ready for founder review.", recommendedAction: "Open the founder review inbox.", href: "/expansion/automation/review" }] : [], metrics: { prepared: result.prepared, rejected: result.rejected } }
  } },
}

/** Dispatch strictly through the registry: the payload is re-validated and unknown actions are refused. */
export async function runAscendAction(actionType: string, payload: Record<string, unknown>, scope: { markets: string[] }, signal: AbortSignal, now = new Date(),
  options: { timeoutMs?: number } = {}): Promise<ActionResult> {
  const { spec, payload: clean } = validatePayload(actionType, payload)
  const handler = HANDLERS[spec.type]
  if (!handler) throw new AscendFailure("policy_rejection", "No handler is registered for this action.")
  check(signal)
  if (handler.mode === "internal_write") return handler.run(async () => { throw new AscendFailure("policy_rejection", "Internal-write handlers manage their own transactions.") }, clean, scope, signal, now)
  const timeoutMs = Math.min(50_000, Math.max(1_000, Math.round(options.timeoutMs ?? 30_000)))
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`set transaction read only`)
      await tx.execute(sql`select set_config('statement_timeout', ${String(timeoutMs)}, true)`)
      return handler.run(async (q) => (await tx.execute(q)).rows as Row[], clean, scope, signal, now)
    })
  } catch (error) {
    // 57014 = query_canceled (statement_timeout): report as the deadline, which is retryable, not a database fault.
    const code = String((error as { code?: unknown })?.code ?? (error as { cause?: { code?: unknown } })?.cause?.code ?? "")
    if (code === "57014") throw new AscendFailure("deadline_exceeded", "The operation exceeded its execution time limit.")
    throw error
  }
}
export const registeredHandlerTypes = () => Object.keys(HANDLERS)
export const handlerMode = (actionType: string) => HANDLERS[actionType]?.mode ?? null
