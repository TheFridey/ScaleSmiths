import { describe, expect, it } from "vitest"
import { currentStageDistribution, eventCount, eventSumPence, inPeriod, parsePerformancePeriod, periodStart, ratio, weeklySeries } from "./partner-performance"

const now = new Date("2026-11-23T12:00:00.000Z")
describe("B2.5 pure performance metrics", () => {
  it("rejects invalid periods and defaults to 30 days", () => {
    expect(parsePerformancePeriod(null)).toBe("30d")
    expect(parsePerformancePeriod("90d")).toBe("90d")
    expect(() => parsePerformancePeriod("365d")).toThrow(RangeError)
    expect(() => parsePerformancePeriod(["7d"])).toThrow()
  })
  it("uses precise rolling intervals and never includes events in the future", () => {
    const start = periodStart("7d", now)!
    expect(start.toISOString()).toBe("2026-11-16T12:00:00.000Z")
    expect(inPeriod("2026-11-16T12:00:00Z", start, now)).toBe(true)
    expect(inPeriod("2026-11-16T11:59:59Z", start, now)).toBe(false)
    expect(inPeriod("2026-11-24T00:00:00Z", start, now)).toBe(false)
  })
  it("clamps a twelve-calendar-month interval at month end", () => {
    expect(periodStart("12m", new Date("2024-02-29T13:00:00Z"))?.toISOString()).toBe("2023-02-28T13:00:00.000Z")
    expect(periodStart("all", now)).toBeNull()
  })
  it("counts actual events and sums pence exactly, including reversals", () => {
    const events = [{ at: "2026-11-22T10:00:00Z", amountPence: "1000000000000000000" }, { at: "2026-11-22T10:30:00Z", amountPence: "-150" }, { at: "2026-10-22T00:00:00Z", amountPence: "500" }]
    const start = periodStart("7d", now)
    expect(eventCount(events, start, now)).toBe(2)
    expect(eventSumPence(events, start, now)).toBe("999999999999999850")
  })
  it("does not invent a conversion percentage from an empty cohort", () => {
    expect(ratio(0, 0)).toEqual({ numerator: 0, denominator: 0, percentage: null })
    expect(ratio(1, 4).percentage).toBe(25)
    expect(() => ratio(5, 4)).toThrow()
  })
  it("labels current pipeline states as a distribution, not historical conversion", () => {
    expect(currentStageDistribution([{ status: "registered", count: 2 }, { status: "approved", count: 1 }])).toEqual({
      kind: "current_state_only", total: 3, stages: [{ status: "registered", count: 2 }, { status: "approved", count: 1 }],
    })
    expect(() => currentStageDistribution([{ status: "registered", count: -1 }])).toThrow()
  })
  it("groups only observed events by Monday of the UTC week", () => {
    const events = [{ at: "2026-11-22T10:00:00Z", amountPence: "100" }, { at: "2026-11-23T09:00:00Z", amountPence: "75" }]
    expect(weeklySeries(events, periodStart("7d", now)!, now)).toEqual([
      { week: "2026-11-16", count: 1, pence: "100" },
      { week: "2026-11-23", count: 1, pence: "75" },
    ])
  })
})
