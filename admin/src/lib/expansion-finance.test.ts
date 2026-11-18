import { describe, expect, it } from "vitest"
import { commissionAt, commissionDelta, formatPence, parseCommissionTerms, pence, standardCommissionTerms } from "./expansion-finance"

describe("versioned exact partner commission", () => {
  it("earns exactly £705 from the three standard VAT-exclusive milestones", () => {
    const terms = standardCommissionTerms()
    const deposit = commissionDelta(terms, "deposit", BigInt(0), BigInt(100000))
    const final = commissionDelta(terms, "final", BigInt(0), BigInt(100000))
    const retainer = commissionDelta(terms, "first_retainer", BigInt(0), BigInt(35000))
    expect([deposit.toString(), final.toString(), retainer.toString()]).toEqual(["30000", "30000", "10500"])
    expect(formatPence((deposit + final + retainer).toString())).toBe("£705.00")
  })
  it("splitting into penny payments cannot create extra commission", () => {
    const terms = standardCommissionTerms()
    let earned = BigInt(0)
    for (let before = BigInt(0); before < BigInt(1000); before++) earned += commissionDelta(terms, "deposit", before, BigInt(1))
    expect(earned).toBe(commissionAt(BigInt(1000), 3000))
  })
  it("preserves bespoke immutable snapshots and exact refund rounding", () => {
    const terms = parseCommissionTerms({ planVersion: "approved-bespoke-v2", rateBps: 2750, milestones: { deposit: "99999", final: "180001", first_retainer: "42000" } })
    const earned = commissionDelta(terms, "deposit", BigInt(0), BigInt(99999))
    expect(earned.toString()).toBe("27500")
    expect(commissionDelta(terms, "deposit", BigInt(99999), -BigInt(99999))).toBe(-earned)
    expect(standardCommissionTerms().rateBps).toBe(3000)
  })
  it("rejects decimals, numbers, negatives, unsafe ranges and unknown plans", () => {
    for (const invalid of [1, 0.1, "1.2", "-1", "01", "1e3", "2147483648", ""]) expect(() => pence(invalid)).toThrow()
    expect(() => parseCommissionTerms({ ...standardCommissionTerms(), rateBps: 3000.5 })).toThrow()
    expect(() => parseCommissionTerms({ ...standardCommissionTerms(), planVersion: "" })).toThrow()
  })
  it("rejects collection over the contract cap, later retainers and excessive reversal", () => {
    expect(() => commissionDelta(standardCommissionTerms(), "first_retainer", BigInt(35000), BigInt(1))).toThrow()
    expect(() => commissionDelta(standardCommissionTerms(), "deposit", BigInt(0), -BigInt(1))).toThrow()
  })
})
