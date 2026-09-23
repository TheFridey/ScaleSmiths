import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { revokeVentureServiceAccount, VentureLabPersistenceError } from "@/lib/server/venture-lab-persistence"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  try {
    const service = await revokeVentureServiceAccount({
      serviceAccountId: typeof body.serviceAccountId === "string" ? body.serviceAccountId : "",
      actorUserId: session.user.id,
      reason: typeof body.reason === "string" ? body.reason : "",
    })
    return NextResponse.json({ service })
  } catch (error) {
    if (error instanceof VentureLabPersistenceError) return NextResponse.json({ error: error.safeMessage, code: error.code }, { status: 409 })
    throw error
  }
}
