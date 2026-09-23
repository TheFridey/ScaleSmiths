import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { resolveVentureAgentProposal, VentureMcpError } from "@/lib/server/venture-lab-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const decision = body.decision === "REJECTED" ? "REJECTED" : "ACCEPTED"
  try {
    const proposal = await resolveVentureAgentProposal({
      proposalId: typeof body.proposalId === "string" ? body.proposalId : "",
      actorUserId: session.user.id,
      decision,
      expectedType: "LAUNCH",
      reason: typeof body.reason === "string" ? body.reason : "",
    })
    return NextResponse.json({ proposal })
  } catch (error) {
    if (error instanceof VentureMcpError) return NextResponse.json({ error: error.code }, { status: error.status })
    throw error
  }
}
