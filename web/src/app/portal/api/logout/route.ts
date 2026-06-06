import { NextResponse } from "next/server"
import { portalLogoutCookieOptions } from "@/lib/portal-auth"

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set("ss-client-session", "", portalLogoutCookieOptions())
  return response
}
