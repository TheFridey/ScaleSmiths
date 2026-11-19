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
