import { NextResponse } from "next/server"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
import { ascendFailure, ascendHeaders, ascendMachineBody } from "@/lib/server/ascend-http"
import { AscendError, authenticateService, renewLease, workerTick } from "@/lib/server/ascend-engine"
export const dynamic = "force-dynamic"

/**
 * ASCEND worker endpoint. Authenticates a scoped worker identity (never a founder session), then performs one
 * bounded tick: heartbeat, optional scheduling, and at most one execution. Excluded from interactive auth in middleware.
 */
export async function POST(request: Request) {
  try {
    const service = await authenticateService(request.headers, "worker.execute")
    if (!(await checkDurableRateLimit(`ascend:worker:${service.id}`, 240, 60000)).ok) throw new AscendError("Worker rate limit reached.", 429, "rate_limited")
    const body = await ascendMachineBody(request)
    if (body.op === "renew") return NextResponse.json(await renewLease(service, { id: String(body.id ?? ""), token: String(body.token ?? "") }), { headers: ascendHeaders })
    return NextResponse.json(await workerTick(service, { workerId: body.workerId, version: body.version, maxConcurrency: body.maxConcurrency, inFlight: body.inFlight, status: body.status }), { headers: ascendHeaders })
  } catch (error) { return ascendFailure(error) }
}
