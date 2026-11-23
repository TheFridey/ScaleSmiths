import { NextResponse } from "next/server"
import { ExpansionError } from "@/lib/expansion"
import { expansionBody, expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
import { requireCapability } from "@/lib/server/rbac"
import { approveDeliveryHandoff, deliveryHandoffEnabled, founderHandoffQueue } from "@/lib/server/delivery-handoff"
export const dynamic = "force-dynamic"
/** Founder-only B2.6 handoff queue and explicit approval. */
export async function GET() {
  try { return NextResponse.json(await founderHandoffQueue(), { headers: expansionHeaders }) }
  catch(error) { return expansionFailure(error) }
}
export async function POST(request: Request) {
  try {
    if (!deliveryHandoffEnabled()) throw new ExpansionError("Delivery handoff is unavailable.",404)
    const actor = await requireCapability("expansion.manage")
    const rate = await checkDurableRateLimit("ascend:handoffs:"+actor.id,30,60000)
    if (!rate.ok) return NextResponse.json({error:"Please wait before trying again."},{status:429,headers:expansionHeaders})
    const input = await expansionBody(request)
    if (input.action !== "approve") throw new ExpansionError("Unknown handoff action.",400)
    return NextResponse.json({ result: await approveDeliveryHandoff({
      opportunityId:input.opportunityId,expectedContractId:input.expectedContractId,
      confirm:input.confirm,reason:input.reason,
    }) },{headers:expansionHeaders})
  } catch(error) { return expansionFailure(error) }
}
