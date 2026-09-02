#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { migrateSharedDatabase } from "./shared-migrator.mjs"

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const localHosts = new Set(["localhost", "127.0.0.1", "::1"])
const isolatedDatabaseName = /(?:^|[_-])(backup|restore|snapshot|clone|staging|migration|test)(?:[_-]|$)/i

export function parseArguments(argv) {
  const options = {}
  const valueArguments = new Set(["--database-url", "--database-url-file", "--confirm-target", "--report"])
  const flagArguments = new Set(["--confirm-isolated-backup", "--confirm-localhost-isolated"])

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (valueArguments.has(argument)) {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`)
      options[argument.slice(2)] = value
      index += 1
    } else if (flagArguments.has(argument)) {
      options[argument.slice(2)] = true
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }
  return options
}

export async function resolveDatabaseUrl(options) {
  if (options["database-url"] && options["database-url-file"]) {
    throw new Error("Use only one of --database-url or --database-url-file.")
  }
  if (options["database-url"]) return options
  if (!options["database-url-file"]) {
    throw new Error("--database-url or --database-url-file is required; environment database URLs are never used.")
  }

  const urlFile = path.resolve(options["database-url-file"])
  const metadata = await lstat(urlFile)
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error("--database-url-file must be a regular, non-symlink file.")
  }
  if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
    throw new Error("--database-url-file must not be group/world accessible.")
  }
  const databaseUrl = (await readFile(urlFile, "utf8")).replace(/\r?\n$/, "")
  if (!databaseUrl || /[\r\n\0]/.test(databaseUrl)) {
    throw new Error("--database-url-file must contain exactly one PostgreSQL URL.")
  }
  return { ...options, "database-url": databaseUrl }
}

export function validateTarget(options) {
  if (!options["database-url"]) throw new Error("--database-url is required; environment database URLs are never used.")
  if (!options.report) throw new Error("--report is required and must name the JSON evidence file.")
  if (!options["confirm-isolated-backup"]) throw new Error("--confirm-isolated-backup is required.")

  let url
  try {
    url = new URL(options["database-url"])
  } catch {
    throw new Error("--database-url must be a valid PostgreSQL URL.")
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("The verification target must use PostgreSQL.")

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""))
  if (!host || !database) throw new Error("The verification target must include a host and database name.")
  if (!isolatedDatabaseName.test(database)) {
    throw new Error("The database name must explicitly identify an isolated backup, restore, snapshot, clone, staging, migration, or test database.")
  }
  if (localHosts.has(host) && !options["confirm-localhost-isolated"]) {
    throw new Error("Localhost may proxy production; --confirm-localhost-isolated is required.")
  }

  const target = `${host}/${database}`
  if (options["confirm-target"] !== target) {
    throw new Error(`--confirm-target must exactly equal ${target}.`)
  }
  if (path.extname(options.report).toLowerCase() !== ".json") throw new Error("--report must use a .json extension.")

  return { url, host, database, target, reportPath: path.resolve(options.report) }
}

export async function runVerification(options) {
  const target = validateTarget(options)
  const requireAdmin = createRequire(path.join(repositoryRoot, "admin", "package.json"))
  const { Pool } = requireAdmin("pg")
  const startedAt = new Date().toISOString()
  const report = {
    version: 1,
    runId: randomUUID(),
    status: "running",
    target: { host: target.host, database: target.database },
    startedAt,
    order: ["shared dependency plan"],
    before: null,
    after: null,
    comparison: null,
  }
  const pool = new Pool({
    connectionString: options["database-url"],
    max: 1,
    connectionTimeoutMillis: 10_000,
    application_name: "scalesmiths_isolated_backup_migration_verifier",
  })

  await writeReport(target.reportPath, report, true)

  console.log(`Target host: ${target.host}`)
  console.log(`Target database: ${target.database}`)
  console.log("Confirmed purpose: isolated production-backup restore verification")

  try {
    const identity = await pool.query("SELECT current_database() AS database")
    if (identity.rows[0]?.database !== target.database) {
      throw new Error(`Connected database ${identity.rows[0]?.database ?? "unknown"} does not match the confirmed target.`)
    }

    report.before = await captureDatabaseState(pool)
    await migrateSharedDatabase({ pool, root: repositoryRoot })
    report.after = await captureDatabaseState(pool)
    report.comparison = compareStates(report.before, report.after)
    report.status = "passed"
    report.completedAt = new Date().toISOString()
    await writeReport(target.reportPath, report)
    console.log(`Verification passed. Machine-readable report: ${target.reportPath}`)
    return report
  } catch (error) {
    report.status = "failed"
    report.completedAt = new Date().toISOString()
    report.error = safeError(error)
    await writeReport(target.reportPath, report)
    throw new Error(`Backup migration verification failed; inspect ${target.reportPath}.`)
  } finally {
    await pool.end()
  }
}

async function captureDatabaseState(pool) {
  const [tables, columns, indexes, enums, webJournal, adminJournal] = await Promise.all([
    pool.query(
      "SELECT schemaname AS schema, tablename AS name FROM pg_tables WHERE schemaname IN ('public','drizzle') ORDER BY schemaname, tablename",
    ),
    pool.query(
      "SELECT table_schema AS schema, table_name AS table, column_name AS column, data_type, udt_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema IN ('public','drizzle') ORDER BY table_schema, table_name, ordinal_position",
    ),
    pool.query(
      "SELECT schemaname AS schema, tablename AS table, indexname AS name, indexdef AS definition FROM pg_indexes WHERE schemaname IN ('public','drizzle') ORDER BY schemaname, tablename, indexname",
    ),
    pool.query(
      "SELECT n.nspname AS schema, t.typname AS name, e.enumsortorder::text AS position, e.enumlabel AS value FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder",
    ),
    readJournal(pool, "__drizzle_web_migrations"),
    readJournal(pool, "__drizzle_migrations"),
  ])
  const schema = {
    tables: tables.rows,
    columns: columns.rows,
    indexes: indexes.rows,
    enums: enums.rows,
  }
  return {
    capturedAt: new Date().toISOString(),
    schemaDigest: digest(schema),
    schema,
    journals: {
      web: webJournal,
      admin: adminJournal,
    },
  }
}

async function readJournal(pool, table) {
  const exists = await pool.query("SELECT to_regclass($1)::text AS relation", [`drizzle.${table}`])
  if (!exists.rows[0]?.relation) return []
  const result = await pool.query(`SELECT id, hash, created_at::text AS created_at FROM drizzle."${table}" ORDER BY id`)
  return result.rows
}

function compareStates(before, after) {
  return {
    schemaChanged: before.schemaDigest !== after.schemaDigest,
    schemaDigestBefore: before.schemaDigest,
    schemaDigestAfter: after.schemaDigest,
    webMigrationsBefore: before.journals.web.length,
    webMigrationsAfter: after.journals.web.length,
    adminMigrationsBefore: before.journals.admin.length,
    adminMigrationsAfter: after.journals.admin.length,
    addedTables: addedKeys(before.schema.tables, after.schema.tables, (item) => `${item.schema}.${item.name}`),
    removedTables: addedKeys(after.schema.tables, before.schema.tables, (item) => `${item.schema}.${item.name}`),
    addedColumns: addedKeys(before.schema.columns, after.schema.columns, (item) => `${item.schema}.${item.table}.${item.column}`),
    removedColumns: addedKeys(after.schema.columns, before.schema.columns, (item) => `${item.schema}.${item.table}.${item.column}`),
    addedIndexes: addedKeys(before.schema.indexes, after.schema.indexes, (item) => `${item.schema}.${item.name}`),
    removedIndexes: addedKeys(after.schema.indexes, before.schema.indexes, (item) => `${item.schema}.${item.name}`),
  }
}

function addedKeys(before, after, key) {
  const existing = new Set(before.map(key))
  return after.map(key).filter((value) => !existing.has(value))
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function safeError(error) {
  return {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error),
  }
}

async function writeReport(reportPath, report, exclusive = false) {
  await mkdir(path.dirname(reportPath), { recursive: true })
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: exclusive ? "wx" : "w" })
}

async function main() {
  const options = await resolveDatabaseUrl(parseArguments(process.argv.slice(2)))
  await runVerification(options)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
