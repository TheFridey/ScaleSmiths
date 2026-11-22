import { NextResponse } from "next/server"
import { ExpansionError } from "@/lib/expansion"
import { expansionBody, expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
import { requireCapability } from "@/lib/server/rbac"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
import { revenueIntelligence, revenueIntelligenceEnabled, saveForecastAssumptions } from "@/lib/server/revenue-intelligence"
export const dynamic = "force-dynamic"
/**
 * Operation Ascend B2.4 revenue intelligence. 404 unless REVENUE_INTELLIGENCE_ENABLED=true; founders with finance access only.
 *   GET   actual revenue from authoritative records, forecast inputs and saved scenarios
 *   POST  {action:"save_assumptions", scenario, stageBasisPoints, averageValuePence, monthlyRetentionBasisPoints, horizonMonths, rationale}
 */
export async function GET() {
  try { return NextResponse.json(await revenueIntelligence(), { headers: expansionHeaders }) } catch (error) { return expansionFailure(error) }
}
export async function POST(request: Request) {
  try {
    if (!revenueIntelligenceEnabled()) throw new ExpansionError("Revenue intelligence is not available yet.", 404)
    const actor = await requireCapability("expansion.manage")
    const limit = await checkDurableRateLimit(`expansion:revenue:${actor.id}`, 30, 60000)
    if (!limit.ok) return NextResponse.json({ error: "Please wait before making another change." }, { status: 429, headers: expansionHeaders })
    const input = await expansionBody(request)
    if (input.action !== "save_assumptions") throw new ExpansionError("Unknown command.")
    return NextResponse.json({ result: await saveForecastAssumptions(input) }, { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}
