import { NextResponse } from "next/server"
import { searchObjections } from "@/lib/server/empower-objections"
import { expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
export const dynamic = "force-dynamic"
/** Partner objection handling (Operation Empower B1.5), read-only search. 404 unless PARTNER_OBJECTION_HANDLING_ENABLED=true. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    return NextResponse.json(await searchObjections({ q: params.get("q") ?? undefined, category: params.get("category") ?? undefined }), { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}
