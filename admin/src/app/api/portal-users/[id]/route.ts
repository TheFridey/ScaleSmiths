import { NextResponse } from "next/server"
import { PortalUserError } from "@/lib/portal-users"
import { requireAdminUserManager } from "@/lib/server/admin-session"
import { updatePortalUser } from "@/lib/server/portal-users"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminUserManager()
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new PortalUserError("Invalid portal user payload.")
    const { id } = await params
    return NextResponse.json({ ok: true, user: await updatePortalUser(id, body as Record<string, unknown>) })
  } catch (error) {
    if (error instanceof PortalUserError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    return NextResponse.json({ error: "Unable to update portal user." }, { status: 500 })
  }
}
