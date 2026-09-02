import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const requireAdmin = createRequire(path.join(repositoryRoot, "admin", "package.json"))
const requireWeb = createRequire(path.join(repositoryRoot, "web", "package.json"))
let pg
try { pg = requireAdmin("pg") } catch { pg = requireWeb("pg") }
const { Pool } = pg

export async function loadSharedMigrationPlan(root = repositoryRoot) {
  const plan = JSON.parse(await readFile(path.join(root, "scripts", "shared-migration-plan.json"), "utf8"))
  const histories = {}
  for (const [owner, config] of Object.entries(plan.histories)) {
    const journal = JSON.parse(await readFile(path.join(root, config.journal), "utf8"))
    histories[owner] = await Promise.all(journal.entries.map(async (entry) => {
      const relativePath = `${config.directory}/${entry.tag}.sql`
      const sql = await readFile(path.join(root, relativePath), "utf8")
      return { owner, entry, relativePath, sql, hash: createHash("sha256").update(sql).digest("hex"), table: config.table }
    }))
  }
  const ordered = []
  for (const range of plan.order) {
    const migrations = histories[range.owner]
    if (!migrations || range.from < 0 || range.through >= migrations.length || range.from > range.through) throw new Error(`Invalid shared migration range: ${JSON.stringify(range)}`)
    ordered.push(...migrations.slice(range.from, range.through + 1))
  }
  const expected = Object.values(histories).flat().length
  if (ordered.length !== expected || new Set(ordered.map((item) => `${item.owner}/${item.entry.tag}`)).size !== expected) throw new Error("Shared migration plan must contain every migration exactly once.")
  return { ...plan, historyConfigs: plan.histories, histories, ordered }
}

export async function migrateSharedDatabase({ connectionString, pool, root = repositoryRoot, logger = console, lockTimeoutMs = 30_000 } = {}) {
  if (!pool && !connectionString) throw new Error("MIGRATION_DATABASE_URL is required for the shared migrator.")
  const ownedPool = pool ?? new Pool({ connectionString, max: 1, application_name: "scalesmiths_shared_migrator" })
  const client = await ownedPool.connect()
  const plan = await loadSharedMigrationPlan(root)
  let locked = false
  try {
    logger.log("Acquiring ScaleSmiths shared migration advisory lock.")
    await acquireAdvisoryLock(client, plan.advisoryLockKey, lockTimeoutMs)
    locked = true
    await ensureJournalTables(client, plan)
    const states = await readAndValidateStates(client, plan)
    while (states.web.prefix < plan.histories.web.length || states.admin.prefix < plan.histories.admin.length) {
      const candidates = Object.keys(plan.histories).map((owner) => plan.histories[owner][states[owner].prefix]).filter(Boolean)
      const readiness = await Promise.all(candidates.map(async (migration) => ({ migration, result: await migrationReadiness(client, plan, states, migration) })))
      const ready = readiness.filter((item) => item.result.ready).sort((left, right) => plan.ordered.indexOf(left.migration) - plan.ordered.indexOf(right.migration))[0]
      if (!ready) {
        const detail = readiness.map(({ migration, result }) => `${migration.owner}/${migration.entry.tag}: ${result.reason}`).join("; ")
        throw unsafeState(plan, states, candidates[0], `no next migration is legal (${detail})`)
      }
      const migration = ready.migration
      const applied = states[migration.owner].applied
      await applyMigration(client, plan, migration, logger)
      applied.set(migration.entry.idx, migration)
      states[migration.owner].prefix += 1
    }
    logger.log(`Shared migrations current: web ${states.web.prefix}/${plan.histories.web.length}, admin ${states.admin.prefix}/${plan.histories.admin.length}.`)
    return { web: states.web.prefix, admin: states.admin.prefix }
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [plan.advisoryLockKey]).catch(() => {})
    client.release()
    if (!pool) await ownedPool.end()
  }
}

async function migrationReadiness(client, plan, states, migration) {
  const key = `${migration.owner}/${migration.entry.tag}`
  for (const dependency of plan.crossHistoryDependencies.filter((item) => item.migration === key && !item.equivalentDuplicate)) {
    const [owner, tag] = dependency.requires.split("/")
    const required = plan.histories[owner]?.find((item) => item.entry.tag === tag)
    if (!required || states[owner].prefix <= required.entry.idx) return { ready: false, reason: `requires ${dependency.requires}` }
  }
  for (const requirement of plan.runtimeRequirements?.[key] ?? []) {
    if (requirement.kind === "table") {
      const result = await client.query("SELECT to_regclass($1)::text AS relation", [`${requirement.schema}.${requirement.name}`])
      if (!result.rows[0]?.relation) return { ready: false, reason: `requires ${requirement.schema}.${requirement.name}; repair is ${requirement.repairMigration}` }
    }
  }
  return { ready: true }
}

