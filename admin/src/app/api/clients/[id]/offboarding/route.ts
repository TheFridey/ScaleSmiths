import { NextResponse } from "next/server"
import { ClientOffboardingError, completeClientOffboarding, getClientOffboarding, reactivateClient, startClientOffboarding, updateOffboardingItem } from "@/lib/server/client-offboarding"
import { guardApiCapability } from "@/lib/server/rbac"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { await guardApiCapability("clients.read"); return NextResponse.json({ ok: true, ...(await getClientOffboarding(await clientId(context))) }) }
  catch (error) { return failure(error) }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("clients.write")
    const body = await payload(request)
    return NextResponse.json({ ok: true, case: await startClientOffboarding(await clientId(context), body, actor) }, { status: 201 })
  } catch (error) { return failure(error) }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await guardApiCapability("clients.write")
    const id = await clientId(context)
    const body = await payload(request)
    const action = typeof body.action === "string" ? body.action : ""
    const caseId = positiveInteger(body.caseId, "Offboarding case")
    if (action === "update_item") return NextResponse.json({ ok: true, item: await updateOffboardingItem(id, caseId, positiveInteger(body.itemId, "Checklist item"), body, actor) })
    if (action === "complete") return NextResponse.json({ ok: true, case: await completeClientOffboarding(id, caseId, body, actor) })
    if (action === "reactivate") return NextResponse.json({ ok: true, case: await reactivateClient(id, caseId, body, actor) })
    throw new ClientOffboardingError("Unsupported offboarding action.")
  } catch (error) { return failure(error) }
}

async function clientId(context: { params: Promise<{ id: string }> }) { return positiveInteger((await context.params).id, "Client") }
async function payload(request: Request) { const body = await request.json().catch(() => null); if (!body || typeof body !== "object" || Array.isArray(body)) throw new ClientOffboardingError("Invalid offboarding payload."); return body as Record<string, unknown> }
function positiveInteger(value: unknown, label: string) { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed <= 0) throw new ClientOffboardingError(`${label} id is invalid.`); return parsed }
function failure(error: unknown) { return error instanceof ClientOffboardingError ? NextResponse.json({ error: error.safeMessage, code: error.code }, { status: error.status }) : NextResponse.json({ error: "Unable to update client offboarding." }, { status: 500 }) }
