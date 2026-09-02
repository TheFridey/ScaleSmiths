import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Pool } from "pg"
import { assertSafeIntegrationDatabaseUrl } from "../../src/lib/test-database-safety"
import { migrateSharedTestDatabase } from "./shared-migration-harness"

// Durable operational controls exercised against a real PostgreSQL: leased job
// claiming (no double execution), expired-lease recovery, idempotency, and
// atomic shared rate-limit counters. Uses the full-privilege test URL so the
// shared `db` client can run the DML these controls depend on.
let pool: Pool
let url: string

// The `db` client caches its pool on globalThis and is shared across integration
// files in this single-worker run. Reset it so this file binds `db` to the
// full-privilege URL it migrates, and release it afterwards so the next file
// rebinds to its own configured role.
async function resetSharedDbClient() {
  const globalForDb = globalThis as unknown as { __scalesmithsPool?: { end: () => Promise<void> }; __scalesmithsDb?: unknown }
  if (globalForDb.__scalesmithsPool) await globalForDb.__scalesmithsPool.end().catch(() => undefined)
  globalForDb.__scalesmithsPool = undefined
  globalForDb.__scalesmithsDb = undefined
}

beforeAll(async () => {
  url = assertSafeIntegrationDatabaseUrl(process.env.TEST_DATABASE_URL)
  process.env.DATABASE_URL = url
  process.env.ADMIN_DATABASE_URL = url
  await resetSharedDbClient()
  pool = new Pool({ connectionString: url, max: 12 })
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public")
  const migrationPool = new Pool({ connectionString: url, max: 2 })
  try {
    await migrateSharedTestDatabase(migrationPool)
  } finally {
    await migrationPool.end()
  }
})

beforeEach(async () => {
  await pool.query('TRUNCATE "forge_previews","forge_jobs","forge_projects","rate_limit_counters" RESTART IDENTITY CASCADE')
})

afterAll(async () => {
  await pool?.end()
  await resetSharedDbClient()
})

async function createProject(): Promise<number> {
  const result = await pool.query("INSERT INTO forge_projects(name,business_name,status) VALUES('Durable','Durable Ltd','intake') RETURNING id")
  return result.rows[0].id as number
}

async function insertQueuedJob(projectId: number, overrides: Record<string, unknown> = {}): Promise<number> {
  const result = await pool.query(
    `INSERT INTO forge_jobs(project_id,kind,status,payload_json,attempts,max_attempts,lease_owner,lease_expires_at,scheduled_at,started_at,updated_at)
     VALUES($1,'research',$2,'{}'::jsonb,$3,$4,$5,$6,COALESCE($7, now()),$8, now())
     RETURNING id`,
    [
      projectId,
      overrides.status ?? "queued",
      overrides.attempts ?? 0,
      overrides.maxAttempts ?? 3,
      overrides.leaseOwner ?? null,
      overrides.leaseExpiresAt ?? null,
      overrides.scheduledAt ?? null,
      overrides.startedAt ?? null,
    ],
  )
  return result.rows[0].id as number
}

