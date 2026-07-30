import { pauseForgeRun } from "@/lib/server/forge-run-orchestrator"
import { parseJsonObject, parsePositiveId, requireForgeRunActor, runApiError } from "@/lib/server/forge-run-route"

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { actor } = await requireForgeRunActor("forge.execute")
    const body = await parseJsonObject(request)
    return Response.json({ ok: true, run: await pauseForgeRun(parsePositiveId((await params).runId, "run id"), actor, String(body.reason ?? "")) })
  } catch (error) { return runApiError(error) }
}
