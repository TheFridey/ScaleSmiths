import type { Metadata } from "next"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { EditClientForm } from "@/components/EditClientForm"
import { db } from "@/lib/db"
import { clients } from "@/lib/schema"

export const metadata: Metadata = { title: "Edit client" }
export const dynamic = "force-dynamic"

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const id = Number(rawId)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const [client] = await db.select({
    id: clients.id,
    name: clients.name,
    contactName: clients.contactName,
    contactEmail: clients.contactEmail,
    tier: clients.tier,
    mrr: clients.mrr,
    status: clients.status,
    invoiceClientCode: clients.invoiceClientCode,
    portalClientId: clients.portalClientId,
  }).from(clients).where(eq(clients.id, id)).limit(1)

  if (!client) notFound()
  return <EditClientForm client={client} />
}
