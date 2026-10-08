import { NextRequest, NextResponse } from "next/server"
import { authenticateJarvisService, authorizeJarvisRead, jarvisReadAction, jarvisReadQuery, JarvisServiceError } from "@/lib/jarvis-service"
import { findAdminUserById } from "@/lib/server/admin-users"
import { readJarvisPage } from "@/lib/server/jarvis-service"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
import { requestLogger, requestIdFromRequest } from "@/lib/server/request-context"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function GET(request: NextRequest, context: {params: Promise<{action: string}>}) {
  const requestId = requestIdFromRequest(request)
  const headers = {"Cache-Control": "private, no-store, max-age=0", "x-request-id": requestId}
  let action: string | undefined
  try {
    const identity = authenticateJarvisService(request.headers)
    action = (await context.params).action
    const selected = jarvisReadAction(action)
    authorizeJarvisRead(identity, await findAdminUserById(identity.userId), selected)
    const query = jarvisReadQuery(request.nextUrl.searchParams)
    const rate = await checkDurableRateLimit(`jarvis:${identity.userId}`, 120, 60_000)
    if (!rate.ok) return NextResponse.json({error: "rate_limited"}, {status: 429, headers: {...headers, "Retry-After": String(Math.ceil(rate.retryAfterMs/1000))}})
    const page = await readJarvisPage(selected, query)
    requestLogger({component: "jarvis-service", requestId, actorId: identity.userId, action: selected, count: page.records.length}).info("JARVIS read completed")
    return NextResponse.json(page, {headers})
  } catch (error) {
    const known = error instanceof JarvisServiceError
    requestLogger({component: "jarvis-service", requestId, action, errorCategory: known ? error.code : "upstream_unavailable"}).warn("JARVIS read unavailable")
    return NextResponse.json({error: known ? error.code : "upstream_unavailable"}, {status: known ? error.status : 503, headers})
  }
}
