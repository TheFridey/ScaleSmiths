import { MONTHLY_REPORT_STATUSES, type MonthlyReportStatus } from "../../../domain/monthly-reports"
export { MONTHLY_REPORT_STATUSES, type MonthlyReportStatus } from "../../../domain/monthly-reports"
export const MONTHLY_REPORT_STATUS_LABELS: Record<MonthlyReportStatus, string> = { draft: "Draft", published: "Published" }
export function isMonthlyReportStatus(value: unknown): value is MonthlyReportStatus { return typeof value === "string" && MONTHLY_REPORT_STATUSES.includes(value as MonthlyReportStatus) }

export function formatReportPeriod(month: number, year: number) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)))
}
