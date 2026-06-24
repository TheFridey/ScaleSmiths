import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "../../../../../../auth"
import { db } from "@/lib/db"
import { parseTimelineUpdate } from "@/lib/client-timeline"
import { clientRequests, clientTimelineEvents } from "@/lib/schema"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.name ?? session?.user?.email ?? "ScaleSmiths"
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const id = parseId(rawId)

  if (!id) {
    return NextResponse.json({ error: "Invalid client request id." }, { status: 400 })
  }

  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid timeline payload." }, { status: 400 })
  }

  const parsed = parseTimelineUpdate(payload as Record<string, unknown>)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const [existing] = await db.select().from(clientRequests).where(eq(clientRequests.id, id)).limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Client request not found." }, { status: 404 })
  }

  const [timelineEvent] = await db
    .insert(clientTimelineEvents)
    .values({
      clientId: existing.clientId,
      requestId: existing.id,
      type: "manual_update",
      title: parsed.data.title,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
      createdBy: sessionActor(session),
    })
    .returning()

  return NextResponse.json({ ok: true, timelineEvent }, { status: 201 })
}
