import { NextResponse } from "next/server"
import NextAuth from "next-auth"
import { authConfig } from "../auth.config"
import {
  buildForgeRateLimitKey,
  isForgeMutatingMethod,
  isForgeTaskEndpoint,
  resolveForgeRateLimitConfig,
} from "@/lib/forge-security"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
import { isAdminSessionCurrent } from "@/lib/admin-users"
import { findAdminUserById } from "@/lib/server/admin-users"
import { authorizeRequest } from "@/lib/rbac"
import { requestLogger } from "@/lib/server/request-context"
import { captureMonitoringMessage } from "@/lib/server/monitoring"

const { auth } = NextAuth(authConfig)
const REQUEST_ID_HEADER = "x-request-id"
const PRIVATE_NO_STORE = "private, no-store, max-age=0"
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

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

  if (pathname.startsWith("/api/auth")) {
    return next()
  }

  // The endpoint performs its own constant-time token check. Keep it outside
  // interactive authentication so infrastructure can check the container.
  if (pathname === "/api/health" || pathname === "/api/monitoring/self-test") {
    return next()
  }

  if (pathname.startsWith("/login")) {
    if (req.auth) {
      const url = req.nextUrl.clone()
      url.pathname = "/dashboard"
      return correlated(NextResponse.redirect(url))
    }

    return next()
  }

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return correlated(NextResponse.json({ error: "Unauthorized." }, { status: 401 }))
    }

    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return correlated(NextResponse.redirect(url))
  }

  const persistedUser = req.auth.user?.id ? await findAdminUserById(req.auth.user.id).catch(() => null) : null
  if (!persistedUser || !isAdminSessionCurrent(persistedUser, req.auth.user.sessionVersion)) {
    if (pathname.startsWith("/api/")) return correlated(NextResponse.json({ error: "Session revoked or account disabled." }, { status: 401 }))
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("reason", "session")
    return correlated(NextResponse.redirect(url))
  }

  const authorization = authorizeRequest(persistedUser.role, { pathname, method: req.method })
  if (!authorization.allowed) {
    const auditContext = { actorId: persistedUser.id, actorRole: persistedUser.role, capability: authorization.capability, pathname, method: req.method, requestId }
    requestLogger({ component: "rbac", ...auditContext }).warn("RBAC access denied")
    captureMonitoringMessage("RBAC access denied", "warning", { ...auditContext, errorCategory: "rbac_denied" })
    if (pathname.startsWith("/api/")) return correlated(NextResponse.json({ error: "Forbidden.", requiredCapability: authorization.capability }, { status: 403 }))
    const url = req.nextUrl.clone()
    url.pathname = "/dashboard"
    url.searchParams.set("reason", "forbidden")
    return correlated(NextResponse.redirect(url))
  }

  if (pathname.startsWith("/api/forge") && isForgeMutatingMethod(req.method)) {
    const config = resolveForgeRateLimitConfig()
    const bucket = isForgeTaskEndpoint(pathname) ? "task" : "mutation"
    const key = buildForgeRateLimitKey({
      actor: req.auth.user?.email ?? req.headers.get("x-forwarded-for") ?? "admin",
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
