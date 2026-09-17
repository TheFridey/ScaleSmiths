import { NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { hasCapability } from "@/lib/rbac"
import { guardApiCapability } from "@/lib/server/rbac"
import { loadForgeOpsSnapshot } from "@/lib/server/forge-ops-health"
import { executeForgeOpsRecovery } from "@/lib/server/forge-ops-recovery"
import { isForgeWorkerEnabled } from "@/lib/server/forge-worker"
import { captureMonitoringException } from "@/lib/server/monitoring"
import type { AdminRole } from "@/lib/admin-users"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  await guardApiCapability("audit.read")
  try {
    const snapshot = await loadForgeOpsSnapshot({ workerEnabled: isForgeWorkerEnabled() })
    return NextResponse.json({
      ok: true,
      snapshot,
      canRecover: hasCapability((session.user?.role ?? "viewer") as AdminRole, "forge.configure"),
    })
  } catch (error) {
    captureMonitoringException(error, { errorCategory: "forge_ops_health" })
    return NextResponse.json({ error: "Forge operations health is unavailable." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  await guardApiCapability("forge.configure")
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid recovery payload." }, { status: 400 })
  const actor = session.user?.email ?? session.user?.id ?? "admin"
  const result = await executeForgeOpsRecovery({
    action: body.action,
    confirmation: body.confirmation,
    jobId: body.jobId,
    actor,
  })
  return NextResponse.json(result.body.result ? { ok: result.body.result.ok, ...result.body } : result.body, { status: result.status })
}
