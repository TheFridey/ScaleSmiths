import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { writeFileSync } from "node:fs"
import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import * as schema from "../../src/lib/schema"
import { hasCapability, type Capability } from "../../src/lib/rbac"

/*
 * Opt-in ASCEND B2.8 workload benchmark against the real engine code on a dedicated disposable database.
 *   ASCEND_BENCHMARK_DATABASE_URL=postgresql://<admin role>@127.0.0.1:55440/ss_ascend_bench_test npm run bench:ascend
 * Synthetic history is sized at five executions (three events each) per partner per period. Numbers describe this host only.
 */
type Actor = { id: string; role: "owner"; active: boolean; sessionVersion: number; displayName: string }
const state = vi.hoisted(() => ({ database: null as NodePgDatabase<typeof schema> | null, actors: null as AsyncLocalStorage<Actor> | null }))
vi.mock("@/lib/db", () => ({ db: {
  execute: (...a: Parameters<NodePgDatabase<typeof schema>["execute"]>) => state.database!.execute(...a),
  transaction: (op: Parameters<NodePgDatabase<typeof schema>["transaction"]>[0]) => state.database!.transaction(op),
} }))
vi.mock("../../src/lib/server/rbac", () => ({ requireCapability: async (c: Capability) => {
  const a = state.actors?.getStore(); if (!a || !hasCapability(a.role, c)) throw new Error("Forbidden"); return { ...a }
} }))
process.env.ASCEND_ENGINE_ENABLED = "true"
process.env.ASCEND_MAX_GLOBAL_CONCURRENCY = "8"
import { authenticateService, authorisedFounder, createServiceIdentity, engineOverview, heartbeat, listExecutions, setControl, updateDefinition, workerTick, claimExecution, completeExecution, startExecution } from "../../src/lib/server/ascend-engine"

const url = process.env.ASCEND_BENCHMARK_DATABASE_URL
const founder: Actor = { id: randomUUID(), role: "owner", active: true, sessionVersion: 1, displayName: "Benchmark founder" }
let pool: Pool
const timed = async <T>(fn: () => Promise<T>) => { const s = performance.now(); const r = await fn(); return { ms: performance.now() - s, r } }
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] * 10) / 10 }

