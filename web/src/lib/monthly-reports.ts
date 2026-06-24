export function formatReportPeriod(month: number, year: number) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)))
}
