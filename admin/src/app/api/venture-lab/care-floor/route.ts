import { NextResponse } from "next/server"
import { confirmVentureCareFloor, VentureLabPersistenceError } from "@/lib/server/venture-lab-persistence"
import { guardApiCapability } from "@/lib/server/rbac"

export async function POST(request: Request) {
  try {
    const actor = await guardApiCapability("venture.experiment.manage")
    const body = await request.json().catch(() => null) as { reason?: unknown } | null
    if (typeof body?.reason !== "string" || !body.reason.trim()) {
      return NextResponse.json({ error: "A reason is required." }, { status: 400 })
    }
    const state = await confirmVentureCareFloor({ actorUserId: actor.id, reason: body.reason })
    return NextResponse.json({ ok: true, careFloorConfirmedMinor: state?.careFloorConfirmedMinor ?? null })
  } catch (error) {
    if (error instanceof VentureLabPersistenceError) return NextResponse.json({ error: error.safeMessage, code: error.code }, { status: 409 })
    return NextResponse.json({ error: "Unable to confirm the Venture Lab care floor." }, { status: 500 })
  }
}
