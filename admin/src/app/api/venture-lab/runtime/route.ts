import { NextResponse } from "next/server"
import { activateVentureEmergencyStop, resumeVentureLab, VentureLabPersistenceError } from "@/lib/server/venture-lab-persistence"
import { guardApiCapability } from "@/lib/server/rbac"

export async function POST(request: Request) {
  try {
    const actor = await guardApiCapability("venture.emergency_stop")
    const body = await request.json().catch(() => null) as { action?: unknown; reason?: unknown } | null
    if ((body?.action !== "stop" && body?.action !== "resume") || typeof body.reason !== "string" || !body.reason.trim()) {
      return NextResponse.json({ error: "Action and reason are required." }, { status: 400 })
    }
    const state = body.action === "stop"
      ? await activateVentureEmergencyStop({ actorUserId: actor.id, reason: body.reason })
      : await resumeVentureLab({ actorUserId: actor.id, reason: body.reason })
    return NextResponse.json({ ok: true, state })
  } catch (error) {
    if (error instanceof VentureLabPersistenceError) return NextResponse.json({ error: error.safeMessage, code: error.code }, { status: 409 })
    return NextResponse.json({ error: "Unable to update Venture Lab runtime." }, { status: 500 })
  }
}
