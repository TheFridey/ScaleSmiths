import { describe, expect, it } from "vitest"
import { buildAcceptedTerms, minimumContractValuePence, commissionAt, commissionDelta, formatPence, parseCommissionTerms, pence, standardCommissionTerms } from "./expansion-finance"

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

  /** Collect each instalment in order against the pooled model; returns per-collection commission. */
  const run = (terms: ReturnType<typeof buildAcceptedTerms>, payments: Array<["deposit" | "interim" | "final" | "first_retainer", number]>) => {
    const milestoneTotals: Record<string, bigint> = {}; let group = BigInt(0); const out: bigint[] = []
    for (const [m, amount] of payments) {
      const before = milestoneTotals[m] ?? BigInt(0)
      const base = m === "first_retainer" ? (milestoneTotals.first_retainer ?? BigInt(0)) : group
      out.push(commissionDelta(terms, m, before, BigInt(amount), base))
      milestoneTotals[m] = before + BigInt(amount); if (m !== "first_retainer") group += BigInt(amount)
    }
    return out.map(Number)
  }
  it("Case A: historical six-month terms are unchanged and carry no pooled commitment", () => {
    expect(standardCommissionTerms()).toEqual({ planVersion: "standard-v1", rateBps: 3000, milestones: { deposit: "100000", final: "100000", first_retainer: "35000" } })
    expect(parseCommissionTerms(standardCommissionTerms()).commitment).toBeUndefined()
  })
  it("Case B: standard-v2 stores a twelve-month £6,200 commitment and earns £705", () => {
    const terms = buildAcceptedTerms({ plan: "standard-v2" })
    expect(terms.commitment).toMatchObject({ currency: "GBP", buildPence: "200000", recurringPence: "35000", minTermMonths: 12, minimumContractValuePence: "620000", buildInstalments: ["100000", "100000"] })
    expect(run(terms, [["deposit", 100000], ["final", 100000], ["first_retainer", 35000]])).toEqual([30000, 30000, 10500])
    expect(minimumContractValuePence(200000)).toBe(BigInt(620000))
  })
  it("Case C: £750/£1,250 earns £225 + £375 + £105 under its own immutable plan version", () => {
    const terms = buildAcceptedTerms({ plan: "standard-v2", scheduleId: "deposit-completion" })
    expect(terms.planVersion).toBe("standard-v2.deposit-completion")
    expect(run(terms, [["deposit", 75000], ["final", 125000], ["first_retainer", 35000]])).toEqual([22500, 37500, 10500])
  })
  it("Case P: four £500 instalments pool into deposit/interim/final and earn £150 x 4 + £105", () => {
    const terms = buildAcceptedTerms({ plan: "standard-v2", scheduleId: "custom", buildInstalmentsPence: [50000, 50000, 50000, 50000], scheduleApprovalReference: "SYNTHETIC founder approval" })
    expect(terms.milestones).toMatchObject({ deposit: "50000", interim: "100000", final: "50000" })
    expect(run(terms, [["deposit", 50000], ["interim", 50000], ["interim", 50000], ["final", 50000], ["first_retainer", 35000]])).toEqual([15000, 15000, 15000, 15000, 10500])
  })
  it("rejects custom schedules without approval or that do not add up, and unapproved discounts", () => {
    expect(() => buildAcceptedTerms({ plan: "standard-v2", scheduleId: "custom", buildInstalmentsPence: [50000, 50000, 50000, 50000] })).toThrow(/approval reference/)
    expect(() => buildAcceptedTerms({ plan: "standard-v2", scheduleId: "custom", buildInstalmentsPence: [50000, 50000], scheduleApprovalReference: "x" })).toThrow(/add up/)
    expect(() => buildAcceptedTerms({ plan: "standard-v2", scheduleId: "nonsense" })).toThrow(/approved payment schedule/)
    expect(() => buildAcceptedTerms({ plan: "standard-v2", buildFeePence: 150000 })).toThrow(/discount allowance/)
    expect(() => buildAcceptedTerms({ plan: "standard-v2", buildFeePence: 150000, approvedDiscountFeePence: 100000 })).toThrow(/discount allowance/)
    expect(() => buildAcceptedTerms({ plan: "standard-v2", recurringPence: 1 })).toThrow()
  })
  it("Cases D/F: Growth Partnership-only earns £105 once on a £4,200 commitment with no build", () => {
    const terms = buildAcceptedTerms({ plan: "growth-only-v1" })
    expect(terms.commitment).toMatchObject({ buildPence: "0", minimumContractValuePence: "420000", minTermMonths: 12 })
    expect(run(terms, [["first_retainer", 35000]])).toEqual([10500])
    expect(() => commissionDelta(terms, "first_retainer", BigInt(35000), BigInt(35000), BigInt(35000))).toThrow()
    expect(() => commissionDelta(terms, "deposit", BigInt(0), BigInt(1), BigInt(0))).toThrow()
    expect(() => buildAcceptedTerms({ plan: "growth-only-v1", buildFeePence: 100000 })).toThrow()
  })
  it("Case G: bespoke £25,000 accrues per collection, never a £705 cap", () => {
    const terms = buildAcceptedTerms({ plan: "bespoke-v1", buildInstalmentsPence: [1000000, 500000, 1000000] })
    expect(terms.commitment?.buildPence).toBe("2500000")
    expect(run(terms, [["deposit", 1000000], ["interim", 500000], ["final", 1000000]])).toEqual([300000, 150000, 300000])
    expect(() => buildAcceptedTerms({ plan: "bespoke-v1", buildInstalmentsPence: [100], rateBps: 2500 })).toThrow(/approval reference/)
  })
  it("pooled rounding: fragmenting odd-penny payments across milestones never beats one cumulative rounding", () => {
    const terms = buildAcceptedTerms({ plan: "bespoke-v1", buildInstalmentsPence: [5, 5, 5, 5] })
    // £0.05 x 4 = 20p: exactly 6p cumulatively; naive per-milestone rounding (5p, 10p, 5p) would pay 2p+3p+2p = 7p
    const total = run(terms, [["deposit", 5], ["interim", 5], ["interim", 5], ["final", 5]]).reduce((a, b) => a + b, 0)
    expect(total).toBe(Number(commissionAt(BigInt(20), 3000)))
    expect(total).toBe(6)
  })
  it("pooled refunds reverse exactly what was earned and cannot exceed collected amounts", () => {
    const terms = buildAcceptedTerms({ plan: "standard-v2", scheduleId: "deposit-completion" })
    expect(commissionDelta(terms, "final", BigInt(125000), -BigInt(125000), BigInt(200000))).toBe(-BigInt(37500))
    expect(() => commissionDelta(terms, "final", BigInt(0), -BigInt(1), BigInt(200000))).toThrow()
  })
  it("tampered or inconsistent snapshots are rejected", () => {
    const good = buildAcceptedTerms({ plan: "standard-v2" })
    type Mutable = { milestones: Record<string, string>; commitment: Record<string, unknown> }
    const bad = (mutate: (t: Mutable) => void) => { const t = JSON.parse(JSON.stringify(good)) as Mutable; mutate(t); return () => parseCommissionTerms(t) }
    expect(bad(t => { t.commitment.minTermMonths = 6; t.commitment.minimumContractValuePence = "410000" })).toThrow(/twelve-month/)
    expect(bad(t => { t.milestones.final = "100001" })).toThrow(/add up/)
    expect(bad(t => { t.commitment.minimumContractValuePence = "1" })).toThrow(/contract value/)
    expect(bad(t => { delete (t as { commitment?: unknown }).commitment })).toThrow(/commitment/)
  })
  it("Cases E/F + table: approved discounted builds earn £555 / £405 / £255 / £105 with an unchanged twelve-month commitment", () => {
    const totals = [[200000, 70500], [150000, 55500], [100000, 40500], [50000, 25500], [0, 10500]].map(([fee, expected]) => {
      const terms = buildAcceptedTerms({ plan: "standard-v2", buildFeePence: fee, approvedDiscountFeePence: fee })
      expect(terms.commitment).toMatchObject({ recurringPence: "35000", minTermMonths: 12, buildPence: String(fee) })
      const payments: Array<["deposit" | "final" | "first_retainer", number]> = fee === 0 ? [["first_retainer", 35000]] : [["deposit", fee / 2], ["final", fee / 2], ["first_retainer", 35000]]
      return [run(terms, payments).reduce((a, b) => a + b, 0), expected]
    })
    for (const [actual, expected] of totals) expect(actual).toBe(expected)
  })
  it("free build keeps a distinct immutable plan version and cannot be paid as a build", () => {
    const terms = buildAcceptedTerms({ plan: "standard-v2", buildFeePence: 0, approvedDiscountFeePence: 0 })
    expect(terms.planVersion).toBe("standard-v2.d0")
    expect(() => commissionDelta(terms, "deposit", BigInt(0), BigInt(1), BigInt(0))).toThrow()
    expect(() => buildAcceptedTerms({ plan: "standard-v2", buildFeePence: 150000, approvedDiscountFeePence: 150000, scheduleId: "deposit-completion" })).toThrow(/equal instalments/)
  })
})
