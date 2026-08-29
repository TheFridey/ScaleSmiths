import "server-only"

import { and, asc, desc, eq, notInArray } from "drizzle-orm"
import { serializeClientPortalMessage, serializeClientPortalRequest, TERMINAL_REQUEST_STATUSES, type ClientRequestStatus } from "@/lib/client-requests"
import { serializeClientPortalTimelineEvent } from "@/lib/client-timeline"
import { db } from "@/lib/db"
import { clientRequestMessages, clientRequests, clientTimelineEvents } from "@/lib/schema"

export async function listRecentPortalThreadMessages(portalClientId: string, limit = 6) {
  const rows = await db.select({
    id: clientRequestMessages.id,
    requestId: clientRequestMessages.requestId,
    requestTitle: clientRequests.title,
    senderType: clientRequestMessages.senderType,
    senderName: clientRequestMessages.senderName,
    body: clientRequestMessages.body,
    createdAt: clientRequestMessages.createdAt,
  }).from(clientRequestMessages)
    .innerJoin(clientRequests, eq(clientRequestMessages.requestId, clientRequests.id))
    .where(and(eq(clientRequests.clientId, portalClientId), eq(clientRequestMessages.visibility, "client_visible")))
    .orderBy(desc(clientRequestMessages.createdAt))
    .limit(limit)
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}

export async function getPortalRequestThread(portalClientId: string, requestId: number) {
  const [requests, messages, timeline] = await Promise.all([
    db.select({
      id: clientRequests.id, title: clientRequests.title, description: clientRequests.description,
      category: clientRequests.category, priority: clientRequests.priority, status: clientRequests.status,
      affectedUrl: clientRequests.affectedUrl, createdAt: clientRequests.createdAt, updatedAt: clientRequests.updatedAt,
    }).from(clientRequests).where(and(eq(clientRequests.id, requestId), eq(clientRequests.clientId, portalClientId))).limit(1),
    db.select({
      id: clientRequestMessages.id, requestId: clientRequestMessages.requestId,
      senderType: clientRequestMessages.senderType, senderName: clientRequestMessages.senderName,
      body: clientRequestMessages.body, visibility: clientRequestMessages.visibility,
      createdAt: clientRequestMessages.createdAt, updatedAt: clientRequestMessages.updatedAt,
    }).from(clientRequestMessages)
      .innerJoin(clientRequests, eq(clientRequestMessages.requestId, clientRequests.id))
      .where(and(eq(clientRequests.id, requestId), eq(clientRequests.clientId, portalClientId), eq(clientRequestMessages.visibility, "client_visible")))
      .orderBy(asc(clientRequestMessages.createdAt), asc(clientRequestMessages.id)),
    db.select({
      id: clientTimelineEvents.id, clientId: clientTimelineEvents.clientId,
      requestId: clientTimelineEvents.requestId, projectId: clientTimelineEvents.projectId,
      type: clientTimelineEvents.type, title: clientTimelineEvents.title,
      description: clientTimelineEvents.description, visibility: clientTimelineEvents.visibility,
      createdBy: clientTimelineEvents.createdBy, createdAt: clientTimelineEvents.createdAt,
    }).from(clientTimelineEvents)
      .innerJoin(clientRequests, eq(clientTimelineEvents.requestId, clientRequests.id))
      .where(and(eq(clientRequests.id, requestId), eq(clientRequests.clientId, portalClientId), eq(clientTimelineEvents.visibility, "client_visible")))
      .orderBy(asc(clientTimelineEvents.createdAt), asc(clientTimelineEvents.id)),
  ])
  const request = requests[0]
  if (!request) return null
  return {
    request: serializeClientPortalRequest(request),
    messages: messages.map(serializeClientPortalMessage).filter((row) => row !== null),
    timeline: timeline.map(serializeClientPortalTimelineEvent).filter((row) => row !== null),
  }
}

export async function resolveGeneralMessageThreadId(portalClientId: string, now = new Date()): Promise<{ requestId: number; created: boolean }> {
  const [existing] = await db
    .select({ id: clientRequests.id })
    .from(clientRequests)
    .where(and(
      eq(clientRequests.clientId, portalClientId),
      eq(clientRequests.category, "general_support"),
      notInArray(clientRequests.status, TERMINAL_REQUEST_STATUSES),
    ))
    .orderBy(desc(clientRequests.createdAt))
    .limit(1)

  if (existing) return { requestId: existing.id, created: false }

  const requestId = await db.transaction(async (tx) => {
    const [requestRow] = await tx
      .insert(clientRequests)
      .values({
        clientId: portalClientId,
        title: "Portal messages",
        description: "Direct messages between this client and ScaleSmiths.",
        category: "general_support",
        priority: "medium",
        status: "new",
        updatedAt: now,
        createdAt: now,
      })
      .returning({ id: clientRequests.id })

    await tx.insert(clientTimelineEvents).values({
      clientId: portalClientId,
      requestId: requestRow.id,
      type: "messages_thread_opened",
      title: "Message thread started",
      description: "A new message thread was started in the ScaleSmiths portal.",
      visibility: "client_visible",
      createdBy: "Client",
      createdAt: now,
    })

    return requestRow.id
  })

  return { requestId, created: true }
}

export async function appendClientMessage(portalClientId: string, requestId: number, body: string, now = new Date()) {
  const [existing] = await db
    .select({ id: clientRequests.id, title: clientRequests.title })
    .from(clientRequests)
    .where(and(eq(clientRequests.id, requestId), eq(clientRequests.clientId, portalClientId)))
    .limit(1)

  if (!existing) return null

  const [inserted] = await db.transaction(async (tx) => {
    const message = await tx
      .insert(clientRequestMessages)
      .values({
        requestId: existing.id,
        senderType: "client",
        senderName: "Client",
        body,
        visibility: "client_visible",
        createdAt: now,
      })
      .returning()

    await tx.update(clientRequests).set({ updatedAt: now }).where(eq(clientRequests.id, existing.id))

    return message
  })

  const serialized = serializeClientPortalMessage(inserted)
  if (!serialized) return null

  return { message: serialized, requestTitle: existing.title }
}

export async function getPortalGeneralMessageThread(portalClientId: string) {
  const [existing] = await db
    .select({ id: clientRequests.id })
    .from(clientRequests)
    .where(and(
      eq(clientRequests.clientId, portalClientId),
      eq(clientRequests.category, "general_support"),
      notInArray(clientRequests.status, TERMINAL_REQUEST_STATUSES),
    ))
    .orderBy(desc(clientRequests.createdAt))
    .limit(1)

  if (!existing) return null

  const thread = await getPortalRequestThread(portalClientId, existing.id)
  if (!thread) return null

  await db.update(clientRequests)
    .set({ clientLastReadAt: new Date() })
    .where(and(eq(clientRequests.id, existing.id), eq(clientRequests.clientId, portalClientId)))

  return { request: thread.request, messages: thread.messages }
}
