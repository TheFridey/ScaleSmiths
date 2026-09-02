import path from "node:path"
import type { Pool } from "pg"

/**
 * Historical bootstrap order for a brand-new shared database.
 * Admin 0000 owns `clients`; web 0018 legitimately references it. Once that
 * prerequisite exists, ownership order remains web first, then admin.
 */
export async function migrateSharedTestDatabase(pool: Pool, adminRoot = path.resolve("."), options: { lockTimeoutMs?: number } = {}) {
  // The production orchestrator is deliberately used by integration tests too.
  const migrationModule = await import("../../../scripts/shared-migrator.mjs")
  const migrateSharedDatabase = migrationModule.migrateSharedDatabase as (input: { pool: Pool; root: string; lockTimeoutMs?: number }) => Promise<unknown>
  await migrateSharedDatabase({ pool, root: path.resolve(adminRoot, ".."), ...options })
}