async function acquireAdvisoryLock(client, key, timeoutMs) {
  const deadline = Date.now() + Math.max(1, Number(timeoutMs))
  while (Date.now() < deadline) {
    const result = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [key])
    if (result.rows[0]?.locked) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for the ScaleSmiths shared migration advisory lock. Another migration runner is active.`)
}

async function ensureJournalTables(client, plan) {
  await client.query("BEGIN")
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"')
    for (const migrations of Object.values(plan.histories)) {
      const table = migrations[0]?.table
      if (!table) throw new Error("A shared migration history cannot be empty.")
      await client.query(`CREATE TABLE IF NOT EXISTS "drizzle"."${table}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`)
    }
    await client.query("COMMIT")
  } catch (error) { await client.query("ROLLBACK"); throw error }
}

async function readAndValidateStates(client, plan) {
  const states = {}
  for (const owner of Object.keys(plan.histories)) {
    const table = plan.histories[owner][0]?.table
    const rows = (await client.query(`SELECT id, hash, created_at FROM "drizzle"."${table}" ORDER BY id`)).rows
    const applied = new Map()
    let prefix = 0
    for (const row of rows) {
      const candidates = plan.histories[owner].filter((migration) => {
        const key = `${owner}/${migration.entry.tag}`
        const hashes = new Set([migration.hash, ...(plan.acceptedHistoricalHashes[key] ?? [])])
        return hashes.has(row.hash) && BigInt(migration.entry.when) === BigInt(row.created_at)
      })
      if (candidates.length !== 1) throw new Error(`Unsupported ${owner} migration journal row id=${row.id}, created_at=${row.created_at}, hash=${row.hash}. The checksum does not identify exactly one repository migration.`)
      const migration = candidates[0]
      if (migration.entry.idx !== prefix) throw new Error(`Unsupported ${owner} migration state: journal contains ${migration.entry.tag} at index ${migration.entry.idx}, but the required next prefix index is ${prefix}.`)
      applied.set(migration.entry.idx, migration)
      prefix += 1
    }
    states[owner] = { rows, applied, prefix }
  }
  return states
}

async function applyMigration(client, plan, migration, logger) {
  const key = `${migration.owner}/${migration.entry.tag}`
  logger.log(`Applying ${key}.`)
  await client.query("BEGIN")
  try {
    const equivalence = plan.equivalentMigrations[key]
    if (equivalence) await verifyEquivalentColumns(client, key, equivalence.columns)
    else for (const statement of migration.sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) await client.query(statement)
    await client.query(`INSERT INTO "drizzle"."${migration.table}" (hash, created_at) VALUES ($1, $2)`, [migration.hash, migration.entry.when])
    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK")
    throw new Error(`Shared migration ${key} failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}

async function verifyEquivalentColumns(client, key, columns) {
  for (const expected of columns) {
    const result = await client.query("SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2", [expected.table, expected.column])
    const actual = result.rows[0]
    if (!actual || actual.data_type !== expected.dataType || (actual.is_nullable === "YES") !== expected.nullable) {
      throw new Error(`${key} cannot be recorded as equivalent: public.${expected.table}.${expected.column} expected ${expected.dataType} nullable=${expected.nullable}, found ${actual ? `${actual.data_type} nullable=${actual.is_nullable === "YES"}` : "missing"}.`)
    }
  }
}

function unsafeState(plan, states, migration, reason) {
  const dependency = plan.crossHistoryDependencies.find((item) => item.migration === `${migration.owner}/${migration.entry.tag}`)
  return new Error(`Unsafe shared migration state: web=${states.web.prefix}/${plan.histories.web.length}, admin=${states.admin.prefix}/${plan.histories.admin.length}; next planned migration ${migration.owner}/${migration.entry.tag} cannot run because ${reason}.${dependency ? ` Required prerequisite: ${dependency.requires} (${dependency.objects.join(", ")}).` : ""}`)
}

export function resolveMigrationDatabaseUrl(env = process.env) {
  const value = env.MIGRATION_DATABASE_URL ?? (env.NODE_ENV === "production" ? null : env.DATABASE_URL)
  if (!value) throw new Error("MIGRATION_DATABASE_URL is required. Runtime WEB_DATABASE_URL and ADMIN_DATABASE_URL credentials are not accepted.")
  return value
}
