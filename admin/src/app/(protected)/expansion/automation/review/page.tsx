import { notFound } from "next/navigation"
import { guardPageCapability } from "@/lib/server/rbac"
import { ascendAutomationEnabled } from "@/lib/server/ascend-automation"
import { FounderReviewQueue } from "@/components/ascend/FounderReviewQueue"
export const dynamic="force-dynamic"
export default async function ReviewQueuePage(){
  await guardPageCapability("expansion.manage")
  if(!ascendAutomationEnabled())notFound()
  return <FounderReviewQueue/>
}
