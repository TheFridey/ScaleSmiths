import { NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { reconcileForgeResources } from "@/lib/server/forge-reconciliation"
import { captureMonitoringException } from "@/lib/server/monitoring"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  return execute(true, session.user?.id ?? "admin")
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { dryRun?: unknown }
  return execute(body.dryRun !== false, session.user?.id ?? "admin")
}

async function execute(dryRun: boolean, actor: string) {
  try {
    const result = await reconcileForgeResources({ dryRun, actor })
    return NextResponse.json({ ok: result.failures.length === 0, ...result }, { status: result.failures.length ? 207 : 200 })
  } catch (error) {
    captureMonitoringException(error, { errorCategory: "forge_reconciliation_request" })
    return NextResponse.json({ error: "Forge reconciliation failed." }, { status: 500 })
  }
}
