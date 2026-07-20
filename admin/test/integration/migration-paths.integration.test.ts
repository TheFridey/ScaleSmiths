import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { assertSafeIntegrationDatabaseUrl } from "../../src/lib/test-database-safety"

const WEB_MIGRATIONS = path.resolve("../web/drizzle")
const ADMIN_MIGRATIONS = path.resolve("drizzle")
const HISTORICAL_ADMIN_COUNT = 42
const HISTORICAL_0012_WHEN = "1782295000000"
const KNOWN_MODIFIED_0012_HASH = "27a492feabbe2e781bc259c1ba64b614b32b8d3388e7844ae5ebbcb0e4e5e93b"

let pool: Pool
let fixtureRoot: string
let historicalWebMigrations: string
let historicalAdminMigrations: string

beforeAll(async () => {
  const databaseUrl = assertSafeIntegrationDatabaseUrl(process.env.TEST_DATABASE_URL)
  pool = new Pool({ connectionString: databaseUrl, max: 4 })
  fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "scalesmiths-migration-fixture-"))
  historicalWebMigrations = await createHistoricalMigrationFolder(WEB_MIGRATIONS, path.join(fixtureRoot, "web"), 10)
  historicalAdminMigrations = await createHistoricalMigrationFolder(ADMIN_MIGRATIONS, path.join(fixtureRoot, "admin"), HISTORICAL_ADMIN_COUNT)
})

beforeEach(async () => {
  await resetDatabase()
})

afterAll(async () => {
  if (pool) {
    await resetDatabase()
    await pool.end()
  }
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true })
})

