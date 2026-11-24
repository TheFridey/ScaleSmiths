import { adminHomeForRole, isPublicAdminBrandAsset } from "@/lib/admin-home"
import { NextResponse } from "next/server"
import NextAuth from "next-auth"
import { authConfig } from "../auth.config"
import {
  buildForgeRateLimitKey,
  isForgeMutatingMethod,
  isForgeTaskEndpoint,
  resolveForgeRateLimitActor,
  resolveForgeRateLimitConfig,
} from "@/lib/forge-security"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
import { resolveClientIp } from "@/lib/client-ip"
import { isAdminSessionCurrent } from "@/lib/admin-users"
import { findAdminUserById } from "@/lib/server/admin-users"
import { authorizeRequest } from "@/lib/rbac"
import { requestLogger } from "@/lib/server/request-context"
import { captureMonitoringMessage } from "@/lib/server/monitoring"

const { auth } = NextAuth(authConfig)
const REQUEST_ID_HEADER = "x-request-id"
const PRIVATE_NO_STORE = "private, no-store, max-age=0"
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

// ASCEND worker and agent endpoints authenticate scoped service tokens themselves (never founder sessions).
const isAscendMachineRoute = (pathname: string) => pathname === "/api/ascend/worker" || /^\/api\/ascend\/v1\/(capabilities|operations|operations\/[0-9a-f-]{36}|operations\/[0-9a-f-]{36}\/cancel)$/.test(pathname)

export default auth(async (req) => {
  const { pathname } = req.nextUrl
  const incomingRequestId = req.headers.get(REQUEST_ID_HEADER)?.trim()
  const requestId = incomingRequestId && SAFE_REQUEST_ID.test(incomingRequestId) ? incomingRequestId : crypto.randomUUID()
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  const next = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set(REQUEST_ID_HEADER, requestId)
    response.headers.set("Cache-Control", PRIVATE_NO_STORE)
    return response
  }
  const correlated = <T extends NextResponse>(response: T) => {
    response.headers.set(REQUEST_ID_HEADER, requestId)
    response.headers.set("Cache-Control", PRIVATE_NO_STORE)
    return response
  }
  const redirectUrl = (targetPathname: string) => {
    const configuredOrigin = process.env.AUTH_URL?.trim()
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host")?.trim()
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
    const origin = configuredOrigin
      ? new URL(configuredOrigin).origin
      : forwardedHost
        ? `${forwardedProto === "http" ? "http" : "https"}://${forwardedHost}`
        : req.nextUrl.origin
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, origin)
    url.pathname = targetPathname
    return url
  }

  if (pathname.startsWith("/api/auth")) {
    return next()
  }

  // Only the invitation consumer, password recovery and applicant withdrawal are public; every other partner endpoint uses
  // the same persisted Auth.js identity and revocation checks as internal users. Each public endpoint proves identity with a
  // one-time emailed link and is same-origin, rate limited and body bounded.
  if (["/partner/activate", "/partner/reset", "/partner/withdraw"].includes(pathname) && ["GET", "HEAD"].includes(req.method)) return next()
  if (["/api/partner/activate", "/api/partner/password-reset", "/api/partner/withdraw"].includes(pathname) && req.method === "POST") return next()

  // Only these non-sensitive installation assets are public on the admin origin.
  if (isPublicAdminBrandAsset(pathname) || pathname === "/manifest.webmanifest" || pathname === "/command-centre-sw.js" || /^\/app-icon\/(192|512|180)$/.test(pathname)) return next()

  // The endpoint performs its own constant-time token check. Keep it outside
  // interactive authentication so infrastructure can check the container.
  if (pathname === "/api/health" || pathname === "/api/monitoring/self-test" || pathname === "/api/venture-lab/mcp" || pathname === "/api/megaton/worker" || /^\/api\/jarvis\/v1\/[^/]+$/.test(pathname) || isAscendMachineRoute(pathname)) {
    return next()
  }

  // The middleware Auth.js configuration decodes JWT state but does not reload
  // identities. Check the persisted version before redirecting away from login,
  // otherwise a revoked cookie bounces between its workspace and the login page.
  const persistedUser = req.auth?.user?.id ? await findAdminUserById(req.auth.user.id).catch(() => null) : null
  if (pathname.startsWith("/login")) {
    if (persistedUser && isAdminSessionCurrent(persistedUser, req.auth?.user?.sessionVersion)) {
      const url = redirectUrl(adminHomeForRole(persistedUser.role))
      return correlated(NextResponse.redirect(url))
    }

    return next()
  }

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return correlated(NextResponse.json({ error: "Unauthorized." }, { status: 401 }))
    }

    const url = redirectUrl("/login")
    return correlated(NextResponse.redirect(url))
  }

  if (!persistedUser || !isAdminSessionCurrent(persistedUser, req.auth.user.sessionVersion)) {
    if (pathname.startsWith("/api/")) return correlated(NextResponse.json({ error: "Session revoked or account disabled." }, { status: 401 }))
    const url = redirectUrl("/login")
    url.searchParams.set("reason", "session")
    return correlated(NextResponse.redirect(url))
  }

  if (pathname === "/") return correlated(NextResponse.redirect(redirectUrl(adminHomeForRole(persistedUser.role))))

  const authorization = authorizeRequest(persistedUser.role, { pathname, method: req.method })
  if (!authorization.allowed) {
    const auditContext = { actorId: persistedUser.id, actorRole: persistedUser.role, capability: authorization.capability, pathname, method: req.method, requestId }
    requestLogger({ component: "rbac", ...auditContext }).warn("RBAC access denied")
    captureMonitoringMessage("RBAC access denied", "warning", { ...auditContext, errorCategory: "rbac_denied" })
    if (pathname.startsWith("/api/")) return correlated(NextResponse.json({ error: "Forbidden.", requiredCapability: authorization.capability }, { status: 403 }))
    const url = redirectUrl(adminHomeForRole(persistedUser.role))
    url.searchParams.set("reason", "forbidden")
    return correlated(NextResponse.redirect(url))
  }

  if (pathname.startsWith("/api/forge") && isForgeMutatingMethod(req.method)) {
    const config = resolveForgeRateLimitConfig()
    const bucket = isForgeTaskEndpoint(pathname) ? "task" : "mutation"
    const key = buildForgeRateLimitKey({
      actor: resolveForgeRateLimitActor({
        userId: persistedUser.id,
        email: req.auth.user?.email,
        // Only reached if an authenticated request somehow carries no id or
        // email; resolveClientIp never returns a client-chosen value.
        forwardedFor: resolveClientIp(req.headers),
      }),
      method: req.method,
      pathname,
      bucket,
    })
    const limit = bucket === "task" ? config.taskLimit : config.mutationLimit
    // Durable, shared across replicas. Fail open on any database error so a
    // transient DB problem cannot lock every admin out of Forge.
    try {
      const result = await checkDurableRateLimit(key, limit, config.windowMs)
      if (!result.ok) {
        return correlated(NextResponse.json(
          { error: "Forge rate limit exceeded. Try again shortly." },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))),
              "RateLimit-Limit": String(result.limit),
              "RateLimit-Remaining": String(result.remaining),
              "RateLimit-Reset": String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))),
            },
          },
        ))
      }
    } catch (error) {
      captureMonitoringMessage("Forge rate limit check failed open", "warning", { errorCategory: "rate_limit_unavailable", pathname, requestId })
      requestLogger({ component: "rate-limit", requestId }).warn("Durable rate limit check failed open", { error: error instanceof Error ? error.message : "unknown" })
    }
  }

  return next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
  runtime: "nodejs",
}
