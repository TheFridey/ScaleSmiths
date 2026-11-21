import { NextResponse } from "next/server"
import { AdminIdentityError } from "@/lib/admin-users"
import { checkLoginRateLimit, getAuthRequestIp, loginRateLimitKeys } from "@/lib/login-limiter"
import { activatePartnerInvitation, previewInvitationAgreement, requirePartnerActivationEnabled } from "@/lib/server/partner-invitations"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" }
  try {
    const origin = request.headers.get("origin")
    const expectedOrigin = process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : new URL(request.url).origin
    if (origin !== expectedOrigin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers })
    requirePartnerActivationEnabled()
    if (!await checkLoginRateLimit(loginRateLimitKeys("partner-activation", getAuthRequestIp(request), ""))) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers })
    if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "JSON is required." }, { status: 415, headers })
    const reader = request.body?.getReader()
    if (!reader) throw new AdminIdentityError("Invalid request.")
    let body = ""
    let size = 0
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) { await reader.cancel(); return NextResponse.json({ error: "Request is too large." }, { status: 413, headers }) }
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
    let payload: Record<string, unknown>
    try { payload = JSON.parse(body) } catch { throw new AdminIdentityError("Invalid request.") }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new AdminIdentityError("Invalid request.")
    // Step one shows the issued agreement in full; step two activates only with an explicit acceptance of that exact text.
    if (payload.action === "preview") return NextResponse.json({ agreement: await previewInvitationAgreement(payload.token) }, { headers })
    await activatePartnerInvitation(payload.token, payload.password, payload.acceptance)
    return NextResponse.json({ ok: true }, { headers })
  } catch (error) {
    return NextResponse.json({ error: error instanceof AdminIdentityError ? error.safeMessage : "Activation is unavailable. Try again later." }, { status: error instanceof AdminIdentityError ? error.status : 503, headers })
  }
}
