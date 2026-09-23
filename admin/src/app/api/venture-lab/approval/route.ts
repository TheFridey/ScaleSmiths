import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { approveVentureSpendRequest, VentureLabPersistenceError } from "@/lib/server/venture-lab-persistence"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  try {
    const approval = await approveVentureSpendRequest({
      approvalId: typeof body.approvalId === "string" ? body.approvalId : "",
      actorUserId: session.user.id,
      reason: typeof body.reason === "string" ? body.reason : "",
    })
    return NextResponse.json({ approval })
  } catch (error) {
    if (error instanceof VentureLabPersistenceError) return NextResponse.json({ error: error.safeMessage, code: error.code }, { status: 409 })
    throw error
  }
}
