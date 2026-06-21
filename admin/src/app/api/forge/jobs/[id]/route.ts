import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "../../../../../../auth"
import { db } from "@/lib/db"
import { forgeJobs } from "@/lib/schema"
import { toForgeJobView } from "@/lib/forge-jobs"

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
