import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import * as schema from "../../src/lib/schema"
import { hasCapability, type Capability } from "../../src/lib/rbac"

/*
 * Operation ASCEND B2.8 acceptance on real PostgreSQL with separate connections, running as the restricted admin runtime
 * role (no DELETE, no TRUNCATE). Scenarios A-G, I and J from the B2.8 mission. Fixtures are additive and test-labelled.
 */
type Actor = { id: string; role: "owner" | "independent_partner"; active: boolean; sessionVersion: number; displayName: string }
const state = vi.hoisted(() => ({
  database: null as NodePgDatabase<typeof schema> | null,
  actors: null as AsyncLocalStorage<Actor> | null,
  onTransaction: null as null | ((pid: number) => Promise<void>),
  dropped: [] as string[],
}))
vi.mock("@/lib/db", () => ({ db: {
  execute: (...args: Parameters<NodePgDatabase<typeof schema>["execute"]>) => state.database!.execute(...args),
  transaction: (operation: Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]) => state.database!.transaction(async (tx) => {
    const hook = state.onTransaction
    if (hook) { const r = await tx.execute(sql`select pg_backend_pid() pid`); await hook(Number(r.rows[0].pid)) }
    return operation(tx)
  }),
} }))
vi.mock("../../src/lib/server/rbac", () => ({ requireCapability: async (capability: Capability) => {
  const actor = state.actors?.getStore()
  if (!actor || !hasCapability(actor.role, capability)) throw new Error("Forbidden capability")
  return { ...actor }
} }))

process.env.ASCEND_ENGINE_ENABLED = "true"
process.env.ASCEND_AGENT_API_ENABLED = "true"
process.env.ASCEND_SCHEDULER_ENABLED = "false"
process.env.ASCEND_MAX_GLOBAL_CONCURRENCY = "4"

import {
  AscendError, agentCapabilities, agentOperation, approveExecution, authenticateService, authorisedFounder, cancelExecution, claimExecution, completeExecution,
  createServiceIdentity, engineOverview, executionDetail, heartbeat, listExecutions, reapExpiredLeases, reconcileAmbiguous, rejectExecution, renewLease, retryExecution,
  revokeServiceIdentity, rotateServiceIdentity, scheduleDue, setControl, startExecution, submitExecution, updateDefinition, workerTick,
  type FounderActor, type ServiceActor,
} from "../../src/lib/server/ascend-engine"
import { AscendFailure } from "../../src/lib/ascend-engine"
import { attachPoolErrorHandlers } from "../../src/lib/db-pool-safety"

function safeUrl(value: string | undefined) {
  if (!value) throw new Error("EXPANSION_TEST_DATABASE_URL is required for this explicit disposable database test.")
  const url = new URL(value)
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "55440" || url.pathname !== "/ss_expansion_test") throw new Error("ASCEND engine tests require the designated disposable loopback database.")
  return value
}

const suffix = randomUUID().slice(0, 8)
const founderA: Actor = { id: randomUUID(), role: "owner", active: true, sessionVersion: 1, displayName: `ASCEND founder A ${suffix}` }
const founderB: Actor = { id: randomUUID(), role: "owner", active: true, sessionVersion: 1, displayName: `ASCEND founder B ${suffix}` }
const partner: Actor = { id: randomUUID(), role: "independent_partner", active: true, sessionVersion: 1, displayName: `ASCEND partner ${suffix}` }
let pool: Pool
let F: FounderActor, FB: FounderActor
let worker: ServiceActor, agent: ServiceActor, otherAgent: ServiceActor
let workerToken = "", agentToken = "", otherAgentToken = ""
const as = <T>(actor: Actor, op: () => Promise<T>) => state.actors!.run(actor, op)
const bearer = (token: string) => new Headers({ authorization: `Bearer ${token}` })
const q = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows as Record<string, unknown>[]
const beat = (id: string, inFlight = 0) => heartbeat(worker, { workerId: id, version: "test-1", maxConcurrency: 8, inFlight })
const tick = (id: string, now = new Date()) => workerTick(worker, { workerId: id, version: "test-1", maxConcurrency: 8, inFlight: 0 }, now)
const events = async (id: string) => (await q("select event from ascend_execution_events where execution_id = $1 order by id", [id])).map((r) => String(r.event))
const statusOf = async (id: string) => String((await q("select status from ascend_executions where id = $1", [id]))[0].status)
const configure = (actionType: string, patch: Record<string, unknown>) => as(founderA, () => updateDefinition(F, actionType, patch))
const key = () => `test:${randomUUID()}`
const ALL_ACTIONS = ["ops.queue_health", "pipeline.inactivity_scan", "onboarding.progress_check", "delivery.handoff_readiness", "review.queue_preparation"]

