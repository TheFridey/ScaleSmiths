import { createHash } from "node:crypto"
import { sql } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { resolveClientIp } from "@/lib/client-ip"
import { partnerApplicationConfig, validatePartnerApplication, isPartnerApplicationOriginAllowed, readPartnerApplicationJson } from "@/lib/partner-applications"
import { checkWebRateLimit } from "@/lib/server/rate-limit"
import { rateLimitHeaders } from "@/lib/rate-limit-policy"
import { siteBaseUrl } from "@/lib/site-identity"
import { captureWebException } from "@/lib/server-monitoring"
import { sendApplicationReceived } from "@/lib/server/partner-application-email"

export const runtime = "nodejs"
const headers = { "Cache-Control": "private, no-store" }

export async function POST(request: NextRequest) {
  const config = partnerApplicationConfig()
  if (!config.enabled || !config.retentionDays) return NextResponse.json({ error: "Applications are not open yet." }, { status: 503, headers })
  const expectedOrigin = process.env.NODE_ENV === "production" ? siteBaseUrl() : request.nextUrl.origin
  if (!isPartnerApplicationOriginAllowed(request.headers.get("origin"), expectedOrigin)) return NextResponse.json({ error: "Please apply from the ScaleSmiths website." }, { status: 403, headers })
  try {
    const hash = (value: string) => createHash("sha256").update(value).digest("hex")
    const network = await checkWebRateLimit("partnerApplication", [`partnerApplication:ip:${hash(resolveClientIp(request.headers))}`])
    if (!network.ok) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429, headers: { ...headers, ...rateLimitHeaders(network) } })
    const parsed = await readPartnerApplicationJson(request)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status, headers })
    const validation = validatePartnerApplication(parsed.data)
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400, headers })
    if (validation.data.privacyVersion !== config.privacyVersion) return NextResponse.json({ error: "The applicant privacy information has changed. Please reload this page and review it before applying." }, { status: 409, headers })
    if (validation.honeypot) return NextResponse.json({ ok: true }, { headers })
    const identity = await checkWebRateLimit("partnerApplication", [`partnerApplication:email:${hash(validation.data.email)}`])
    if (!identity.ok) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429, headers: { ...headers, ...rateLimitHeaders(identity) } })
    const d = validation.data
    await db.execute(sql`insert into partner_applications
      (name,email,phone,region,experience,business_activity,networks,industries,motivation,linkedin,privacy_version,retention_until)
      values (${d.name},${d.email},${d.phone},${d.region},${d.experience},${d.businessActivity},${d.networks},${d.industries},${d.motivation},${d.linkedin},${config.privacyVersion},now() + ${config.retentionDays} * interval '1 day')`)
    // Confirmation email is a courtesy: its outcome is logged and never changes the response.
    await sendApplicationReceived({ name: d.name, email: d.email }).catch(() => undefined)
    return NextResponse.json({ ok: true }, { status: 201, headers })
  } catch {
    // Driver errors can embed SQL parameters in their message, stack or cause.
    // Do not pass submitted applicant information to a monitoring provider.
    captureWebException(new Error("Partner application persistence failed."), { routePath: "/api/partner-applications", method: "POST", errorCategory: "partner_application" })
    return NextResponse.json({ error: "We could not save your application. Please try again later." }, { status: 503, headers })
  }
}
