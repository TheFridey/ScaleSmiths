// Persisted shared-database contract. Web owns the table/migrations; admin may manage reports.
export const MONTHLY_REPORT_STATUSES = ["draft", "published"] as const
export type MonthlyReportStatus = (typeof MONTHLY_REPORT_STATUSES)[number]
