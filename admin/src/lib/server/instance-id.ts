import "server-only"
import { hostname } from "node:os"
import { randomUUID } from "node:crypto"

// A stable identifier for this admin process. Used as the durable "owner" for
// resources this instance holds (currently previews) so restarts and other
// replicas can tell whose live handles are whose and reconcile the rest.
const globalForInstance = globalThis as unknown as { __adminInstanceId?: string }

export function getAdminInstanceId(): string {
  if (!globalForInstance.__adminInstanceId) {
    globalForInstance.__adminInstanceId = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`
  }
  return globalForInstance.__adminInstanceId
}
