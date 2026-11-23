import { NextResponse } from "next/server"
import { expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
import { partnerDeliveryHandoffs } from "@/lib/server/delivery-handoff"
export const dynamic = "force-dynamic"
/** Strictly partner-owned projection. Excludes founder notes, accepted scope and internal project IDs. */
export async function GET() {
  try { return NextResponse.json(await partnerDeliveryHandoffs(),{headers:expansionHeaders}) }
  catch(error) { return expansionFailure(error) }
}
