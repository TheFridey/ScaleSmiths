import { NextResponse } from "next/server"
import { partnerPerformance } from "@/lib/server/partner-performance"
import { expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
export const dynamic = "force-dynamic"
/** B2.5 read-only, partner-scoped dashboard; 404 while disabled. */
export async function GET(request: Request) {
  try {
    const period = new URL(request.url).searchParams.get("period")
    return NextResponse.json(await partnerPerformance(period), { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}
