import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { deliveryHandoffEnabled } from "@/lib/server/delivery-handoff"
import { HandoffWorkbench } from "@/components/ascend/HandoffWorkbench"
export const dynamic = "force-dynamic"
export default async function DeliveryHandoffsPage(){
  await guardPageCapability("expansion.manage")
  if(!deliveryHandoffEnabled()) notFound()
  return <HandoffWorkbench/>
}
