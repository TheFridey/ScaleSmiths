import { NextResponse } from "next/server"
import { meetingPreparation, opportunityGuidance, partnerToday, searchGuidance } from "@/lib/server/empower-guidance"
import { expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
export const dynamic = "force-dynamic"
/**
 * Operation Empower B1.6 unified partner workspace, read-only. 404 unless PARTNER_UNIFIED_WORKSPACE_ENABLED=true.
 *   ?view=today | ?opportunity=<id> | ?meeting=<id> | ?q=<text>&type=<answer|resource|lesson|course>
 */
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams
    const body = p.get("view") === "today" ? await partnerToday()
      : p.has("opportunity") ? await opportunityGuidance(p.get("opportunity"))
      : p.has("meeting") ? await meetingPreparation(p.get("meeting"))
      : await searchGuidance({ q: p.get("q") ?? undefined, type: p.get("type") ?? undefined })
    return NextResponse.json(body, { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}
