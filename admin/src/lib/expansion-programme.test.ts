import { describe, expect, it } from "vitest"
import { cumulativeBonusPence, isReferralCode, progressTowardsNext, PROPOSED_MILESTONES, referralCodeFromBytes } from "./expansion-programme"

describe("proposed achievement schedule", () => {
  it("cumulative bonuses match the programme (£8,000 / £23,000 / £53,000)", () => {
    expect([100, 250, 500].map(n => cumulativeBonusPence(n) / 100)).toEqual([8000, 23000, 53000])
    expect(cumulativeBonusPence(9)).toBe(0); expect(cumulativeBonusPence(10)).toBe(25000)
    expect(PROPOSED_MILESTONES).toHaveLength(8)
  })
  it("derives progress towards the next milestone", () => {
    expect(progressTowardsNext(7)).toMatchObject({ remaining: 3, next: { clients: 10 } })
    expect(progressTowardsNext(0)).toMatchObject({ remaining: 1, next: { clients: 1 }, fraction: 0 })
    expect(progressTowardsNext(500)).toMatchObject({ next: null, fraction: 1 })
  })
  it("generates unambiguous referral codes", () => {
    const code = referralCodeFromBytes(new Uint8Array([0, 31, 7, 200, 9, 99, 255, 1]))
    expect(isReferralCode(code)).toBe(true); expect(code).toMatch(/^SS-[A-Z2-7]{8}$/)
    expect(isReferralCode("SS-abcd1234")).toBe(false); expect(() => referralCodeFromBytes(new Uint8Array(3))).toThrow()
  })
})
