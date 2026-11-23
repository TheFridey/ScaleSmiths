import { NextResponse } from "next/server"
import { expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
import { founderAutomationSignals } from "@/lib/server/ascend-automation"
export const dynamic = "force-dynamic"
export async function GET() {
  try { return NextResponse.json(await founderAutomationSignals(), { headers: expansionHeaders }) }
  catch(error) { return expansionFailure(error) }
}
