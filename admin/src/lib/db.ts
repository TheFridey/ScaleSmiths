import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import * as schema from "./schema"

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

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database access.")
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  })
}

function createUnavailableDb(): NodePgDatabase<typeof schema> {
  return new Proxy({}, {
    get() {
      throw new Error("DATABASE_URL is required for database access.")
    },
  }) as NodePgDatabase<typeof schema>
}

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL)
const pool = hasDatabaseUrl ? globalForDb.__scalesmithsPool ?? createPool() : undefined
export const db: NodePgDatabase<typeof schema> = hasDatabaseUrl
  ? globalForDb.__scalesmithsDb ?? drizzle(pool as Pool, { schema })
  : createUnavailableDb()

if (process.env.NODE_ENV !== "production" && pool) {
  globalForDb.__scalesmithsPool = pool
  globalForDb.__scalesmithsDb = db
}
