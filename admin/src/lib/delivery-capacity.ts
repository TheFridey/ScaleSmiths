export type DeliveryConfidence = "low" | "medium" | "high"
export type DeliveryRiskLevel = "low" | "medium" | "high"
export type DeliveryWorkStatus = "confirmed" | "probable" | "waiting_client" | "waiting_internal" | "retainer"

export interface DeliveryWorkItem {
  id: string
  name: string
  source: "forge_project" | "client_request" | "retainer" | "sales_pipeline" | "manual_commitment"
  status: DeliveryWorkStatus
  owner: string | null
  deadline: string | null
  estimatedHours: number
  remainingHours: number
  manualHours: number
  forgeHours: number
  probability: number
  confidence: DeliveryConfidence
  risk: DeliveryRiskLevel
  blockers: string[]
  assumptions: string[]
  singlePersonDependency: boolean
}

export interface CapacityAdjustment {
  id?: number
  weekStart: string
  adjustmentType: "capacity_override" | "time_off" | "contractor_capacity" | "sales_commitment" | "actual_delivery"
  staffName: string | null
  role: string | null
  hours: number
  reason: string
  confidence: DeliveryConfidence
}

export interface ForecastActual {
  periodStart: string
  periodType: "week" | "month"
  forecastHours: number
  actualHours: number
  notes: string | null
}

export interface CapacityAssumptions {
  defaultWeeklyHumanHours: number
  retainerHoursPerClient: number
  forgeHumanReviewRatio: number
  probableWorkProbabilityFloor: number
  generatedAt: string
}

export interface CapacityPeriod {
  key: string
  label: string
  start: string
  end: string
  confirmedHours: number
  probableHours: number
  manualHours: number
  forgeHours: number
  retainerHours: number
  availableHours: number
  adjustedCapacityHours: number
  utilization: number
  risk: DeliveryRiskLevel
  confidence: DeliveryConfidence
  warnings: string[]
}

export interface CapacityForecast {
  assumptions: CapacityAssumptions
  activeProjects: DeliveryWorkItem[]
  probableIncomingWork: DeliveryWorkItem[]
  retainerObligations: DeliveryWorkItem[]
  workAwaitingClients: DeliveryWorkItem[]
  workAwaitingInternalApproval: DeliveryWorkItem[]
  weekly: CapacityPeriod[]
  monthly: CapacityPeriod[]
  warnings: string[]
  forecastVsActual: Array<ForecastActual & { varianceHours: number; variancePercent: number | null }>
  singlePersonDependencies: DeliveryWorkItem[]
}

export function buildCapacityForecast(input: {
  now?: Date
  workItems: DeliveryWorkItem[]
  adjustments?: CapacityAdjustment[]
  actuals?: ForecastActual[]
  assumptions?: Partial<CapacityAssumptions>
}): CapacityForecast {
  const now = input.now ?? new Date()
  const assumptions: CapacityAssumptions = {
    defaultWeeklyHumanHours: 32,
    retainerHoursPerClient: 3,
    forgeHumanReviewRatio: 0.35,
    probableWorkProbabilityFloor: 0.25,
    generatedAt: now.toISOString(),
    ...input.assumptions,
  }
  const adjustments = input.adjustments ?? []
  const activeProjects = input.workItems.filter((item) => item.source === "forge_project" && item.status === "confirmed")
  const probableIncomingWork = input.workItems.filter((item) => item.status === "probable")
  const retainerObligations = input.workItems.filter((item) => item.status === "retainer")
  const workAwaitingClients = input.workItems.filter((item) => item.status === "waiting_client")
  const workAwaitingInternalApproval = input.workItems.filter((item) => item.status === "waiting_internal")
  const weekly = buildPeriods({ now, count: 12, type: "week", workItems: input.workItems, adjustments, assumptions })
  const monthly = buildPeriods({ now, count: 6, type: "month", workItems: input.workItems, adjustments, assumptions })
  const warnings = buildWarnings(weekly, monthly, input.workItems)
  const forecastVsActual = (input.actuals ?? []).map((actual) => {
    const varianceHours = actual.actualHours - actual.forecastHours
    return {
      ...actual,
      varianceHours,
      variancePercent: actual.forecastHours > 0 ? Math.round((varianceHours / actual.forecastHours) * 100) : null,
    }
  })

  return {
    assumptions,
    activeProjects,
    probableIncomingWork,
    retainerObligations,
    workAwaitingClients,
    workAwaitingInternalApproval,
    weekly,
    monthly,
    warnings,
    forecastVsActual,
    singlePersonDependencies: input.workItems.filter((item) => item.singlePersonDependency),
  }
}

