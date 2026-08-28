import { MONTHLY_REPORT_STATUSES, type MonthlyReportStatus } from "../../../domain/monthly-reports"
export { MONTHLY_REPORT_STATUSES, type MonthlyReportStatus } from "../../../domain/monthly-reports"
export const MONTHLY_REPORT_GENERATORS = ["forge", "manual"] as const

export type MonthlyReportGeneratedBy = (typeof MONTHLY_REPORT_GENERATORS)[number]
export const MONTHLY_REPORT_STATUS_LABELS: Record<MonthlyReportStatus, string> = { draft: "Draft", published: "Published" }
export function isMonthlyReportStatus(value: unknown): value is MonthlyReportStatus { return typeof value === "string" && MONTHLY_REPORT_STATUSES.includes(value as MonthlyReportStatus) }

export function parseReportPeriod(input: Record<string, unknown>, now = new Date()) {
  const month = Number.parseInt(String(input.month ?? now.getMonth() + 1), 10)
  const year = Number.parseInt(String(input.year ?? now.getFullYear()), 10)

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false as const, error: "Report month must be between 1 and 12." }
  }

  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return { ok: false as const, error: "Report year is invalid." }
  }

  return { ok: true as const, data: { month, year } }
}

export function parseReportEditPayload(input: Record<string, unknown>) {
  const title = optionalString(input.title, 240)
  const summary = optionalString(input.summary, 2000)
  const htmlContent = optionalString(input.htmlContent, 200_000)

  if (!title) return { ok: false as const, error: "Report title is required." }
  if (!summary) return { ok: false as const, error: "Report summary is required." }
  if (!htmlContent) return { ok: false as const, error: "Report HTML content is required." }

  return { ok: true as const, data: { title, summary, htmlContent } }
}

export function formatReportPeriod(month: number, year: number) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)))
}

function optionalString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null
}
