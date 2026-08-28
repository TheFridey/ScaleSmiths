import type { Metadata } from "next"
import { ClientsTable } from "@/components/Clients"
import { listClientDirectory } from "@/lib/server/client-read-service"
import { listClientSalesProposals } from "@/lib/server/sales-read-service"

export const metadata: Metadata = { title: "Clients" }
export const dynamic = "force-dynamic"

export default async function ClientsPage() {
  const [rows, proposalRows] = await Promise.all([
    listClientDirectory(),
    listClientSalesProposals(),
  ])

  return <ClientsTable clients={rows} salesProposals={proposalRows} />
}