function buildPeriods(input: {
  now: Date
  count: number
  type: "week" | "month"
  workItems: DeliveryWorkItem[]
  adjustments: CapacityAdjustment[]
  assumptions: CapacityAssumptions
}) {
  return Array.from({ length: input.count }, (_, index) => {
    const start = input.type === "week" ? addDays(startOfWeek(input.now), index * 7) : addMonths(startOfMonth(input.now), index)
    const end = input.type === "week" ? addDays(start, 7) : addMonths(start, 1)
    const periodItems = input.workItems.filter((item) => itemOverlapsPeriod(item, start, end))
    const weighted = periodItems.map((item) => ({ item, hours: weightedHoursForPeriod(item, start, end) }))
    const confirmedHours = sum(weighted.filter(({ item }) => item.status !== "probable").map(({ hours }) => hours))
    const probableHours = sum(weighted.filter(({ item }) => item.status === "probable").map(({ item, hours }) => hours * item.probability))
    const manualHours = sum(weighted.map(({ item, hours }) => hours * manualShare(item)))
    const forgeHours = sum(weighted.map(({ item, hours }) => hours * forgeShare(item)))
    const retainerHours = sum(weighted.filter(({ item }) => item.status === "retainer").map(({ hours }) => hours))
    const adjustedCapacityHours = capacityForPeriod(input.type, start, input.assumptions, input.adjustments)
    const committed = confirmedHours + probableHours
    const utilization = adjustedCapacityHours > 0 ? Math.round((committed / adjustedCapacityHours) * 100) : 999
    const warnings = periodWarnings({ utilization, confirmedHours, probableHours, adjustedCapacityHours, periodItems })
    return {
      key: input.type === "week" ? weekKey(start) : monthKey(start),
      label: input.type === "week" ? `Week of ${dateLabel(start)}` : start.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      start: start.toISOString(),
      end: end.toISOString(),
      confirmedHours: Math.round(confirmedHours),
      probableHours: Math.round(probableHours),
      manualHours: Math.round(manualHours),
      forgeHours: Math.round(forgeHours),
      retainerHours: Math.round(retainerHours),
      availableHours: input.assumptions.defaultWeeklyHumanHours * (input.type === "week" ? 1 : 4.33),
      adjustedCapacityHours: Math.round(adjustedCapacityHours),
      utilization,
      risk: utilization >= 115 || warnings.some((warning) => warning.includes("deadline")) ? "high" : utilization >= 90 ? "medium" : "low",
      confidence: periodConfidence(periodItems),
      warnings,
    } satisfies CapacityPeriod
  })
}

function itemOverlapsPeriod(item: DeliveryWorkItem, start: Date, end: Date) {
  if (!item.deadline) return start <= addDays(new Date(), 90)
  const deadline = new Date(item.deadline)
  return deadline >= start && deadline < end || deadline >= start && start <= addDays(new Date(), 28)
}

function weightedHoursForPeriod(item: DeliveryWorkItem, start: Date, end: Date) {
  if (!item.deadline) return item.remainingHours / 4
  const deadline = new Date(item.deadline)
  if (deadline >= start && deadline < end) return item.remainingHours
  const daysUntilDeadline = Math.max(1, Math.ceil((deadline.getTime() - start.getTime()) / 86_400_000))
  const periodsRemaining = Math.max(1, Math.ceil(daysUntilDeadline / 7))
  return item.remainingHours / periodsRemaining
}

