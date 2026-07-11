import { NextResponse } from "next/server"
import { AdminIdentityError } from "@/lib/admin-users"
import { invalidateAdminMfa, resetAdminUserPassword, updateAdminUser } from "@/lib/server/admin-users"
import { requireAdminUserManager } from "@/lib/server/admin-session"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdminUserManager()
    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AdminIdentityError("Invalid user payload.")
    const input = body as Record<string, unknown>
    if (input.disableMfa === true) {
      if (typeof input.ownerPassword !== "string") throw new AdminIdentityError("Owner password is required to invalidate MFA.")
      await invalidateAdminMfa(id, actor, input.ownerPassword)
      return NextResponse.json({ ok: true, mfaDisabled: true })
    }
    if (typeof input.password === "string" && (input.role !== undefined || input.active !== undefined || input.revokeSessions === true)) throw new AdminIdentityError("Password resets must be submitted separately from role, status, or revocation changes.")
    if (typeof input.password === "string") await resetAdminUserPassword(id, input.password, actor)
    const hasAccountChange = input.role !== undefined || input.active !== undefined || input.revokeSessions === true
    const user = hasAccountChange ? await updateAdminUser(id, input, actor) : null
    return NextResponse.json({ ok: true, user })
  } catch (error) {
    if (error instanceof AdminIdentityError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
    return NextResponse.json({ error: "Unable to update admin user." }, { status: 500 })
  }
}
