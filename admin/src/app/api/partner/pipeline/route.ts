import { NextResponse } from "next/server"
import { ExpansionError } from "@/lib/expansion"
import { expansionBody, expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
import { partnerOpportunityDetail, partnerPipeline, partnerPipelineEnabled, recordInteraction, scheduleFollowUp } from "@/lib/server/partner-pipeline"
import { requireCapability } from "@/lib/server/rbac"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
export const dynamic = "force-dynamic"
/**
 * Operation Ascend B2.1 partner pipeline. 404 unless PARTNER_PIPELINE_ENABLED=true.
 *   GET            the partner's own pipeline
 *   GET ?id=<uuid> one of the partner's own opportunities (another partner's is a 404)
 *   POST {action:"record_interaction"|"schedule_follow_up", ...}
 * Stage changes, scope submission and assistance requests use POST /api/partner, which re-checks every rule.
 */
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")
    return NextResponse.json(id !== null ? await partnerOpportunityDetail(id) : await partnerPipeline(), { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}
export async function POST(request: Request) {
  try {
    if (!partnerPipelineEnabled()) throw new ExpansionError("The pipeline is not available yet.", 404)
    const actor = await requireCapability("expansion.partner")
    const limit = await checkDurableRateLimit(`expansion:pipeline:${actor.id}`, 60, 60000)
    if (!limit.ok) return NextResponse.json({ error: "Please wait before making another change." }, { status: 429, headers: expansionHeaders })
    const input = await expansionBody(request)
    if (input.action === "record_interaction") return NextResponse.json({ result: await recordInteraction(input) }, { headers: expansionHeaders })
    if (input.action === "schedule_follow_up") return NextResponse.json({ result: await scheduleFollowUp(input) }, { headers: expansionHeaders })
    throw new ExpansionError("Unknown pipeline action.")
  } catch (error) { return expansionFailure(error) }
}
