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

export default auth((req) => {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/login")) {
    if (req.auth) {
      const url = req.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }

    return NextResponse.next()
  }

  if (!req.auth) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
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
      return NextResponse.json(
        { error: "Forge rate limit exceeded. Try again shortly." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))),
          },
        },
      )
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
