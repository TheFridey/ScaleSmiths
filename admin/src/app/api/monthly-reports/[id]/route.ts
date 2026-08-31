import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { formatReportPeriod, parseReportEditPayload } from "@/lib/monthly-reports"
import { clients, monthlyReportAuditLogs, monthlyReports } from "@/lib/schema"
import { recordClientActivity } from "@/lib/server/client-activity"
import { guardApiCapability } from "@/lib/server/rbac"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseId(value: string) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let actor: Awaited<ReturnType<typeof guardApiCapability>>
  try { actor = await guardApiCapability("finance.write") } catch { return NextResponse.json({ error: "Forbidden." }, { status: 403 }) }
  const actorLabel = actor.displayName ?? actor.email ?? actor.id

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

  if (existing.status === "published") {
    return NextResponse.json({ error: "Published reports are immutable. Generate a new version to make changes." }, { status: 409 })
  }

  if (action === "review") {
    const report = await db.transaction(async (tx) => {
      const [reviewed] = await tx.update(monthlyReports).set({ reviewedAt: now, reviewedBy: actorLabel, updatedAt: now })
        .where(and(eq(monthlyReports.id, existing.id), eq(monthlyReports.status, "draft"))).returning()
      if (!reviewed) throw new Error("Report changed before review.")
      await tx.insert(monthlyReportAuditLogs).values({ reportId: reviewed.id, clientId: reviewed.clientId, action: "reviewed", actor: actorLabel, metadataJson: { version: reviewed.version } })
      return reviewed
    })
    return NextResponse.json({ ok: true, report: serializeReport(report) })
  }

  if (action === "publish") {
    if (!existing.reviewedAt || !existing.reviewedBy) return NextResponse.json({ error: "Review and approve the draft before publication." }, { status: 409 })
    const { report, timelineEvent } = await db.transaction(async (tx) => {
      const [published] = await tx
        .update(monthlyReports)
        .set({ status: "published", publishedAt: now, publishedBy: actorLabel, updatedAt: now })
        .where(and(eq(monthlyReports.id, existing.id), eq(monthlyReports.status, "draft")))
        .returning()
      if (!published) throw new Error("Report changed before publication.")
      const [client] = await tx.select({ id: clients.id }).from(clients).where(eq(clients.portalClientId, existing.clientId)).limit(1)
      if (!client) throw new Error("The report client is not linked to an internal client record.")
      await tx.insert(monthlyReportAuditLogs).values({ reportId: published.id, clientId: published.clientId, action: "published", actor: actorLabel, metadataJson: { version: published.version, reviewedBy: published.reviewedBy } })
      const createdTimelineEvent = await recordClientActivity(tx, { clientRecordId: client.id, portalClientId: existing.clientId, sourceDomain: "report", sourceReference: `report:${published.id}:published`, type: "monthly_report_published", title: "Monthly report published", description: `${published.title} is now available in your client portal.`, visibility: "client_visible", actor: { type: "admin", id: actor.id, label: actorLabel }, occurredAt: now, idempotencyKey: `report:${published.id}:published` })

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
      reviewedAt: null,
      reviewedBy: null,
      updatedAt: now,
    })
    .where(and(eq(monthlyReports.id, existing.id), eq(monthlyReports.status, "draft")))
    .returning()

  await db.insert(monthlyReportAuditLogs).values({ reportId: report.id, clientId: report.clientId, action: "draft_updated", actor: actorLabel, metadataJson: { version: report.version, reviewCleared: Boolean(existing.reviewedAt) } })

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
    version: row.version,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  }
}
