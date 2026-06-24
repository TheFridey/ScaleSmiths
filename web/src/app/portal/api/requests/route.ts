import { NextRequest, NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { parseClientRequestPayload, serializeClientPortalRequest } from "@/lib/client-requests"
import { serializeClientPortalTimelineEvent } from "@/lib/client-timeline"
import {
  createFallbackClientRequestTriage,
  formatClientRequestTriageChecklist,
  formatClientRequestTriageSummary,
} from "@/lib/client-request-triage"
import { getClientSessionFromRequest, unauthorizedClientPortalResponse } from "@/lib/portal-session"
import {
  deriveClientDisplayName,
  isCriticalClientRequest,
  sendClientRequestNotifications,
} from "@/lib/request-notifications"
import { clientRequestMessages, clientRequests, clientTimelineEvents, portalClientAccounts } from "@/lib/schema"

export const dynamic = "force-dynamic"

async function findClientNotificationEmail(clientId: string) {
  try {
    const [account] = await db
      .select({ email: portalClientAccounts.email })
      .from(portalClientAccounts)
      .where(and(
        eq(portalClientAccounts.clientId, clientId),
        eq(portalClientAccounts.active, true),
      ))
      .limit(1)

    return account?.email ?? null
  } catch {
    console.warn("[request-notifications] client email lookup failed. Request creation was not blocked.")
    return null
  }
}

export async function GET(request: NextRequest) {
  const session = await getClientSessionFromRequest(request)

  if (!session) {
    return unauthorizedClientPortalResponse(request)
  }

  try {
    const rows = await db
      .select({
        id: clientRequests.id,
        title: clientRequests.title,
        category: clientRequests.category,
        priority: clientRequests.priority,
        status: clientRequests.status,
        description: clientRequests.description,
        affectedUrl: clientRequests.affectedUrl,
        createdAt: clientRequests.createdAt,
        updatedAt: clientRequests.updatedAt,
      })
      .from(clientRequests)
      .where(eq(clientRequests.clientId, session.clientId))
      .orderBy(desc(clientRequests.updatedAt), desc(clientRequests.createdAt))

    return NextResponse.json({ ok: true, requests: rows.map(serializeClientPortalRequest) })
  } catch {
    return NextResponse.json({ error: "Unable to load requests right now." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getClientSessionFromRequest(request)

  if (!session) {
    return unauthorizedClientPortalResponse(request)
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const parsed = parseClientRequestPayload({
    clientId: session.clientId,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority,
    affectedUrl: input.affectedUrl,
    pageUrl: input.affectedUrl,
  })

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const now = new Date()
    const clientName = deriveClientDisplayName(session.clientId)
    const triage = createFallbackClientRequestTriage({
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      priority: parsed.data.priority,
      affectedUrl: parsed.data.affectedUrl,
      clientContext: session.clientId,
    })
    const { requestRow: created, timelineEvent } = await db.transaction(async (tx) => {
      const [requestRow] = await tx
        .insert(clientRequests)
        .values({
          clientId: session.clientId,
          title: parsed.data.title,
          description: parsed.data.description,
          category: parsed.data.category,
          priority: parsed.data.priority,
          status: "new",
          affectedUrl: parsed.data.affectedUrl,
          pageUrl: parsed.data.pageUrl,
          forgeSummary: formatClientRequestTriageSummary(triage),
          forgeSuggestedActions: formatClientRequestTriageChecklist(triage),
          forgeSuggestedReply: triage.suggestedClientReply,
          updatedAt: now,
        })
        .returning({
          id: clientRequests.id,
          title: clientRequests.title,
          category: clientRequests.category,
          priority: clientRequests.priority,
          status: clientRequests.status,
          description: clientRequests.description,
          affectedUrl: clientRequests.affectedUrl,
          createdAt: clientRequests.createdAt,
          updatedAt: clientRequests.updatedAt,
        })

      await tx.insert(clientRequestMessages).values({
        requestId: requestRow.id,
        senderType: "client",
        senderName: "Client",
        body: parsed.data.description,
        visibility: "client_visible",
        createdAt: requestRow.createdAt,
      })

      const [createdTimelineEvent] = await tx
        .insert(clientTimelineEvents)
        .values({
          clientId: session.clientId,
          requestId: requestRow.id,
          type: "request_submitted",
          title: "Request submitted",
          description: "Your request has been logged in the ScaleSmiths portal.",
          visibility: "client_visible",
          createdBy: "Client",
          createdAt: requestRow.createdAt,
        })
        .returning({
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

      return { requestRow, timelineEvent: createdTimelineEvent }
    })

    const critical = isCriticalClientRequest(parsed.data.category, parsed.data.priority)
    const clientEmail = await findClientNotificationEmail(session.clientId)
    try {
      await sendClientRequestNotifications({
        requestId: created.id,
        clientId: session.clientId,
        clientName,
        clientEmail,
        title: parsed.data.title,
        category: parsed.data.category,
        priority: parsed.data.priority,
        affectedUrl: parsed.data.affectedUrl,
      })
    } catch {
      console.warn("[request-notifications] unexpected warning. Request creation was not blocked.")
    }

    return NextResponse.json({
      ok: true,
      request: serializeClientPortalRequest(created),
      timelineEvent: serializeClientPortalTimelineEvent(timelineEvent),
      critical,
      confirmation: critical
        ? "Request received and marked critical. ScaleSmiths will prioritise triage; if the issue is blocking enquiries, payments, domain, SSL, or site availability, also use your agreed direct line."
        : "Request received. ScaleSmiths will triage it and reply within the usual portal response window.",
    }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Unable to submit request right now." }, { status: 500 })
  }
}
