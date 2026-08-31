import { readFile } from "node:fs/promises"
import path from "node:path"
import pg from "pg"

const url = process.env.MIGRATION_DATABASE_URL ?? process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL
if (!url || !/(?:test|e2e)/i.test(new URL(url).pathname)) throw new Error("Refusing to migrate a database whose name is not an explicit test/E2E fixture.")
const pool = new pg.Pool({ connectionString: url })

async function journal(root) { return JSON.parse(await readFile(path.join(root, "drizzle", "meta", "_journal.json"), "utf8")) }
async function apply(root, entries, compatibility = false) {
  for (const entry of entries) {
    let sql = await readFile(path.join(root, "drizzle", `${entry.tag}.sql`), "utf8")
    if (compatibility && entry.tag === "0052_stiff_dazzler") sql = sql.replaceAll("ADD COLUMN \"", "ADD COLUMN IF NOT EXISTS \"")
    const client = await pool.connect()
    try {
      await client.query("begin")
      for (const statement of sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean)) await client.query(statement)
      await client.query("commit")
    } catch (error) { await client.query("rollback"); throw error } finally { client.release() }
  }
}

try {
  const adminRoot = path.resolve("."), webRoot = path.resolve("../web")
  const admin = (await journal(adminRoot)).entries, web = (await journal(webRoot)).entries
  await apply(adminRoot, admin.slice(0, 1))
  await apply(webRoot, web.slice(0, 18))
  await apply(adminRoot, admin.slice(1, 51))
  await apply(webRoot, web.slice(18))
  await apply(adminRoot, admin.slice(51), true)
} finally { await pool.end() }
