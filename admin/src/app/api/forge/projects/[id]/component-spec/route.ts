import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { ForgeAiError } from "@/lib/server/forge-ai"
import { ForgeComponentSpecAgentError, approveForgeComponentSpec } from "@/lib/server/forge-component-spec-agent"
import { enqueueForgeJob, forgeJobResponseBody } from "@/lib/server/forge-job-runner"

export const dynamic = "force-dynamic"

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.email ?? session?.user?.name ?? "admin"
}

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const projectId = parseId(rawId)

  if (!projectId) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  try {
    const outcome = await enqueueForgeJob({ projectId, kind: "component_spec", actor: sessionActor(session) })
    return NextResponse.json(forgeJobResponseBody(outcome))
  } catch (error) {
    if (error instanceof ForgeComponentSpecAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    if (error instanceof ForgeAiError) {
      return NextResponse.json({ error: error.safeMessage }, { status: 502 })
    }

    return NextResponse.json({ error: "Unable to generate Forge component specification." }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const projectId = parseId(rawId)

  if (!projectId) {
    return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body) || !("spec" in body)) {
    return NextResponse.json({ error: "A component specification payload is required." }, { status: 400 })
  }

  try {
    const result = await approveForgeComponentSpec(projectId, sessionActor(session), (body as Record<string, unknown>).spec)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ForgeComponentSpecAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to approve Forge component specification." }, { status: 500 })
  }
}
