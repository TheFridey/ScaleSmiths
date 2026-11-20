/**
 * Scale Your Future: public programme facts. Single source for the /partners page, the earnings
 * calculator and the header/footer links. All money is integer pence (bigint) and VAT-exclusive.
 * Everything here is an illustration of the proposed programme, not an approved agreement; items
 * marked planned/approval-gated must never be presented as operational.
 */
export const PROGRAMME = {
  name: "Scale Your Future",
  headline: "Your ambition. Your independence. Our expertise.",
  opportunity: "Global Independent Business Partner",
  commissionBps: 3000,
  websitePence: BigInt(200000),
  retainerPence: BigInt(35000),
  minimumRetainerMonths: 12,
} as const

const BPS = BigInt(10000)
/** Round once on the cumulative amount, matching the admin commission engine. */
export function commissionOnPence(amount: bigint): bigint {
  if (amount < BigInt(0)) throw new Error("Amount must not be negative.")
  return (amount * BigInt(PROGRAMME.commissionBps) + BigInt(5000)) / BPS
}

export const minimumContractValuePence = (buildPence: bigint = PROGRAMME.websitePence) =>
  buildPence + PROGRAMME.retainerPence * BigInt(PROGRAMME.minimumRetainerMonths)

export type SaleKind = "standard" | "discounted" | "retainer-only" | "free-build"
export const DISCOUNT_BUILD_FEES_PENCE = [BigInt(150000), BigInt(100000), BigInt(50000)] as const

export interface SaleBreakdown { build: bigint; retainer: bigint; total: bigint }
/** Build commission + 30% of the first retainer only. Later retainers never earn acquisition commission. */
export function saleCommission(kind: SaleKind, buildFeePence: bigint = PROGRAMME.websitePence): SaleBreakdown {
  const fee = kind === "standard" ? PROGRAMME.websitePence : kind === "discounted" ? buildFeePence : BigInt(0)
  if (kind === "discounted" && (fee <= BigInt(0) || fee > PROGRAMME.websitePence)) throw new Error("A discounted build fee must be above £0 and no more than the standard fee.")
  const build = commissionOnPence(fee), retainer = commissionOnPence(PROGRAMME.retainerPence)
  return { build, retainer, total: build + retainer }
}
export function bespokeCommission(eligibleCollectedPence: bigint): bigint {
  if (eligibleCollectedPence < BigInt(0) || eligibleCollectedPence > BigInt(100_000_000_000)) throw new Error("Choose a supported project value.")
  return commissionOnPence(eligibleCollectedPence)
}
export function standardSalesCommission(sales: number): bigint {
  if (!Number.isInteger(sales) || sales < 0 || sales > 100) throw new Error("Choose between 0 and 100 sales.")
  return BigInt(sales) * saleCommission("standard").total
}

export interface PaymentExample { label: string; rows: ReadonlyArray<{ payment: string; client: bigint }> }
export const PAYMENT_EXAMPLES: readonly PaymentExample[] = [
  { label: "Equal instalments", rows: [{ payment: "Deposit", client: BigInt(100000) }, { payment: "Final website balance", client: BigInt(100000) }, { payment: "First Growth Partnership payment", client: BigInt(35000) }] },
  { label: "Deposit and completion", rows: [{ payment: "Deposit", client: BigInt(75000) }, { payment: "Completion payment", client: BigInt(125000) }, { payment: "First Growth Partnership payment", client: BigInt(35000) }] },
]

export const BESPOKE_EXAMPLES_PENCE = [5000, 10000, 25000, 50000, 100000, 250000].map((p) => BigInt(p) * BigInt(100))

/** Planned lifetime achievement schedule. Conditional: no reward is payable until written terms are approved. */
export const ACHIEVEMENTS = [
  { clients: 1, reward: "Optional ScaleSmiths branded polo", cash: BigInt(0) },
  { clients: 5, reward: "Personal ScaleSmiths webpage", cash: BigInt(0) },
  { clients: 10, reward: "£250 achievement bonus", cash: BigInt(25000) },
  { clients: 25, reward: "£750 achievement bonus", cash: BigInt(75000) },
  { clients: 50, reward: "£2,000 achievement bonus", cash: BigInt(200000) },
  { clients: 100, reward: "£5,000 achievement bonus", cash: BigInt(500000) },
  { clients: 250, reward: "£15,000 achievement bonus", cash: BigInt(1500000) },
  { clients: 500, reward: "£30,000 achievement bonus", cash: BigInt(3000000) },
] as const
export function cumulativeAchievementCash(clients: number): bigint {
  return ACHIEVEMENTS.filter((a) => a.clients <= clients).reduce((sum, a) => sum + a.cash, BigInt(0))
}

export type Availability = "AVAILABLE SUBJECT TO APPROVAL" | "PLANNED" | "IN DEVELOPMENT" | "NOT AVAILABLE IN THIS MARKET"
export const FEATURE_AVAILABILITY: ReadonlyArray<{ feature: string; status: Availability; note: string }> = [
  { feature: "30% acquisition commission", status: "AVAILABLE SUBJECT TO APPROVAL", note: "On eligible collected payments, under the final partner agreement." },
  { feature: "Partner Portal", status: "IN DEVELOPMENT", note: "Core prospect, scope and commission workspace exists; remaining tools are being built." },
  { feature: "Withdrawal requests", status: "PLANNED", note: "Frequency, minimums and invoice requirements are not yet approved." },
  { feature: "Achievement rewards", status: "PLANNED", note: "Conditional until written terms are approved." },
  { feature: "Partner referral reward", status: "PLANNED", note: "Conditional until written terms are approved." },
  { feature: "Dedicated ScaleSmiths email", status: "PLANNED", note: "Not provisioned automatically." },
  { feature: "Personal CircleCard", status: "PLANNED", note: "Fulfilment is not yet confirmed." },
  { feature: "Researched prospect allocation", status: "PLANNED", note: "Subject to availability, screening and market compliance. No fixed number is guaranteed." },
  { feature: "Partner Academy", status: "IN DEVELOPMENT", note: "Optional and voluntary." },
  { feature: "Website Intelligence, Sales Studio, Ask ScaleSmiths", status: "IN DEVELOPMENT", note: "Not yet available to partners." },
  { feature: "Personal partner webpage", status: "PLANNED", note: "Needs partner consent and founder approval." },
  { feature: "Founding Partner recognition", status: "PLANNED", note: "By founder nomination only; not awarded by application order." },
  { feature: "International activation", status: "AVAILABLE SUBJECT TO APPROVAL", note: "Only in markets ScaleSmiths has approved and can support." },
]

/** Partner sign-in lives on the existing admin origin; no separate partner subdomain or auth stack. */
export function partnerLoginUrl(env: { NEXT_PUBLIC_ADMIN_URL?: string; NODE_ENV?: string } = process.env as never): string {
  const configured = env.NEXT_PUBLIC_ADMIN_URL?.trim()
  let base = env.NODE_ENV === "production" ? "https://admin.scalesmiths.co.uk" : "http://localhost:3103"
  if (configured) { try { const url = new URL(configured); if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) base = url.origin } catch { /* keep default */ } }
  return `${base}/login`
}
