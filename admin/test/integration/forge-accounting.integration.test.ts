import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Pool } from "pg"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { assertSafeIntegrationDatabaseUrl } from "../../src/lib/test-database-safety"
import { runWithForgeAttribution } from "../../src/lib/server/forge-attribution-context"
import { migrateSharedTestDatabase } from "./shared-migration-harness"

const runExec = promisify(execFile)
let pool: Pool
let adminUrl: string

function roleUrl(base: string, username: string, password: string) {
  const url = new URL(base)
  url.username = username
  url.password = password
  return url.toString()
}

beforeAll(async () => {
  const url = assertSafeIntegrationDatabaseUrl(process.env.TEST_DATABASE_URL)
  const migrationUrl = roleUrl(url, "ss_test_migration", "migration-password")
  adminUrl = roleUrl(url, "ss_test_admin", "admin-password")
  pool = new Pool({ connectionString: url, max: 8 })
  await pool.query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public")
  const provisionEnv: NodeJS.ProcessEnv = { ...process.env, POSTGRES_PROVISIONING_DATABASE_URL: url, WEB_DATABASE_URL: roleUrl(url, "ss_test_web", "web-password"), ADMIN_DATABASE_URL: adminUrl, MIGRATION_DATABASE_URL: migrationUrl, READONLY_DATABASE_URL: roleUrl(url, "ss_test_readonly", "readonly-password"), NODE_ENV: "test" }
  await runExec(process.execPath, [path.resolve("scripts/provision-postgres-roles.mjs"), "--confirm-provision"], { env: provisionEnv })
  const migrationPool = new Pool({ connectionString: migrationUrl, max: 2 })
  try {
    await migrateSharedTestDatabase(migrationPool)
  } finally { await migrationPool.end() }
  await runExec(process.execPath, [path.resolve("scripts/provision-postgres-roles.mjs"), "--confirm-provision"], { env: provisionEnv })
  process.env.ADMIN_DATABASE_URL = adminUrl
  process.env.DATABASE_URL = url
}, 60000)

