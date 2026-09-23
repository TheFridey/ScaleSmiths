import { NextResponse } from "next/server"
import { approveVentureSpendRequest, VentureLabPersistenceError } from "@/lib/server/venture-lab-persistence"
import { guardApiCapability } from "@/lib/server/rbac"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("venture.finance.approve")
    const { id } = await params
    const body = await request.json().catch(() => null) as { reason?: unknown } | null
    if (typeof body?.reason !== "string" || !body.reason.trim()) {
      return NextResponse.json({ error: "Approval reason is required." }, { status: 400 })
    }
    const approval = await approveVentureSpendRequest({ approvalId: id, actorUserId: actor.id, reason: body.reason })
    return NextResponse.json({ ok: true, approval })
  } catch (error) {
    if (error instanceof VentureLabPersistenceError) return NextResponse.json({ error: error.safeMessage, code: error.code }, { status: 409 })
    return NextResponse.json({ error: "Unable to approve Venture Lab request." }, { status: 500 })
  }
}
