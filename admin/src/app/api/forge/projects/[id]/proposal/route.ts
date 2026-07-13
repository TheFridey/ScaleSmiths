import { NextResponse } from "next/server"
import { auth } from "../../../../../../../auth"
import { ForgeProposalAgentError, recordForgeProposalApproval, recordForgeProposalClientResponse } from "@/lib/server/forge-proposal-agent"
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

  const body = await request.json().catch(() => ({})) as { action?: unknown }
  const action = body.action === "audit" ? "audit" : "proposal"

  try {
    const outcome = await enqueueForgeJob({ projectId, kind: "proposal", actor: sessionActor(session), payload: { action } })
    return NextResponse.json(forgeJobResponseBody(outcome))
  } catch (error) {
    if (error instanceof ForgeProposalAgentError) {
      return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    }

    return NextResponse.json({ error: "Unable to generate proposal." }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })

  const { id: rawId } = await params
  const projectId = parseId(rawId)
  if (!projectId) return NextResponse.json({ error: "Invalid Forge project id." }, { status: 400 })

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: "Invalid proposal payload." }, { status: 400 })

  try {
    if (body.action === "approval") {
      const state = body.state === "approved" || body.state === "rejected" ? body.state : null
      const reason = typeof body.reason === "string" ? body.reason.trim() : ""
      if (!state || reason.length < 8) return NextResponse.json({ error: "Proposal approval state and reason are required." }, { status: 400 })
      const artifact = await recordForgeProposalApproval(projectId, sessionActor(session), { state, reason })
      return NextResponse.json({ ok: true, artifact })
    }

    if (body.action === "client_response") {
      const response = body.response === "accepted" || body.response === "changes_requested" || body.response === "declined" || body.response === "no_response" ? body.response : null
      if (!response) return NextResponse.json({ error: "Client response is invalid." }, { status: 400 })
      const artifact = await recordForgeProposalClientResponse(projectId, sessionActor(session), {
        response,
        contact: typeof body.contact === "string" ? body.contact.trim() || null : null,
        notes: typeof body.notes === "string" ? body.notes.trim() || null : null,
      })
      return NextResponse.json({ ok: true, artifact })
    }

    return NextResponse.json({ error: "Unsupported proposal action." }, { status: 400 })
  } catch (error) {
    if (error instanceof ForgeProposalAgentError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    return NextResponse.json({ error: "Unable to update proposal." }, { status: 500 })
  }
}
