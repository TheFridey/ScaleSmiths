import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import path from "node:path"
import { assertSafeIntegrationDatabaseUrl } from "../../src/lib/test-database-safety"

// Exact Forge AI cost attribution and run-context invalidation, against a real
// PostgreSQL. These behaviours are only meaningful against real numeric aggregation and
// real foreign keys, so they are integration tests rather than mocked unit tests.
let pool: Pool
let url: string

// `db` caches its pool on globalThis and is shared across integration files in this
// single-worker run. Reset so this file binds `db` to the URL it migrates.
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
    const migrationDb = drizzle(migrationPool)
    await migrate(migrationDb, { migrationsFolder: path.resolve("../web/drizzle"), migrationsTable: "__drizzle_web_migrations", migrationsSchema: "drizzle" })
    await migrate(migrationDb, { migrationsFolder: path.resolve("drizzle") })
  } finally {
    await migrationPool.end()
  }
})

beforeEach(async () => {
  await pool.query('TRUNCATE "forge_ai_usage","forge_run_events","forge_run_steps","forge_runs","forge_jobs","forge_artifacts","forge_tasks","forge_projects" RESTART IDENTITY CASCADE')
})

afterAll(async () => {
  await pool?.end()
  await resetSharedDbClient()
})

async function createProject(name = "Attribution"): Promise<number> {
  return (await pool.query("INSERT INTO forge_projects(name,business_name,status) VALUES($1,'Attribution Ltd','intake') RETURNING id", [name])).rows[0].id
}

async function createRun(projectId: number, mode = "standard", policy: Record<string, unknown> = {}): Promise<number> {
  return (await pool.query(
    "INSERT INTO forge_runs(project_id,mode,status,policy_json,started_by,started_at) VALUES($1,$2,'running',$3::jsonb,'tester',now()) RETURNING id",
    [projectId, mode, JSON.stringify(policy)],
  )).rows[0].id
}

async function createJob(projectId: number, kind = "copy"): Promise<number> {
  return (await pool.query(
    "INSERT INTO forge_jobs(project_id,kind,status,started_at) VALUES($1,$2,'running',now()) RETURNING id",
    [projectId, kind],
  )).rows[0].id
}

async function createStep(runId: number, projectId: number, stage: string, sequence: number, jobId: number | null, status = "running"): Promise<number> {
  return (await pool.query(
    "INSERT INTO forge_run_steps(run_id,project_id,stage,status,sequence,job_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
    [runId, projectId, stage, status, sequence, jobId],
  )).rows[0].id
}

/**
 * Inserts usage with an explicit wall-clock window. The windows deliberately overlap so
 * a time-window implementation would cross-attribute; exact attribution must not.
 */
async function insertUsage(input: {
  projectId: number
  runId?: number | null
  runStepId?: number | null
  jobId?: number | null
  cost: string
  startOffsetMs?: number
  endOffsetMs?: number
}) {
  await pool.query(
    `INSERT INTO forge_ai_usage(project_id,run_id,run_step_id,job_id,provider,model,prompt_tokens,completion_tokens,total_tokens,estimated_cost,started_at,completed_at)
     VALUES($1,$2,$3,$4,'mock','mock-model',10,10,20,$5,now() + ($6 || ' milliseconds')::interval, now() + ($7 || ' milliseconds')::interval)`,
    [
      input.projectId,
      input.runId ?? null,
      input.runStepId ?? null,
      input.jobId ?? null,
      input.cost,
      String(input.startOffsetMs ?? 0),
      String(input.endOffsetMs ?? 1000),
    ],
  )
}

