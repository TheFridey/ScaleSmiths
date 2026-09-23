import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { findAdminUserById } from "@/lib/server/admin-users"
import { activateVentureEmergencyStop, resumeVentureLab } from "@/lib/server/venture-lab-persistence"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const actor = await findAdminUserById(session.user.id)
  if (!actor?.active) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === "string" ? body.action : ""
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  if (!reason) return NextResponse.json({ error: "A reason is required." }, { status: 400 })

  if (action === "stop") {
    return NextResponse.json({ runtime: await activateVentureEmergencyStop({ actorUserId: actor.id, reason }) })
  }
  if (action === "resume") {
    if (!["owner", "administrator", "venture_controller"].includes(actor.role)) {
      return NextResponse.json({ error: "Only Venture Controller authority may resume Venture Lab." }, { status: 403 })
    }
    return NextResponse.json({ runtime: await resumeVentureLab({ actorUserId: actor.id, reason }) })
  }
  return NextResponse.json({ error: "Unknown runtime action." }, { status: 400 })
}
