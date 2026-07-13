import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import type { ForgeGeneratedSiteAgentRequest } from "@/lib/forge-generated-site-agent"
import { ForgeGeneratedSiteAgentError, runForgeGeneratedSiteAgent } from "@/lib/server/forge-generated-site-agent"
import { guardApiCapability } from "@/lib/server/rbac"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  try { await guardApiCapability("forge.execute") } catch { return NextResponse.json({ error: "Forbidden." }, { status: 403 }) }
  const projectId = Number((await params).id)
  if (!Number.isInteger(projectId) || projectId < 1) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  const body = await request.json().catch(() => null) as ForgeGeneratedSiteAgentRequest | null
  if (!body) return NextResponse.json({ error: "Invalid implementation request." }, { status: 400 })
  try {
    const actor = session.user?.email ?? session.user?.name ?? "admin"
    return NextResponse.json(await runForgeGeneratedSiteAgent(projectId, actor, body))
  } catch (error) {
    if (error instanceof ForgeGeneratedSiteAgentError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    return NextResponse.json({ error: "Unable to run the generated-site implementation agent." }, { status: 500 })
  }
}
