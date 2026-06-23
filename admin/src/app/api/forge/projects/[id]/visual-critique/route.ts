import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import {
  ForgeVisualCritiqueAgentError,
  applyForgeVisualCritiqueSafeFixes,
  approveForgeVisualCritique,
} from "@/lib/server/forge-visual-critique-agent"
import { enqueueForgeJob, forgeJobResponseBody } from "@/lib/server/forge-job-runner"

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

  try {
    if (action === "approve") {
      return NextResponse.json(await approveForgeVisualCritique(projectId, sessionActor(session)))
    }
    if (action === "auto_fix") {
      return NextResponse.json(await applyForgeVisualCritiqueSafeFixes(projectId, sessionActor(session)))
    }

    const outcome = await enqueueForgeJob({ projectId, kind: "visual_critique", actor: sessionActor(session) })
    return NextResponse.json(forgeJobResponseBody(outcome))
  } catch (error) {
    if (error instanceof ForgeVisualCritiqueAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to run visual critique." }, { status: 500 })
  }
}