describe.skipIf(!url)("ASCEND B2.8 workload benchmark", () => {
  const results: Record<string, unknown>[] = []
  beforeAll(async () => {
    const u = new URL(url!)
    if (!["127.0.0.1", "localhost"].includes(u.hostname) || u.port !== "55440" || u.pathname !== "/ss_ascend_bench_test") throw new Error("Benchmark refuses any database but the disposable ss_ascend_bench_test.")
    pool = new Pool({ connectionString: url, max: 12, options: "-c app.access_mode=internal_write" })
    state.database = drizzle(pool, { schema }); state.actors = new AsyncLocalStorage()
    await pool.query("insert into admin_users(id,email,display_name,password_hash,role,active,session_version) values($1,$2,$3,'bench-not-for-login','owner',true,1)", [founder.id, `bench-${founder.id}@example.invalid`, founder.displayName])
  })
  afterAll(async () => { await pool?.end() })

  it("measures throughput, latency and growth at 10, 100, 1,000 and 10,000 partners", async () => {
    const F = await state.actors!.run(founder, authorisedFounder)
    const ident = await state.actors!.run(founder, () => createServiceIdentity(F, { name: `bench-worker-${randomUUID().slice(0, 6)}`, kind: "worker", capabilities: ["worker.execute"], allowedActions: ["ops.queue_health", "pipeline.inactivity_scan", "onboarding.progress_check", "delivery.handoff_readiness", "review.queue_preparation"] }))
    const worker = await authenticateService(new Headers({ authorization: `Bearer ${ident.token}` }), "worker.execute")
    await state.actors!.run(founder, () => setControl(F, "global", false, "Benchmark only"))
    for (const t of ["ops.queue_health", "pipeline.inactivity_scan"]) await state.actors!.run(founder, () => updateDefinition(F, t, { enabled: true, requiresApproval: false, cooldownSeconds: 0, maxConcurrency: 8 }))
    let historySoFar = 0
    for (const partners of [10, 100, 1000, 10000]) {
      const history = partners * 5 - historySoFar
      // Synthetic completed history with three events each: the growth a month of per-partner automation would create.
      await pool.query(`with ins as (insert into ascend_executions (id, correlation_id, idempotency_key, action_type, payload_version, payload, payload_sha256, scope, policy_version, policy_decision,
          origin, status, approval_required, deadline_at, max_attempts, attempts, result, created_at, updated_at, completed_at)
        select gen_random_uuid(), gen_random_uuid(), 'bench:' || gen_random_uuid(), 'pipeline.inactivity_scan', 1, '{"inactiveDays":14}', md5(g::text) || md5((g+1)::text), '{"markets":["GB"]}', 1,
          '{"decision":"accepted"}', 'schedule', 'completed', false, now(), 5, 1, '{"summary":"synthetic"}', now() - (g % 2592000 || ' seconds')::interval, now(), now() - (g % 2592000 || ' seconds')::interval
        from generate_series(1, $1::int) g returning id)
        insert into ascend_execution_events (execution_id, event, actor_kind) select id, e, 'system' from ins cross join unnest(array['created','started','completed']) e`, [history])
      historySoFar += history
      await pool.query("analyze ascend_executions; analyze ascend_execution_events")
      // Live queue proportional to the network, capped so each scale finishes in bounded time.
      const queued = Math.min(400, Math.max(40, partners))
      for (let i = 0; i < queued; i += 50) {
        await pool.query(`insert into ascend_executions (id, correlation_id, idempotency_key, action_type, payload_version, payload, payload_sha256, scope, policy_version, policy_decision, origin, status,
            approval_required, deadline_at, max_attempts) select gen_random_uuid(), gen_random_uuid(), 'bench:q:' || gen_random_uuid(), 'ops.queue_health', 1, '{"staleWorkerMinutes":5}',
            md5(random()::text) || md5(random()::text), '{"markets":["GB"]}', (select policy_version from ascend_automation_definitions where action_type = 'ops.queue_health'), '{"decision":"accepted"}',
            'schedule', 'queued', false, now() + interval '1 day', 5 from generate_series(1, $1::int)`, [Math.min(50, queued - i)])
      }
      // Claim latency on an isolated sample (claim, start, complete with a trivial result).
      await heartbeat(worker, { workerId: "bench-claim", version: "bench", maxConcurrency: 8, inFlight: 0 })
      const claimMs: number[] = []
      for (let i = 0; i < 20; i++) {
        const { ms, r } = await timed(() => claimExecution(worker, "bench-claim"))
        claimMs.push(ms)
        if (r) { await startExecution(worker, r); await completeExecution(worker, r, { ok: true, result: { bench: true } }) }
      }
      // Throughput: eight concurrent workers drain the remaining queue through the full tick (handler included).
      const lanes = Array.from({ length: 8 }, (_, i) => `bench-${partners}-${i}`)
      for (const l of lanes) await heartbeat(worker, { workerId: l, version: "bench", maxConcurrency: 8, inFlight: 0 })
      const tickMs: number[] = []
      const drain = await timed(() => Promise.all(lanes.map(async (l) => {
        let n = 0
        for (;;) { const { ms, r } = await timed(() => workerTick(worker, { workerId: l, version: "bench", maxConcurrency: 8, inFlight: 0 })); if (!r.claimed) return n; tickMs.push(ms); n++ }
      })))
      const executed = drain.r.reduce((a, b) => a + b, 0)
      const overviewMs: number[] = [], explorerMs: number[] = [], filteredMs: number[] = []
      for (let i = 0; i < 5; i++) {
        overviewMs.push((await timed(() => engineOverview())).ms)
        explorerMs.push((await timed(() => listExecutions({ limit: 50 }))).ms)
        filteredMs.push((await timed(() => listExecutions({ status: "dead_lettered", actionType: "ops.queue_health", limit: 50 }))).ms)
      }
      const size = (await pool.query("select pg_total_relation_size('ascend_executions') e, pg_total_relation_size('ascend_execution_events') v, (select count(*) from ascend_executions) n")).rows[0]
      const dupes = Number((await pool.query("select count(*)::int c from (select execution_id from ascend_execution_events where event = 'completed' group by execution_id having count(*) > 1) x")).rows[0].c)
      expect(dupes).toBe(0)
      const row = { partners, executionsStored: Number(size.n), executedConcurrently: executed + 20, throughputPerSecond: Math.round((executed / drain.ms) * 1000 * 10) / 10,
        claimP50ms: pct(claimMs, 50), claimP95ms: pct(claimMs, 95), tickP50ms: pct(tickMs, 50), tickP95ms: pct(tickMs, 95),
        overviewP50ms: pct(overviewMs, 50), explorerP50ms: pct(explorerMs, 50), filteredExplorerP50ms: pct(filteredMs, 50),
        executionsTableMB: Math.round(Number(size.e) / 1048576 * 10) / 10, eventsTableMB: Math.round(Number(size.v) / 1048576 * 10) / 10, duplicateCompletions: dupes }
      results.push(row)
      process.stdout.write(`[ascend-bench] ${JSON.stringify(row)}\n`)
    }
    if (process.env.ASCEND_BENCHMARK_OUT) writeFileSync(process.env.ASCEND_BENCHMARK_OUT, JSON.stringify({ host: "disposable local PostgreSQL 16, single machine", results }, null, 2))
  }, 1_800_000)
})
