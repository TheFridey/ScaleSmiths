import { NextResponse } from "next/server"
import { ExpansionError } from "@/lib/expansion"
import { expansionBody, expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
import { requireCapability } from "@/lib/server/rbac"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
import { assignFounder, founderCommandCentre, founderSalesCommandEnabled } from "@/lib/server/sales-command"
export const dynamic = "force-dynamic"
/**
 * Operation Ascend B2.3 founder sales command centre. 404 unless FOUNDER_SALES_COMMAND_ENABLED=true.
 *   GET   overview, prioritised work queue and partner oversight
 *   POST  {action:"assign", opportunityId, assigneeId|null, reason, expectedCurrentId|null}
 */
export async function GET() {
  try { return NextResponse.json(await founderCommandCentre(), { headers: expansionHeaders }) } catch (error) { return expansionFailure(error) }
}
export async function POST(request: Request) {
  try {
    if (!founderSalesCommandEnabled()) throw new ExpansionError("The sales command centre is not available yet.", 404)
    const actor = await requireCapability("expansion.manage")
    const limit = await checkDurableRateLimit(`expansion:command:${actor.id}`, 60, 60000)
    if (!limit.ok) return NextResponse.json({ error: "Please wait before making another change." }, { status: 429, headers: expansionHeaders })
    const input = await expansionBody(request)
    if (input.action !== "assign") throw new ExpansionError("Unknown command.")
    return NextResponse.json({ result: await assignFounder({ opportunityId: input.opportunityId, assigneeId: input.assigneeId ?? null, reason: input.reason, expectedCurrentId: input.expectedCurrentId ?? null }) }, { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}