async function financialFingerprint() {
  const tables = ["expansion_commission_ledger", "expansion_payouts", "expansion_payout_entries", "expansion_withdrawal_requests", "expansion_withdrawal_entries",
    "expansion_contracts", "partner_agreement_acceptances", "commercial_payments", "expansion_payment_events", "invoices"]
  const out: Record<string, string> = {}
  for (const t of tables) out[t] = String((await q(`select count(*)::text || ':' || coalesce(md5(string_agg(x::text, '|' order by x::text)), '-') f from ${t} x`))[0].f)
  return out
}

describe.skipIf(!process.env.EXPANSION_TEST_DATABASE_URL)("ASCEND B2.8 execution engine on real PostgreSQL", () => {
  let financialBefore: Record<string, string>

  beforeAll(async () => {
    const url = safeUrl(process.env.EXPANSION_TEST_DATABASE_URL)
    pool = new Pool({ connectionString: url, max: 16, options: "-c app.access_mode=internal_write", connectionTimeoutMillis: 5000 })
    // The production safeguard: scenario B2 terminates a backend mid-transaction and the process must survive it.
    const dropped: string[] = []
    attachPoolErrorHandlers(pool, (_message, detail) => { dropped.push(detail.code) })
    state.dropped = dropped
    state.database = drizzle(pool, { schema })
    state.actors = new AsyncLocalStorage<Actor>()
    for (const a of [founderA, founderB, partner]) await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'test-fixture-not-for-login',$4,true,1)", [a.id, `ascend-${a.id}@example.invalid`, a.displayName, a.role])
    F = await as(founderA, authorisedFounder)
    FB = await as(founderB, authorisedFounder)
    const w = await as(founderA, () => createServiceIdentity(F, { name: `test-worker-${suffix}`, kind: "worker", capabilities: ["worker.execute"], allowedActions: ALL_ACTIONS }))
    const ag = await as(founderA, () => createServiceIdentity(F, { name: `test-agent-${suffix}`, kind: "agent", capabilities: ["operations.submit", "operations.read", "operations.cancel"], allowedActions: ["ops.queue_health", "pipeline.inactivity_scan"] }))
    const og = await as(founderA, () => createServiceIdentity(F, { name: `test-agent2-${suffix}`, kind: "agent", capabilities: ["operations.submit", "operations.read", "operations.cancel"], allowedActions: ["ops.queue_health"] }))
    workerToken = w.token; agentToken = ag.token; otherAgentToken = og.token
    worker = await authenticateService(bearer(workerToken), "worker.execute")
    agent = await authenticateService(bearer(agentToken), "operations.submit")
    otherAgent = await authenticateService(bearer(otherAgentToken), "operations.submit")
    financialBefore = await financialFingerprint()
    await as(founderA, () => setControl(F, "global", false, "TEST ONLY: resume for acceptance suite"))
  })

  beforeEach(async () => {
    // Leave nothing in flight between scenarios; everything is cancelled through the engine, never deleted.
    for (const r of await q("select id from ascend_executions where status in ('pending_approval','approved','scheduled','queued','retry_scheduled','leased')"))
      await as(founderA, () => cancelExecution(F, r.id, "TEST ONLY: isolate scenario"))
    for (const r of await q("select id from ascend_executions where status = 'running'")) {
      await q("update ascend_executions set lease_expires_at = now() - interval '1 second' where id = $1", [r.id])
    }
    await reapExpiredLeases()
    for (const r of await q("select id from ascend_executions where status in ('retry_scheduled','queued')")) await as(founderA, () => cancelExecution(F, r.id, "TEST ONLY: isolate scenario"))
    for (const s of await q("select scope from ascend_automation_controls where suspended")) await as(founderA, () => setControl(F, String(s.scope), false, "TEST ONLY: reset control"))
    for (const t of ["ops.queue_health", "pipeline.inactivity_scan", "onboarding.progress_check", "delivery.handoff_readiness", "review.queue_preparation"])
      await configure(t, { enabled: true, requiresApproval: false, cooldownSeconds: 0, maxConcurrency: 8, maxAttempts: 5, timeoutSeconds: 30, intervalSeconds: null, marketScope: ["GB"] })
  })

  afterAll(async () => {
    if (state.actors && F) await as(founderA, () => setControl(F, "global", true, "TEST ONLY: suite finished; leave automation suspended"))
    await pool?.end()
  })

  it("A: signal to approval to worker execution to completion with a complete audit trail", async () => {
    await configure("ops.queue_health", { requiresApproval: true })
    const submitted = await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 10 }, idempotencyKey: key() }))
    expect(submitted.status).toBe("pending_approval")
    await beat(`w-a-${suffix}`)
    expect((await tick(`w-a-${suffix}`)).claimed).toBeNull() // nothing runs before approval
    const detail = await as(founderA, () => executionDetail(submitted.id))
    expect(detail.policyDecision).toMatchObject({ decision: "accepted", requiresApproval: true })
    await expect(as(founderB, () => approveExecution(FB, submitted.id, { payloadSha256: "0".repeat(64), policyVersion: detail.policyVersion }))).rejects.toThrow(/changed since you reviewed/)
    await as(founderB, () => approveExecution(FB, submitted.id, { payloadSha256: detail.payloadSha256, policyVersion: detail.policyVersion }))
    const run = await tick(`w-a-${suffix}`)
    expect(run.claimed).toMatchObject({ id: submitted.id, status: "completed" })
    const done = await as(founderA, () => executionDetail(submitted.id))
    expect(done.result).toMatchObject({ source: expect.stringContaining("ascend_executions"), summary: expect.any(String) })
    expect(done.approval?.by).toBe(founderB.displayName)
    expect(await events(submitted.id)).toEqual(["created", "approved", "queued", "claimed", "started", "completed"])
    await expect(q("update ascend_execution_events set event = 'tampered' where execution_id = $1", [submitted.id])).rejects.toThrow(/append-only|immutable/)
  })

  it("B: a worker that dies mid-execution is recovered without duplicate completion; stale results are refused", async () => {
    const { id } = await as(founderA, () => submitExecution(F, { actionType: "pipeline.inactivity_scan", idempotencyKey: key() }))
    await beat(`w-crash-${suffix}`); await beat(`w-rescue-${suffix}`)
    const claim = (await claimExecution(worker, `w-crash-${suffix}`))!
    expect((await startExecution(worker, claim)).run).toBe(true)
    // The process is killed here: no completion is ever sent. Advance past lease expiry.
    const later = new Date(Date.parse(claim.leaseExpiresAt) + 1000)
    expect(await reapExpiredLeases(later)).toMatchObject({ requeued: 1 })
    expect(await statusOf(id)).toBe("retry_scheduled")
    await expect(completeExecution(worker, claim, { ok: true, result: { late: true } })).rejects.toThrow(/lease expired or changed/)
    const rescued = await tick(`w-rescue-${suffix}`, later)
    expect(rescued.claimed).toMatchObject({ id, status: "completed" })
    const ev = await events(id)
    expect(ev.filter((e) => e === "completed")).toHaveLength(1)
    expect(ev).toEqual(["created", "claimed", "started", "lease_expired", "claimed", "started", "completed"])
    expect(Number((await q("select attempts from ascend_executions where id = $1", [id]))[0].attempts)).toBe(2)
  })

  it("B2: a database connection terminated mid-transaction leaves no partial state and recovers", async () => {
    const { id } = await as(founderA, () => submitExecution(F, { actionType: "delivery.handoff_readiness", idempotencyKey: key() }))
    await beat(`w-db-${suffix}`)
    const claim = (await claimExecution(worker, `w-db-${suffix}`))!
    await startExecution(worker, claim)
    let killed = false
    state.onTransaction = async (pid) => { if (!killed) { killed = true; await pool.query("select pg_terminate_backend($1)", [pid]) } }
    await expect(completeExecution(worker, claim, { ok: true, result: { x: 1 } })).rejects.toThrow()
    state.onTransaction = null
    expect(await statusOf(id)).toBe("running") // nothing half-written
    expect(state.dropped.length).toBeGreaterThanOrEqual(1) // reported, not an uncaught exception
    expect((await events(id)).includes("completed")).toBe(false)
    await reapExpiredLeases(new Date(Date.parse(claim.leaseExpiresAt) + 1000))
    expect((await tick(`w-db-${suffix}`, new Date(Date.parse(claim.leaseExpiresAt) + 2000))).claimed).toMatchObject({ id, status: "completed" })
  })

  it("C: revoked approver, changed policy and expired approval each stop execution before it starts", async () => {
    await configure("ops.queue_health", { requiresApproval: true })
    const submitApproved = async () => {
      const s = await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", idempotencyKey: key() }))
      const d = await as(founderA, () => executionDetail(s.id))
      await as(founderB, () => approveExecution(FB, s.id, { payloadSha256: d.payloadSha256, policyVersion: d.policyVersion }))
      return s.id
    }
    await beat(`w-c-${suffix}`)
    const revoked = await submitApproved()
    await q("update admin_users set active = false where id = $1", [founderB.id])
    try {
      expect((await tick(`w-c-${suffix}`)).claimed).toMatchObject({ id: revoked, status: "failed" })
      expect((await q("select failure_class from ascend_executions where id = $1", [revoked]))[0].failure_class).toBe("permission")
      await expect(as(founderB, authorisedFounder)).rejects.toThrow(/revoked/)
    } finally { await q("update admin_users set active = true where id = $1", [founderB.id]) }

    const policy = await submitApproved()
    await configure("ops.queue_health", { approvalTtlSeconds: 7200 }) // material change: policy version increments
    expect((await tick(`w-c-${suffix}`)).claimed).toMatchObject({ id: policy, status: "failed" })
    expect((await q("select last_error from ascend_executions where id = $1", [policy]))[0].last_error).toMatch(/policy changed/)

    const expired = await submitApproved()
    expect((await tick(`w-c-${suffix}`, new Date(Date.now() + 7300e3))).claimed).toMatchObject({ id: expired, status: "failed" })
    expect((await q("select failure_class from ascend_executions where id = $1", [expired]))[0].failure_class).toBe("approval_expired")

    const pending = await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", idempotencyKey: key() }))
    const d = await as(founderA, () => executionDetail(pending.id))
    await configure("ops.queue_health", { approvalTtlSeconds: 3600 })
    await expect(as(founderB, () => approveExecution(FB, pending.id, { payloadSha256: d.payloadSha256, policyVersion: d.policyVersion }))).rejects.toThrow(/policy changed/)
    await as(founderA, () => rejectExecution(F, pending.id, "TEST ONLY: stale approval request"))
    expect(await statusOf(pending.id)).toBe("cancelled")
  })

  it("D: concurrent workers never execute the same operation twice and respect global and per-action caps", async () => {
    const ids: string[] = []
    for (let i = 0; i < 40; i++) ids.push((await as(founderA, () => submitExecution(F, { actionType: "pipeline.inactivity_scan", payload: { inactiveDays: 3 + (i % 20) }, idempotencyKey: key() }))).id)
    const workers = Array.from({ length: 8 }, (_, i) => `w-d-${i}-${suffix}`)
    for (const w of workers) await beat(w)
    const start = Date.now()
    await Promise.all(workers.map(async (w) => {
      for (let guard = 0; guard < 200; guard++) {
        const r = await tick(w)
        if (!r.claimed) {
          const left = Number((await q("select count(*)::int c from ascend_executions where id = any($1) and status in ('queued','retry_scheduled','leased','running')", [ids]))[0].c)
          if (!left) return
          await new Promise((res) => setTimeout(res, 5))
        }
      }
    }))
    const elapsed = Date.now() - start
    const rows = await q(`select e.id, e.status, count(*) filter (where v.event = 'completed')::int completed, count(*) filter (where v.event = 'started')::int started
      from ascend_executions e join ascend_execution_events v on v.execution_id = e.id where e.id = any($1) group by e.id, e.status`, [ids])
    expect(rows).toHaveLength(40)
    for (const r of rows) expect(r).toMatchObject({ status: "completed", completed: 1, started: 1 })
    const overlap = await q(`with spans as (select execution_id, min(occurred_at) filter (where event = 'claimed') s, max(occurred_at) filter (where event = 'completed') f
      from ascend_execution_events where execution_id = any($1) group by execution_id)
      select max(c)::int peak from (select (select count(*) from spans b where b.s <= a.s and b.f > a.s) c from spans a) x`, [ids])
    expect(Number(overlap[0].peak)).toBeLessThanOrEqual(4)
    process.stdout.write(`[ascend] 40 executions across 8 workers in ${elapsed} ms; peak concurrency ${overlap[0].peak}\n`)

    // Per-action cap of one: eight simultaneous claims lease exactly one job.
    await configure("onboarding.progress_check", { maxConcurrency: 1 })
    for (let i = 0; i < 5; i++) await as(founderA, () => submitExecution(F, { actionType: "onboarding.progress_check", payload: { pendingDays: 1 + i }, idempotencyKey: key() }))
    const claims = await Promise.all(workers.map((w) => claimExecution(worker, w)))
    expect(claims.filter(Boolean)).toHaveLength(1)
    // Global cap of four: eight simultaneous claims over plentiful work lease exactly four (one already held above).
    for (let i = 0; i < 8; i++) await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 1 + i }, idempotencyKey: key() }))
    const more = await Promise.all(workers.map((w) => claimExecution(worker, w)))
    expect(more.filter(Boolean)).toHaveLength(3)
    expect(Number((await q("select count(*)::int c from ascend_executions where status in ('leased','running')"))[0].c)).toBe(4)
  })

  it("E: an emergency stop halts new execution, keeps queued work recoverable, and lets in-flight work finish truthfully", async () => {
    await beat(`w-e-${suffix}`)
    const logStart = Number((await q("select coalesce(max(id), 0)::bigint m from ascend_control_events"))[0].m)
    const running = (await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", idempotencyKey: key() }))).id
    const leasedOnly = (await as(founderA, () => submitExecution(F, { actionType: "pipeline.inactivity_scan", idempotencyKey: key() }))).id
    const queued = (await as(founderA, () => submitExecution(F, { actionType: "delivery.handoff_readiness", idempotencyKey: key() }))).id
    const c1 = (await claimExecution(worker, `w-e-${suffix}`))!; expect(c1.id).toBe(running)
    expect((await startExecution(worker, c1)).run).toBe(true)
    const c2 = (await claimExecution(worker, `w-e-${suffix}`))!; expect(c2.id).toBe(leasedOnly)
    const stop = await as(founderA, () => setControl(F, "global", true, "TEST ONLY: emergency stop drill"))
    // Concurrent workers keep ticking during the stop: nothing new may start.
    const ticks = await Promise.all(Array.from({ length: 6 }, (_, i) => beat(`w-e-${i}-${suffix}`).then(() => tick(`w-e-${i}-${suffix}`))))
    expect(ticks.every((t) => t.claimed === null)).toBe(true)
    expect(await startExecution(worker, c2)).toMatchObject({ run: false, status: "queued" })
    expect(Number((await q("select attempts from ascend_executions where id = $1", [leasedOnly]))[0].attempts)).toBe(0)
    expect(await renewLease(worker, c1)).toMatchObject({ renewed: false, reason: "stop_requested" })
    expect(await completeExecution(worker, c1, { ok: true, result: { summary: "finished during stop" } })).toMatchObject({ status: "completed" })
    expect(await statusOf(queued)).toBe("queued")
    const overview = await as(founderA, () => engineOverview())
    expect(overview.controls.find((c) => c.scope === "global")).toMatchObject({ suspended: true })
    await expect(as(founderA, () => setControl(F, "global", false, "TEST ONLY: stale resume", stop.version - 1))).rejects.toThrow(/changed since you loaded/)
    await as(founderA, () => setControl(F, "global", false, "TEST ONLY: deliberate resume after drill", stop.version))
    // Action-level suspension blocks only that action.
    await as(founderA, () => setControl(F, "action:pipeline.inactivity_scan", true, "TEST ONLY: suspend one action"))
    expect((await tick(`w-e-${suffix}`)).claimed).toMatchObject({ id: queued, status: "completed" })
    expect((await tick(`w-e-${suffix}`)).claimed).toBeNull()
    await as(founderA, () => setControl(F, "action:pipeline.inactivity_scan", false, "TEST ONLY: resume one action"))
    expect((await tick(`w-e-${suffix}`)).claimed).toMatchObject({ id: leasedOnly, status: "completed" })
    const log = await q("select event, subject from ascend_control_events where id > $1 order by id", [logStart])
    expect(log.map((r) => `${r.event} ${r.subject}`)).toEqual(["suspended global", "resumed global", "suspended action:pipeline.inactivity_scan", "resumed action:pipeline.inactivity_scan"])
  })

  it("F: permanent failures fail immediately, transient ones back off then dead-letter, and manual retry re-enters policy", async () => {
    await configure("ops.queue_health", { maxAttempts: 2 })
    await beat(`w-f-${suffix}`)
    const permanent = (await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 2 }, idempotencyKey: key() }))).id
    let c = (await claimExecution(worker, `w-f-${suffix}`))!; await startExecution(worker, c)
    expect(await completeExecution(worker, c, { ok: false, error: new AscendFailure("business_rule", "TEST ONLY permanent rule failure for postgresql://user:secret@host/db") })).toMatchObject({ status: "failed", failureClass: "business_rule" })
    expect((await q("select last_error from ascend_executions where id = $1", [permanent]))[0].last_error).not.toMatch(/secret/)

    const transient = (await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 3 }, idempotencyKey: key() }))).id
    c = (await claimExecution(worker, `w-f-${suffix}`))!; await startExecution(worker, c)
    const first = await completeExecution(worker, c, { ok: false, error: Object.assign(new Error("connection reset"), { code: "ECONNRESET" }) }, new Date(), () => 0)
    expect(first).toMatchObject({ status: "retry_scheduled", failureClass: "database_unavailable" })
    expect(Date.parse(String(first.availableAt)) - Date.now()).toBeGreaterThanOrEqual(14_000)
    expect((await tick(`w-f-${suffix}`)).claimed).toBeNull() // backoff respected
    const later = new Date(Date.parse(String(first.availableAt)) + 1000)
    c = (await claimExecution(worker, `w-f-${suffix}`, later))!; await startExecution(worker, c, later)
    expect(await completeExecution(worker, c, { ok: false, error: Object.assign(new Error("x"), { code: "57P01" }) }, later)).toMatchObject({ status: "dead_lettered" })
    const dead = await as(founderA, () => listExecutions({ status: "dead_lettered" }))
    expect(dead.items.some((i) => i.id === transient && i.failureClass === "database_unavailable")).toBe(true)
    expect((await as(founderA, () => engineOverview())).queue.deadLetters).toBeGreaterThanOrEqual(1)

    await configure("ops.queue_health", { requiresApproval: true })
    expect(await as(founderA, () => retryExecution(F, transient))).toMatchObject({ status: "pending_approval" })
    expect(await events(transient)).toContain("manual_retry")
    await expect(as(founderA, () => retryExecution(F, transient))).rejects.toThrow(/Only failed or dead-letter/)
  })

  it("F2: a non-idempotent run whose lease is lost becomes ambiguous and needs explicit reconciliation", async () => {
    const { id } = await as(founderA, () => submitExecution(F, { actionType: "delivery.handoff_readiness", idempotencyKey: key() }))
    await beat(`w-amb-${suffix}`)
    const claim = (await claimExecution(worker, `w-amb-${suffix}`))!
    await startExecution(worker, claim)
    // No registered action is non-idempotent today; simulate a future one by reaping a running lease of an unknown-idempotency type.
    const { ACTION_REGISTRY } = await import("../../src/lib/ascend-engine")
    const spec = ACTION_REGISTRY["delivery.handoff_readiness"] as { idempotent: boolean }
    spec.idempotent = false
    try { expect(await reapExpiredLeases(new Date(Date.parse(claim.leaseExpiresAt) + 1000))).toMatchObject({ ambiguous: 1 }) } finally { spec.idempotent = true }
    expect(await statusOf(id)).toBe("ambiguous")
    await expect(as(founderA, () => retryExecution(F, id))).rejects.toThrow(/Only failed or dead-letter/)
    await expect(as(founderA, () => cancelExecution(F, id, "TEST ONLY"))).rejects.toThrow(/already finished/)
    expect(await as(founderA, () => reconcileAmbiguous(F, id, "failed", "TEST ONLY: verified nothing happened"))).toMatchObject({ status: "failed" })
  })

  it("G: partners, inactive founders and changed sessions cannot reach the engine", async () => {
    await expect(as(partner, authorisedFounder)).rejects.toThrow(/Forbidden/)
    await expect(as({ ...founderA, sessionVersion: 2 }, authorisedFounder)).rejects.toThrow(/revoked/)
    const mine = await submitExecution(agent, { actionType: "ops.queue_health", idempotencyKey: key() })
    await expect(agentOperation(otherAgent, mine.id)).rejects.toThrow(/not found/i)
    await expect(cancelExecution(otherAgent, mine.id, "TEST ONLY: not mine")).rejects.toThrow(/not found/i)
    expect((await agentOperation(agent, mine.id)).status).toBe("queued")
  })

  it("I: a restricted agent identity can discover, submit, observe and cancel, but never approve or exceed scope", async () => {
    await configure("ops.queue_health", { requiresApproval: true })
    const caps = await agentCapabilities(agent)
    expect(caps.actions.map((a) => a.type).sort()).toEqual(["ops.queue_health", "pipeline.inactivity_scan"])
    const k = key()
    const op = await submitExecution(agent, { actionType: "ops.queue_health", idempotencyKey: k })
    expect(op.status).toBe("pending_approval")
    expect(await submitExecution(agent, { actionType: "ops.queue_health", idempotencyKey: k })).toMatchObject({ id: op.id, replay: true })
    await expect(submitExecution(agent, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 9 }, idempotencyKey: k })).rejects.toThrow(/different work/)
    await expect(submitExecution(agent, { actionType: "onboarding.progress_check", idempotencyKey: key() })).rejects.toThrow(/may not request/)
    await expect(submitExecution(agent, { actionType: "ops.queue_health", scope: { markets: ["US"] }, idempotencyKey: key() })).rejects.toThrow(/not authorised/)
    await beat(`w-i-${suffix}`)
    expect((await tick(`w-i-${suffix}`)).claimed).toBeNull() // approval is still required for agent work
    await expect(authenticateService(bearer(agentToken), "worker.execute")).rejects.toThrow(/lacks the required capability/)
    await expect(authenticateService(bearer(workerToken), "operations.submit")).rejects.toThrow(/lacks the required capability/)
    await expect(claimExecution(agent, `w-i-${suffix}`)).rejects.toThrow(/Only worker identities/)
    expect(await cancelExecution(agent, op.id, "TEST ONLY: agent withdrew request")).toMatchObject({ status: "cancelled" })
    expect((await agentOperation(agent, op.id)).status).toBe("cancelled")
    const rotated = await as(founderA, () => rotateServiceIdentity(F, otherAgent.id))
    await expect(authenticateService(bearer(otherAgentToken), "operations.read")).rejects.toThrow(/authentication failed/)
    await as(founderA, () => revokeServiceIdentity(F, otherAgent.id, "TEST ONLY: revoke agent"))
    await expect(authenticateService(bearer(rotated.token), "operations.read")).rejects.toThrow(/revoked/)
    await expect(as(founderA, () => createServiceIdentity(F, { name: `bad-${suffix}`, kind: "agent", capabilities: ["executions.approve"], allowedActions: ["ops.queue_health"] }))).rejects.toThrow(/may only hold/)
    await expect(q("insert into ascend_service_identities(id,name,kind,token_sha256,capabilities,created_by) values($1,$2,'agent',$3,'{worker.execute}',$4)", [randomUUID(), `sneaky-${suffix}`, "c".repeat(64), founderA.id])).rejects.toThrow(/check constraint/)
  })

  it("J: prohibited financial, communication, agreement, activation, permission and retention actions are refused everywhere", async () => {
    const prohibited = ["finance.payout_run", "partner.commission_rate_update", "ledger.adjust", "agreement.publish", "partner.activate", "applicant.retention_purge",
      "founder.permission_grant", "prospect.email_send", "partner.notify", "withdrawal.approve", "refund.issue", "client.contact"]
    for (const actionType of prohibited) {
      for (const actor of [F, agent, { kind: "system" as const }]) {
        const attempt = actor === F ? as(founderA, () => submitExecution(F, { actionType, idempotencyKey: key() })) : submitExecution(actor, { actionType, idempotencyKey: key() })
        await expect(attempt).rejects.toMatchObject({ failureClass: "policy_rejection" })
      }
      await expect(q("insert into ascend_automation_definitions(action_type) values($1)", [actionType])).rejects.toThrow(/check constraint/)
      await expect(as(founderA, () => updateDefinition(F, actionType, { enabled: true }))).rejects.toThrow(/Unknown automation/)
      await expect(as(founderA, () => setControl(F, `action:${actionType}`, false, "TEST ONLY"))).rejects.toThrow(/Unknown control scope/)
    }
    await expect(as(founderA, () => createServiceIdentity(F, { name: `fin-${suffix}`, kind: "agent", capabilities: ["operations.submit"], allowedActions: ["finance.payout_run"] }))).rejects.toThrow(/registered automations/)
    await expect(q(`insert into ascend_executions(id,correlation_id,idempotency_key,action_type,payload_version,payload,payload_sha256,scope,policy_version,policy_decision,origin,status,approval_required,deadline_at,max_attempts)
      values($1,$1,$2,'finance.payout_run',1,'{}',$3,'{}',1,'{}','schedule','queued',false,now()+interval '1 hour',1)`, [randomUUID(), key(), "d".repeat(64)])).rejects.toThrow(/foreign key/)
    expect(await financialFingerprint()).toEqual(financialBefore)
  })

  it("schedules each enabled interval once per bucket across racing workers and never while stopped", async () => {
    await configure("ops.queue_health", { intervalSeconds: 3600, cooldownSeconds: 0 })
    process.env.ASCEND_SCHEDULER_ENABLED = "true"
    try {
      const now = new Date()
      const results = await Promise.all(Array.from({ length: 6 }, () => scheduleDue(now)))
      expect(results.reduce((a, b) => a + b, 0)).toBe(1)
      await as(founderA, () => setControl(F, "global", true, "TEST ONLY: stop scheduler"))
      expect(await scheduleDue(new Date(now.getTime() + 3700e3))).toBe(0)
      await as(founderA, () => setControl(F, "global", false, "TEST ONLY: resume scheduler"))
    } finally { process.env.ASCEND_SCHEDULER_ENABLED = "false" }
  })

  it("K (B2.9): a worker claims and starts only its assigned automations; narrowing or revoking it stops the next start", async () => {
    const narrow = await as(founderA, () => createServiceIdentity(F, { name: `test-narrow-${suffix}`, kind: "worker", capabilities: ["worker.execute"], allowedActions: ["ops.queue_health"] }))
    const nw = await authenticateService(bearer(narrow.token), "worker.execute")
    await expect(as(founderA, () => createServiceIdentity(F, { name: `test-empty-${suffix}`, kind: "worker", capabilities: ["worker.execute"] }))).rejects.toThrow(/at least one automation/)
    const other = (await as(founderA, () => submitExecution(F, { actionType: "pipeline.inactivity_scan", idempotencyKey: key() }))).id
    const mine = (await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", idempotencyKey: key() }))).id
    await heartbeat(nw, { workerId: `w-k-${suffix}`, version: "test-1", maxConcurrency: 1, inFlight: 0 })
    const claim = (await claimExecution(nw, `w-k-${suffix}`))!
    expect(claim.id).toBe(mine)
    expect(await claimExecution(nw, `w-k-${suffix}`)).toBeNull() // the scan is not this worker's to take
    expect(await statusOf(other)).toBe("queued")
    // Narrowed between claim and start: the run is refused and the work returns to the queue without losing an attempt.
    await q("update ascend_service_identities set allowed_actions = '{pipeline.inactivity_scan}' where id = $1", [nw.id])
    expect(await startExecution(nw, claim)).toMatchObject({ run: false, status: "queued" })
    expect(Number((await q("select attempts from ascend_executions where id = $1", [mine]))[0].attempts)).toBe(0)
    await as(founderA, () => revokeServiceIdentity(F, nw.id, "TEST ONLY: revoke narrow worker"))
    await expect(claimExecution(nw, `w-k-${suffix}`)).rejects.toThrow(/revoked/)
  })

  it("L (B2.9): another identity cannot start, renew or complete a lease even with the lease token", async () => {
    const thief = await as(founderA, () => createServiceIdentity(F, { name: `test-thief-${suffix}`, kind: "worker", capabilities: ["worker.execute"], allowedActions: ALL_ACTIONS }))
    const tw = await authenticateService(bearer(thief.token), "worker.execute")
    await heartbeat(tw, { workerId: `w-thief-${suffix}`, version: "test-1", maxConcurrency: 1, inFlight: 0 })
    const { id } = await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", idempotencyKey: key() }))
    await beat(`w-l-${suffix}`)
    const claim = (await claimExecution(worker, `w-l-${suffix}`))!
    expect(claim.id).toBe(id)
    expect(await startExecution(tw, claim)).toMatchObject({ run: false })
    expect(await statusOf(id)).toBe("leased")
    expect((await startExecution(worker, claim)).run).toBe(true)
    await expect(renewLease(tw, claim)).rejects.toThrow(/no longer held/)
    await expect(completeExecution(tw, claim, { ok: true, result: { forged: true } })).rejects.toThrow(/not recorded/)
    expect(await renewLease(worker, claim)).toMatchObject({ renewed: true })
    expect(await completeExecution(worker, claim, { ok: true, result: { summary: "owner" } })).toMatchObject({ status: "completed" })
    expect((await q("select result from ascend_executions where id = $1", [id]))[0].result).toEqual({ summary: "owner" })
    await as(founderA, () => revokeServiceIdentity(F, tw.id, "TEST ONLY: revoke thief"))
  })

  it("M (B2.9): idempotency and cooldown are bound to the market scope", async () => {
    await configure("ops.queue_health", { marketScope: ["GB", "IE"], cooldownSeconds: 3600 })
    const k = key()
    const gb = await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 1234 }, scope: { markets: ["GB"] }, idempotencyKey: k }))
    await expect(as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 1234 }, scope: { markets: ["IE"] }, idempotencyKey: k }))).rejects.toMatchObject({ status: 409, failureClass: "duplicate" })
    await expect(as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 1234 }, scope: { markets: ["GB", "IE"] }, idempotencyKey: k }))).rejects.toMatchObject({ status: 409 })
    expect(await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 1234 }, scope: { markets: ["GB"] }, idempotencyKey: k }))).toMatchObject({ id: gb.id, replay: true })
    // The same payload in another market is different work: the GB cooldown does not hold it.
    const ie = await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 1234 }, scope: { markets: ["IE"] }, idempotencyKey: key() }))
    expect(ie.replay).toBe(false)
    await expect(as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 1234 }, scope: { markets: ["GB"] }, idempotencyKey: key() }))).rejects.toMatchObject({ status: 429 })
    await expect(as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", idempotencyKey: "agent:00000000:reserved" }))).rejects.toThrow(/reserved/)
  })

  it("N (B2.9): concurrent submissions with different keys cannot bypass the cooldown", async () => {
    await configure("pipeline.inactivity_scan", { cooldownSeconds: 3600 })
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => as(founderA, () => submitExecution(F, { actionType: "pipeline.inactivity_scan", payload: { inactiveDays: 33 }, idempotencyKey: key() }))))
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const refused = results.filter((r): r is PromiseRejectedResult => r.status === "rejected")
    expect(refused).toHaveLength(9)
    for (const r of refused) expect(r.reason).toMatchObject({ status: 429, failureClass: "rate_limited" })
  })

  it("O (B2.9): an analysis handler cannot write: its transaction is READ ONLY in PostgreSQL with a statement timeout", async () => {
    const before = Number((await q("select count(*)::int c from ascend_review_jobs"))[0].c)
    const { id } = await as(founderA, () => submitExecution(F, { actionType: "ops.queue_health", payload: { staleWorkerMinutes: 7 }, idempotencyKey: key() }))
    await beat(`w-o-${suffix}`)
    let readOnly: Record<string, unknown> | null = null
    const database = state.database!
    const realTx = database.transaction.bind(database)
    const spy = vi.spyOn(database, "transaction").mockImplementation(((op: Parameters<typeof realTx>[0]) => realTx(async (tx) => {
      const out = await op(tx)
      const r = await tx.execute(sql`select current_setting('transaction_read_only') ro, current_setting('statement_timeout') st`)
      if (String(r.rows[0].ro) === "on") readOnly = r.rows[0] as Record<string, unknown>
      return out
    })) as typeof realTx)
    try { expect((await tick(`w-o-${suffix}`)).claimed).toMatchObject({ id, status: "completed" }) } finally { spy.mockRestore() }
    expect(readOnly).toMatchObject({ ro: "on", st: "30s" })
    expect(Number((await q("select count(*)::int c from ascend_review_jobs"))[0].c)).toBe(before)
  })

  it("leaves every financial and agreement table byte-for-byte unchanged", async () => {
    expect(await financialFingerprint()).toEqual(financialBefore)
    expect(AscendError).toBeTypeOf("function")
  })
})
