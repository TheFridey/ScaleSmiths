import { NextResponse } from "next/server"
import { expansionBody } from "@/lib/server/expansion-http"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
import { ascendFailure, ascendHeaders } from "@/lib/server/ascend-http"
import {
  AscendError, approveExecution, authorisedFounder, cancelExecution, createServiceIdentity, engineOverview, executionDetail, listExecutions,
  reconcileAmbiguous, rejectExecution, retryExecution, revokeServiceIdentity, rotateServiceIdentity, setControl, submitExecution, updateDefinition,
} from "@/lib/server/ascend-engine"
export const dynamic = "force-dynamic"

/** Founder-only ASCEND command centre API. Every command re-reads founder authority from the database. */
export async function GET(request: Request) {
  try {
    await authorisedFounder()
    const params = new URL(request.url).searchParams
    const view = params.get("view") ?? "overview"
    if (view === "overview") return NextResponse.json(await engineOverview(), { headers: ascendHeaders })
    if (view === "executions") return NextResponse.json(await listExecutions(Object.fromEntries(params)), { headers: ascendHeaders })
    if (view === "execution") return NextResponse.json(await executionDetail(params.get("id")), { headers: ascendHeaders })
    throw new AscendError("Unknown view.", 400)
  } catch (error) { return ascendFailure(error) }
}

export async function POST(request: Request) {
  try {
    const actor = await authorisedFounder()
    if (!(await checkDurableRateLimit(`ascend:engine:${actor.id}`, 60, 60000)).ok)
      return NextResponse.json({ error: "Too many command centre requests. Wait a minute and try again." }, { status: 429, headers: ascendHeaders })
    const body = await expansionBody(request)
    const r = await (async () => {
      switch (body.action) {
        case "submit": return submitExecution(actor, { actionType: body.actionType, payload: body.payload, scope: body.scope, idempotencyKey: body.idempotencyKey })
        case "approve": return approveExecution(actor, body.id, { payloadSha256: body.payloadSha256, policyVersion: body.policyVersion })
        case "reject": return rejectExecution(actor, body.id, body.reason)
        case "cancel": return cancelExecution(actor, body.id, body.reason)
        case "retry": return retryExecution(actor, body.id)
        case "reconcile": return reconcileAmbiguous(actor, body.id, body.outcome, body.note)
        case "control": return setControl(actor, body.scope, body.suspended, body.reason, body.expectedVersion)
        case "definition": return updateDefinition(actor, body.actionType, body.patch)
        case "identity_create": return createServiceIdentity(actor, { name: body.name, kind: body.kind, capabilities: body.capabilities, allowedActions: body.allowedActions })
        case "identity_rotate": return rotateServiceIdentity(actor, body.id)
        case "identity_revoke": return revokeServiceIdentity(actor, body.id, body.reason)
        default: throw new AscendError("Unknown command.", 400)
      }
    })()
    return NextResponse.json({ result: r }, { headers: ascendHeaders })
  } catch (error) { return ascendFailure(error) }
}
