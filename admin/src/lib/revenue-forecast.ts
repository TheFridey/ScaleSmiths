/**
 * Operation Ascend B2.4: the revenue forecast model. Pure and deterministic: integer pence (BigInt) and basis points
 * (1 bp = 0.01%), no floating-point money, no network, no database.
 *
 * A forecast is a hypothetical projection from stated assumptions. It is never money earned, never written to any ledger,
 * and never derived from an invented conversion rate: a historical rate is shown only when enough closed outcomes exist.
 */
export const SCENARIOS = ["conservative", "baseline", "optimistic"] as const
export type Scenario = (typeof SCENARIOS)[number]
export const SCENARIO_LABELS: Record<Scenario, string> = { conservative: "Conservative", baseline: "Baseline", optimistic: "Optimistic" }
export const FORECAST_STAGES = ["qualified", "scope_submitted", "approved"] as const
export type ForecastStage = (typeof FORECAST_STAGES)[number]
export const STAGE_LABELS: Record<ForecastStage, string> = { qualified: "Qualified", scope_submitted: "Scope under review", approved: "Scope approved" }
/** Fewer closed outcomes than this and no historical conversion rate is shown (founder decision FD-ASC-05). */
export const MIN_CLOSED_OUTCOMES = 10
export const MAX_HORIZON_MONTHS = 24

export type Assumptions = {
  scenario: Scenario
  /** Probability, in basis points (0–10000), that an opportunity now at each stage becomes an accepted contract. */
  stageBasisPoints: Record<ForecastStage, number>
  /** Assumed one-off value of an accepted contract, in pence. */
  averageValuePence: string
  /** Share of contracted monthly recurring revenue kept each month, in basis points. */
  monthlyRetentionBasisPoints: number
  horizonMonths: number
}

const bp = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 10000
/** Validates founder-entered assumptions; returns the normalised value or the first problem. */
export function parseAssumptions(input: unknown): { ok: true; value: Assumptions } | { ok: false; problem: string } {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  if (!(SCENARIOS as readonly string[]).includes(String(i.scenario))) return { ok: false, problem: "Choose a scenario." }
  const stages = (i.stageBasisPoints && typeof i.stageBasisPoints === "object" ? i.stageBasisPoints : {}) as Record<string, unknown>
  for (const s of FORECAST_STAGES) if (!bp(stages[s])) return { ok: false, problem: `Enter a probability between 0% and 100% for ${STAGE_LABELS[s].toLowerCase()}.` }
  if (typeof i.averageValuePence !== "string" || !/^\d{1,12}$/.test(i.averageValuePence)) return { ok: false, problem: "Enter an average contract value in whole pence (up to £9,999,999,999.99)." }
  if (!bp(i.monthlyRetentionBasisPoints)) return { ok: false, problem: "Enter a monthly retention between 0% and 100%." }
  if (typeof i.horizonMonths !== "number" || !Number.isInteger(i.horizonMonths) || i.horizonMonths < 1 || i.horizonMonths > MAX_HORIZON_MONTHS) return { ok: false, problem: `Choose a horizon of 1 to ${MAX_HORIZON_MONTHS} months.` }
  return { ok: true, value: { scenario: i.scenario as Scenario, stageBasisPoints: Object.fromEntries(FORECAST_STAGES.map((s) => [s, stages[s] as number])) as Record<ForecastStage, number>,
    averageValuePence: String(BigInt(i.averageValuePence)), monthlyRetentionBasisPoints: i.monthlyRetentionBasisPoints as number, horizonMonths: i.horizonMonths } }
}

export type History = { accepted: number; lost: number }
/** The observed rate from closed expansion opportunities, or null with the reason when there is not enough history. */
export function historicalConversion(h: History) {
  const closed = h.accepted + h.lost
  if (closed < MIN_CLOSED_OUTCOMES) return { basisPoints: null, closed, reason: `${closed === 0 ? "No closed outcomes yet" : `Only ${closed} closed ${closed === 1 ? "outcome" : "outcomes"} so far`}; at least ${MIN_CLOSED_OUTCOMES} are needed before a historical conversion rate is shown.` }
  return { basisPoints: Math.floor((h.accepted * 10000) / closed), closed, reason: null }
}

export type ProjectionInput = { stageCounts: Record<ForecastStage, number>; monthlyRecurringPence: string; assumptions: Assumptions }
export type ProjectionLine = { label: string; pence: string; explanation: string }
/** Pipeline value weighted by stage probability, plus contracted recurring revenue decayed by the retention assumption. */
export function project(input: ProjectionInput): { lines: ProjectionLine[]; totalPence: string } {
  const a = input.assumptions, avg = BigInt(a.averageValuePence), lines: ProjectionLine[] = []
  for (const s of FORECAST_STAGES) {
    const n = BigInt(Math.max(0, Math.trunc(input.stageCounts[s] ?? 0))), p = BigInt(a.stageBasisPoints[s])
    lines.push({ label: `${STAGE_LABELS[s]} pipeline`, pence: ((n * avg * p) / BigInt(10000)).toString(),
      explanation: `${n} ${n === BigInt(1) ? "opportunity" : "opportunities"} × ${pct(a.stageBasisPoints[s])} × ${gbp(avg)} assumed value` })
  }
  let month = BigInt(input.monthlyRecurringPence), recurring = BigInt(0)
  const keep = BigInt(a.monthlyRetentionBasisPoints)
  for (let m = 0; m < a.horizonMonths; m++) { month = (month * keep) / BigInt(10000); recurring += month }
  lines.push({ label: "Contracted recurring revenue", pence: recurring.toString(),
    explanation: `${gbp(BigInt(input.monthlyRecurringPence))} a month now, ${pct(a.monthlyRetentionBasisPoints)} kept each month, over ${a.horizonMonths} ${a.horizonMonths === 1 ? "month" : "months"}` })
  return { lines, totalPence: lines.reduce((t, l) => t + BigInt(l.pence), BigInt(0)).toString() }
}

export const pct = (basisPoints: number) => `${(basisPoints / 100).toFixed(basisPoints % 100 === 0 ? 0 : 2)}%`
export function gbp(pence: bigint | string) {
  const p = BigInt(pence), neg = p < BigInt(0), abs = neg ? -p : p
  const pounds = (abs / BigInt(100)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","), rest = (abs % BigInt(100)).toString().padStart(2, "0")
  return `${neg ? "−" : ""}£${pounds}.${rest}`
}
