import { NextResponse } from "next/server"
import { PortalUserError } from "@/lib/portal-users"
import { listPortalUsers, provisionPortalAccount } from "@/lib/server/portal-users"
import { guardApiCapability } from "@/lib/server/rbac"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await guardApiCapability("portal_users.read")
    return NextResponse.json({ users: await listPortalUsers() })
  } catch (error) { return portalError(error) }
}

export async function POST(request: Request) {
  try {
    const actor = await guardApiCapability("portal_users.manage")
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new PortalUserError("Invalid portal user payload.")
    const input = body as Record<string, unknown>
    if (input.purpose === "reset") await guardApiCapability("portal_users.credentials.reset")
    const user = await provisionPortalAccount(input, actor)
    return NextResponse.json({ ok: true, user }, { status: 201 })
  } catch (error) { return portalError(error) }
}

function portalError(error: unknown) {
  if (error instanceof PortalUserError) return NextResponse.json({ error: error.safeMessage }, { status: error.status })
  return NextResponse.json({ error: "Unable to manage portal users." }, { status: 500 })
}
