import type { Metadata } from "next"
import { desc } from "drizzle-orm"
import { ClientsTable } from "@/components/Clients"
import { db } from "@/lib/db"
import { clients } from "@/lib/schema"

export const metadata: Metadata = { title: "Clients" }
export const dynamic = "force-dynamic"

export default async function ClientsPage() {
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      contactName: clients.contactName,
      tier: clients.tier,
      mrr: clients.mrr,
      status: clients.status,
      progress: clients.progress,
    })
    .from(clients)
    .orderBy(desc(clients.createdAt))

  return <ClientsTable clients={rows} />
}
