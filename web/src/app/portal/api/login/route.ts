import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { checkLoginRateLimit, genericLoginError, getRequestIp, loginRateLimitKeys } from "@/lib/login-limiter"
import { portalClientAccounts } from "@/lib/schema"
import {
  PORTAL_SESSION_COOKIE,
  authenticateDemoPortal,
  authenticatePortalAccount,
  createPortalSessionToken,
  portalSessionCookieOptions,
} from "@/lib/portal-auth"

export async function POST(request: NextRequest) {
  if (!process.env.PORTAL_SECRET) {
    return NextResponse.json({ error: "Unable to sign in right now." }, { status: 500 })
  }

  const credentials = await request.json().catch(() => ({}))
  const identifier = typeof credentials.email === "string" ? credentials.email : ""
  const allowed = await checkLoginRateLimit(loginRateLimitKeys("portal-login", getRequestIp(request), identifier))

  if (!allowed) {
    return NextResponse.json({ error: genericLoginError() }, { status: 401 })
  }

  const session =
    authenticateDemoPortal(credentials) ??
    (await authenticatePortalAccount(credentials, async (email) => {
      const [account] = await db
        .select({
          clientId: portalClientAccounts.clientId,
          email: portalClientAccounts.email,
          passwordHash: portalClientAccounts.passwordHash,
          active: portalClientAccounts.active,
        })
        .from(portalClientAccounts)
        .where(eq(portalClientAccounts.email, email))
        .limit(1)

      return account ?? null
    }))

  if (!session) {
    return NextResponse.json({ error: genericLoginError() }, { status: 401 })
  }

  const token = await createPortalSessionToken(session.clientId, process.env.PORTAL_SECRET)

  const response = NextResponse.json({ ok: true, clientId: session.clientId })
  response.cookies.set(PORTAL_SESSION_COOKIE, token, portalSessionCookieOptions())

  return response
}
