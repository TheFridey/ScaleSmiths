import { getCurrentForgeRun } from "@/lib/server/forge-run-orchestrator"
import { parsePositiveId, requireForgeRunActor, runApiError } from "@/lib/server/forge-run-route"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireForgeRunActor("forge.read")
    const projectId = parsePositiveId((await params).id, "project id")
    return Response.json({ ok: true, run: await getCurrentForgeRun(projectId) })
  } catch (error) {
    return runApiError(error)
  }
}
