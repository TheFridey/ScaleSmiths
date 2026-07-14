import { NextResponse } from "next/server"
import { isValidMonitoringSelfTestToken } from "@/lib/monitoring-self-test"
import { captureWebMessage, webErrorMonitoringHealth } from "@/lib/server-monitoring"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export function POST(request: Request) {
  if (!isValidMonitoringSelfTestToken(request.headers.get("x-monitoring-self-test-token"))) {
    return NextResponse.json({ status: "unavailable" }, { status: 401 })
  }

  const monitoring = webErrorMonitoringHealth()
  if (!monitoring.configured) {
    return NextResponse.json({ status: monitoring.status, application: monitoring.application }, { status: 503 })
  }

  const eventId = captureWebMessage("Monitoring configuration self-test", "info", {
    requestId: request.headers.get("x-request-id") ?? undefined,
    errorCategory: "monitoring_self_test",
    deploymentEnvironment: monitoring.environment,
  })
  return NextResponse.json(
    { status: eventId ? "accepted" : "delivery_failed", application: monitoring.application, eventId },
    { status: eventId ? 202 : 503, headers: { "Cache-Control": "no-store" } },
  )
}