function capacityForPeriod(type: "week" | "month", start: Date, assumptions: CapacityAssumptions, adjustments: CapacityAdjustment[]) {
  const base = assumptions.defaultWeeklyHumanHours * (type === "week" ? 1 : 4.33)
  const relevant = adjustments.filter((adjustment) => samePeriod(new Date(adjustment.weekStart), start, type))
  const override = relevant.find((adjustment) => adjustment.adjustmentType === "capacity_override")
  const delta = sum(relevant.filter((adjustment) => adjustment.adjustmentType !== "capacity_override" && adjustment.adjustmentType !== "actual_delivery").map((adjustment) => {
    if (adjustment.adjustmentType === "time_off") return -Math.abs(adjustment.hours)
    return adjustment.hours
  }))
  return Math.max(0, (override ? override.hours : base) + delta)
}

function buildWarnings(weekly: CapacityPeriod[], monthly: CapacityPeriod[], items: DeliveryWorkItem[]) {
  const warnings: string[] = []
  if (weekly.some((period) => period.confirmedHours > period.adjustedCapacityHours)) warnings.push("Confirmed work exceeds available delivery capacity in at least one week.")
  if (weekly.some((period) => period.confirmedHours + period.probableHours > period.adjustedCapacityHours)) warnings.push("Sales commitments plus probable work exceed available delivery capacity in at least one week.")
  if (monthly.some((period) => period.utilization >= 115)) warnings.push("Monthly forecast is materially over capacity; defer or staff work before making more commitments.")
  if (items.some((item) => item.singlePersonDependency)) warnings.push("Single-person delivery dependencies exist; check cover before promising dates.")
  if (items.some((item) => item.status === "waiting_client")) warnings.push("Some work is waiting on clients and may compress delivery windows later.")
  return unique(warnings)
}

function periodWarnings(input: { utilization: number; confirmedHours: number; probableHours: number; adjustedCapacityHours: number; periodItems: DeliveryWorkItem[] }) {
  const warnings: string[] = []
  if (input.confirmedHours > input.adjustedCapacityHours) warnings.push("Confirmed work exceeds capacity.")
  if (input.confirmedHours + input.probableHours > input.adjustedCapacityHours) warnings.push("Confirmed plus probable work exceeds capacity.")
  if (input.utilization >= 115) warnings.push("Sales commitments are above delivery capacity.")
  if (input.periodItems.some((item) => item.blockers.length > 0)) warnings.push("Approval or client blockers affect this period.")
  if (input.periodItems.some((item) => item.deadline && new Date(item.deadline) < addDays(new Date(), 14) && item.remainingHours > 8)) warnings.push("Near-term deadline still has material remaining effort.")
  return unique(warnings)
}

function periodConfidence(items: DeliveryWorkItem[]): DeliveryConfidence {
  if (items.some((item) => item.confidence === "low")) return "low"
  if (items.some((item) => item.confidence === "medium" || item.status === "probable")) return "medium"
  return "high"
}

function manualShare(item: DeliveryWorkItem) {
  const total = item.manualHours + item.forgeHours
  return total > 0 ? item.manualHours / total : 1
}

function forgeShare(item: DeliveryWorkItem) {
  const total = item.manualHours + item.forgeHours
  return total > 0 ? item.forgeHours / total : 0
}

function samePeriod(date: Date, start: Date, type: "week" | "month") {
  return type === "week" ? weekKey(date) === weekKey(start) : monthKey(date) === monthKey(start)
}

function startOfWeek(date: Date) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = copy.getUTCDay() || 7
  copy.setUTCDate(copy.getUTCDate() - day + 1)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date)
  copy.setUTCMonth(copy.getUTCMonth() + months)
  return copy
}

function weekKey(date: Date) {
  const start = startOfWeek(date)
  return start.toISOString().slice(0, 10)
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7)
}

function dateLabel(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}
