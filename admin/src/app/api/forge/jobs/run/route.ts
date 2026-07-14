import { NextResponse } from "next/server"
import { auth } from "../../../../../../auth"
import { runDueForgeJobs } from "@/lib/server/forge-job-runner"
import { normalizeUnknownError } from "@/lib/server/logging"
import { requestIdFromRequest, requestLogger, withRequestLogContext } from "@/lib/server/request-context"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Worker drain endpoint. Background jobs normally execute in-process right after they are
 * enqueued; this endpoint lets an external scheduler (cron) recover any jobs that were left
 * queued (e.g. if the server restarted before background execution started).
 */
export async function POST(request: Request) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const actorId = session.user?.id ?? "admin"

  return withRequestLogContext({ requestId: requestIdFromRequest(request), actorId }, async () => {
    const body = await request.json().catch(() => ({})) as { limit?: unknown }
    const limit = Number.isInteger(body.limit) ? Number(body.limit) : 5
    const log = requestLogger({ component: "forge-job-worker" })

    try {
      const result = await runDueForgeJobs(limit)
      log.info("Forge job drain completed", result)
      return NextResponse.json({ ok: true, ...result })
    } catch (error) {
      log.error("Forge job drain failed", {
        error: normalizeUnknownError(error, { safeMessage: "Unable to drain Forge jobs.", category: "forge_job_drain" }),
      })
      return NextResponse.json({ error: "Unable to drain Forge jobs." }, { status: 500 })
    }
  })
}
