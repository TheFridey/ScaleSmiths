import { loadForgeRun } from "@/lib/server/forge-run-orchestrator"
import { parsePositiveId, requireForgeRunActor, runApiError } from "@/lib/server/forge-run-route"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    await requireForgeRunActor("forge.read")
    const run = await loadForgeRun(parsePositiveId((await params).runId, "run id"))
    return run ? Response.json({ ok: true, run }) : Response.json({ error: "Forge run not found." }, { status: 404 })
  } catch (error) {
    return runApiError(error)
  }
}
