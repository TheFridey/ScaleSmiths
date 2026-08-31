import { NextRequest, NextResponse } from "next/server"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { parseReportPeriod } from "@/lib/monthly-reports"
import { generateMonthlyClientReport } from "@/lib/server/monthly-report-generator"
import { monthlyReportAuditLogs, monthlyReports } from "@/lib/schema"
import { guardApiCapability } from "@/lib/server/rbac"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export async function GET(request: NextRequest) {
  try { await guardApiCapability("finance.read") } catch { return NextResponse.json({ error: "Forbidden." }, { status: 403 }) }

  const clientId = optionalString(request.nextUrl.searchParams.get("clientId"))

  if (!clientId) {
    return NextResponse.json({ error: "Client id is required." }, { status: 400 })
  }

  const rows = await db
    .select()
    .from(monthlyReports)
    .where(eq(monthlyReports.clientId, clientId))
    .orderBy(desc(monthlyReports.year), desc(monthlyReports.month), desc(monthlyReports.createdAt))
    .limit(12)

  return NextResponse.json({ ok: true, reports: rows.map(serializeReport) })
}

export async function POST(request: NextRequest) {
  let actor: Awaited<ReturnType<typeof guardApiCapability>>
  try { actor = await guardApiCapability("finance.write") } catch { return NextResponse.json({ error: "Forbidden." }, { status: 403 }) }

  const body = await request.json().catch(() => null)

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid report payload." }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const clientId = optionalString(input.clientId)
  const period = parseReportPeriod(input)

  if (!clientId) {
    return NextResponse.json({ error: "Client id is required." }, { status: 400 })
  }

  if (!period.ok) {
    return NextResponse.json({ error: period.error }, { status: 400 })
  }

  try {
    const generated = await generateMonthlyClientReport({
      clientId,
      month: period.data.month,
      year: period.data.year,
    })
    const now = new Date()
    const report = await db.transaction(async (tx) => {
      const [latest] = await tx.select({ version: monthlyReports.version }).from(monthlyReports)
        .where(and(eq(monthlyReports.clientId, clientId), eq(monthlyReports.month, period.data.month), eq(monthlyReports.year, period.data.year)))
        .orderBy(desc(monthlyReports.version)).limit(1)
      const [created] = await tx.insert(monthlyReports).values({
        clientId,
        month: period.data.month,
        year: period.data.year,
        title: generated.title,
        summary: generated.summary,
        htmlContent: generated.htmlContent,
        status: "draft",
        generatedBy: generated.generatedBy,
        version: (latest?.version ?? 0) + 1,
        sourceSnapshot: generated.sourceSnapshot,
        updatedAt: now,
      }).returning()
      await tx.insert(monthlyReportAuditLogs).values({ reportId: created.id, clientId, action: "draft_generated", actor: actor.email ?? actor.id, metadataJson: { version: created.version, evidenceSchemaVersion: generated.sourceSnapshot.schemaVersion } })
      return created
    })

    return NextResponse.json({ ok: true, report: serializeReport(report) }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Unable to generate monthly report right now." }, { status: 500 })
  }
}

function serializeReport(row: typeof monthlyReports.$inferSelect) {
  return {
    id: row.id,
    clientId: row.clientId,
    month: row.month,
    year: row.year,
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
