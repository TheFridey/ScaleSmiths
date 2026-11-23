/**
 * B2.5: pure, read-only helpers for a partner's own performance data.
 * No learning-progress reads, financial writes or estimated conversion outcomes.
 */
export const PERFORMANCE_PERIODS = ["7d", "30d", "90d", "12m", "all"] as const
export type PerformancePeriod = (typeof PERFORMANCE_PERIODS)[number]
export type DatedEvent = { at: string; amountPence?: string }
export type StageSnapshot = { status: string; count: number }

export function parsePerformancePeriod(value: unknown): PerformancePeriod {
  if (value === undefined || value === null || value === "") return "30d"
  if (typeof value === "string" && (PERFORMANCE_PERIODS as readonly string[]).includes(value)) return value as PerformancePeriod
  throw new RangeError("Choose a valid performance period.")
}

/** Rolling periods are anchored to UTC instants; 12m is twelve calendar months, not 365 days. */
export function periodStart(period: PerformancePeriod, now: Date): Date | null {
  if (!Number.isFinite(now.getTime())) throw new RangeError("A valid reference time is required.")
  if (period === "all") return null
  if (period === "12m") {
    const start = new Date(now.getTime())
    const day = start.getUTCDate()
    start.setUTCDate(1)
    start.setUTCMonth(start.getUTCMonth() - 12)
    const last = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate()
    start.setUTCDate(Math.min(day, last))
    return start
  }
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90
  return new Date(now.getTime() - days * 86_400_000)
}

export function inPeriod(at: string | Date, start: Date | null, now: Date): boolean {
  const time = new Date(at).getTime()
  return Number.isFinite(time) && time <= now.getTime() && (start === null || time >= start.getTime())
}

export function eventCount(events: readonly DatedEvent[], start: Date | null, now: Date): number {
  return events.filter((event) => inPeriod(event.at, start, now)).length
}

/** Money stays in integer pence and does not create or infer commission eligibility. */
export function eventSumPence(events: readonly DatedEvent[], start: Date | null, now: Date): string {
  return events.reduce((sum, event) => inPeriod(event.at, start, now) ? sum + BigInt(event.amountPence ?? "0") : sum, BigInt(0)).toString()
}

export function ratio(numerator: number, denominator: number): { numerator: number; denominator: number; percentage: number | null } {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator < 0 || denominator < 0 || numerator > denominator) {
    throw new RangeError("Counts must be valid non-negative cohort values.")
  }
  return { numerator, denominator, percentage: denominator === 0 ? null : Math.round(numerator * 10000 / denominator) / 100 }
}

/**
 * A snapshot of current states is NOT an historical stage-conversion funnel.
 * Do not infer that intermediate stages occurred.
 */
export function currentStageDistribution(stages: readonly StageSnapshot[]): { kind: "current_state_only"; total: number; stages: StageSnapshot[] } {
  const total = stages.reduce((sum, item) => {
    if (!Number.isSafeInteger(item.count) || item.count < 0) throw new RangeError("Invalid stage count.")
    return sum + item.count
  }, 0)
  return { kind: "current_state_only", total, stages: stages.map((stage) => ({ ...stage })) }
}

/** An explicitly observed, stable week-bucketed series in UTC, not inferred history. */
export function weeklySeries(events: readonly DatedEvent[], start: Date, now: Date): Array<{ week: string; count: number; pence: string }> {
  const buckets = new Map<string, { count: number; pence: bigint }>()
  for (const event of events) {
    if (!inPeriod(event.at, start, now)) continue
    const day = new Date(event.at)
    const weekday = (day.getUTCDay() + 6) % 7
    day.setUTCHours(0, 0, 0, 0)
    day.setUTCDate(day.getUTCDate() - weekday)
    const key = day.toISOString().slice(0, 10)
    const b = buckets.get(key) ?? { count: 0, pence: BigInt(0) }
    b.count++
    b.pence += BigInt(event.amountPence ?? "0")
    buckets.set(key, b)
  }
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, v]) => ({ week, count: v.count, pence: v.pence.toString() }))
}
