import type { Metadata } from "next"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { ClientOffboardingManager } from "@/components/ClientOffboardingManager"
import { db } from "@/lib/db"
import { clients } from "@/lib/schema"
import { guardPageCapability } from "@/lib/server/rbac"

export const metadata: Metadata = { title: "Client offboarding" }
export const dynamic = "force-dynamic"

export default async function ClientOffboardingPage({ params }: { params: Promise<{ id: string }> }) {
  await guardPageCapability("clients.write")
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  const [client] = await db.select({ id: clients.id, name: clients.name, status: clients.status }).from(clients).where(eq(clients.id, id)).limit(1)
  if (!client) notFound()
  return <ClientOffboardingManager client={client} />
}
