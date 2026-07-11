import { NextResponse } from "next/server"
import { healthPayload, isValidHealthToken } from "@/lib/health"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET(request: Request) {
  if (!isValidHealthToken(request.headers.get("x-health-check-token"))) {
    return NextResponse.json({ status: "unavailable" }, { status: 401 })
  }

  return NextResponse.json(healthPayload(), {
    headers: { "Cache-Control": "no-store" },
  })
}
