import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { ForgeAiError } from "@/lib/server/forge-ai"
import { ForgeCopyAgentError, approveForgeCopyDocument } from "@/lib/server/forge-copy-agent"
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

  const body = await request.json().catch(() => null)
  const regeneratePagePath = body && typeof body === "object" && !Array.isArray(body) && typeof body.regeneratePagePath === "string"
    ? body.regeneratePagePath
    : null

  try {
    const outcome = await enqueueForgeJob({ projectId, kind: "copy", actor: sessionActor(session), payload: { regeneratePagePath } })
    return NextResponse.json(forgeJobResponseBody(outcome))
  } catch (error) {
    if (error instanceof ForgeCopyAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    if (error instanceof ForgeAiError) {
      return NextResponse.json({ error: error.safeMessage }, { status: 502 })
    }

    return NextResponse.json({ error: "Unable to generate Forge copy." }, { status: 500 })
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

  if (!body || typeof body !== "object" || Array.isArray(body) || !("copy" in body)) {
    return NextResponse.json({ error: "A copy document payload is required." }, { status: 400 })
  }

  try {
    const result = await approveForgeCopyDocument(projectId, sessionActor(session), (body as Record<string, unknown>).copy)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ForgeCopyAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to approve Forge copy." }, { status: 500 })
  }
}
