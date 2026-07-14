import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../../auth"
import { loadProviderHealthSnapshot } from "@/lib/server/forge-provider-health"
import { requestIdFromRequest, withRequestLogContext } from "@/lib/server/request-context"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const actorId = session.user?.id ?? "admin"

  return withRequestLogContext({ requestId: requestIdFromRequest(request), actorId }, async () => {
    const health = await loadProviderHealthSnapshot()
    return NextResponse.json({ ok: true, health })
  })
}
