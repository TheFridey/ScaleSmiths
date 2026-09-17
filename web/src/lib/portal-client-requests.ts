import "server-only"

import { and, asc, desc, eq, inArray, notInArray, sql } from "drizzle-orm"
import { serializeClientPortalMessage, serializeClientPortalRequest, TERMINAL_REQUEST_STATUSES } from "@/lib/client-requests"
import { serializeClientPortalTimelineEvent } from "@/lib/client-timeline"
import { withPortalTenant } from "@/lib/db"
import {
  collapsePortalMessageInbox,
  PORTAL_MESSAGE_INBOX_LIMIT,
  type PortalMessageInboxRow,
} from "@/lib/portal-message-inbox"
import { clientRequestMessages, clientRequests, clientTimelineEvents } from "@/lib/schema"

export async function listRecentPortalThreadMessages(portalClientId: string, limit = 6) {
  const rows = await withPortalTenant(portalClientId, async (tx) => tx.select({
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
    .limit(limit))
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}

export async function listPortalMessageThreads(portalClientId: string, limit = PORTAL_MESSAGE_INBOX_LIMIT) {
  return withPortalTenant(portalClientId, async (tx) => {
    const latest = await tx
      .select({
        requestId: clientRequestMessages.requestId,
        lastId: sql<number>`max(${clientRequestMessages.id})`.as("last_id"),
      })
      .from(clientRequestMessages)
      .innerJoin(clientRequests, eq(clientRequestMessages.requestId, clientRequests.id))
      .where(and(eq(clientRequests.clientId, portalClientId), eq(clientRequestMessages.visibility, "client_visible")))
      .groupBy(clientRequestMessages.requestId)
      .orderBy(desc(sql`max(${clientRequestMessages.createdAt})`), desc(sql`max(${clientRequestMessages.id})`))
      .limit(limit + 1)

    const lastIds = latest.map((row) => Number(row.lastId)).filter((id) => Number.isInteger(id) && id > 0)
    if (lastIds.length === 0) return collapsePortalMessageInbox([], limit)

    const rows = await tx
      .select({
        requestId: clientRequests.id,
        title: clientRequests.title,
        category: clientRequests.category,
        status: clientRequests.status,
        clientLastReadAt: clientRequests.clientLastReadAt,
        messageId: clientRequestMessages.id,
        senderType: clientRequestMessages.senderType,
        senderName: clientRequestMessages.senderName,
        body: clientRequestMessages.body,
        createdAt: clientRequestMessages.createdAt,
      })
      .from(clientRequestMessages)
      .innerJoin(clientRequests, eq(clientRequestMessages.requestId, clientRequests.id))
      .where(and(
        eq(clientRequests.clientId, portalClientId),
        eq(clientRequestMessages.visibility, "client_visible"),
        inArray(clientRequestMessages.id, lastIds),
      ))

    const byId = new Map(rows.map((row) => [row.messageId, row]))
    const ordered: PortalMessageInboxRow[] = []
    for (const item of latest) {
      const row = byId.get(Number(item.lastId))
      if (row) ordered.push(row)
    }

    return collapsePortalMessageInbox(ordered, limit)
  })
}

export async function markPortalRequestRead(portalClientId: string, requestId: number, now = new Date()) {
  await withPortalTenant(portalClientId, async (tx) => {
    await tx.update(clientRequests)
      .set({ clientLastReadAt: now })
      .where(and(eq(clientRequests.id, requestId), eq(clientRequests.clientId, portalClientId)))
  })
}

export async function findPortalGeneralMessageThreadId(portalClientId: string) {
  const [existing] = await withPortalTenant(portalClientId, async (tx) => tx
    .select({ id: clientRequests.id })
    .from(clientRequests)
    .where(and(
      eq(clientRequests.clientId, portalClientId),
      eq(clientRequests.category, "general_support"),
      eq(clientRequests.title, "Portal messages"),
      notInArray(clientRequests.status, TERMINAL_REQUEST_STATUSES),
    ))
    .orderBy(desc(clientRequests.createdAt))
    .limit(1))

  return existing?.id ?? null
}

export async function getPortalRequestThread(portalClientId: string, requestId: number) {
  return withPortalTenant(portalClientId, async (tx) => {
    const requests = await tx.select({
      id: clientRequests.id, title: clientRequests.title, description: clientRequests.description,
      category: clientRequests.category, priority: clientRequests.priority, status: clientRequests.status,
      affectedUrl: clientRequests.affectedUrl, createdAt: clientRequests.createdAt, updatedAt: clientRequests.updatedAt,
      clientLastReadAt: clientRequests.clientLastReadAt,
    }).from(clientRequests).where(and(eq(clientRequests.id, requestId), eq(clientRequests.clientId, portalClientId))).limit(1)
    const messages = await tx.select({
      id: clientRequestMessages.id, requestId: clientRequestMessages.requestId,
      senderType: clientRequestMessages.senderType, senderName: clientRequestMessages.senderName,
      body: clientRequestMessages.body, visibility: clientRequestMessages.visibility,
      createdAt: clientRequestMessages.createdAt, updatedAt: clientRequestMessages.updatedAt,
    }).from(clientRequestMessages)
      .innerJoin(clientRequests, eq(clientRequestMessages.requestId, clientRequests.id))
      .where(and(eq(clientRequests.id, requestId), eq(clientRequests.clientId, portalClientId), eq(clientRequestMessages.visibility, "client_visible")))
      .orderBy(asc(clientRequestMessages.createdAt), asc(clientRequestMessages.id))
    const timeline = await tx.select({
      id: clientTimelineEvents.id, clientId: clientTimelineEvents.clientId,
      requestId: clientTimelineEvents.requestId, projectId: clientTimelineEvents.projectId,
      type: clientTimelineEvents.type, title: clientTimelineEvents.title,
      description: clientTimelineEvents.description, visibility: clientTimelineEvents.visibility,
      createdBy: clientTimelineEvents.createdBy, sourceDomain: clientTimelineEvents.sourceDomain,
      actorLabel: clientTimelineEvents.actorLabel, occurredAt: clientTimelineEvents.occurredAt, createdAt: clientTimelineEvents.createdAt,
    }).from(clientTimelineEvents)
      .innerJoin(clientRequests, eq(clientTimelineEvents.requestId, clientRequests.id))
      .where(and(eq(clientRequests.id, requestId), eq(clientRequests.clientId, portalClientId), eq(clientTimelineEvents.visibility, "client_visible")))
      .orderBy(asc(clientTimelineEvents.occurredAt), asc(clientTimelineEvents.id))
    const request = requests[0]
    if (!request) return null
    return {
      request: serializeClientPortalRequest(request),
      messages: messages.map(serializeClientPortalMessage).filter((row) => row !== null),
      timeline: timeline.map(serializeClientPortalTimelineEvent).filter((row) => row !== null),
    }
  })
}

export async function resolveGeneralMessageThreadId(portalClientId: string, now = new Date()): Promise<{ requestId: number; created: boolean }> {
  return withPortalTenant(portalClientId, async (tx, tenant) => {
    const [existing] = await tx
      .select({ id: clientRequests.id })
      .from(clientRequests)
      .where(and(
        eq(clientRequests.clientId, portalClientId),
        eq(clientRequests.category, "general_support"),
        eq(clientRequests.title, "Portal messages"),
        notInArray(clientRequests.status, TERMINAL_REQUEST_STATUSES),
      ))
      .orderBy(desc(clientRequests.createdAt))
      .limit(1)

    if (existing) return { requestId: existing.id, created: false }

    const [requestRow] = await tx
      .insert(clientRequests)
      .values({
        clientId: portalClientId,
        clientRecordId: tenant.clientRecordId,
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
      clientRecordId: tenant.clientRecordId,
      requestId: requestRow.id,
      type: "messages_thread_opened",
      title: "Message thread started",
      description: "A new message thread was started in the ScaleSmiths portal.",
      visibility: "client_visible",
      createdBy: "Client",
      createdAt: now,
    })

    return { requestId: requestRow.id, created: true }
  })
}

export async function appendClientMessage(portalClientId: string, requestId: number, body: string, now = new Date()) {
  return withPortalTenant(portalClientId, async (tx) => {
    const [existing] = await tx
      .select({ id: clientRequests.id, title: clientRequests.title })
      .from(clientRequests)
      .where(and(eq(clientRequests.id, requestId), eq(clientRequests.clientId, portalClientId)))
      .limit(1)

    if (!existing) return null

    const [inserted] = await tx
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

    const serialized = serializeClientPortalMessage(inserted)
    if (!serialized) return null

    return { message: serialized, requestTitle: existing.title }
  })
}

export async function getPortalGeneralMessageThread(portalClientId: string) {
  const existingId = await findPortalGeneralMessageThreadId(portalClientId)
  if (!existingId) return null

  const thread = await getPortalRequestThread(portalClientId, existingId)
  if (!thread) return null

  return { request: thread.request, messages: thread.messages }
}
