import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "../../../../../auth"
import { db } from "@/lib/db"
import { clientRequests, clientTimelineEvents } from "@/lib/schema"
import {
  isClientRequestCategory,
  isClientRequestPriority,
  isClientRequestStatus,
  optionalTrimmedString,
} from "@/lib/client-requests"
import { timelineEventForRequestStatus } from "@/lib/client-timeline"
import {
  formatClientRequestTriageChecklist,
  formatClientRequestTriageSummary,
} from "@/lib/client-request-triage"
import { generateClientRequestTriage } from "@/lib/server/client-request-triage"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

function appendInternalNote(existing: string | null, note: string, actor: string, now: Date) {
  const stamp = now.toISOString()
  const entry = `[${stamp}] ${actor}\n${note}`
  return existing?.trim() ? `${existing.trim()}\n\n${entry}` : entry
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const id = parseId(rawId)

  if (!id) {
    return NextResponse.json({ error: "Invalid client request id." }, { status: 400 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid client request payload." }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const action = typeof input.action === "string" ? input.action : "update"
  const [existing] = await db.select().from(clientRequests).where(eq(clientRequests.id, id)).limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Client request not found." }, { status: 404 })
  }

  const now = new Date()

  if (action === "markRead") {
    const [updatedRequest] = await db
      .update(clientRequests)
      .set({ adminLastReadAt: now })
      .where(eq(clientRequests.id, id))
      .returning()

    return NextResponse.json({ ok: true, request: updatedRequest, timelineEvent: null })
  }

  const updates: Partial<typeof clientRequests.$inferInsert> = { updatedAt: now }
  const internalNote = optionalTrimmedString(input.internalNote)

  if (action === "regenerateTriage") {
    const triage = await generateClientRequestTriage({
      title: existing.title,
      description: existing.description,
      category: existing.category,
      priority: existing.priority,
      affectedUrl: existing.affectedUrl ?? existing.pageUrl,
      clientContext: existing.clientId,
    })
    const sourceNote = triage.source === "ai"
      ? "\n\nSource: Forge AI triage."
      : `\n\nSource: deterministic Forge fallback.${triage.error ? ` ${triage.error}` : ""}`

    updates.forgeSummary = `${formatClientRequestTriageSummary(triage.result)}${sourceNote}`
    updates.forgeSuggestedActions = formatClientRequestTriageChecklist(triage.result)
    updates.forgeSuggestedReply = triage.result.suggestedClientReply
  } else if (action === "markCompleted") {
    updates.status = "completed"
    updates.completedAt = now
  } else if (action === "reopen") {
    updates.status = "in_progress"
    updates.completedAt = null
  } else if (action !== "update") {
    return NextResponse.json({ error: "Unsupported client request action." }, { status: 400 })
  }

  if (input.status !== undefined) {
    if (!isClientRequestStatus(input.status)) {
      return NextResponse.json({ error: "Unsupported client request status." }, { status: 400 })
    }

    updates.status = input.status
    updates.completedAt = input.status === "completed" ? existing.completedAt ?? now : null
  }

  if (input.priority !== undefined) {
    if (!isClientRequestPriority(input.priority)) {
      return NextResponse.json({ error: "Unsupported client request priority." }, { status: 400 })
    }

    updates.priority = input.priority
  }

  if (input.category !== undefined) {
    if (!isClientRequestCategory(input.category)) {
      return NextResponse.json({ error: "Unsupported client request category." }, { status: 400 })
    }

    updates.category = input.category
  }

  if (internalNote) {
    updates.internalNotes = appendInternalNote(existing.internalNotes, internalNote, sessionActor(session), now)
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "No client request updates supplied." }, { status: 400 })
  }

  const statusEvent = updates.status && updates.status !== existing.status
    ? timelineEventForRequestStatus(updates.status)
    : null

  const { requestRow, timelineEvent } = await db.transaction(async (tx) => {
    const [updatedRequest] = await tx
      .update(clientRequests)
      .set(updates)
      .where(eq(clientRequests.id, id))
      .returning()

    if (!statusEvent) {
      return { requestRow: updatedRequest, timelineEvent: null }
    }

    const [createdTimelineEvent] = await tx
      .insert(clientTimelineEvents)
      .values({
        clientId: existing.clientId,
        requestId: existing.id,
        type: statusEvent.type,
        title: statusEvent.title,
        description: statusEvent.description,
        visibility: "client_visible",
        createdBy: sessionActor(session),
        createdAt: now,
      })
      .returning()

    return { requestRow: updatedRequest, timelineEvent: createdTimelineEvent }
  })

  return NextResponse.json({ ok: true, request: requestRow, timelineEvent })
}
