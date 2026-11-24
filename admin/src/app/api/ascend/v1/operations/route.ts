import { NextResponse } from "next/server"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
import { ascendFailure, ascendHeaders, ascendMachineBody } from "@/lib/server/ascend-http"
import { AGENT_CONTRACT_VERSION, AscendError, ascendAgentApiEnabled, authenticateService, submitExecution } from "@/lib/server/ascend-engine"
export const dynamic = "force-dynamic"

/**
 * Structured task submission for agents. The same policy, approval, market and emergency-stop rules apply as for
 * founders; agents can never approve their own work. Idempotency-Key is required so retries never duplicate work.
 */
export async function POST(request: Request) {
  try {
    if (!ascendAgentApiEnabled()) throw new AscendError("Not found.", 404)
    const service = await authenticateService(request.headers, "operations.submit")
    if (!(await checkDurableRateLimit(`ascend:agent:${service.id}`, 30, 60000)).ok) throw new AscendError("Agent rate limit reached.", 429, "rate_limited")
    const key = request.headers.get("idempotency-key")
    if (!key) throw new AscendError("An Idempotency-Key header is required.", 400, "invalid_payload")
    const body = await ascendMachineBody(request)
    if (body.contract !== AGENT_CONTRACT_VERSION) throw new AscendError(`Unsupported contract. Use ${AGENT_CONTRACT_VERSION}.`, 400, "invalid_payload")
    const result = await submitExecution(service, { actionType: body.actionType, payload: body.payload, scope: body.scope, idempotencyKey: `agent:${service.id}:${key}`, correlationId: body.correlationId })
    return NextResponse.json({ contract: AGENT_CONTRACT_VERSION, ...result }, { status: result.replay ? 200 : 202, headers: ascendHeaders })
  } catch (error) { return ascendFailure(error) }
}
