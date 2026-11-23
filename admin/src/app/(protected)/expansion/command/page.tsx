import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { founderSalesCommandEnabled } from "@/lib/server/sales-command"
import { ascendAutomationEnabled } from "@/lib/server/ascend-automation"
import { deliveryHandoffEnabled } from "@/lib/server/delivery-handoff"
import { SalesCommandCentre } from "@/components/ascend/SalesCommandCentre"
export const dynamic = "force-dynamic"
/** Operation Ascend B2.3: the founder sales command centre. 404 unless FOUNDER_SALES_COMMAND_ENABLED=true. */
export default async function SalesCommandPage() {
  await guardPageCapability("expansion.manage")
  if (!founderSalesCommandEnabled()) notFound()
  return <SalesCommandCentre handoffsEnabled={deliveryHandoffEnabled()} automationEnabled={ascendAutomationEnabled()} />
}
