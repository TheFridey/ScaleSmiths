export const COMMISSION_MILESTONES = ["deposit", "interim", "final", "first_retainer"] as const
export type CommissionMilestone = (typeof COMMISSION_MILESTONES)[number]
export const BUILD_MILESTONES = ["deposit", "interim", "final"] as const
/** Exact accepted commercial agreement, snapshotted with the contract. Integer pence as decimal strings. */
export interface AcceptedCommitment {
  currency: "GBP"
  buildPence: string
  recurringPence: string
  minTermMonths: number
  minimumContractValuePence: string
  scheduleId: string
  buildInstalments: string[]
  scheduleApprovalReference?: string
  refundPolicyReference?: string
}
export interface CommissionTerms {
  planVersion: string
  rateBps: number
  milestones: { deposit: string; final: string; first_retainer: string; interim?: string }
  unpaidRefundApprovalReference?: string
  /** "pooled-build-v1": one cumulative rounding across every build instalment. Absent for historical plans. */
  commissionModel?: "pooled-build-v1"
  commitment?: AcceptedCommitment
}

export class ExpansionFinanceError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = "ExpansionFinanceError" }
}

const MAX_PENCE = BigInt("2147483647")
export function pence(value: unknown, allowZero = false): bigint {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,9})$/.test(value)) throw new ExpansionFinanceError("Enter an integer pence amount as a decimal string.")
  const amount = BigInt(value)
  if (amount > MAX_PENCE || (!allowZero && amount === BigInt(0))) throw new ExpansionFinanceError("Amount is outside the supported range.")
  return amount
}

export function parseCommissionTerms(input: unknown): CommissionTerms {
  if (!input || typeof input !== "object") throw new ExpansionFinanceError("Approved commission terms are required.")
  const terms = input as Partial<CommissionTerms>
  if (typeof terms.planVersion !== "string" || !/^[A-Za-z0-9_.-]{1,80}$/.test(terms.planVersion) || !Number.isInteger(terms.rateBps) || terms.rateBps! < 0 || terms.rateBps! > 10000 || !terms.milestones) throw new ExpansionFinanceError("Commission plan version or rate is invalid.")
  const milestones = {} as CommissionTerms["milestones"]
  for (const key of ["deposit", "final", "first_retainer"] as const) milestones[key] = pence(terms.milestones[key], true).toString()
  if (terms.milestones.interim !== undefined) milestones.interim = pence(terms.milestones.interim, true).toString()
  const result: CommissionTerms = { planVersion: terms.planVersion, rateBps: terms.rateBps!, milestones }
  if (terms.unpaidRefundApprovalReference !== undefined) {
    result.unpaidRefundApprovalReference = financeText(terms.unpaidRefundApprovalReference, "Accepted unpaid refund clause reference")
  }
  if (terms.commissionModel !== undefined || terms.commitment !== undefined) {
    if (terms.commissionModel !== "pooled-build-v1" || !terms.commitment) throw new ExpansionFinanceError("Pooled commission terms need an accepted commitment snapshot.")
    const c = terms.commitment as unknown as Record<string, unknown>
    const instalments = Array.isArray(c.buildInstalments) ? c.buildInstalments.map(v => pence(v, false).toString()) : null
    if (c.currency !== "GBP" || !instalments || instalments.length > 12 || !Number.isInteger(c.minTermMonths) || (c.minTermMonths as number) < 1 || (c.minTermMonths as number) > 120) throw new ExpansionFinanceError("Accepted commitment is incomplete or invalid.")
    const build = pence(c.buildPence, true), recurring = pence(c.recurringPence, true)
    const buildTotal = BigInt(milestones.deposit) + BigInt(milestones.interim ?? "0") + BigInt(milestones.final)
    if (buildTotal !== build || instalments.reduce((sum, v) => sum + BigInt(v), BigInt(0)) !== build || (build === BigInt(0) && instalments.length > 0)) throw new ExpansionFinanceError("Payment schedule must add up exactly to the approved build value.")
    if (BigInt(milestones.first_retainer) > recurring) throw new ExpansionFinanceError("First-retainer commission base cannot exceed the recurring fee.")
    if (pence(c.minimumContractValuePence, true) !== build + recurring * BigInt(c.minTermMonths as number)) throw new ExpansionFinanceError("Minimum contract value does not match build, recurring fee and term.")
    if ((/^(standard-v2|growth-only-v1)/.test(terms.planVersion)) && c.minTermMonths !== STANDARD_V2_MINIMUM_RETAINER_MONTHS) throw new ExpansionFinanceError("This plan requires a twelve-month minimum commitment.")
    result.commissionModel = "pooled-build-v1"
    result.commitment = { currency: "GBP", buildPence: build.toString(), recurringPence: recurring.toString(), minTermMonths: c.minTermMonths as number, minimumContractValuePence: String(c.minimumContractValuePence), scheduleId: financeText(c.scheduleId, "Payment schedule", 80), buildInstalments: instalments,
      ...(c.scheduleApprovalReference !== undefined ? { scheduleApprovalReference: financeText(c.scheduleApprovalReference, "Schedule approval reference", 500) } : {}),
      ...(c.refundPolicyReference !== undefined ? { refundPolicyReference: financeText(c.refundPolicyReference, "Refund policy reference", 500) } : {}) }
  }
  return result
}

