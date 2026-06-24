import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { type NextRequest, NextResponse } from "next/server"
import {
  PORTAL_SESSION_COOKIE,
  type PortalSession,
  isClientPortalAccessAllowed,
  verifyPortalSessionToken,
} from "@/lib/portal-auth"

export async function getClientSessionFromCookies(): Promise<PortalSession | null> {
  const cookieStore = await cookies()
  return verifyPortalSessionToken(cookieStore.get(PORTAL_SESSION_COOKIE)?.value, process.env.PORTAL_SECRET)
}

export async function getClientSessionFromRequest(request: NextRequest): Promise<PortalSession | null> {
  return verifyPortalSessionToken(request.cookies.get(PORTAL_SESSION_COOKIE)?.value, process.env.PORTAL_SECRET)
}

export async function requireClientSession(): Promise<PortalSession> {
  const session = await getClientSessionFromCookies()

  if (!session) {
    redirect("/portal/login")
  }

  return session
}

export async function requireClientPortalAccess(clientId: string): Promise<PortalSession> {
  const session = await requireClientSession()

  if (!isClientPortalAccessAllowed(session, clientId)) {
    redirect(`/portal/${session.clientId}`)
  }

  return session
}

export function unauthorizedClientPortalResponse(request: NextRequest) {
  const acceptsHtml = request.headers.get("accept")?.includes("text/html")

  if (acceptsHtml) {
    return NextResponse.redirect(new URL("/portal/login", request.url))
  }

  return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
}