describe("migration installation paths", () => {
  it("applies every migration from zero in production order with separate journals", async () => {
    await applyMigrations(WEB_MIGRATIONS, ADMIN_MIGRATIONS)

    expect(await migrationCount("__drizzle_web_migrations")).toBe(13)
    expect(await migrationCount("__drizzle_migrations")).toBe(46)
    expect(await columnExists("forge_artifacts", "content_bytes")).toBe(true)
    expect(await columnExists("forge_deployment_candidates", "dependency_report_json")).toBe(true)
    expect(await columnExists("forge_deployment_candidates", "dependency_sbom_hash")).toBe(true)
    expect(await constraintExists("forge_deployment_candidates_dependency_evidence_complete")).toBe(true)
    expect(await functionContains("prevent_submitted_deployment_candidate_mutation", "dependency_report_json")).toBe(true)
    expect(await tableExists("client_request_messages")).toBe(true)
    expect(await tableExists("public_claims")).toBe(true)
    expect(await viewExists("public_verified_claims")).toBe(true)
    expect(await indexExists("forge_artifacts_version_idx")).toBe(true)
  })

  it("upgrades a locked historical fixture by applying only the forward reconciliation", async () => {
    await applyMigrations(historicalWebMigrations, historicalAdminMigrations)
    expect(await migrationCount("__drizzle_web_migrations")).toBe(10)
    expect(await migrationCount("__drizzle_migrations")).toBe(HISTORICAL_ADMIN_COUNT)

    await pool.query(
      "UPDATE drizzle.__drizzle_migrations SET hash = $1 WHERE created_at = $2",
      [KNOWN_MODIFIED_0012_HASH, HISTORICAL_0012_WHEN],
    )
    await pool.query(
      "INSERT INTO client_requests(client_id,title,description) VALUES('migration-fixture-client','Preserve me','Historical client request')",
    )

    // Model the known uncertainty without rewriting any journal entry: objects
    // previously supplied defensively by 0009/0012 are absent, while existing
    // shared client-request data must survive the forward repair.
    await pool.query("ALTER TABLE forge_artifacts DROP COLUMN content_bytes")
    await pool.query("DROP INDEX forge_artifacts_version_idx")
    await pool.query("DROP TABLE client_request_messages CASCADE")

    await applyMigrations(WEB_MIGRATIONS, ADMIN_MIGRATIONS)

    expect(await migrationCount("__drizzle_web_migrations")).toBe(13)
    expect(await migrationCount("__drizzle_migrations")).toBe(46)
    expect(await columnExists("forge_artifacts", "content_bytes")).toBe(true)
    expect(await columnExists("forge_deployment_candidates", "dependency_report_json")).toBe(true)
    expect(await constraintExists("forge_deployment_candidates_dependency_hashes_sha256")).toBe(true)
    expect(await tableExists("client_request_messages")).toBe(true)
    expect(await indexExists("forge_artifacts_version_idx")).toBe(true)
    expect(
      (
        await pool.query<{ count: number }>(
          "SELECT count(*)::int count FROM client_requests WHERE client_id = 'migration-fixture-client'",
        )
      ).rows[0].count,
    ).toBe(1)
    expect(
      (
        await pool.query<{ hash: string }>(
          "SELECT hash FROM drizzle.__drizzle_migrations WHERE created_at = $1",
          [HISTORICAL_0012_WHEN],
        )
      ).rows[0].hash,
    ).toBe(KNOWN_MODIFIED_0012_HASH)
  })

  it("requires complete dependency evidence and freezes it after candidate submission", async () => {
    await applyMigrations(WEB_MIGRATIONS, ADMIN_MIGRATIONS)
    const project = await pool.query<{ id: number }>("INSERT INTO forge_projects(name,business_name) VALUES('Evidence fixture','Evidence fixture') RETURNING id")
    const projectId = project.rows[0].id
    const hash = "a".repeat(64)
    const baseColumns = "project_id,candidate_number,state,workspace_version,workspace_path,workspace_hash,evidence_json,release_notes,rollback_plan,created_by"
    const baseValues = [projectId, 1, "draft", "v1", "generated-sites/evidence", hash, {}, "Fixture", "Rollback", "integration-test"]

    await expect(pool.query(
      `INSERT INTO forge_deployment_candidates(${baseColumns},dependency_report_json,dependency_report_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [...baseValues, {}, hash],
    )).rejects.toThrow(/dependency_evidence_complete/)

    const created = await pool.query<{ id: number }>(
      `INSERT INTO forge_deployment_candidates(${baseColumns},dependency_report_json,dependency_report_hash,dependency_sbom_json,dependency_sbom_hash,dependency_package_json_hash,dependency_lockfile_hash,dependency_policy_version,dependency_evidence_created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      [[...baseValues.slice(0, 2), "submitted", ...baseValues.slice(3)], { status: "passed" }, hash, { spdxVersion: "SPDX-2.3" }, hash, hash, hash, "fixture-policy", new Date()].flat(),
    )
    await expect(pool.query("UPDATE forge_deployment_candidates SET dependency_report_json = $1 WHERE id = $2", [{ status: "failed" }, created.rows[0].id])).rejects.toThrow(/snapshot is immutable/)
  })
})

async function applyMigrations(webFolder: string, adminFolder: string) {
  const database = drizzle(pool)
  await migrate(database, {
    migrationsFolder: webFolder,
    migrationsTable: "__drizzle_web_migrations",
    migrationsSchema: "drizzle",
  })
  await migrate(database, { migrationsFolder: adminFolder })
}

async function createHistoricalMigrationFolder(source: string, destination: string, entryCount: number) {
  const journal = JSON.parse(await readFile(path.join(source, "meta", "_journal.json"), "utf8")) as {
    entries: Array<{ tag: string }>
  }
  const entries = journal.entries.slice(0, entryCount)
  await mkdir(path.join(destination, "meta"), { recursive: true })
  for (const entry of entries) {
    await copyFile(path.join(source, `${entry.tag}.sql`), path.join(destination, `${entry.tag}.sql`))
  }
  await writeFile(path.join(destination, "meta", "_journal.json"), `${JSON.stringify({ ...journal, entries }, null, 2)}\n`)
  return destination
}

async function resetDatabase() {
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public")
}

async function migrationCount(table: "__drizzle_web_migrations" | "__drizzle_migrations") {
  const result = await pool.query<{ count: number }>(`SELECT count(*)::int count FROM drizzle."${table}"`)
  return result.rows[0].count
}

async function tableExists(table: string) {
  const result = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists",
    [table],
  )
  return result.rows[0].exists
}

async function viewExists(view: string) {
  const result = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = $1) AS exists",
    [view],
  )
  return result.rows[0].exists
}

async function columnExists(table: string, column: string) {
  const result = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2) AS exists",
    [table, column],
  )
  return result.rows[0].exists
}

async function indexExists(index: string) {
  const result = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1) AS exists",
    [index],
  )
  return result.rows[0].exists
}

async function constraintExists(constraint: string) {
  const result = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = $1) AS exists",
    [constraint],
  )
  return result.rows[0].exists
}

async function functionContains(functionName: string, expected: string) {
  const result = await pool.query<{ definition: string }>(
    "SELECT pg_get_functiondef(oid) definition FROM pg_proc WHERE proname = $1 LIMIT 1",
    [functionName],
  )
  return result.rows[0]?.definition.includes(expected) ?? false
}
