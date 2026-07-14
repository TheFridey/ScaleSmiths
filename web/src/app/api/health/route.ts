import { NextResponse } from "next/server"
import { webErrorMonitoringHealth } from "@/lib/server-monitoring"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "scalesmiths-web",
    environment: process.env.NODE_ENV ?? "unknown",
    release: process.env.SS_RELEASE_ID || process.env.ERROR_MONITORING_RELEASE || undefined,
    monitoring: webErrorMonitoringHealth(),
  }, { headers: { "Cache-Control": "no-store" } })
}
