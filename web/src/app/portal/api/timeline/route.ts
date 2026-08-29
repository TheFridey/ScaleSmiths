import { NextRequest, NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { serializeClientPortalTimelineEvent } from "@/lib/client-timeline"
import { db } from "@/lib/db"
import { getClientSessionFromRequest, unauthorizedClientPortalResponse } from "@/lib/portal-session"
import { clientTimelineEvents } from "@/lib/schema"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const session = await getClientSessionFromRequest(request)

  if (!session) {
    return unauthorizedClientPortalResponse(request)
  }

  try {
    const rows = await db
      .select({
        id: clientTimelineEvents.id,
        clientId: clientTimelineEvents.clientId,
        requestId: clientTimelineEvents.requestId,
        projectId: clientTimelineEvents.projectId,
        type: clientTimelineEvents.type,
        title: clientTimelineEvents.title,
        description: clientTimelineEvents.description,
        visibility: clientTimelineEvents.visibility,
        createdBy: clientTimelineEvents.createdBy,
        sourceDomain: clientTimelineEvents.sourceDomain,
        actorLabel: clientTimelineEvents.actorLabel,
        occurredAt: clientTimelineEvents.occurredAt,
        createdAt: clientTimelineEvents.createdAt,
      })
      .from(clientTimelineEvents)
      .where(and(
        eq(clientTimelineEvents.clientId, session.clientId),
        eq(clientTimelineEvents.visibility, "client_visible"),
      ))
      .orderBy(desc(clientTimelineEvents.occurredAt), desc(clientTimelineEvents.id))
      .limit(20)

    return NextResponse.json({
      ok: true,
      timeline: rows.map(serializeClientPortalTimelineEvent).filter((event) => event !== null),
    })
  } catch {
    return NextResponse.json({ error: "Unable to load timeline right now." }, { status: 500 })
  }
}