describe("exact Forge AI cost attribution", () => {
  it("1. gives two overlapping AI jobs on one project separate costs", async () => {
    const project = await createProject()
    const run = await createRun(project)
    const jobA = await createJob(project)
    const jobB = await createJob(project)
    const stepA = await createStep(run, project, "copy", 1, jobA)
    const stepB = await createStep(run, project, "research", 2, jobB)

    // Fully overlapping windows: a time-window model would give each job both costs.
    await insertUsage({ projectId: project, runId: run, runStepId: stepA, jobId: jobA, cost: "1.500000", startOffsetMs: 0, endOffsetMs: 5000 })
    await insertUsage({ projectId: project, runId: run, runStepId: stepB, jobId: jobB, cost: "2.250000", startOffsetMs: 1000, endOffsetMs: 4000 })

    const { sumForgeJobCost, sumForgeRunStepCost } = await import("../../src/lib/server/forge-ai-usage")
    expect(await sumForgeJobCost(jobA)).toBe(1.5)
    expect(await sumForgeJobCost(jobB)).toBe(2.25)
    expect(await sumForgeRunStepCost(stepA)).toBe(1.5)
    expect(await sumForgeRunStepCost(stepB)).toBe(2.25)
  })

  it("2. gives a retry only its own attempt cost", async () => {
    const project = await createProject()
    const run = await createRun(project)
    const firstJob = await createJob(project)
    const retryJob = await createJob(project)
    const step = await createStep(run, project, "copy", 1, retryJob)

    // Both attempts belong to the same step, but each attempt's spend is its own job.
    await insertUsage({ projectId: project, runId: run, runStepId: step, jobId: firstJob, cost: "0.400000", startOffsetMs: 0, endOffsetMs: 2000 })
    await insertUsage({ projectId: project, runId: run, runStepId: step, jobId: retryJob, cost: "0.100000", startOffsetMs: 1000, endOffsetMs: 3000 })

    const { sumForgeJobCost, sumForgeRunStepCost } = await import("../../src/lib/server/forge-ai-usage")
    expect(await sumForgeJobCost(retryJob)).toBe(0.1)
    expect(await sumForgeJobCost(firstJob)).toBe(0.4)
    // The step legitimately carries both attempts.
    expect(await sumForgeRunStepCost(step)).toBe(0.5)
  })

  it("3. includes every linked step in the run total and satisfies the consistency assertion", async () => {
    const project = await createProject()
    const run = await createRun(project)
    const stepA = await createStep(run, project, "copy", 1, null)
    const stepB = await createStep(run, project, "research", 2, null)

    await insertUsage({ projectId: project, runId: run, runStepId: stepA, cost: "0.750000" })
    await insertUsage({ projectId: project, runId: run, runStepId: stepB, cost: "1.250000" })
    // Run-linked usage that belongs to no single step.
    await insertUsage({ projectId: project, runId: run, runStepId: null, cost: "0.500000" })

    const { assertForgeRunCostConsistency, sumForgeRunCost } = await import("../../src/lib/server/forge-ai-usage")
    expect(await sumForgeRunCost(run)).toBe(2.5)

    const consistency = await assertForgeRunCostConsistency(run)
    expect(consistency).toMatchObject({ stepTotal: 2, nonStepRunTotal: 0.5, runTotal: 2.5, consistent: true, difference: 0 })
    expect(consistency.stepTotal).toBeLessThanOrEqual(consistency.runTotal)
  })

  it("4. never assigns unattributed legacy usage to a run, step or job", async () => {
    const project = await createProject()
    const run = await createRun(project)
    const job = await createJob(project)
    const step = await createStep(run, project, "copy", 1, job)

    await insertUsage({ projectId: project, runId: run, runStepId: step, jobId: job, cost: "1.000000" })
    // Legacy rows: same project, overlapping window, no relationships. A time-window
    // model would silently fold these into the run.
    await insertUsage({ projectId: project, cost: "9.000000", startOffsetMs: 0, endOffsetMs: 5000 })
    await insertUsage({ projectId: project, cost: "3.000000", startOffsetMs: -5000, endOffsetMs: 5000 })

    const { loadForgeRunCostBreakdown, sumForgeJobCost, sumForgeRunCost, sumForgeRunStepCost } = await import("../../src/lib/server/forge-ai-usage")
    expect(await sumForgeRunCost(run)).toBe(1)
    expect(await sumForgeRunStepCost(step)).toBe(1)
    expect(await sumForgeJobCost(job)).toBe(1)

    // Legacy spend is surfaced, clearly labelled, and kept out of run accounting.
    const breakdown = await loadForgeRunCostBreakdown(run, project)
    expect(breakdown.runTotal).toBe(1)
    expect(breakdown.unattributedProjectCost).toBe(12)
    expect(breakdown.consistent).toBe(true)
  })

  it("10. keeps concurrent run and job outcomes idempotent and non-overlapping", async () => {
    // One active run per project is a schema invariant (forge_runs_one_active_project_idx),
    // so genuinely concurrent runs live on different projects.
    const projectA = await createProject("Concurrent A")
    const projectB = await createProject("Concurrent B")
    const runA = await createRun(projectA)
    const runB = await createRun(projectB)
    const jobA = await createJob(projectA)
    const jobB = await createJob(projectB)
    const stepA = await createStep(runA, projectA, "copy", 1, jobA)
    const stepB = await createStep(runB, projectB, "copy", 1, jobB)

    // Interleaved concurrent writes over identical wall-clock windows.
    await Promise.all([
      insertUsage({ projectId: projectA, runId: runA, runStepId: stepA, jobId: jobA, cost: "0.300000", startOffsetMs: 0, endOffsetMs: 3000 }),
      insertUsage({ projectId: projectB, runId: runB, runStepId: stepB, jobId: jobB, cost: "0.700000", startOffsetMs: 0, endOffsetMs: 3000 }),
      insertUsage({ projectId: projectA, runId: runA, runStepId: stepA, jobId: jobA, cost: "0.200000", startOffsetMs: 0, endOffsetMs: 3000 }),
    ])

    const { assertForgeRunCostConsistency, sumForgeRunCost } = await import("../../src/lib/server/forge-ai-usage")
    expect(await sumForgeRunCost(runA)).toBe(0.5)
    expect(await sumForgeRunCost(runB)).toBe(0.7)

    // Re-reading is stable and both runs stay internally consistent.
    for (const run of [runA, runB]) {
      const first = await assertForgeRunCostConsistency(run)
      const second = await assertForgeRunCostConsistency(run)
      expect(second).toEqual(first)
      expect(first.consistent).toBe(true)
    }
  })

  it("keeps the spend record when a run, step or job is deleted", async () => {
    const project = await createProject()
    const run = await createRun(project)
    const job = await createJob(project)
    const step = await createStep(run, project, "copy", 1, job)
    await insertUsage({ projectId: project, runId: run, runStepId: step, jobId: job, cost: "2.000000" })

    await pool.query("DELETE FROM forge_runs WHERE id=$1", [run])

    // ON DELETE SET NULL: the money survives, the linkage degrades to unattributed.
    const rows = await pool.query("SELECT run_id,run_step_id,job_id,estimated_cost FROM forge_ai_usage")
    expect(rows.rowCount).toBe(1)
    expect(rows.rows[0]).toMatchObject({ run_id: null, run_step_id: null, estimated_cost: "2.000000" })
  })

  it("sums decimal money exactly, without floating-point drift", async () => {
    const project = await createProject()
    const run = await createRun(project)
    const step = await createStep(run, project, "copy", 1, null)
    // 0.1 + 0.2 is the canonical float trap; the numeric column must produce 0.3.
    await insertUsage({ projectId: project, runId: run, runStepId: step, cost: "0.100000" })
    await insertUsage({ projectId: project, runId: run, runStepId: step, cost: "0.200000" })

    const { sumForgeRunStepCost } = await import("../../src/lib/server/forge-ai-usage")
    expect(await sumForgeRunStepCost(step)).toBe(0.3)
  })
})