describe("durable Forge job queue (real PostgreSQL)", () => {
  it("lets exactly one of many concurrent workers claim a single queued job", async () => {
    const projectId = await createProject()
    await insertQueuedJob(projectId)
    const { claimNextForgeJob } = await import("../../src/lib/server/forge-job-queue")

    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => claimNextForgeJob(`worker-${index}`)))
    const winners = results.filter((job) => job !== null)

    expect(winners).toHaveLength(1)
    expect(winners[0]!.status).toBe("running")
    expect(winners[0]!.attempts).toBe(1)

    const rows = await pool.query("SELECT status, lease_owner FROM forge_jobs")
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0].status).toBe("running")
    expect(rows.rows[0].lease_owner).toMatch(/^worker-\d+$/)
  })

  it("claim-by-id is guarded so it never double-runs with the worker loop", async () => {
    const projectId = await createProject()
    const jobId = await insertQueuedJob(projectId)
    const { claimForgeJobById } = await import("../../src/lib/server/forge-job-queue")

    const results = await Promise.all(Array.from({ length: 6 }, () => claimForgeJobById(jobId, "racer")))
    expect(results.filter((job) => job !== null)).toHaveLength(1)
  })

  it("recovers jobs whose worker lease expired: requeue while attempts remain, else dead-letter", async () => {
    const projectId = await createProject()
    const past = new Date(Date.now() - 60_000)
    const recoverable = await insertQueuedJob(projectId, { status: "running", attempts: 1, maxAttempts: 3, leaseOwner: "dead-a", leaseExpiresAt: past, startedAt: past })
    const exhausted = await insertQueuedJob(projectId, { status: "running", attempts: 3, maxAttempts: 3, leaseOwner: "dead-b", leaseExpiresAt: past, startedAt: past })
    const { reapExpiredForgeJobLeases } = await import("../../src/lib/server/forge-job-queue")

    const outcome = await reapExpiredForgeJobLeases()
    expect(outcome).toEqual({ requeued: 1, deadLettered: 1, requeuedIds: [recoverable], deadLetteredIds: [exhausted] })

    const statuses = new Map((await pool.query("SELECT id, status, lease_owner FROM forge_jobs")).rows.map((r) => [r.id, r]))
    expect(statuses.get(recoverable)).toMatchObject({ status: "queued", lease_owner: null })
    expect(statuses.get(exhausted)).toMatchObject({ status: "dead_letter", lease_owner: null })
  })

  it("does not reclaim a running job whose lease is still valid", async () => {
    const projectId = await createProject()
    await insertQueuedJob(projectId, { status: "running", attempts: 1, leaseOwner: "alive", leaseExpiresAt: new Date(Date.now() + 60_000) })
    const { reapExpiredForgeJobLeases } = await import("../../src/lib/server/forge-job-queue")
    expect(await reapExpiredForgeJobLeases()).toEqual({ requeued: 0, deadLettered: 0, requeuedIds: [], deadLetteredIds: [] })
  })

  it("deduplicates enqueue by idempotency key", async () => {
    const projectId = await createProject()
    const { insertForgeJob } = await import("../../src/lib/server/forge-job-queue")

    const first = await insertForgeJob({ projectId, kind: "research", actor: "tester", idempotencyKey: "dup-key" })
    const second = await insertForgeJob({ projectId, kind: "research", actor: "tester", idempotencyKey: "dup-key" })

    expect(first.deduplicated).toBe(false)
    expect(second.deduplicated).toBe(true)
    expect(second.job.id).toBe(first.job.id)
    expect((await pool.query("SELECT count(*)::int AS count FROM forge_jobs")).rows[0].count).toBe(1)
  })

  it("retries with backoff then dead-letters when attempts are exhausted", async () => {
    const projectId = await createProject()
    const { failForgeJob } = await import("../../src/lib/server/forge-job-queue")
    const baseJob = { id: 0, projectId, taskId: null, kind: "research", status: "running" as const, payloadJson: {}, resultJson: null, error: null, failureReason: null, actor: null, idempotencyKey: null, maxAttempts: 3, leaseOwner: "w", leaseExpiresAt: new Date(), heartbeatAt: new Date(), scheduledAt: new Date(), startedAt: new Date(), completedAt: null, createdAt: new Date(), updatedAt: new Date() }

    const retryId = await insertQueuedJob(projectId, { status: "running", attempts: 1, maxAttempts: 3 })
    const retry = await failForgeJob({ ...baseJob, id: retryId, attempts: 1 }, "boom")
    expect(retry.retried).toBe(true)
    const retried = (await pool.query("SELECT status, scheduled_at FROM forge_jobs WHERE id=$1", [retryId])).rows[0]
    expect(retried.status).toBe("queued")
    expect(new Date(retried.scheduled_at).getTime()).toBeGreaterThan(Date.now())

    const deadId = await insertQueuedJob(projectId, { status: "running", attempts: 3, maxAttempts: 3 })
    const dead = await failForgeJob({ ...baseJob, id: deadId, attempts: 3 }, "final boom")
    expect(dead.retried).toBe(false)
    expect((await pool.query("SELECT status, failure_reason FROM forge_jobs WHERE id=$1", [deadId])).rows[0]).toMatchObject({ status: "dead_letter", failure_reason: "final boom" })
  })
})

describe("durable rate limits (real PostgreSQL)", () => {
  it("increments atomically under concurrency with no lost updates", async () => {
    const { checkDurableRateLimit } = await import("../../src/lib/server/rate-limit-store")
    const requests = 25

    const results = await Promise.all(Array.from({ length: requests }, () => checkDurableRateLimit("burst-key", 1000, 60_000)))
    const counts = results.map((result) => result.count).sort((a, b) => a - b)

    // Every concurrent increment observed a distinct value 1..N — proof there were no lost updates.
    expect(counts).toEqual(Array.from({ length: requests }, (_, index) => index + 1))
    const stored = await pool.query("SELECT count FROM rate_limit_counters WHERE key='burst-key'")
    expect(stored.rows[0].count).toBe(requests)
  })

  it("blocks once the window limit is reached and resets in a new window", async () => {
    const { checkDurableRateLimit } = await import("../../src/lib/server/rate-limit-store")
    const now = 1_000_000_000_000

    const first = await checkDurableRateLimit("limit-key", 2, 60_000, now)
    const second = await checkDurableRateLimit("limit-key", 2, 60_000, now)
    const third = await checkDurableRateLimit("limit-key", 2, 60_000, now)
    expect([first.ok, second.ok, third.ok]).toEqual([true, true, false])
    expect(third.retryAfterMs).toBeGreaterThan(0)

    // A later window starts a fresh counter.
    const nextWindow = await checkDurableRateLimit("limit-key", 2, 60_000, now + 60_000)
    expect(nextWindow.ok).toBe(true)
    expect(nextWindow.count).toBe(1)
  })

  it("cleans up expired counters", async () => {
    const { checkDurableRateLimit, cleanupExpiredRateLimitCounters } = await import("../../src/lib/server/rate-limit-store")
    await checkDurableRateLimit("old-key", 10, 1, Date.now() - 10_000)
    const removed = await cleanupExpiredRateLimitCounters()
    expect(removed).toBeGreaterThanOrEqual(1)
  })
})
