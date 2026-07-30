import { getForgeRunStage } from "@/lib/forge-run-stages"
import { skipForgeRunStep } from "@/lib/server/forge-run-orchestrator"
import { parseJsonObject, parsePositiveId, requireForgeRunActor, runApiError } from "@/lib/server/forge-run-route"

export async function POST(request: Request, { params }: { params: Promise<{ runId: string; stage: string }> }) {
  try {
    const { actor } = await requireForgeRunActor("forge.execute")
    const values = await params
    const stage = getForgeRunStage(values.stage)
    if (!stage) return Response.json({ error: "Unknown Forge run stage." }, { status: 400 })
    const body = await parseJsonObject(request)
    if (typeof body.reason !== "string") return Response.json({ error: "A reason is required." }, { status: 400 })
    return Response.json({ ok: true, run: await skipForgeRunStep(parsePositiveId(values.runId, "run id"), stage.key, actor, body.reason) })
  } catch (error) { return runApiError(error) }
}
