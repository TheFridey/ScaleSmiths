import "server-only"

import { desc } from "drizzle-orm"
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
