import "server-only"

import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { formatReportPeriod } from "@/lib/monthly-reports"
import { monthlyReports } from "@/lib/schema"

const portalReportSummary = {
  id: monthlyReports.id,
  month: monthlyReports.month,
  year: monthlyReports.year,
  title: monthlyReports.title,
  summary: monthlyReports.summary,
  publishedAt: monthlyReports.publishedAt,
}

export async function listPublishedPortalReports(portalClientId: string) {
  return db.select(portalReportSummary).from(monthlyReports)
    .where(and(eq(monthlyReports.clientId, portalClientId), eq(monthlyReports.status, "published")))
    .orderBy(desc(monthlyReports.year), desc(monthlyReports.month), desc(monthlyReports.publishedAt))
}

export async function getLatestPublishedPortalReport(portalClientId: string) {
  const [report] = await db.select(portalReportSummary).from(monthlyReports)
    .where(and(eq(monthlyReports.clientId, portalClientId), eq(monthlyReports.status, "published")))
    .orderBy(desc(monthlyReports.year), desc(monthlyReports.month), desc(monthlyReports.publishedAt))
    .limit(1)
  if (!report) return null
  return {
    id: report.id,
    title: report.title,
    summary: report.summary,
    periodLabel: formatReportPeriod(report.month, report.year),
    publishedAt: report.publishedAt?.toISOString() ?? null,
  }
}

export async function getPublishedPortalReport(portalClientId: string, reportId: number) {
  const [report] = await db.select({
    id: monthlyReports.id,
    title: monthlyReports.title,
    htmlContent: monthlyReports.htmlContent,
  }).from(monthlyReports).where(and(
    eq(monthlyReports.id, reportId),
    eq(monthlyReports.clientId, portalClientId),
    eq(monthlyReports.status, "published"),
  )).limit(1)
  return report ?? null
}
