export const COMMISSION_MILESTONES = ["deposit", "final", "first_retainer"] as const
export type CommissionMilestone = (typeof COMMISSION_MILESTONES)[number]
export interface CommissionTerms {
  planVersion: string
  rateBps: number
  milestones: Record<CommissionMilestone, string>
  unpaidRefundApprovalReference?: string
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
  const milestones = {} as Record<CommissionMilestone, string>
  for (const key of COMMISSION_MILESTONES) milestones[key] = pence(terms.milestones[key], true).toString()
  const result: CommissionTerms = { planVersion: terms.planVersion, rateBps: terms.rateBps!, milestones }
  if (terms.unpaidRefundApprovalReference !== undefined) {
    result.unpaidRefundApprovalReference = financeText(terms.unpaidRefundApprovalReference, "Accepted unpaid refund clause reference")
  }
  return result
}

export function standardCommissionTerms(): CommissionTerms {
  return { planVersion: "standard-v1", rateBps: 3000, milestones: { deposit: "100000", final: "100000", first_retainer: "35000" } }
}

/**
 * Operation Intelligence plan versions. standard-v1 (six-month, historical) is never altered;
 * accepted agreements keep the snapshot they were approved under. All amounts are integer pence.
 * Flexible payment schedules are expressed purely as milestone amounts: commission is 30% of
 * cumulative collected revenue per milestone, so splitting never increases total entitlement.
 */
export const STANDARD_V2_MINIMUM_RETAINER_MONTHS = 12
export interface ApprovedScheduleInput { build: number; retainer?: number; planVersion?: string; split?: { deposit: number; final: number } }

/** Build + first retainer terms. `build` and `retainer` are integer pence, VAT-exclusive. */
export function scheduleCommissionTerms(input: ApprovedScheduleInput): CommissionTerms {
  const retainer = input.retainer ?? 35000
  if (!Number.isSafeInteger(input.build) || input.build < 0 || !Number.isSafeInteger(retainer) || retainer < 0) throw new ExpansionFinanceError("Schedule amounts must be non-negative integer pence.")
  const split = input.split ?? { deposit: Math.floor(input.build / 2), final: input.build - Math.floor(input.build / 2) }
  if (split.deposit < 0 || split.final < 0 || split.deposit + split.final !== input.build) throw new ExpansionFinanceError("Payment schedule must add up exactly to the approved build fee.")
  return parseCommissionTerms({ planVersion: input.planVersion ?? "standard-v2", rateBps: 3000, milestones: { deposit: String(split.deposit), final: String(split.final), first_retainer: String(retainer) } })
}

/** Standard 12-month package: £2,000 build (£1,000/£1,000), £350 monthly Growth Partnership. */
export function standardCommissionTermsV2(): CommissionTerms { return scheduleCommissionTerms({ build: 200000 }) }
/** Approved alternative: £750 deposit, £1,250 completion, £350 first retainer. */
export function flexibleCommissionTermsV2(): CommissionTerms { return scheduleCommissionTerms({ build: 200000, split: { deposit: 75000, final: 125000 } }) }
/** Growth Partnership-only: no build milestones. First £350 payment earns £105; later retainers earn nothing. */
export function retainerOnlyCommissionTerms(): CommissionTerms { return scheduleCommissionTerms({ build: 0, planVersion: "growth-only-v1" }) }
/** Contract value in pence for a twelve-month commitment. */
export function minimumContractValuePence(buildPence: number, monthlyPence = 35000, months = STANDARD_V2_MINIMUM_RETAINER_MONTHS) { return BigInt(buildPence) + BigInt(monthlyPence) * BigInt(months) }

/** Round once on cumulative qualifying revenue; splitting receipts cannot add commission. */
export function commissionAt(netCollected: bigint, rateBps: number): bigint {
  if (netCollected < BigInt(0) || !Number.isInteger(rateBps) || rateBps < 0 || rateBps > 10000) throw new ExpansionFinanceError("Invalid commission calculation.")
  return (netCollected * BigInt(rateBps) + BigInt(5000)) / BigInt(10000)
}

export function commissionDelta(termsInput: unknown, milestone: CommissionMilestone, before: bigint, change: bigint): bigint {
  const terms = parseCommissionTerms(termsInput)
  if (!COMMISSION_MILESTONES.includes(milestone)) throw new ExpansionFinanceError("Invalid commission milestone.")
  const after = before + change
  if (after < BigInt(0) || after > pence(terms.milestones[milestone], true)) throw new ExpansionFinanceError("Collection exceeds the approved milestone or refund balance.", 409)
  return commissionAt(after, terms.rateBps) - commissionAt(before, terms.rateBps)
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
