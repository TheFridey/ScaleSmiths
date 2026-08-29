import type { Metadata } from "next"
import { asc, desc, inArray } from "drizzle-orm"
import { ClientRequestsQueue, type AdminClientRequestRow } from "@/components/ClientRequestsQueue"
import { db } from "@/lib/db"
import { clientRequestMessages, clientRequests, clientTimelineEvents } from "@/lib/schema"

export const metadata: Metadata = { title: "Client Requests" }
export const dynamic = "force-dynamic"

function serializeMessage(row: typeof clientRequestMessages.$inferSelect): AdminClientRequestRow["messages"][number] {
  return {
    id: row.id,
    requestId: row.requestId,
    senderType: row.senderType,
    senderName: row.senderName,
    body: row.body,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }
}

function serializeTimelineEvent(row: typeof clientTimelineEvents.$inferSelect): AdminClientRequestRow["timelineEvents"][number] {
  return {
    id: row.id,
    clientId: row.clientId,
    requestId: row.requestId,
    projectId: row.projectId,
    type: row.type,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  }
}

function serializeRequest(
  row: typeof clientRequests.$inferSelect,
  messages: AdminClientRequestRow["messages"],
  timelineEvents: AdminClientRequestRow["timelineEvents"],
): AdminClientRequestRow {
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
    adminLastReadAt: row.adminLastReadAt?.toISOString() ?? null,
    messages,
    timelineEvents,
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
    const ids = rows.map((row) => row.id)
    const messageRows = ids.length > 0
      ? await db
        .select()
        .from(clientRequestMessages)
        .where(inArray(clientRequestMessages.requestId, ids))
        .orderBy(asc(clientRequestMessages.createdAt), asc(clientRequestMessages.id))
      : []
    const timelineRows = ids.length > 0
      ? await db
        .select()
        .from(clientTimelineEvents)
        .where(inArray(clientTimelineEvents.requestId, ids))
        .orderBy(asc(clientTimelineEvents.createdAt), asc(clientTimelineEvents.id))
      : []
    const messagesByRequest = new Map<number, AdminClientRequestRow["messages"]>()
    const timelineByRequest = new Map<number, AdminClientRequestRow["timelineEvents"]>()

    for (const message of messageRows) {
      const messages = messagesByRequest.get(message.requestId) ?? []
      messages.push(serializeMessage(message))
      messagesByRequest.set(message.requestId, messages)
    }

    for (const timelineEvent of timelineRows) {
      if (!timelineEvent.requestId) continue
      const events = timelineByRequest.get(timelineEvent.requestId) ?? []
      events.push(serializeTimelineEvent(timelineEvent))
      timelineByRequest.set(timelineEvent.requestId, events)
    }

    return (
      <ClientRequestsQueue
        initialRequests={rows.map((row) => serializeRequest(
          row,
          messagesByRequest.get(row.id) ?? [],
          timelineByRequest.get(row.id) ?? [],
        ))}
        loadError={null}
        initialSelectedId={selectedRequestId}
      />
    )
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error."
    const loadError = `Unable to load client requests. Confirm the client_requests migration has been applied and DATABASE_URL points at the shared application database. ${detail}`

    return <ClientRequestsQueue initialRequests={[]} loadError={loadError} initialSelectedId={selectedRequestId} />
  }
}
