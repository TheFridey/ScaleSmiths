import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { AdminIdentityError } from "@/lib/admin-users"
import { guardApiCapability } from "@/lib/server/rbac"
import { enqueueForgeJob, forgeJobResponseBody } from "@/lib/server/forge-job-runner"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const projectId = Number((await context.params).id)
  if (!Number.isInteger(projectId) || projectId < 1) return NextResponse.json({ error: "Invalid project ID." }, { status: 400 })
  try {
    await guardApiCapability("forge.execute")
    const actor = session.user?.email ?? session.user?.name ?? "admin"
    const outcome = await enqueueForgeJob({ projectId, kind: "copy_quality_review", actor })
    return NextResponse.json(forgeJobResponseBody(outcome))
  } catch (error) {
    if (error instanceof AdminIdentityError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    return NextResponse.json({ error: "Unable to evaluate copy quality." }, { status: 500 })
  }
}