export const isPooledCommission = (terms: CommissionTerms) => terms.commissionModel === "pooled-build-v1"
export const milestoneCap = (terms: CommissionTerms, milestone: CommissionMilestone) => BigInt(terms.milestones[milestone] ?? "0")
/** Milestones whose collections share one cumulative commission rounding. */
export function commissionGroup(terms: CommissionTerms, milestone: CommissionMilestone): CommissionMilestone[] {
  if (!isPooledCommission(terms)) return [milestone]
  return milestone === "first_retainer" ? ["first_retainer"] : [...BUILD_MILESTONES]
}

export function standardCommissionTerms(): CommissionTerms {
  return { planVersion: "standard-v1", rateBps: 3000, milestones: { deposit: "100000", final: "100000", first_retainer: "35000" } }
}

export const STANDARD_V2_MINIMUM_RETAINER_MONTHS = 12
/** Contract value in pence for a commitment. */
export function minimumContractValuePence(buildPence: number, monthlyPence = 35000, months = STANDARD_V2_MINIMUM_RETAINER_MONTHS) { return BigInt(buildPence) + BigInt(monthlyPence) * BigInt(months) }

/* ---- Founder-approved plan builder: terms are constructed server-side, never typed as JSON ---- */
export const COMMERCIAL_PLAN_KEYS = ["standard-v2", "growth-only-v1", "bespoke-v1"] as const
export type CommercialPlanKey = (typeof COMMERCIAL_PLAN_KEYS)[number]
/** Pre-approved standard schedules (pence). Any other schedule needs a recorded founder approval reference. */
export const APPROVED_STANDARD_SCHEDULES: Record<string, readonly number[]> = { equal: [100000, 100000], "deposit-completion": [75000, 125000] }
export interface PlanRequest {
  plan: CommercialPlanKey
  scheduleId?: string
  buildInstalmentsPence?: number[]
  scheduleApprovalReference?: string
  recurringPence?: number
  firstRetainerEligiblePence?: number
  rateBps?: number
  rateApprovalReference?: string
  refundPolicyReference?: string
  unpaidRefundApprovalReference?: string
  buildFeePence?: number
}
const STANDARD_BUILD = 200000, STANDARD_RECURRING = 35000

