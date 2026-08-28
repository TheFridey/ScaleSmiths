import "server-only"

import { desc, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { clients } from "@/lib/schema"

export async function listDashboardClients() {
  return db.select({
    id: clients.id, name: clients.name, tier: clients.tier, mrr: clients.mrr,
    status: clients.status, progress: clients.progress, portalClientId: clients.portalClientId,
  }).from(clients).orderBy(desc(clients.createdAt))
}

export async function listClientDirectory() {
  return db.select({
    id: clients.id, name: clients.name, contactName: clients.contactName,
    contactEmail: clients.contactEmail, tier: clients.tier, mrr: clients.mrr,
    status: clients.status, progress: clients.progress,
  }).from(clients).orderBy(desc(clients.createdAt))
}

export async function getClientNamesByIds(clientIds: number[]) {
  const uniqueIds = [...new Set(clientIds)]
  if (uniqueIds.length === 0) return new Map<number, string>()
  const rows = await db.select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(inArray(clients.id, uniqueIds))
  return new Map(rows.map((client) => [client.id, client.name]))
}
