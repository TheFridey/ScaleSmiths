import { describe, expect, it } from "vitest"
import { gbp, historicalConversion, MIN_CLOSED_OUTCOMES, parseAssumptions, pct, project, type Assumptions } from "./revenue-forecast"

const base: Assumptions = { scenario: "baseline", stageBasisPoints: { qualified: 1000, scope_submitted: 3000, approved: 7000 }, averageValuePence: "300000", monthlyRetentionBasisPoints: 9500, horizonMonths: 3 }

describe("forecast assumptions", () => {
  it("accept valid founder input and refuse anything out of range", () => {
    expect(parseAssumptions({ ...base })).toEqual({ ok: true, value: base })
    const bad = (over: Record<string, unknown>) => parseAssumptions({ ...base, ...over })
    expect(bad({ scenario: "wild" })).toMatchObject({ ok: false })
    expect(bad({ stageBasisPoints: { ...base.stageBasisPoints, approved: 10001 } })).toMatchObject({ ok: false, problem: expect.stringMatching(/scope approved/) })
    expect(bad({ stageBasisPoints: { ...base.stageBasisPoints, qualified: 12.5 } })).toMatchObject({ ok: false })
    expect(bad({ averageValuePence: "-1" })).toMatchObject({ ok: false })
    expect(bad({ averageValuePence: 300000 })).toMatchObject({ ok: false })
    expect(bad({ monthlyRetentionBasisPoints: -1 })).toMatchObject({ ok: false })
    expect(bad({ horizonMonths: 25 })).toMatchObject({ ok: false })
    expect(bad({ horizonMonths: 0 })).toMatchObject({ ok: false })
  })
})

describe("historical conversion", () => {
  it("is never shown below the minimum number of closed outcomes", () => {
    expect(historicalConversion({ accepted: 3, lost: 2 })).toMatchObject({ basisPoints: null, closed: 5 })
    expect(historicalConversion({ accepted: 0, lost: 0 }).reason).toMatch(/at least 10/)
    expect(historicalConversion({ accepted: 3, lost: MIN_CLOSED_OUTCOMES - 3 })).toMatchObject({ basisPoints: 3000, closed: 10, reason: null })
    expect(historicalConversion({ accepted: 1, lost: 2 + MIN_CLOSED_OUTCOMES }).basisPoints).toBe(769)
  })
})

describe("projection", () => {
  it("weights pipeline by stage and decays recurring revenue, exactly, in integer pence", () => {
    const r = project({ stageCounts: { qualified: 4, scope_submitted: 2, approved: 1 }, monthlyRecurringPence: "100000", assumptions: base })
    // Pipeline: 4 × £3,000 × 10%, 2 × £3,000 × 30%, 1 × £3,000 × 70%.
    // Recurring, floored each month: 100000 × 0.95 = 95000; × 0.95 = 90250; × 0.95 = 85737.5 → 85737; total 270987.
    expect(r.lines.map((l) => l.pence)).toEqual(["120000", "180000", "210000", "270987"])
    expect(r.totalPence).toBe("780987")
    expect(r.lines[0].explanation).toBe("4 opportunities × 10% × £3,000.00 assumed value")
  })
  it("projects nothing from nothing and never mutates its input", () => {
    const input = { stageCounts: { qualified: 0, scope_submitted: 0, approved: 0 }, monthlyRecurringPence: "0", assumptions: { ...base } }
    expect(project(input).totalPence).toBe("0")
    expect(input.assumptions).toEqual(base)
    expect(project({ ...input, assumptions: { ...base, monthlyRetentionBasisPoints: 0 }, monthlyRecurringPence: "50000" }).totalPence).toBe("0")
  })
  it("formats money and percentages without floating-point drift", () => {
    expect(gbp("123456789")).toBe("£1,234,567.89")
    expect(gbp("-705")).toBe("−£7.05")
    expect(gbp(BigInt(70500))).toBe("£705.00")
    expect(pct(3000)).toBe("30%")
    expect(pct(1234)).toBe("12.34%")
  })
})
