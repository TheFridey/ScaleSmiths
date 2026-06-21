import { NextResponse } from "next/server"
import { auth } from "../../../../../../auth"
import { runDueForgeJobs } from "@/lib/server/forge-job-runner"

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

  const body = await request.json().catch(() => ({})) as { limit?: unknown }
  const limit = Number.isInteger(body.limit) ? Number(body.limit) : 5

  try {
    const result = await runDueForgeJobs(limit)
    return NextResponse.json({ ok: true, ...result })
  } catch {
    return NextResponse.json({ error: "Unable to drain Forge jobs." }, { status: 500 })
  }
}
