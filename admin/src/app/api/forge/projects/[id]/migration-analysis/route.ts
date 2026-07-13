import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { guardApiCapability } from "@/lib/server/rbac"
import { enqueueForgeJob, forgeJobResponseBody } from "@/lib/server/forge-job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const projectId = Number((await params).id)
  if (!Number.isInteger(projectId) || projectId < 1) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  try { await guardApiCapability("forge.execute"); const actor = session.user?.email ?? session.user?.name ?? "admin"; return NextResponse.json(forgeJobResponseBody(await enqueueForgeJob({ projectId, kind: "migration_analysis", actor }))) }
  catch { return NextResponse.json({ error: "Unable to analyse the website migration." }, { status: 500 }) }
}
