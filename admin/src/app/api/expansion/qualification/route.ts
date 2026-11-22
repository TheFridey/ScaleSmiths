import { NextResponse } from "next/server"
import { expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
import { founderQualification } from "@/lib/server/expansion-qualification"
export const dynamic = "force-dynamic"
/** Operation Ascend B2.2: founder inspection of an opportunity's readiness factors. Read-only. 404 unless PARTNER_QUALIFICATION_ENABLED=true. */
export async function GET(request: Request) {
  try { return NextResponse.json(await founderQualification(new URL(request.url).searchParams.get("id")), { headers: expansionHeaders }) }
  catch (error) { return expansionFailure(error) }
}
