import { NextRequest, NextResponse } from "next/server"
import { and, asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  parseClientRequestMessageBody,
  serializeClientPortalMessage,
  serializeClientPortalRequest,
} from "@/lib/client-requests"
import { serializeClientPortalTimelineEvent } from "@/lib/client-timeline"
import { getClientSessionFromRequest, unauthorizedClientPortalResponse } from "@/lib/portal-session"
import { clientRequestMessages, clientRequests, clientTimelineEvents } from "@/lib/schema"

export const dynamic = "force-dynamic"

interface RequestDetailContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RequestDetailContext) {
  const session = await getClientSessionFromRequest(request)

  if (!session) {
    return unauthorizedClientPortalResponse(request)
  }

  const { id: rawId } = await params
  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 })
  }

  try {
    const [row] = await db
      .select({
        id: clientRequests.id,
        title: clientRequests.title,
        description: clientRequests.description,
        category: clientRequests.category,
        priority: clientRequests.priority,
        status: clientRequests.status,
        affectedUrl: clientRequests.affectedUrl,
        createdAt: clientRequests.createdAt,
        updatedAt: clientRequests.updatedAt,
      })
      .from(clientRequests)
      .where(and(
        eq(clientRequests.id, id),
        eq(clientRequests.clientId, session.clientId),
      ))
      .limit(1)

    if (!row) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 })
    }

    const messages = await db
      .select({
        id: clientRequestMessages.id,
        requestId: clientRequestMessages.requestId,
        senderType: clientRequestMessages.senderType,
        senderName: clientRequestMessages.senderName,
        body: clientRequestMessages.body,
        visibility: clientRequestMessages.visibility,
        createdAt: clientRequestMessages.createdAt,
        updatedAt: clientRequestMessages.updatedAt,
      })
      .from(clientRequestMessages)
      .where(and(
        eq(clientRequestMessages.requestId, row.id),
        eq(clientRequestMessages.visibility, "client_visible"),
      ))
      .orderBy(asc(clientRequestMessages.createdAt), asc(clientRequestMessages.id))

    const timeline = await db
      .select({
        id: clientTimelineEvents.id,
        clientId: clientTimelineEvents.clientId,
        requestId: clientTimelineEvents.requestId,
        projectId: clientTimelineEvents.projectId,
        type: clientTimelineEvents.type,
        title: clientTimelineEvents.title,
        description: clientTimelineEvents.description,
        visibility: clientTimelineEvents.visibility,
        createdBy: clientTimelineEvents.createdBy,
        createdAt: clientTimelineEvents.createdAt,
      })
      .from(clientTimelineEvents)
      .where(and(
        eq(clientTimelineEvents.requestId, row.id),
        eq(clientTimelineEvents.visibility, "client_visible"),
      ))
      .orderBy(asc(clientTimelineEvents.createdAt), asc(clientTimelineEvents.id))

    return NextResponse.json({
      ok: true,
      request: serializeClientPortalRequest(row),
      messages: messages.map(serializeClientPortalMessage).filter((message) => message !== null),
      timeline: timeline.map(serializeClientPortalTimelineEvent).filter((event) => event !== null),
    })
  } catch {
    return NextResponse.json({ error: "Unable to load request right now." }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RequestDetailContext) {
  const session = await getClientSessionFromRequest(request)

  if (!session) {
    return unauthorizedClientPortalResponse(request)
  }

  const { id: rawId } = await params
  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid message payload." }, { status: 400 })
  }

  const parsed = parseClientRequestMessageBody((body as Record<string, unknown>).body)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const [existing] = await db
      .select({ id: clientRequests.id })
      .from(clientRequests)
      .where(and(
        eq(clientRequests.id, id),
        eq(clientRequests.clientId, session.clientId),
      ))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 })
    }

    const now = new Date()
    const [message] = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(clientRequestMessages)
        .values({
          requestId: existing.id,
          senderType: "client",
          senderName: "Client",
          body: parsed.data,
          visibility: "client_visible",
          createdAt: now,
        })
        .returning({
          id: clientRequestMessages.id,
          requestId: clientRequestMessages.requestId,
          senderType: clientRequestMessages.senderType,
          senderName: clientRequestMessages.senderName,
          body: clientRequestMessages.body,
          visibility: clientRequestMessages.visibility,
          createdAt: clientRequestMessages.createdAt,
          updatedAt: clientRequestMessages.updatedAt,
        })

      await tx
        .update(clientRequests)
        .set({ updatedAt: now })
        .where(eq(clientRequests.id, existing.id))

      return inserted
    })

    return NextResponse.json({ ok: true, message: serializeClientPortalMessage(message) }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Unable to send message right now." }, { status: 500 })
  }
}
