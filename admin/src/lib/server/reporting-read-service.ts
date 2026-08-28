import "server-only"

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { monthlyReports } from "@/lib/schema"

export async function getReportingDashboardSnapshot(month: number, year: number) {
  const reports = await db.select({ clientId: monthlyReports.clientId })
    .from(monthlyReports)
    .where(and(eq(monthlyReports.month, month), eq(monthlyReports.year, year)))
  return { currentMonthReportCount: reports.length, clientIdsWithCurrentReport: new Set(reports.map((report) => report.clientId)) }
}
