import { getForgeRunStage } from "@/lib/forge-run-stages"
import { retryForgeRunStep } from "@/lib/server/forge-run-orchestrator"
import { parsePositiveId, requireForgeRunActor, runApiError } from "@/lib/server/forge-run-route"

export async function POST(_request: Request, { params }: { params: Promise<{ runId: string; stage: string }> }) {
  try {
    const { actor } = await requireForgeRunActor("forge.execute")
    const values = await params
    const stage = getForgeRunStage(values.stage)
    if (!stage) return Response.json({ error: "Unknown Forge run stage." }, { status: 400 })
    return Response.json({ ok: true, run: await retryForgeRunStep(parsePositiveId(values.runId, "run id"), stage.key, actor) })
  } catch (error) { return runApiError(error) }
}
