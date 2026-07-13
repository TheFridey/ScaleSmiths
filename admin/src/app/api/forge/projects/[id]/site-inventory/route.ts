import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { guardApiCapability } from "@/lib/server/rbac"
import { enqueueForgeJob, forgeJobResponseBody } from "@/lib/server/forge-job-runner"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const projectId = Number((await params).id)
  if (!Number.isInteger(projectId) || projectId < 1) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  try {
    await guardApiCapability("forge.execute")
    const body = await request.json() as { startUrl?: unknown; maxPages?: unknown; maxDepth?: unknown; allowedDomains?: unknown; robotsPolicy?: unknown }
    if (typeof body.startUrl !== "string" || !body.startUrl.trim()) return NextResponse.json({ error: "A starting website URL is required." }, { status: 400 })
    const payload = { startUrl: body.startUrl, maxPages: body.maxPages, maxDepth: body.maxDepth, allowedDomains: body.allowedDomains, robotsPolicy: body.robotsPolicy }
    const actor = session.user?.email ?? session.user?.name ?? "admin"
    return NextResponse.json(forgeJobResponseBody(await enqueueForgeJob({ projectId, kind: "site_inventory", actor, payload })))
  } catch {
    return NextResponse.json({ error: "Unable to inventory the existing website." }, { status: 500 })
  }
}
