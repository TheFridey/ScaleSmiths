import { NextResponse } from "next/server"
import { ascendFailure, ascendHeaders } from "@/lib/server/ascend-http"
import { AscendError, agentCapabilities, ascendAgentApiEnabled, authenticateService } from "@/lib/server/ascend-engine"
export const dynamic = "force-dynamic"

/** TITAN OS / Jarvis capability discovery: only the actions this identity may request. */
export async function GET(request: Request) {
  try {
    if (!ascendAgentApiEnabled()) throw new AscendError("Not found.", 404)
    const service = await authenticateService(request.headers, "operations.read")
    return NextResponse.json(await agentCapabilities(service), { headers: ascendHeaders })
  } catch (error) { return ascendFailure(error) }
}
