import { NextResponse } from "next/server"
import { PortalUserError } from "@/lib/portal-users"
import { guardApiCapability } from "@/lib/server/rbac"
import { updatePortalUser } from "@/lib/server/portal-users"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new PortalUserError("Invalid portal user payload.")
    const input = body as Record<string, unknown>
    const credentialChange = input.resetPassword === true || input.password !== undefined
    const accountChange = input.email !== undefined || input.active !== undefined
    if (credentialChange && accountChange) throw new PortalUserError("Credential resets must be submitted separately from email or status changes.")
    await guardApiCapability(credentialChange ? "portal_users.credentials.reset" : "portal_users.manage")
    const { id } = await params
    return NextResponse.json({ ok: true, user: await updatePortalUser(id, input) })
  } catch (error) {
    if (error instanceof PortalUserError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    return NextResponse.json({ error: "Unable to update portal user." }, { status: 500 })
  }
}
