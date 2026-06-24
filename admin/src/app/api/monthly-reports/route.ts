import { NextRequest, NextResponse } from "next/server"
import { desc, eq } from "drizzle-orm"
import { auth } from "../../../../auth"
import { db } from "@/lib/db"
import { parseReportPeriod } from "@/lib/monthly-reports"
import { generateMonthlyClientReport } from "@/lib/server/monthly-report-generator"
import { monthlyReports } from "@/lib/schema"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

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
  const session = await auth()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

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
    const [report] = await db
      .insert(monthlyReports)
      .values({
        clientId,
        month: period.data.month,
        year: period.data.year,
        title: generated.title,
        summary: generated.summary,
        htmlContent: generated.htmlContent,
        status: "draft",
        generatedBy: generated.generatedBy,
        updatedAt: now,
      })
      .returning()

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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  }
}
