import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "../../../../../../auth"
import { db } from "@/lib/db"
import {
  isClientRequestMessageVisibility,
  parseClientRequestMessageBody,
} from "@/lib/client-requests"
import { clientRequestMessages, clientRequests, clientTimelineEvents } from "@/lib/schema"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.name ?? session?.user?.email ?? "ScaleSmiths"
}

function appendInternalNote(existing: string | null, note: string, actor: string, now: Date) {
  const stamp = now.toISOString()
  const entry = `[${stamp}] ${actor}\n${note}`
  return existing?.trim() ? `${existing.trim()}\n\n${entry}` : entry
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const id = parseId(rawId)

  if (!id) {
    return NextResponse.json({ error: "Invalid client request id." }, { status: 400 })
  }

  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid message payload." }, { status: 400 })
  }

  const input = payload as Record<string, unknown>
  const visibility = isClientRequestMessageVisibility(input.visibility) ? input.visibility : null
  const parsedBody = parseClientRequestMessageBody(input.body)

  if (!visibility) {
    return NextResponse.json({ error: "Message visibility is invalid." }, { status: 400 })
  }

  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 })
  }

  const [existing] = await db.select().from(clientRequests).where(eq(clientRequests.id, id)).limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Client request not found." }, { status: 404 })
  }

  const now = new Date()
  const actor = sessionActor(session)
  const { message, timelineEvent } = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(clientRequestMessages)
      .values({
        requestId: existing.id,
        senderType: "admin",
        senderName: actor,
        body: parsedBody.data,
        visibility,
        createdAt: now,
      })
      .returning()

    await tx
      .update(clientRequests)
      .set({
        updatedAt: now,
        internalNotes: visibility === "internal"
          ? appendInternalNote(existing.internalNotes, parsedBody.data, actor, now)
          : existing.internalNotes,
      })
      .where(eq(clientRequests.id, existing.id))

    if (visibility !== "client_visible") {
      return { message: inserted[0], timelineEvent: null }
    }

    const [createdTimelineEvent] = await tx
      .insert(clientTimelineEvents)
      .values({
        clientId: existing.clientId,
        requestId: existing.id,
        type: "admin_reply",
        title: "ScaleSmiths replied",
        description: "A new reply has been added to this request thread.",
        visibility: "client_visible",
        createdBy: actor,
        createdAt: now,
      })
      .returning()

    return { message: inserted[0], timelineEvent: createdTimelineEvent }
  })

  const [requestRow] = await db.select().from(clientRequests).where(eq(clientRequests.id, existing.id)).limit(1)

  return NextResponse.json({ ok: true, message, timelineEvent, request: requestRow }, { status: 201 })
}
