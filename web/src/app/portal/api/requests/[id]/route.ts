import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  parseClientRequestMessageBody,
} from "@/lib/client-requests"
import { getClientSessionFromRequest, unauthorizedClientPortalResponse } from "@/lib/portal-session"
import { appendClientMessage, getPortalRequestThread } from "@/lib/portal-client-requests"
import { clientRequestMessages, clientRequests } from "@/lib/schema"
import { resolveClientIp } from "@/lib/client-ip"
import { rateLimitHeaders, webRateLimitKeys } from "@/lib/rate-limit-policy"
import { checkWebRateLimit } from "@/lib/server/rate-limit"
import { sendClientRequestMessageNotification } from "@/lib/request-notifications"
import { loadPortalClientProfile } from "@/lib/portal-client-profile"

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
    const thread = await getPortalRequestThread(session.clientId, id)
    if (!thread) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 })
    }

    await db.update(clientRequests)
      .set({ clientLastReadAt: new Date() })
      .where(and(eq(clientRequests.id, id), eq(clientRequests.clientId, session.clientId)))

    return NextResponse.json({ ok: true, ...thread })
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

  const decision = await checkWebRateLimit(
    "portalRequestMessage",
    webRateLimitKeys("portalRequestMessage", resolveClientIp(request.headers), session.clientId),
  )
  if (!decision.ok) {
    return NextResponse.json(
      { error: "Too many messages sent. Please wait before sending another." },
      { status: 429, headers: rateLimitHeaders(decision) },
    )
  }

  try {
    const result = await appendClientMessage(session.clientId, id, parsed.data)
    if (!result) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 })
    }

    try {
      const profile = await loadPortalClientProfile(session.clientId)
      const notificationResult = await sendClientRequestMessageNotification({
        requestId: id,
        messageId: result.message.id,
        correlationId: request.headers.get("x-request-id") ?? undefined,
        actorId: session.clientId,
        clientId: session.clientId,
        clientName: profile?.companyName ?? "Client workspace",
        requestTitle: result.requestTitle,
        messageBody: result.message.body,
      })
      await db.update(clientRequestMessages).set({
        notificationEmailStatus: notificationResult.status,
        notificationEmailFailureReason: notificationResult.failureReason ?? null,
      }).where(eq(clientRequestMessages.id, result.message.id))
    } catch {
      console.warn("[request-notifications] unexpected warning on message reply. Message was not lost.")
      await db.update(clientRequestMessages).set({
        notificationEmailStatus: "failed",
        notificationEmailFailureReason: "delivery",
      }).where(eq(clientRequestMessages.id, result.message.id)).catch(() => undefined)
    }

    return NextResponse.json({ ok: true, message: result.message }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Unable to send message right now." }, { status: 500 })
  }
}
