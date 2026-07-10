import { NextResponse } from "next/server"
import NextAuth from "next-auth"
import { authConfig } from "../auth.config"
import {
  buildForgeRateLimitKey,
  checkForgeRateLimit,
  isForgeMutatingMethod,
  isForgeTaskEndpoint,
  resolveForgeRateLimitConfig,
  type ForgeRateLimitStore,
} from "@/lib/forge-security"

const { auth } = NextAuth(authConfig)
const forgeRateLimitStore: ForgeRateLimitStore = new Map()
const REQUEST_ID_HEADER = "x-request-id"
const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

export default auth((req) => {
  const { pathname } = req.nextUrl
  const incomingRequestId = req.headers.get(REQUEST_ID_HEADER)?.trim()
  const requestId = incomingRequestId && SAFE_REQUEST_ID.test(incomingRequestId) ? incomingRequestId : crypto.randomUUID()
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set(REQUEST_ID_HEADER, requestId)
  const next = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }
  const correlated = <T extends NextResponse>(response: T) => {
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  }

  if (pathname.startsWith("/api/auth")) {
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
    const result = checkForgeRateLimit(forgeRateLimitStore, key, limit, config.windowMs)

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
  }

  return next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
