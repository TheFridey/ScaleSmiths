import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import {
  ForgeVisualCritiqueAgentError,
  applyForgeVisualCritiqueSafeFixes,
  approveForgeVisualCritique,
} from "@/lib/server/forge-visual-critique-agent"
import { enqueueForgeJob, forgeJobResponseBody } from "@/lib/server/forge-job-runner"
import { guardApiCapability } from "@/lib/server/rbac"
import { AdminIdentityError } from "@/lib/admin-users"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const projectId = parseId(rawId)

  if (!projectId) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const action = body && typeof body === "object" && !Array.isArray(body) && typeof body.action === "string"
    ? body.action
    : "run"
  const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {}

  try {
    if (action === "approve") {
      await guardApiCapability("forge.approve")
      const actor = sessionActor(session)
      const result = await approveForgeVisualCritique(projectId, actor, String(input.reason ?? ""), typeof input.overridePolicy === "string" ? input.overridePolicy : null)
      const { getCurrentForgeRun, approveForgeRunStep } = await import("@/lib/server/forge-run-orchestrator")
      const run = await getCurrentForgeRun(projectId)
      if (run?.steps.some((step) => step.stage === "visual_critique" && step.status === "awaiting_approval")) await approveForgeRunStep(run.id, "visual_critique", actor, String(input.reason ?? ""))
      return NextResponse.json(result)
    }
    if (action === "auto_fix") {
      await guardApiCapability("forge.approve")
      const actor = sessionActor(session)
      const fixed = await applyForgeVisualCritiqueSafeFixes(projectId, actor)
      const { getCurrentForgeRun, retryForgeRunStep } = await import("@/lib/server/forge-run-orchestrator")
      const run = await getCurrentForgeRun(projectId)
      if (run?.steps.some((step) => step.stage === "visual_critique" && step.status === "awaiting_approval")) {
        const rerun = await retryForgeRunStep(run.id, "visual_critique", actor)
        return NextResponse.json({ ...fixed, rerun })
      }
      const rerun = await enqueueForgeJob({ projectId, kind: "visual_critique", actor, payload: { priorArtifactId: fixed.artifactId, safeFixes: fixed.fixes } })
      return NextResponse.json({ ...fixed, rerun: forgeJobResponseBody(rerun) })
    }

    const outcome = await enqueueForgeJob({ projectId, kind: "visual_critique", actor: sessionActor(session) })
    return NextResponse.json(forgeJobResponseBody(outcome))
  } catch (error) {
    if (error instanceof AdminIdentityError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    if (error instanceof ForgeVisualCritiqueAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to run visual critique." }, { status: 500 })
  }
}
