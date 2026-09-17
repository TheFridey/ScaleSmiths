import { Pool } from "pg"
import { sql, type ExtractTablesWithRelations } from "drizzle-orm"
import { drizzle, type NodePgDatabase, type NodePgTransaction } from "drizzle-orm/node-postgres"
import * as schema from "./schema"
import { resolveAdminDatabaseUrl } from "./database-url"

/*
 * A single shared pg Pool + Drizzle instance.
 *
 * Pool lifecycle notes (important for `next build`):
 * - `allowExitOnIdle: true` lets the Node process exit once every pooled client is idle.
 *   Without it, an idle connection opened during "Collecting page data" keeps the build
 *   worker alive and the build never exits.
 * - `connectionTimeoutMillis` makes a connection attempt fail fast instead of blocking for the
 *   OS-level TCP timeout (~2 minutes) when the database is unreachable during build.
 * - The instance is cached on globalThis so dev hot-reload reuses one pool instead of leaking
 *   a new pool on every module reload.
 */

const globalForDb = globalThis as unknown as {
  __scalesmithsPool?: Pool
  __scalesmithsDb?: NodePgDatabase<typeof schema>
}

export const TENANT_ACCESS_MODE = {
  tenant: "tenant",
  internalAggregate: "internal_aggregate",
  internalWrite: "internal_write",
} as const

function createPool() {
  const connectionString = resolveAdminDatabaseUrl()
  if (!connectionString) {
    throw new Error("ADMIN_DATABASE_URL is required for admin database access.")
  }

  return new Pool({
    connectionString,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    // Session default for the admin modular monolith: explicit internal write
    // mode, not BYPASSRLS. Tenant-scoped helpers override this transaction-locally.
    options: `-c app.access_mode=${TENANT_ACCESS_MODE.internalWrite}`,
  })
}

function createUnavailableDb(): NodePgDatabase<typeof schema> {
  return new Proxy({}, {
    get() {
      throw new Error("ADMIN_DATABASE_URL is required for admin database access.")
    },
  }) as NodePgDatabase<typeof schema>
}

const hasDatabaseUrl = Boolean(resolveAdminDatabaseUrl())
const pool = hasDatabaseUrl ? globalForDb.__scalesmithsPool ?? createPool() : undefined
export const db: NodePgDatabase<typeof schema> = hasDatabaseUrl
  ? globalForDb.__scalesmithsDb ?? drizzle(pool as Pool, { schema })
  : createUnavailableDb()

export type AdminDatabaseTransaction = NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>

export async function withClientTenant<T>(clientId: number, operation: (tx: AdminDatabaseTransaction) => Promise<T>) {
  if (!Number.isInteger(clientId) || clientId <= 0) throw new Error("A positive client tenant id is required.")
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.access_mode', ${TENANT_ACCESS_MODE.tenant}, true)`)
    await tx.execute(sql`select set_config('app.current_client_id', ${String(clientId)}, true)`)
    return operation(tx)
  })
}

export async function withInternalAggregate<T>(operation: (tx: AdminDatabaseTransaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.access_mode', ${TENANT_ACCESS_MODE.internalAggregate}, true)`)
    await tx.execute(sql`select set_config('app.current_client_id', '', true)`)
    return operation(tx)
  })
}

export async function withInternalWrite<T>(operation: (tx: AdminDatabaseTransaction) => Promise<T>) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.access_mode', ${TENANT_ACCESS_MODE.internalWrite}, true)`)
    return operation(tx)
  })
}

if (process.env.NODE_ENV !== "production" && pool) {
  globalForDb.__scalesmithsPool = pool
  globalForDb.__scalesmithsDb = db
}
