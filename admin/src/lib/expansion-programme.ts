/** Proposed Scale Your Future lifetime schedule. A PLAN, not a commitment: rewards stay conditional until a programme version is approved. */
export interface MilestoneDefinition { clients: number; kind: "polo" | "webpage" | "bonus"; rewardPence: number; label: string }
export const PROPOSED_MILESTONES: readonly MilestoneDefinition[] = [
  { clients: 1, kind: "polo", rewardPence: 0, label: "Optional ScaleSmiths branded polo" },
  { clients: 5, kind: "webpage", rewardPence: 0, label: "Personal ScaleSmiths webpage" },
  { clients: 10, kind: "bonus", rewardPence: 25000, label: "£250 achievement bonus" },
  { clients: 25, kind: "bonus", rewardPence: 75000, label: "£750 achievement bonus" },
  { clients: 50, kind: "bonus", rewardPence: 200000, label: "£2,000 achievement bonus" },
  { clients: 100, kind: "bonus", rewardPence: 500000, label: "£5,000 achievement bonus" },
  { clients: 250, kind: "bonus", rewardPence: 1500000, label: "£15,000 achievement bonus" },
  { clients: 500, kind: "bonus", rewardPence: 3000000, label: "£30,000 achievement bonus" },
]
export const REFERRAL_THRESHOLD = 5
export const REFERRAL_REWARD_PENCE = 25000

export function cumulativeBonusPence(clients: number, milestones: readonly MilestoneDefinition[] = PROPOSED_MILESTONES) {
  return milestones.filter(m => m.clients <= clients).reduce((sum, m) => sum + m.rewardPence, 0)
}
export function progressTowardsNext(count: number, milestones: readonly MilestoneDefinition[] = PROPOSED_MILESTONES) {
  const next = [...milestones].sort((a, b) => a.clients - b.clients).find(m => m.clients > count) ?? null
  return { next, remaining: next ? next.clients - count : 0, fraction: next ? count / next.clients : 1 }
}
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
/** `SS-` plus eight base32 characters from caller-supplied random bytes (no ambiguous 0/1/8/9). */
export function referralCodeFromBytes(bytes: Uint8Array): string {
  if (bytes.length < 8) throw new Error("Eight random bytes are required.")
  return `SS-${Array.from(bytes.slice(0, 8), (b) => ALPHABET[b % 32]).join("")}`
}
export const isReferralCode = (value: unknown): value is string => typeof value === "string" && /^SS-[A-Z2-7]{8}$/.test(value)
