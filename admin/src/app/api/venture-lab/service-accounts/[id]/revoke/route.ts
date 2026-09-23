import { NextResponse } from "next/server"
import { revokeVentureServiceAccount, VentureLabPersistenceError } from "@/lib/server/venture-lab-persistence"
import { guardApiCapability } from "@/lib/server/rbac"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("venture.integration.manage")
    const { id } = await params
    const body = await request.json().catch(() => null) as { reason?: unknown } | null
    if (typeof body?.reason !== "string" || !body.reason.trim()) {
      return NextResponse.json({ error: "Revocation reason is required." }, { status: 400 })
    }
    const service = await revokeVentureServiceAccount({ serviceAccountId: id, actorUserId: actor.id, reason: body.reason })
    return NextResponse.json({ ok: true, service })
  } catch (error) {
    if (error instanceof VentureLabPersistenceError) return NextResponse.json({ error: error.safeMessage, code: error.code }, { status: 409 })
    return NextResponse.json({ error: "Unable to revoke Venture Lab service identity." }, { status: 500 })
  }
}
