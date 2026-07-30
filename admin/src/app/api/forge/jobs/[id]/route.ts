import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "../../../../../../auth"
import { db } from "@/lib/db"
import { forgeJobs } from "@/lib/schema"
import { toForgeJobView } from "@/lib/forge-jobs"
import { cancelForgeJob, retryForgeJob } from "@/lib/server/forge-job-queue"
import { parseJsonObject, requireForgeRunActor, runApiError } from "@/lib/server/forge-run-route"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const jobId = parseId(rawId)

  if (!jobId) {
    return NextResponse.json({ error: "Invalid job id." }, { status: 400 })
  }

  const [job] = await db.select().from(forgeJobs).where(eq(forgeJobs.id, jobId)).limit(1)

  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 })
  }

  const view = toForgeJobView(job)
  return NextResponse.json({
    ok: true,
    jobId: view.id,
    status: view.status,
    error: view.error,
    result: view.result,
    job: view,
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor } = await requireForgeRunActor("forge.execute")
    const jobId = parseId((await params).id)
    if (!jobId) return NextResponse.json({ error: "Invalid job id." }, { status: 400 })
    const body = await parseJsonObject(request)
    if (body.action === "retry") {
      const result = await retryForgeJob(jobId)
      if (!result.retried) return NextResponse.json({ error: result.reason ?? "Retry is unavailable.", code: "retry_unavailable" }, { status: 409 })
      return NextResponse.json({ ok: true, action: "retry", jobId, actor })
    }
    if (body.action === "cancel") {
      const cancelled = await cancelForgeJob(jobId)
      if (!cancelled) return NextResponse.json({ error: "Only queued or running jobs can be cancelled.", code: "cancel_unavailable" }, { status: 409 })
      return NextResponse.json({ ok: true, action: "cancel", jobId, actor })
    }
    return NextResponse.json({ error: "Use retry or cancel.", code: "invalid_action" }, { status: 400 })
  } catch (error) {
    return runApiError(error)
  }
}