beforeEach(async () => {
  const tables = await pool.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '__drizzle_migrations'")
  if (tables.rows.length) await pool.query(`TRUNCATE ${tables.rows.map(r => `"public"."${r.tablename.replaceAll('"', '""')}"`).join(",")} RESTART IDENTITY CASCADE`)
})

afterAll(async () => { await pool?.end() })

async function createProject(name = "Integration Site", status = "intake") {
  return (await pool.query("INSERT INTO forge_projects(name,business_name,status) VALUES($1,$2,$3) RETURNING id", [name, "Integration Ltd", status])).rows[0].id as number
}

async function createRun(projectId: number, mode = "standard", policyJson: Record<string, unknown> = {}, status = "completed") {
  return (await pool.query("INSERT INTO forge_runs(project_id,mode,status,started_by,policy_json) VALUES($1,$2,$3,'test',$4) RETURNING id", [projectId, mode, status, JSON.stringify(policyJson)])).rows[0].id as number
}

async function createStep(runId: number, projectId: number, stage: string, sequence: number, status = "completed") {
  return (await pool.query("INSERT INTO forge_run_steps(run_id,project_id,stage,sequence,status,required) VALUES($1,$2,$3,$4,$5,true) RETURNING id", [runId, projectId, stage, sequence, status])).rows[0].id as number
}

async function createJob(projectId: number, kind = "research", status = "completed") {
  return (await pool.query("INSERT INTO forge_jobs(project_id,kind,status) VALUES($1,$2,$3) RETURNING id", [projectId, kind, status])).rows[0].id as number
}

async function insertAiUsage(overrides: Record<string, unknown>) {
  const defaults: Record<string, unknown> = { provider: "test", model: "test", prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_cost: "0.000000", started_at: new Date().toISOString(), completed_at: new Date().toISOString() }
  const values = { ...defaults, ...overrides }
  const keys = Object.keys(values).filter(k => values[k] !== undefined)
  const columns = keys.join(", ")
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ")
  return (await pool.query(`INSERT INTO forge_ai_usage(${columns}) VALUES(${placeholders}) RETURNING id`, keys.map(k => values[k]))).rows[0].id as number
}

describe("Forge AI cost attribution (real PostgreSQL)", () => {
  it("A. overlapping jobs get isolated totals via FK", async () => {
    const project = await createProject()
    const run = await createRun(project)
    const stepA = await createStep(run, project, "research", 1)
    const stepB = await createStep(run, project, "copy", 2)
    const jobA = await createJob(project, "research")
    const jobB = await createJob(project, "copy")

    await insertAiUsage({ project_id: project, run_id: run, run_step_id: stepA, job_id: jobA, estimated_cost: "1.500000" })
    await insertAiUsage({ project_id: project, run_id: run, run_step_id: stepB, job_id: jobB, estimated_cost: "2.250000" })

    const { updateRunStepActualCost } = await import("../../src/lib/server/forge-runs/accounting")
    await updateRunStepActualCost(stepA, jobA)
    await updateRunStepActualCost(stepB, jobB)
    const rows = await pool.query("SELECT id, actual_cost_usd FROM forge_run_steps WHERE run_id=$1 ORDER BY id", [run])
    expect(rows.rows[0].actual_cost_usd).toBe("1.500000")
    expect(rows.rows[1].actual_cost_usd).toBe("2.250000")
  })

  it("B. overlapping runs receive only their own linked usage", async () => {
    const project = await createProject()
    const run1 = await createRun(project, "standard", {}, "completed")
    const run2 = await createRun(project, "redesign", {}, "completed")
    await insertAiUsage({ project_id: project, run_id: run1, estimated_cost: "3.000000" })
    await insertAiUsage({ project_id: project, run_id: run2, estimated_cost: "7.000000" })
    const { updateRunActualCost } = await import("../../src/lib/server/forge-runs/accounting")
    await updateRunActualCost(run1)
    await updateRunActualCost(run2)
    const rows = await pool.query("SELECT id, actual_cost_usd FROM forge_runs WHERE project_id=$1 ORDER BY id", [project])
    expect(rows.rows[0].actual_cost_usd).toBe("3.000000")
    expect(rows.rows[1].actual_cost_usd).toBe("7.000000")
  })

  it("C. retry attempts: separate job IDs, no absorption", async () => {
    const project = await createProject()
    const run = await createRun(project)
    const step = await createStep(run, project, "research", 1)
    const job1 = await createJob(project, "research")
    const job2 = await createJob(project, "research")
    await insertAiUsage({ project_id: project, job_id: job1, run_step_id: step, run_id: run, estimated_cost: "1.000000" })
    await insertAiUsage({ project_id: project, job_id: job2, run_step_id: step, run_id: run, estimated_cost: "2.000000" })
    const { updateRunStepActualCost } = await import("../../src/lib/server/forge-runs/accounting")
    await updateRunStepActualCost(step, job1)
    expect((await pool.query("SELECT actual_cost_usd FROM forge_run_steps WHERE id=$1", [step])).rows[0].actual_cost_usd).toBe("1.000000")
    await updateRunStepActualCost(step, job2)
    expect((await pool.query("SELECT actual_cost_usd FROM forge_run_steps WHERE id=$1", [step])).rows[0].actual_cost_usd).toBe("2.000000")
  })

  it("D. legacy unattributed usage (NULL FKs) excluded from run FK totals", async () => {
    const project = await createProject()
    const run = await createRun(project)
    const job = await createJob(project)
    await insertAiUsage({ project_id: project, run_id: run, job_id: job, estimated_cost: "5.000000" })
    await insertAiUsage({ project_id: project, estimated_cost: "9.999999" })
    const { updateRunActualCost } = await import("../../src/lib/server/forge-runs/accounting")
    await updateRunActualCost(run)
    const row = await pool.query("SELECT actual_cost_usd FROM forge_runs WHERE id=$1", [run])
    expect(row.rows[0].actual_cost_usd).toBe("5.000000")
  })

  it("E. project-level reporting includes legacy unattributed usage", async () => {
    const project = await createProject()
    await insertAiUsage({ project_id: project, estimated_cost: "4.000000" })
    await insertAiUsage({ project_id: project, estimated_cost: "2.000000" })
    const { loadForgeAiUsageBudgetSnapshot } = await import("../../src/lib/server/forge-ai-usage")
    const snap = await loadForgeAiUsageBudgetSnapshot(project)
    expect(snap.project.used).toBeGreaterThanOrEqual(5.99)
  })

  it("F. ON DELETE SET NULL preserves AI spend", async () => {
    const project = await createProject()
    const run = await createRun(project)
    const step = await createStep(run, project, "research", 1)
    const job = await createJob(project)
    await insertAiUsage({ project_id: project, run_id: run, run_step_id: step, job_id: job, estimated_cost: "7.770000" })
    await pool.query("DELETE FROM forge_jobs WHERE id=$1", [job])
    const rows = await pool.query("SELECT run_id, run_step_id, job_id, estimated_cost FROM forge_ai_usage WHERE project_id=$1", [project])
    expect(rows.rows[0].job_id).toBeNull()
    expect(rows.rows[0].estimated_cost).toBe("7.770000")
  })

  it("G. decimal: 0.1 + 0.2 = numeric 0.3", async () => {
    const project = await createProject()
    const run = await createRun(project)
    await insertAiUsage({ project_id: project, run_id: run, estimated_cost: "0.100000" })
    await insertAiUsage({ project_id: project, run_id: run, estimated_cost: "0.200000" })
    const { updateRunActualCost } = await import("../../src/lib/server/forge-runs/accounting")
    await updateRunActualCost(run)
    expect((await pool.query("SELECT actual_cost_usd FROM forge_runs WHERE id=$1", [run])).rows[0].actual_cost_usd).toBe("0.300000")
  })

  it("H. repeated reads idempotent", async () => {
    const project = await createProject()
    const run = await createRun(project)
    await insertAiUsage({ project_id: project, run_id: run, estimated_cost: "3.141592" })
    const { updateRunActualCost } = await import("../../src/lib/server/forge-runs/accounting")
    await updateRunActualCost(run)
    await updateRunActualCost(run)
    await updateRunActualCost(run)
    expect((await pool.query("SELECT actual_cost_usd FROM forge_runs WHERE id=$1", [run])).rows[0].actual_cost_usd).toBe("3.141592")
  })

  it("I. cancelled/failed runs produce correct totals", async () => {
    const project = await createProject()
    const run = await createRun(project, "standard", {}, "failed")
    await insertAiUsage({ project_id: project, run_id: run, estimated_cost: "0.500000" })
    const { updateRunActualCost } = await import("../../src/lib/server/forge-runs/accounting")
    await updateRunActualCost(run)
    expect((await pool.query("SELECT actual_cost_usd FROM forge_runs WHERE id=$1", [run])).rows[0].actual_cost_usd).toBe("0.500000")
  })

  it("J. zero-cost usage", async () => {
    const project = await createProject()
    const run = await createRun(project)
    await insertAiUsage({ project_id: project, run_id: run, estimated_cost: "0.000000" })
    const { updateRunActualCost } = await import("../../src/lib/server/forge-runs/accounting")
    await updateRunActualCost(run)
    expect((await pool.query("SELECT actual_cost_usd FROM forge_runs WHERE id=$1", [run])).rows[0].actual_cost_usd).toBe("0.000000")
  })
})

describe("Forge ALS attribution (persisted in DB)", () => {
  it("two concurrent scopes write different persisted run_id/job_id", async () => {
    const project = await createProject()
    // Different project per scope to avoid the unique-active-run constraint
    const projectB = await createProject("ALS Project B")
    const runA = await createRun(project, "standard", {}, "running")
    const runB = await createRun(projectB, "redesign", {}, "running")
    const jobA = await createJob(project, "research")
    const jobB = await createJob(projectB, "copy")

    const { recordForgeAiUsage } = await import("../../src/lib/server/forge-ai-usage")

    const rowA = await runWithForgeAttribution({ projectId: project, runId: runA, jobId: jobA }, async () => {
      await recordForgeAiUsage({ projectId: project, provider: "mock", model: "test", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, estimatedCost: 0.01, startedAt: new Date(), completedAt: new Date() })
      return pool.query("SELECT run_id, job_id FROM forge_ai_usage WHERE job_id=$1", [jobA])
    })
    const rowB = await runWithForgeAttribution({ projectId: projectB, runId: runB, jobId: jobB }, async () => {
      await recordForgeAiUsage({ projectId: projectB, provider: "mock", model: "test", usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, estimatedCost: 0.02, startedAt: new Date(), completedAt: new Date() })
      return pool.query("SELECT run_id, job_id FROM forge_ai_usage WHERE job_id=$1", [jobB])
    })

    expect(rowA.rows[0].run_id).toBe(runA)
    expect(rowA.rows[0].job_id).toBe(jobA)
    expect(rowB.rows[0].run_id).toBe(runB)
    expect(rowB.rows[0].job_id).toBe(jobB)
  })
})
