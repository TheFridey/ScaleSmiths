import "server-only"

import { NextResponse } from "next/server"
import { AdminIdentityError } from "@/lib/admin-users"
import { checkLoginRateLimit, getAuthRequestIp, loginRateLimitKeys } from "@/lib/login-limiter"

/*
 * Shared guard for the unauthenticated partner endpoints (password recovery, applicant withdrawal). Mirrors the activation route:
 * same-origin only, durable per-IP and per-identifier rate limiting, JSON only, bounded body, generic failures, never cached.
 */
export const publicHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" }
type Handler = (payload: Record<string, unknown>) => Promise<Record<string, unknown>>

export async function handlePublicPartnerRequest(request: Request, scope: string, identifierOf: (payload: Record<string, unknown>) => string, handle: Handler) {
  try {
    const origin = request.headers.get("origin")
    const expectedOrigin = process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : new URL(request.url).origin
    if (origin !== expectedOrigin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: publicHeaders })
    if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "JSON is required." }, { status: 415, headers: publicHeaders })
    const text = await readBounded(request, 8192)
    if (text === null) return NextResponse.json({ error: "Request is too large." }, { status: 413, headers: publicHeaders })
    let payload: unknown
    try { payload = JSON.parse(text) } catch { throw new AdminIdentityError("Invalid request.") }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new AdminIdentityError("Invalid request.")
    const body = payload as Record<string, unknown>
    if (!await checkLoginRateLimit(loginRateLimitKeys(scope, getAuthRequestIp(request), identifierOf(body)))) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429, headers: publicHeaders })
    return NextResponse.json(await handle(body), { headers: publicHeaders })
  } catch (error) {
    return NextResponse.json({ error: error instanceof AdminIdentityError ? error.safeMessage : "This service is unavailable. Try again later." }, { status: error instanceof AdminIdentityError ? error.status : 503, headers: publicHeaders })
  }
}

async function readBounded(request: Request, limit: number): Promise<string | null> {
  const reader = request.body?.getReader()
  if (!reader) throw new AdminIdentityError("Invalid request.")
  const decoder = new TextDecoder()
  let body = "", size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) { await reader.cancel(); return null }
    body += decoder.decode(value, { stream: true })
  }
  return body + decoder.decode()
}
