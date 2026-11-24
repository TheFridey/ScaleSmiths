import type { Pool } from "pg"

/**
 * Keep a database interruption from terminating the admin process.
 *
 * node-postgres emits "error" on the pool for an idle client, and on the client itself for a client that is checked
 * out (pg-pool removes its idle listener while a client is in use). An "error" event with no listener is an uncaught
 * exception, so a database restart, failover or terminated backend during a transaction would otherwise crash the
 * whole admin app (and every in-flight request with it). The failing query still rejects normally, and pg marks the
 * client non-queryable so the pool discards it on release. Only an error code is logged, never connection details.
 */
export function attachPoolErrorHandlers(pool: Pool, log: (message: string, detail: { code: string }) => void = console.error) {
  const report = (scope: string) => (error: Error & { code?: string }) => log(`Admin database ${scope} client error`, { code: error.code ?? "connection_lost" })
  pool.on("error", report("idle"))
  pool.on("connect", (client) => { client.on("error", report("active")) })
  return pool
}
