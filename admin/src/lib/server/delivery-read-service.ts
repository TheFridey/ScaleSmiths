import "server-only"

import { desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { clientRequestMessages, clientRequests, clientTimelineEvents } from "@/lib/schema"

export async function getDeliveryDashboardSnapshot() {
  const [requests, replies, timeline, notificationFailures] = await Promise.all([
    db.select({ id: clientRequests.id, clientId: clientRequests.clientId, title: clientRequests.title,
      priority: clientRequests.priority, status: clientRequests.status, updatedAt: clientRequests.updatedAt })
      .from(clientRequests).orderBy(desc(clientRequests.updatedAt)),
    db.select({ id: clientRequestMessages.id, requestId: clientRequestMessages.requestId,
      senderName: clientRequestMessages.senderName, body: clientRequestMessages.body,
      createdAt: clientRequestMessages.createdAt, requestTitle: clientRequests.title,
      clientId: clientRequests.clientId, requestStatus: clientRequests.status })
      .from(clientRequestMessages).innerJoin(clientRequests, eq(clientRequestMessages.requestId, clientRequests.id))
      .where(eq(clientRequestMessages.senderType, "client")).orderBy(desc(clientRequestMessages.createdAt)).limit(8),
    db.select({ id: clientTimelineEvents.id, clientId: clientTimelineEvents.clientId,
      title: clientTimelineEvents.title, description: clientTimelineEvents.description,
      visibility: clientTimelineEvents.visibility, createdAt: clientTimelineEvents.createdAt })
      .from(clientTimelineEvents).orderBy(desc(clientTimelineEvents.createdAt)).limit(8),
    db.select({ id: clientRequests.id }).from(clientRequests)
      .where(eq(clientRequests.notificationEmailStatus, "failed")).limit(50),
  ])
  return {
    unreadClientReplies: replies.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    criticalRequests: requests.filter((row) => row.priority === "critical" && row.status !== "completed" && row.status !== "cancelled")
      .slice(0, 6).map(serializeRequest),
    waitingClientRequests: requests.filter((row) => row.status === "waiting_client").slice(0, 6).map(serializeRequest),
    recentTimeline: timeline.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    failedRequestNotifications: notificationFailures.length,
  }
}

function serializeRequest<T extends { updatedAt: Date }>(request: T) {
  return { ...request, updatedAt: request.updatedAt.toISOString() }
}
