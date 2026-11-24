import { NextResponse } from "next/server"
import { ascendFailure, ascendHeaders, ascendMachineBody } from "@/lib/server/ascend-http"
import { AscendError, ascendAgentApiEnabled, authenticateService, cancelExecution } from "@/lib/server/ascend-engine"
export const dynamic = "force-dynamic"

/** Cancellation request for the agent's own operation. Running work is asked to stop, never falsely reported cancelled. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!ascendAgentApiEnabled()) throw new AscendError("Not found.", 404)
    const service = await authenticateService(request.headers, "operations.cancel")
    const body = await ascendMachineBody(request)
    return NextResponse.json(await cancelExecution(service, (await context.params).id, body.reason ?? "Cancelled by requesting agent"), { headers: ascendHeaders })
  } catch (error) { return ascendFailure(error) }
}
