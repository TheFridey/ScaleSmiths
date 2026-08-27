import type { Metadata } from "next"
import { desc } from "drizzle-orm"
import { ClientsTable } from "@/components/Clients"
import { db } from "@/lib/db"
import { clients, salesProposals } from "@/lib/schema"

export const metadata: Metadata = { title: "Clients" }
export const dynamic = "force-dynamic"

export default async function ClientsPage() {
  const [rows, proposalRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        contactName: clients.contactName,
        contactEmail: clients.contactEmail,
        tier: clients.tier,
        mrr: clients.mrr,
        status: clients.status,
        progress: clients.progress,
      })
      .from(clients)
      .orderBy(desc(clients.createdAt)),
    db.select().from(salesProposals).orderBy(desc(salesProposals.updatedAt)),
  ])

  return <ClientsTable clients={rows} salesProposals={proposalRows} />
}
