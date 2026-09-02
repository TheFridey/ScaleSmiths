import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Pool } from "pg"
import path from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { assertSafeIntegrationDatabaseUrl } from "../../src/lib/test-database-safety"
import { migrateSharedTestDatabase } from "./shared-migration-harness"

const runExec = promisify(execFile)
let pool: Pool

interface ForgeStepState {
  stage: string
  status: string
  failure_category?: string | null
}

function roleUrl(base: string, username: string, password: string) {
  const url = new URL(base)
  url.username = username
  url.password = password
  return url.toString()
}

beforeAll(async () => {
  const url = assertSafeIntegrationDatabaseUrl(process.env.TEST_DATABASE_URL)
  const migrationUrl = roleUrl(url, "ss_test_migration", "migration-password")
  const adminUrl = roleUrl(url, "ss_test_admin", "admin-password")
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

async function createProject(name = "Inv Project") {
  return (await pool.query("INSERT INTO forge_projects(name,business_name,status) VALUES($1,$2,'intake') RETURNING id", [name, "Inv Ltd"])).rows[0].id as number
}

async function createRun(projectId: number, mode = "standard", policyJson: Record<string, unknown> = {}) {
  return (await pool.query("INSERT INTO forge_runs(project_id,mode,status,started_by,policy_json) VALUES($1,$2,'running','test',$3) RETURNING id", [projectId, mode, JSON.stringify(policyJson)])).rows[0].id as number
}

async function createStep(runId: number, projectId: number, stage: string, sequence: number, status = "completed", inputHash = "hash-before", required = true) {
  return (await pool.query("INSERT INTO forge_run_steps(run_id,project_id,stage,sequence,status,required,input_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id", [runId, projectId, stage, sequence, status, required, inputHash])).rows[0].id as number
}

async function insertArtifact(projectId: number, type: string, hash: string) {
  return (await pool.query("INSERT INTO forge_artifacts(project_id,type,title,content,output_hash,quality_state,approval_state) VALUES($1,$2,'Test','{}',$3,'validated','approved') RETURNING id", [projectId, type, hash])).rows[0].id as number
}

describe("Forge invalidation modes (real PostgreSQL)", () => {
  it("standard mode: changing copy invalidates downstream design_system", async () => {
    const project = await createProject()
    const run = await createRun(project, "standard", {})
    await insertArtifact(project, "handover_doc", "brief-v1")
    await insertArtifact(project, "copy_doc", "copy-v1")
    await createStep(run, project, "brief", 1)
    await createStep(run, project, "research", 2)
    await createStep(run, project, "copy", 3)
    await createStep(run, project, "design_system", 4)

    await pool.query("UPDATE forge_run_steps SET output_artifact_ids=$1 WHERE stage='copy' AND run_id=$2", [JSON.stringify([99]), run])
    await insertArtifact(project, "copy_doc", "copy-v2")

    const { invalidateDownstreamForChangedInput } = await import("../../src/lib/server/forge-runs/invalidation")
    await invalidateDownstreamForChangedInput(run, project, "copy", "test")

    const steps = await pool.query<ForgeStepState>("SELECT stage, status, failure_category FROM forge_run_steps WHERE run_id=$1 ORDER BY sequence", [run])
    expect(steps.rows.find((step) => step.stage === "research")?.status).toBe("completed")
    expect(steps.rows.find((step) => step.stage === "design_system")?.status).toBe("pending")
  })

  it("redesign mode invalidation", async () => {
    const project = await createProject()
    const run = await createRun(project, "redesign", {})
    await insertArtifact(project, "handover_doc", "brief-v1")
    await insertArtifact(project, "copy_doc", "copy-v1")
    await createStep(run, project, "brief", 1)
    await createStep(run, project, "copy", 3)
    await createStep(run, project, "design_system", 4)
    await pool.query("UPDATE forge_run_steps SET output_artifact_ids='[99]' WHERE stage='copy' AND run_id=$1", [run])
    await insertArtifact(project, "copy_doc", "copy-v2")
    const { invalidateDownstreamForChangedInput } = await import("../../src/lib/server/forge-runs/invalidation")
    await invalidateDownstreamForChangedInput(run, project, "copy", "test")
    const design = await pool.query("SELECT status FROM forge_run_steps WHERE run_id=$1 AND stage='design_system'", [run])
    expect(design.rows[0].status).toBe("pending")
  })

  it("refresh mode invalidation", async () => {
    const project = await createProject()
    const run = await createRun(project, "refresh", {})
    await insertArtifact(project, "handover_doc", "brief-v1")
    await insertArtifact(project, "copy_doc", "copy-v1")
    await createStep(run, project, "brief", 1)
    await createStep(run, project, "copy", 3)
    await createStep(run, project, "design_system", 4)
    await pool.query("UPDATE forge_run_steps SET output_artifact_ids='[99]' WHERE stage='copy' AND run_id=$1", [run])
    await insertArtifact(project, "copy_doc", "copy-v2")
    const { invalidateDownstreamForChangedInput } = await import("../../src/lib/server/forge-runs/invalidation")
    await invalidateDownstreamForChangedInput(run, project, "copy", "test")
    expect((await pool.query("SELECT status FROM forge_run_steps WHERE run_id=$1 AND stage='design_system'", [run])).rows[0].status).toBe("pending")
  })

  it("migration mode invalidation", async () => {
    const project = await createProject()
    const run = await createRun(project, "migration", { migration: true })
    await insertArtifact(project, "handover_doc", "brief-v1")
    await insertArtifact(project, "copy_doc", "copy-v1")
    await createStep(run, project, "brief", 1)
    await createStep(run, project, "copy", 3)
    await createStep(run, project, "design_system", 4)
    await pool.query("UPDATE forge_run_steps SET output_artifact_ids='[99]' WHERE stage='copy' AND run_id=$1", [run])
    await insertArtifact(project, "copy_doc", "copy-v2")
    const { invalidateDownstreamForChangedInput } = await import("../../src/lib/server/forge-runs/invalidation")
    await invalidateDownstreamForChangedInput(run, project, "copy", "test")
    expect((await pool.query("SELECT status FROM forge_run_steps WHERE run_id=$1 AND stage='design_system'", [run])).rows[0].status).toBe("pending")
  })

  it("policy-disabled stages remain skipped", async () => {
    const project = await createProject()
    const run = await createRun(project, "standard", { skipStages: { design_system: true } })
    await insertArtifact(project, "handover_doc", "brief-v1")
    await insertArtifact(project, "copy_doc", "copy-v1")
    await createStep(run, project, "brief", 1)
    await createStep(run, project, "copy", 3)
    await createStep(run, project, "design_system", 4, "skipped")
    await pool.query("UPDATE forge_run_steps SET output_artifact_ids='[99]' WHERE stage='copy' AND run_id=$1", [run])
    await insertArtifact(project, "copy_doc", "copy-v2")
    const { invalidateDownstreamForChangedInput } = await import("../../src/lib/server/forge-runs/invalidation")
    await invalidateDownstreamForChangedInput(run, project, "copy", "test")
    const design = await pool.query("SELECT status FROM forge_run_steps WHERE run_id=$1 AND stage='design_system'", [run])
    expect(design.rows[0].status).toBe("skipped")
  })

  it("changing design does not invalidate upstream research/copy", async () => {
    const project = await createProject()
    const run = await createRun(project, "standard", {})
    await insertArtifact(project, "handover_doc", "brief-v1")
    await insertArtifact(project, "copy_doc", "copy-v1")
    await insertArtifact(project, "design_system", "design-v1")
    await createStep(run, project, "brief", 1)
    await createStep(run, project, "research", 2)
    await createStep(run, project, "copy", 3)
    await createStep(run, project, "design_system", 4)
    await pool.query("UPDATE forge_run_steps SET output_artifact_ids='[99]' WHERE stage='design_system' AND run_id=$1", [run])
    await insertArtifact(project, "design_system", "design-v2")
    const { invalidateDownstreamForChangedInput } = await import("../../src/lib/server/forge-runs/invalidation")
    await invalidateDownstreamForChangedInput(run, project, "design_system", "test")
    const steps = await pool.query<ForgeStepState>("SELECT stage, status FROM forge_run_steps WHERE run_id=$1 ORDER BY sequence", [run])
    expect(steps.rows.find((step) => step.stage === "research")?.status).toBe("completed")
    expect(steps.rows.find((step) => step.stage === "copy")?.status).toBe("completed")
  })

  it("repeated invalidation is idempotent", async () => {
    const project = await createProject()
    const run = await createRun(project, "standard", {})
    await insertArtifact(project, "handover_doc", "brief-v1")
    await insertArtifact(project, "copy_doc", "copy-v1")
    await createStep(run, project, "brief", 1)
    await createStep(run, project, "copy", 3)
    await createStep(run, project, "design_system", 4)
    await pool.query("UPDATE forge_run_steps SET output_artifact_ids='[99]' WHERE stage='copy' AND run_id=$1", [run])
    await insertArtifact(project, "copy_doc", "copy-v2")
    const { invalidateDownstreamForChangedInput } = await import("../../src/lib/server/forge-runs/invalidation")
    await invalidateDownstreamForChangedInput(run, project, "copy", "test")
    expect((await pool.query("SELECT status FROM forge_run_steps WHERE run_id=$1 AND stage='design_system'", [run])).rows[0].status).toBe("pending")
    await invalidateDownstreamForChangedInput(run, project, "copy", "test")
    expect((await pool.query("SELECT status FROM forge_run_steps WHERE run_id=$1 AND stage='design_system'", [run])).rows[0].status).toBe("pending")
  })

  it("absent optional stages handled", async () => {
    const project = await createProject()
    const run = await createRun(project, "standard", {})
    await insertArtifact(project, "handover_doc", "brief-v1")
    await insertArtifact(project, "copy_doc", "copy-v1")
    await createStep(run, project, "brief", 1)
    await createStep(run, project, "copy", 3)
    await createStep(run, project, "design_system", 4, "pending", "hash-before", false)
    await pool.query("UPDATE forge_run_steps SET output_artifact_ids='[99]' WHERE stage='copy' AND run_id=$1", [run])
    await insertArtifact(project, "copy_doc", "copy-v2")
    const { invalidateDownstreamForChangedInput } = await import("../../src/lib/server/forge-runs/invalidation")
    await invalidateDownstreamForChangedInput(run, project, "copy", "test")
    expect((await pool.query("SELECT status FROM forge_run_steps WHERE run_id=$1 AND stage='design_system'", [run])).rows[0].status).toBe("pending")
  })
})
