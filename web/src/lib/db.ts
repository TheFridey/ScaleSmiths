import { Pool } from "pg"
import { eq, sql, type ExtractTablesWithRelations } from "drizzle-orm"
import { drizzle, type NodePgDatabase, type NodePgTransaction } from "drizzle-orm/node-postgres"
import * as schema from "./schema"
import { resolveWebDatabaseUrl } from "./database-url"

const connectionString = resolveWebDatabaseUrl()
const pool = connectionString ? new Pool({ connectionString, allowExitOnIdle: true, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 }) : undefined

export const db: NodePgDatabase<typeof schema> = pool
  ? drizzle(pool, { schema })
  : new Proxy({}, { get() { throw new Error("WEB_DATABASE_URL is required for public web database access.") } }) as NodePgDatabase<typeof schema>

export type WebDatabaseTransaction = NodePgTransaction<typeof schema, ExtractTablesWithRelations<typeof schema>>

export async function withPortalTenant<T>(
  portalClientId: string,
  operation: (tx: WebDatabaseTransaction, tenant: { clientRecordId: number; portalClientId: string }) => Promise<T>,
) {
  if (typeof portalClientId !== "string" || !portalClientId.trim()) {
    throw new Error("A portal client id is required.")
  }
  return db.transaction(async (tx) => {
    const [client] = await tx
      .select({ id: schema.invoicePortalClients.id })
      .from(schema.invoicePortalClients)
      .where(eq(schema.invoicePortalClients.portalClientId, portalClientId))
      .limit(1)
    if (!client) throw new Error("Portal tenant mapping is missing.")
    await tx.execute(sql`select set_config('app.access_mode', 'tenant', true)`)
    await tx.execute(sql`select set_config('app.current_client_id', ${String(client.id)}, true)`)
    return operation(tx, { clientRecordId: client.id, portalClientId })
  })
}
