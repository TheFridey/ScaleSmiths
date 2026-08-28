import { NextResponse, type NextRequest } from "next/server"
import { shouldRespectPrivacyOptOut, sanitizeExperienceEvent } from "@/lib/experience-analytics"
import { resolveClientIp } from "@/lib/client-ip"
import { rateLimitHeaders, webRateLimitKeys } from "@/lib/rate-limit-policy"
import { checkWebRateLimit } from "@/lib/server/rate-limit"
import { db } from "@/lib/db"
import { experienceEvents } from "@/lib/schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (shouldRespectPrivacyOptOut(request.headers)) {
    return NextResponse.json({ ok: true, skipped: "privacy_opt_out" }, { headers: noStoreHeaders() })
  }

  const payload = sanitizeExperienceEvent(await request.json().catch(() => null))
  if (!payload) {
    return NextResponse.json({ ok: false, error: "Invalid analytics event." }, { status: 400, headers: noStoreHeaders() })
  }

  // Unauthenticated endpoint that writes a row per call. Limit on the trusted
  // network bucket and the client-declared session, so neither a single network
  // nor a single replayed session can stuff the analytics table.
  const decision = await checkWebRateLimit(
    "experienceEvents",
    webRateLimitKeys("experienceEvents", resolveClientIp(request.headers), payload.sessionId),
  )
  if (!decision.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many analytics events." },
      { status: 429, headers: { ...noStoreHeaders(), ...rateLimitHeaders(decision) } },
    )
  }

  await db
    .insert(experienceEvents)
    .values({
      eventName: payload.eventName,
      eventKey: payload.eventKey,
      sessionId: payload.sessionId,
      path: payload.path,
      deviceClass: payload.deviceClass,
      preference: payload.preference,
      returningPreference: payload.returningPreference,
      fromExperience: payload.fromExperience,
      toExperience: payload.toExperience,
      interactiveStep: payload.interactiveStep,
      completionDepth: payload.completionDepth,
      referrerHost: payload.referrerHost,
      campaignSource: payload.campaignSource,
      campaignMedium: payload.campaignMedium,
      campaignName: payload.campaignName,
      errorCategory: payload.errorCategory,
      metadata: payload.metadata,
    })
    .onConflictDoNothing()

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders() })
}

function noStoreHeaders() {
  return { "Cache-Control": "no-store" }
}
