import type { Metadata } from "next"
import { desc } from "drizzle-orm"
import { ClientRequestsQueue, type AdminClientRequestRow } from "@/components/ClientRequestsQueue"
import { db } from "@/lib/db"
import { clientRequests } from "@/lib/schema"

export const metadata: Metadata = { title: "Client Requests" }
export const dynamic = "force-dynamic"

function serializeRequest(row: typeof clientRequests.$inferSelect): AdminClientRequestRow {
  return {
    id: row.id,
    clientId: row.clientId,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    affectedUrl: row.affectedUrl,
    pageUrl: row.pageUrl,
    internalNotes: row.internalNotes,
    forgeSummary: row.forgeSummary,
    forgeSuggestedActions: row.forgeSuggestedActions,
    forgeSuggestedReply: row.forgeSuggestedReply,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  }
}

function parseSelectedRequestId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string | string[] }>
}) {
  const selectedRequestId = parseSelectedRequestId((await searchParams).request)

  try {
    const rows = await db.select().from(clientRequests).orderBy(desc(clientRequests.updatedAt), desc(clientRequests.createdAt))
    return <ClientRequestsQueue initialRequests={rows.map(serializeRequest)} loadError={null} initialSelectedId={selectedRequestId} />
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error."
    const loadError = `Unable to load client requests. Confirm the client_requests migration has been applied and DATABASE_URL points at the shared application database. ${detail}`

    return <ClientRequestsQueue initialRequests={[]} loadError={loadError} initialSelectedId={selectedRequestId} />
  }
}
