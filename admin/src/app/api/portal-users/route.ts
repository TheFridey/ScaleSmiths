import { NextResponse } from "next/server"
import { PortalUserError } from "@/lib/portal-users"
import { createPortalUser, listPortalUsers } from "@/lib/server/portal-users"
import { requireAdminUserManager } from "@/lib/server/admin-session"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireAdminUserManager()
    return NextResponse.json({ users: await listPortalUsers() })
  } catch (error) { return portalError(error) }
}

export async function POST(request: Request) {
  try {
    await requireAdminUserManager()
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new PortalUserError("Invalid portal user payload.")
    const input = body as Record<string, unknown>
    const user = await createPortalUser(input, input.testAccount === true)
    return NextResponse.json({ ok: true, user }, { status: 201 })
  } catch (error) { return portalError(error) }
}

function portalError(error: unknown) {
  if (error instanceof PortalUserError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
  return NextResponse.json({ error: "Unable to manage portal users." }, { status: 500 })
}
