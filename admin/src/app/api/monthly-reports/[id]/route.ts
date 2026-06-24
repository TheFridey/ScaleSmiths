import { NextRequest, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { auth } from "../../../../../auth"
import { db } from "@/lib/db"
import { formatReportPeriod, parseReportEditPayload } from "@/lib/monthly-reports"
import { clientTimelineEvents, monthlyReports } from "@/lib/schema"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function sessionActor(session: { user?: { email?: string | null; name?: string | null } } | null) {
  return session?.user?.name ?? session?.user?.email ?? "ScaleSmiths"
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const { id: rawId } = await params
  const id = parseId(rawId)

  if (!id) {
    return NextResponse.json({ error: "Invalid report id." }, { status: 400 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid report payload." }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const action = typeof input.action === "string" ? input.action : "update"
  const [existing] = await db.select().from(monthlyReports).where(eq(monthlyReports.id, id)).limit(1)

  if (!existing) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 })
  }

  const now = new Date()

  if (action === "publish") {
    const { report, timelineEvent } = await db.transaction(async (tx) => {
      const [published] = await tx
        .update(monthlyReports)
        .set({ status: "published", publishedAt: existing.publishedAt ?? now, updatedAt: now })
        .where(eq(monthlyReports.id, existing.id))
        .returning()
      const [createdTimelineEvent] = await tx
        .insert(clientTimelineEvents)
        .values({
          clientId: existing.clientId,
          type: "monthly_report_published",
          title: "Monthly report published",
          description: `${published.title} is now available in your client portal.`,
          visibility: "client_visible",
          createdBy: sessionActor(session),
          createdAt: now,
        })
        .returning()

      return { report: published, timelineEvent: createdTimelineEvent }
    })

    return NextResponse.json({ ok: true, report: serializeReport(report), timelineEvent })
  }

  if (action !== "update") {
    return NextResponse.json({ error: "Unsupported report action." }, { status: 400 })
  }

  const parsed = parseReportEditPayload(input)

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const [report] = await db
    .update(monthlyReports)
    .set({
      title: parsed.data.title,
      summary: parsed.data.summary,
      htmlContent: parsed.data.htmlContent,
      generatedBy: "manual",
      updatedAt: now,
    })
    .where(eq(monthlyReports.id, existing.id))
    .returning()

  return NextResponse.json({ ok: true, report: serializeReport(report) })
}

function serializeReport(row: typeof monthlyReports.$inferSelect) {
  return {
    id: row.id,
    clientId: row.clientId,
    month: row.month,
    year: row.year,
    period: formatReportPeriod(row.month, row.year),
    title: row.title,
    summary: row.summary,
    htmlContent: row.htmlContent,
    status: row.status,
    generatedBy: row.generatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  }
}
