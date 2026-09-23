import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { updateVentureGateState, VentureMcpError } from "@/lib/server/venture-lab-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  try {
    const gate = await updateVentureGateState({
      actorUserId: session.user.id,
      currentBlocker: typeof body.currentBlocker === "string" ? body.currentBlocker : "",
      nextDecision: typeof body.nextDecision === "string" ? body.nextDecision : "",
    })
    return NextResponse.json({ gate })
  } catch (error) {
    if (error instanceof VentureMcpError) return NextResponse.json({ error: error.code }, { status: error.status })
    throw error
  }
}
