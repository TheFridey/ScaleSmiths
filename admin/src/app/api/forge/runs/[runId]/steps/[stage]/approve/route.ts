import { getForgeRunStage } from "@/lib/forge-run-stages"
import { approveForgeRunStep } from "@/lib/server/forge-run-orchestrator"
import { parseJsonObject, parsePositiveId, requireForgeRunActor, runApiError } from "@/lib/server/forge-run-route"

export async function POST(request: Request, { params }: { params: Promise<{ runId: string; stage: string }> }) {
  try {
    const { actor } = await requireForgeRunActor("forge.approve")
    const values = await params
    const stage = getForgeRunStage(values.stage)
    if (!stage) return Response.json({ error: "Unknown Forge run stage." }, { status: 400 })
    const body = await parseJsonObject(request)
    return Response.json({ ok: true, run: await approveForgeRunStep(parsePositiveId(values.runId, "run id"), stage.key, actor, typeof body.reason === "string" ? body.reason : undefined) })
  } catch (error) { return runApiError(error) }
}
