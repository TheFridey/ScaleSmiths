import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { isForgeAnimationPack } from "@/lib/forge-animation"
import { isForgeDesignStylePack } from "@/lib/forge-design"
import { ForgeAiError } from "@/lib/server/forge-ai"
import { ForgeDesignAgentError, approveForgeDesignDirection } from "@/lib/server/forge-design-agent"
import { enqueueForgeJob, forgeJobResponseBody } from "@/lib/server/forge-job-runner"

export const dynamic = "force-dynamic"

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
  const input = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {}
  const preferredStylePack = isForgeDesignStylePack(input.preferredStylePack)
    ? input.preferredStylePack
    : null
  const preferredAnimationPack = isForgeAnimationPack(input.preferredAnimationPack)
    ? input.preferredAnimationPack
    : null

  try {
    const outcome = await enqueueForgeJob({ projectId, kind: "design", actor: sessionActor(session), payload: { preferredStylePack, preferredAnimationPack } })
    return NextResponse.json(forgeJobResponseBody(outcome))
  } catch (error) {
    if (error instanceof ForgeDesignAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    if (error instanceof ForgeAiError) {
      return NextResponse.json({ error: error.safeMessage }, { status: 502 })
    }

    return NextResponse.json({ error: "Unable to generate Forge design direction." }, { status: 500 })
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

  if (!body || typeof body !== "object" || Array.isArray(body) || !("direction" in body)) {
    return NextResponse.json({ error: "A design direction payload is required." }, { status: 400 })
  }

  try {
    const input = body as Record<string, unknown>
    const result = await approveForgeDesignDirection(projectId, sessionActor(session), input.direction, input.selectedStylePack, input.selectedAnimationPack)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ForgeDesignAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to approve Forge design direction." }, { status: 500 })
  }
}
