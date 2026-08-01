import "server-only"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db"

const E2E_ENVIRONMENT = "forge-v2-e2e"
const E2E_MARKER = "scalesmiths-forge-v2-admin-isolated-test-v1"

export function isForgeE2EManualWorkerRequest(environment: Record<string, string | undefined>): boolean {
  if (environment.FORGE_E2E_MANUAL_WORKER !== "enabled") return false
  if (environment.SCALESMITHS_TEST_ENVIRONMENT !== E2E_ENVIRONMENT) return false
  const databaseUrl = environment.ADMIN_DATABASE_URL ?? environment.DATABASE_URL ?? ""
  const databaseName = (() => {
    try { return new URL(databaseUrl).pathname.replace(/^\//, "") }
    catch { return "" }
  })()
  return /(?:e2e|test|isolated)/i.test(databaseName) && !/prod/i.test(databaseName)
}

export async function isForgeE2EManualWorkerMode(): Promise<boolean> {
  if (process.env.FORGE_E2E_MANUAL_WORKER !== "enabled") return false
  if (!isForgeE2EManualWorkerRequest(process.env)) {
    throw new Error("Forge manual worker mode requires the Forge E2E environment and an isolated test database name.")
  }
  const marker = await db.execute<{ marker: string }>(sql`
    select marker from scalesmiths_test_environment where marker = ${E2E_MARKER}
  `)
  if (marker.rows.length !== 1) {
    throw new Error("Forge manual worker mode requires the isolated admin test database marker.")
  }
  return true
}
