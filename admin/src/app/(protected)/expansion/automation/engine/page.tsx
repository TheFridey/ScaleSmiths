import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { ascendEngineEnabled } from "@/lib/server/ascend-engine"
import { EngineCommandCentre } from "@/components/ascend/EngineCommandCentre"
export const dynamic = "force-dynamic"
export const metadata = { title: "Automation command centre" }
export default async function AutomationEnginePage() {
  await guardPageCapability("expansion.manage")
  if (!ascendEngineEnabled()) notFound()
  return <EngineCommandCentre />
}
