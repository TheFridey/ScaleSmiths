import { NextResponse } from "next/server"
import { auth } from "../../../../../auth"
import { revokeOwnAdminSessions } from "@/lib/server/admin-users"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  await revokeOwnAdminSessions(session.user.id)
  return NextResponse.json({ ok: true })
}
