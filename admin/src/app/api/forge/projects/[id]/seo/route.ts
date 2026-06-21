import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { ForgeSeoAgentError, runForgeSeoAgent } from "@/lib/server/forge-seo-agent"

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

  const body = await request.json().catch(() => ({})) as { action?: unknown }
  const action = body.action === "fix" ? "fix" : "generate"

  try {
    const result = await runForgeSeoAgent(projectId, sessionActor(session), action)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ForgeSeoAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to run the Forge SEO engine." }, { status: 500 })
  }
}
