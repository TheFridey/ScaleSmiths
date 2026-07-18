import { Pool } from "pg"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import * as schema from "./schema"
import { resolveWebDatabaseUrl } from "./database-url"

const connectionString = resolveWebDatabaseUrl()
const pool = connectionString ? new Pool({ connectionString, allowExitOnIdle: true, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 }) : undefined

export const db: NodePgDatabase<typeof schema> = pool
  ? drizzle(pool, { schema })
  : new Proxy({}, { get() { throw new Error("WEB_DATABASE_URL is required for public web database access.") } }) as NodePgDatabase<typeof schema>
