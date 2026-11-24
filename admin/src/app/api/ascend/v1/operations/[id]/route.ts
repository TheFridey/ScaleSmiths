import { NextResponse } from "next/server"
import { ascendFailure, ascendHeaders } from "@/lib/server/ascend-http"
import { AscendError, agentOperation, ascendAgentApiEnabled, authenticateService } from "@/lib/server/ascend-engine"
export const dynamic = "force-dynamic"

/** Status and structured result of an operation this identity submitted. Others' operations read as not found. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!ascendAgentApiEnabled()) throw new AscendError("Not found.", 404)
    const service = await authenticateService(request.headers, "operations.read")
    return NextResponse.json(await agentOperation(service, (await context.params).id), { headers: ascendHeaders })
  } catch (error) { return ascendFailure(error) }
}