export function buildAcceptedTerms(req: PlanRequest): CommissionTerms {
  const ints = (values: unknown, label: string) => {
    if (!Array.isArray(values) || values.length < 1 || values.length > 12 || values.some(v => !Number.isSafeInteger(v) || v <= 0 || v > 2147483647)) throw new ExpansionFinanceError(`${label} must list one to twelve positive integer pence amounts.`)
    return values as number[]
  }
  let instalments: number[] = [], recurring = STANDARD_RECURRING, scheduleId = "none", planVersion: string, rateBps = 3000
  const firstRetainer = (fee: number) => req.firstRetainerEligiblePence ?? fee
  if (req.plan === "standard-v2") {
    if ((req.buildFeePence ?? STANDARD_BUILD) !== STANDARD_BUILD) throw new ExpansionFinanceError("A build fee below the standard £2,000 needs an approved discount allowance.", 403)
    if (req.recurringPence !== undefined && req.recurringPence !== STANDARD_RECURRING) throw new ExpansionFinanceError("The standard plan's recurring fee is £350 a month; other pricing needs the bespoke plan.", 403)
    scheduleId = req.scheduleId ?? "equal"
    if (scheduleId === "custom") {
      instalments = ints(req.buildInstalmentsPence, "Custom schedule")
      if (!req.scheduleApprovalReference?.trim()) throw new ExpansionFinanceError("A custom payment schedule needs a founder approval reference.")
    } else {
      const approved = APPROVED_STANDARD_SCHEDULES[scheduleId]
      if (!approved) throw new ExpansionFinanceError("Choose an approved payment schedule.")
      instalments = [...approved]
    }
    if (instalments.reduce((a, b) => a + b, 0) !== STANDARD_BUILD) throw new ExpansionFinanceError("Payment schedule must add up exactly to the approved build value.")
    planVersion = scheduleId === "equal" ? "standard-v2" : `standard-v2.${scheduleId === "custom" ? "c" + instalments.join("-") : scheduleId}`
  } else if (req.plan === "growth-only-v1") {
    if (req.buildFeePence || req.buildInstalmentsPence?.length) throw new ExpansionFinanceError("Growth Partnership-only plans have no website build.")
    if (req.recurringPence !== undefined && req.recurringPence !== STANDARD_RECURRING) throw new ExpansionFinanceError("The Growth Partnership-only fee is £350 a month; other pricing needs the bespoke plan.", 403)
    planVersion = "growth-only-v1"
  } else if (req.plan === "bespoke-v1") {
    instalments = ints(req.buildInstalmentsPence, "Bespoke project schedule")
    recurring = req.recurringPence ?? 0
    if (!Number.isSafeInteger(recurring) || recurring < 0) throw new ExpansionFinanceError("Recurring fee must be non-negative integer pence.")
    if (req.rateBps !== undefined && req.rateBps !== 3000) {
      if (!req.rateApprovalReference?.trim()) throw new ExpansionFinanceError("A commission rate other than 30% needs an explicit approval reference.")
      rateBps = req.rateBps
    }
    scheduleId = "bespoke"
    planVersion = `bespoke-v1.${instalments.join("-")}.${recurring}.${rateBps}`.slice(0, 80)
    if (planVersion.length >= 80) throw new ExpansionFinanceError("Bespoke schedule has too many instalments to version safely.")
  } else throw new ExpansionFinanceError("Choose an approved commercial plan.")
  const build = instalments.reduce((a, b) => a + b, 0)
  const milestones = {
    deposit: String(instalments[0] ?? 0),
    interim: String(instalments.slice(1, -1).reduce((a, b) => a + b, 0)),
    final: String(instalments.length > 1 ? instalments[instalments.length - 1] : 0),
    first_retainer: String(req.plan === "bespoke-v1" ? firstRetainer(0) : firstRetainer(recurring)),
  }
  const minTermMonths = req.plan === "bespoke-v1" ? (recurring > 0 ? 12 : 1) : STANDARD_V2_MINIMUM_RETAINER_MONTHS
  return parseCommissionTerms({
    planVersion, rateBps, milestones, commissionModel: "pooled-build-v1",
    ...(req.unpaidRefundApprovalReference ? { unpaidRefundApprovalReference: req.unpaidRefundApprovalReference } : {}),
    commitment: { currency: "GBP", buildPence: String(build), recurringPence: String(recurring), minTermMonths, buildInstalments: instalments.map(String), scheduleId,
      minimumContractValuePence: String(BigInt(build) + BigInt(recurring) * BigInt(minTermMonths)),
      ...(req.scheduleApprovalReference ? { scheduleApprovalReference: req.scheduleApprovalReference } : {}),
      ...(req.refundPolicyReference ? { refundPolicyReference: req.refundPolicyReference } : {}) },
  })
}

/** Round once on cumulative qualifying revenue; splitting receipts cannot add commission. */
export function commissionAt(netCollected: bigint, rateBps: number): bigint {
  if (netCollected < BigInt(0) || !Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new ExpansionFinanceError("Invalid commission calculation.")
  return (netCollected * BigInt(rateBps) + BigInt(5000)) / BigInt(10000)
}

/**
 * Commission movement for a collection or refund. Legacy plans round per milestone (unchanged).
 * Pooled plans round once on the cumulative build total, so splitting payments across instalments
 * or milestones can never add a penny; callers must pass the pooled `groupBefore` total.
 */
export function commissionDelta(termsInput: unknown, milestone: CommissionMilestone, before: bigint, change: bigint, groupBefore?: bigint): bigint {
  const terms = parseCommissionTerms(termsInput)
  if (!COMMISSION_MILESTONES.includes(milestone)) throw new ExpansionFinanceError("Invalid commission milestone.")
  if (isPooledCommission(terms) && groupBefore === undefined) throw new ExpansionFinanceError("Pooled commission calculation needs the cumulative build total.")
  const after = before + change
  if (after < BigInt(0) || after > milestoneCap(terms, milestone)) throw new ExpansionFinanceError("Collection exceeds the approved milestone or refund balance.", 409)
  const base = isPooledCommission(terms) ? groupBefore! : before
  if (base + change < BigInt(0)) throw new ExpansionFinanceError("Collection exceeds the approved milestone or refund balance.", 409)
  return commissionAt(base + change, terms.rateBps) - commissionAt(base, terms.rateBps)
}

export function financeText(value: unknown, label: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max || /[\u0000-\u001f]/.test(value)) throw new ExpansionFinanceError(`${label} is required and must be at most ${max} characters.`)
  return value.trim()
}

export function financeUuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new ExpansionFinanceError("A valid record identifier is required.")
  return value.toLowerCase()
}

export function formatPence(value: string): string {
  if (!/^-?\d+$/.test(value)) throw new ExpansionFinanceError("Invalid statement amount.")
  const amount = BigInt(value), absolute = amount < BigInt(0) ? -amount : amount
  return `${amount < BigInt(0) ? "-" : ""}£${(absolute / BigInt(100)).toLocaleString("en-GB")}.${(absolute % BigInt(100)).toString().padStart(2, "0")}`
}
