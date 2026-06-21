import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { ForgeFrontendCodeAgentError } from "@/lib/server/forge-frontend-code-agent"
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
    const outcome = await enqueueForgeJob({ projectId, kind: "generate_site", actor: sessionActor(session) })
    return NextResponse.json(forgeJobResponseBody(outcome))
  } catch (error) {
    if (error instanceof ForgeFrontendCodeAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to generate Forge site code." }, { status: 500 })
  }
}
