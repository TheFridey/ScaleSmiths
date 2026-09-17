import type { Metadata } from "next"
import { hasCapability } from "@/lib/rbac"
import { guardPageCapability } from "@/lib/server/rbac"
import { loadForgeOpsSnapshot } from "@/lib/server/forge-ops-health"
import { isForgeWorkerEnabled } from "@/lib/server/forge-worker"
import { ForgeOpsDashboard } from "@/components/operations/ForgeOpsDashboard"

export const metadata: Metadata = { title: "Forge operations" }
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default async function ForgeOperationsPage() {
  const actor = await guardPageCapability("audit.read")
  const snapshot = await loadForgeOpsSnapshot({ workerEnabled: isForgeWorkerEnabled() })
  return <ForgeOpsDashboard snapshot={snapshot} canRecover={hasCapability(actor.role, "forge.configure")} />
}
