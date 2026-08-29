import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { parseClientRequestMessageBody } from "@/lib/client-requests"
import { getClientSessionFromRequest, unauthorizedClientPortalResponse } from "@/lib/portal-session"
import { appendClientMessage, resolveGeneralMessageThreadId } from "@/lib/portal-client-requests"
import { loadPortalClientProfile } from "@/lib/portal-client-profile"
import { sendClientRequestMessageNotification } from "@/lib/request-notifications"
import { resolveClientIp } from "@/lib/client-ip"
import { rateLimitHeaders, webRateLimitKeys } from "@/lib/rate-limit-policy"
import { checkWebRateLimit } from "@/lib/server/rate-limit"
import { clientRequestMessages } from "@/lib/schema"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await getClientSessionFromRequest(request)

  if (!session) {
    return unauthorizedClientPortalResponse(request)
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
    const { requestId } = await resolveGeneralMessageThreadId(session.clientId)
    const result = await appendClientMessage(session.clientId, requestId, parsed.data)

    if (!result) {
      return NextResponse.json({ error: "Unable to send message right now." }, { status: 500 })
    }

    try {
      const profile = await loadPortalClientProfile(session.clientId)
      const notificationResult = await sendClientRequestMessageNotification({
        requestId,
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
      console.warn("[request-notifications] unexpected warning on new portal message. Message was not lost.")
      await db.update(clientRequestMessages).set({
        notificationEmailStatus: "failed",
        notificationEmailFailureReason: "delivery",
      }).where(eq(clientRequestMessages.id, result.message.id)).catch(() => undefined)
    }

    return NextResponse.json({ ok: true, requestId, message: result.message }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Unable to send message right now." }, { status: 500 })
  }
}
