import { createForgeRun } from "@/lib/server/forge-run-orchestrator"
import { parseJsonObject, parsePositiveId, requireForgeRunActor, runApiError } from "@/lib/server/forge-run-route"
import type { ForgeRunMode, ForgeRunPolicy } from "@/lib/forge-run-stages"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { actor } = await requireForgeRunActor("forge.execute")
    const projectId = parsePositiveId((await params).id, "project id")
    const body = await parseJsonObject(request)
    const mode = body.mode === "refresh" || body.mode === "migration" ? body.mode : "standard"
    const run = await createForgeRun({ projectId, actor, mode: mode as ForgeRunMode, policy: (body.policy ?? {}) as ForgeRunPolicy })
    return Response.json({ ok: true, run }, { status: 201 })
  } catch (error) {
    return runApiError(error)
  }
}
