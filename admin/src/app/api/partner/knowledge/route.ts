import { NextResponse } from "next/server"
import { searchKnowledge } from "@/lib/server/empower-knowledge"
import { expansionFailure, expansionHeaders } from "@/lib/server/expansion-http"
export const dynamic = "force-dynamic"
/** Partner Knowledge Base (Operation Empower B1.4), read-only search. 404 unless PARTNER_KNOWLEDGE_BASE_ENABLED=true. */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams
    return NextResponse.json(await searchKnowledge({ q: params.get("q") ?? undefined, topic: params.get("topic") ?? undefined }), { headers: expansionHeaders })
  } catch (error) { return expansionFailure(error) }
}
