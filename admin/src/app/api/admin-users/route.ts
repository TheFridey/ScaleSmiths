import { NextResponse } from "next/server"
import { AdminIdentityError } from "@/lib/admin-users"
import { createAdminUser, listAdminUsers } from "@/lib/server/admin-users"
import { requireAdminUserManager } from "@/lib/server/admin-session"
import { hasCapability } from "@/lib/rbac"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireAdminUserManager()
    return NextResponse.json({ users: await listAdminUsers() })
  } catch (error) { return identityError(error) }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminUserManager()
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new AdminIdentityError("Invalid user payload.")
    if ((body as Record<string, unknown>).role === "owner" && !hasCapability(actor.role, "users.assign_owner")) throw new AdminIdentityError("Only an owner can create another owner.", 403, "owner_required")
    const created = await createAdminUser(body as Record<string, unknown>)
    return NextResponse.json({ ok: true, userId: created.id }, { status: 201 })
  } catch (error) { return identityError(error) }
}

function identityError(error: unknown) {
  if (error instanceof AdminIdentityError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
  return NextResponse.json({ error: "Unable to manage admin users." }, { status: 500 })
}
