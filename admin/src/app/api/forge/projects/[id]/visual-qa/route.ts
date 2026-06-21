import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { ForgeVisualQaAgentError, runForgeVisualQaAgent } from "@/lib/server/forge-visual-qa-agent"

export const dynamic = "force-dynamic"
export const maxDuration = 300

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
    const result = await runForgeVisualQaAgent(projectId, sessionActor(session))
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ForgeVisualQaAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to run Lighthouse & visual QA." }, { status: 500 })
  }
}
