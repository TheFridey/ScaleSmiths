import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { loadAnalyticsRetentionPublicState, runAnalyticsRetentionJob } from "@/lib/server/analytics-retention"
import { normalizeUnknownError } from "@/lib/server/logging"
import { requestIdFromRequest, requestLogger, withRequestLogContext } from "@/lib/server/request-context"
import { guardApiCapability } from "@/lib/server/rbac"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  await guardApiCapability("analytics.read")
  return NextResponse.json({ ok: true, state: await loadAnalyticsRetentionPublicState() })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  await guardApiCapability("analytics.write")
  const actorId = session.user?.id ?? "admin"
  return withRequestLogContext({ requestId: requestIdFromRequest(request), actorId }, async () => {
    const body = await request.json().catch(() => ({})) as { force?: unknown }
    const log = requestLogger({ component: "analytics-retention" })
    try {
      const result = await runAnalyticsRetentionJob({
        owner: `api:${actorId}`,
        force: body.force === true,
      })
      log.info("Analytics retention drain completed", { status: result.status, skipped: result.skipped })
      return NextResponse.json({ ok: true, ...result })
    } catch (error) {
      log.error("Analytics retention drain failed", {
        error: normalizeUnknownError(error, { safeMessage: "Unable to run analytics retention.", category: "analytics_retention" }),
      })
      return NextResponse.json({ error: "Unable to run analytics retention." }, { status: 500 })
    }
  })
}
