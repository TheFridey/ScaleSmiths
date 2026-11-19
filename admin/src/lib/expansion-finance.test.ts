import { describe, expect, it } from "vitest"
import { flexibleCommissionTermsV2, minimumContractValuePence, retainerOnlyCommissionTerms, scheduleCommissionTerms, standardCommissionTermsV2, commissionAt, commissionDelta, formatPence, parseCommissionTerms, pence, standardCommissionTerms } from "./expansion-finance"

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

  const earn = (terms: ReturnType<typeof standardCommissionTermsV2>, paid: Array<["deposit" | "final" | "first_retainer", bigint]>) =>
    paid.map(([milestone, amount]) => commissionDelta(terms, milestone, BigInt(0), amount).toString())
  it("Case A: historical six-month terms are unchanged", () => {
    expect(standardCommissionTerms()).toEqual({ planVersion: "standard-v1", rateBps: 3000, milestones: { deposit: "100000", final: "100000", first_retainer: "35000" } })
  })
  it("Case B: twelve-month standard terms earn £705 on a £6,200 minimum contract", () => {
    expect(standardCommissionTermsV2().planVersion).toBe("standard-v2")
    expect(minimumContractValuePence(200000)).toBe(BigInt(620000))
    expect(earn(standardCommissionTermsV2(), [["deposit", BigInt(100000)], ["final", BigInt(100000)], ["first_retainer", BigInt(35000)]])).toEqual(["30000", "30000", "10500"])
  })
  it("Case C: £750/£1,250 schedule earns £225 + £375 + £105 = £705", () => {
    const parts = earn(flexibleCommissionTermsV2(), [["deposit", BigInt(75000)], ["final", BigInt(125000)], ["first_retainer", BigInt(35000)]])
    expect(parts).toEqual(["22500", "37500", "10500"])
    expect(parts.reduce((a, b) => a + BigInt(b), BigInt(0))).toBe(BigInt(70500))
  })
  it("Case D: retainer-only earns £105 once and nothing more on later payments", () => {
    const terms = retainerOnlyCommissionTerms()
    expect(commissionDelta(terms, "first_retainer", BigInt(0), BigInt(35000))).toBe(BigInt(10500))
    expect(() => commissionDelta(terms, "first_retainer", BigInt(35000), BigInt(35000))).toThrow()
    expect(() => commissionDelta(terms, "deposit", BigInt(0), BigInt(1))).toThrow()
    expect(minimumContractValuePence(0)).toBe(BigInt(420000))
  })
  it("Cases E/F: discounted and free-build websites follow the approved build fee", () => {
    const total = (build: number) => { const terms = scheduleCommissionTerms({ build }); return commissionAt(BigInt(build), 3000) + commissionDelta(terms, "first_retainer", BigInt(0), BigInt(35000)) }
    expect(total(150000)).toBe(BigInt(55500)); expect(total(100000)).toBe(BigInt(40500)); expect(total(50000)).toBe(BigInt(25500)); expect(total(0)).toBe(BigInt(10500))
  })
  it("Case G: bespoke £25,000 accrues only from verified collections", () => {
    const terms = parseCommissionTerms({ planVersion: "bespoke-approved-1", rateBps: 3000, milestones: { deposit: "1000000", final: "1500000", first_retainer: "0" } })
    expect(commissionDelta(terms, "deposit", BigInt(0), BigInt(1000000))).toBe(BigInt(300000))
    expect(commissionDelta(terms, "final", BigInt(0), BigInt(1500000))).toBe(BigInt(450000))
  })
  it("rejects schedules that do not add up to the approved build fee", () => {
    expect(() => scheduleCommissionTerms({ build: 200000, split: { deposit: 75000, final: 100000 } })).toThrow()
    expect(() => scheduleCommissionTerms({ build: -1 })).toThrow()
  })
})
