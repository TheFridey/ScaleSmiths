import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "scalesmiths-web",
    environment: process.env.NODE_ENV ?? "unknown",
    release: process.env.ERROR_MONITORING_RELEASE || undefined,
  }, { headers: { "Cache-Control": "no-store" } })
}
