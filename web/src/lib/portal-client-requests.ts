import "server-only"

import { and, asc, desc, eq } from "drizzle-orm"
import { serializeClientPortalMessage, serializeClientPortalRequest } from "@/lib/client-requests"
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
