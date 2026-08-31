import { mkdtemp, mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Pool } from "pg"
import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"

/**
 * Historical bootstrap order for a brand-new shared database.
 * Admin 0000 owns `clients`; web 0018 legitimately references it. Once that
 * prerequisite exists, ownership order remains web first, then admin.
 */
export async function migrateSharedTestDatabase(pool: Pool, adminRoot = path.resolve("."), webRoot = path.resolve("../web")) {
  const database = drizzle(pool)
  const clients = await pool.query("select to_regclass('public.clients') as relation")
  if (!clients.rows[0]?.relation) {
    await migratePrefix(database, adminRoot, 1, {})
    await migratePrefix(database, webRoot, 18, { migrationsTable: "__drizzle_web_migrations", migrationsSchema: "drizzle" })
    await migratePrefix(database, adminRoot, 51, {})
    await executeMigrationRange(pool, webRoot, 18)
  }
  await migrateAdminWithSharedSchemaCompatibility(database, adminRoot)
}

async function executeMigrationRange(pool: Pool, appRoot: string, start: number) {
  const journal = JSON.parse(await readFile(path.join(appRoot, "drizzle", "meta", "_journal.json"), "utf8"))
  for (const entry of journal.entries.slice(start)) {
    const sql = await readFile(path.join(appRoot, "drizzle", `${entry.tag}.sql`), "utf8")
    for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) await pool.query(statement)
  }
}

async function migrateAdminWithSharedSchemaCompatibility(database: ReturnType<typeof drizzle>, adminRoot: string) {
  const temporaryRoot = await copyMigrationFolder(adminRoot, "scalesmiths-admin-shared-")
  try {
    const duplicate = path.join(temporaryRoot, "0052_stiff_dazzler.sql")
    const sql = await readFile(duplicate, "utf8")
    await writeFile(duplicate, sql.replaceAll("ADD COLUMN \"", "ADD COLUMN IF NOT EXISTS \""))
    await migrate(database, { migrationsFolder: temporaryRoot })
  } finally { await rm(temporaryRoot, { recursive: true, force: true }) }
}

async function copyMigrationFolder(appRoot: string, prefix: string) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), prefix))
  const journal = JSON.parse(await readFile(path.join(appRoot, "drizzle", "meta", "_journal.json"), "utf8"))
  const metadata = path.join(temporaryRoot, "meta")
  await mkdir(metadata)
  await copyFile(path.join(appRoot, "drizzle", "meta", "_journal.json"), path.join(metadata, "_journal.json"))
  for (const entry of journal.entries) await copyFile(path.join(appRoot, "drizzle", `${entry.tag}.sql`), path.join(temporaryRoot, `${entry.tag}.sql`))
  return temporaryRoot
}

async function migratePrefix(database: ReturnType<typeof drizzle>, appRoot: string, count: number, options: { migrationsTable?: string; migrationsSchema?: string }) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "scalesmiths-admin-bootstrap-"))
  try {
    const metadata = path.join(temporaryRoot, "meta")
    await mkdir(metadata)
    const journal = JSON.parse(await readFile(path.join(appRoot, "drizzle", "meta", "_journal.json"), "utf8"))
    const entries = journal.entries.slice(0, count)
    for (const entry of entries) await copyFile(path.join(appRoot, "drizzle", `${entry.tag}.sql`), path.join(temporaryRoot, `${entry.tag}.sql`))
    await writeFile(path.join(metadata, "_journal.json"), JSON.stringify({ ...journal, entries }))
    await migrate(database, { migrationsFolder: temporaryRoot, ...options })
  } finally { await rm(temporaryRoot, { recursive: true, force: true }) }
}
