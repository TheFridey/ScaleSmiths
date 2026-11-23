import { NextResponse } from "next/server"
import { ExpansionError } from "@/lib/expansion"
import { expansionBody, expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
import { ascendAutomationEnabled } from "@/lib/server/ascend-automation"
import { requireCapability } from "@/lib/server/rbac"
import {
  claimInternalReviewJob, finishInternalReviewJob, founderReviewJobQueue,
  resolveInternalReviewJob, syncFounderReviewJobs,
} from "@/lib/server/ascend-review-queue"
export const dynamic = "force-dynamic"
export async function GET() {
  try { return NextResponse.json(await founderReviewJobQueue(),{headers:expansionHeaders}) }
  catch(error) { return expansionFailure(error) }
}
/** Founder-invoked internal preparation only. No external dispatch and no unattended process. */
export async function POST(request:Request) {
  try {
    if(!ascendAutomationEnabled())throw new ExpansionError("Operational automation is unavailable.",404)
    const actor=await requireCapability("expansion.manage")
    const rate=await checkDurableRateLimit("ascend:review:"+actor.id,20,60000)
    if(!rate.ok)return NextResponse.json({error:"Too many review requests."},{status:429,headers:expansionHeaders})
    const body=await expansionBody(request)
    if(body.action==="observe")return NextResponse.json({result:await syncFounderReviewJobs()},{headers:expansionHeaders})
    if(body.action==="prepare") {
      const claim=await claimInternalReviewJob()
      if(!claim)return NextResponse.json({result:null,message:"No review task is due."},{headers:expansionHeaders})
      try {
        // Only validate and prepare an internal suggestion. DO NOT send, notify, pay or create projects.
        if(!claim.payload || !claim.payload.id || !claim.payload.href.startsWith("/") || claim.payload.href.startsWith("//"))
          throw new ExpansionError("The stored signal is not a safe review task.",409)
        return NextResponse.json({result:await finishInternalReviewJob(claim.id,claim.token,true)},{headers:expansionHeaders})
      } catch {
        return NextResponse.json({result:await finishInternalReviewJob(claim.id,claim.token,false,new Date(),"Invalid internal advisory signal")},{headers:expansionHeaders})
      }
    }
    if(body.action==="resolve")return NextResponse.json({result:await resolveInternalReviewJob(String(body.id??""))},{headers:expansionHeaders})
    throw new ExpansionError("Unknown review action.",400)
  }catch(error){return expansionFailure(error)}
}
