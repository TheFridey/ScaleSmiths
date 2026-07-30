import { startForgeRun } from "@/lib/server/forge-run-orchestrator"
import { parseJsonObject, parsePositiveId, requireForgeRunActor, runApiError } from "@/lib/server/forge-run-route"

export async function POST(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const { actor, role } = await requireForgeRunActor("forge.execute")
    const body = await parseJsonObject(request)
    const wantsOverride = body.override === true
    if (wantsOverride && role !== "owner" && role !== "administrator") return Response.json({ error: "Only owners and administrators may override a run budget.", code: "override_forbidden" }, { status: 403 })
    const override = wantsOverride && typeof body.reason === "string" ? { reason: body.reason } : undefined
    return Response.json({ ok: true, run: await startForgeRun(parsePositiveId((await params).runId, "run id"), actor, override) })
  } catch (error) { return runApiError(error) }
}
