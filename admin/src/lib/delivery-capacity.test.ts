import { describe, expect, it } from "vitest"
import { buildCapacityForecast, type DeliveryWorkItem } from "./delivery-capacity"

const now = new Date("2026-07-13T09:00:00.000Z")

function item(overrides: Partial<DeliveryWorkItem>): DeliveryWorkItem {
  return {
    id: "work:1",
    name: "Project",
    source: "forge_project",
    status: "confirmed",
    owner: "rhys",
    deadline: "2026-07-17T12:00:00.000Z",
    estimatedHours: 40,
    remainingHours: 40,
    manualHours: 30,
    forgeHours: 10,
    probability: 1,
    confidence: "medium",
    risk: "medium",
    blockers: [],
    assumptions: [],
    singlePersonDependency: false,
    ...overrides,
  }
}

describe("delivery capacity forecasting", () => {
  it("warns when confirmed and probable sales work exceed capacity", () => {
    const forecast = buildCapacityForecast({
      now,
      assumptions: { defaultWeeklyHumanHours: 32 },
      workItems: [
        item({ id: "confirmed", remainingHours: 38, manualHours: 32, forgeHours: 6 }),
        item({ id: "probable", source: "sales_pipeline", status: "probable", remainingHours: 30, manualHours: 24, forgeHours: 6, probability: 0.5 }),
      ],
    })

    expect(forecast.weekly[0].confirmedHours).toBe(38)
    expect(forecast.weekly[0].probableHours).toBe(15)
    expect(forecast.weekly[0].risk).toBe("high")
    expect(forecast.warnings).toContain("Confirmed work exceeds available delivery capacity in at least one week.")
    expect(forecast.warnings).toContain("Sales commitments plus probable work exceed available delivery capacity in at least one week.")
  })

  it("keeps probable work separate and does not treat Forge effort as zero human effort", () => {
    const forecast = buildCapacityForecast({
      now,
      workItems: [
        item({ id: "forge", remainingHours: 20, manualHours: 12, forgeHours: 8 }),
        item({ id: "pipeline", source: "sales_pipeline", status: "probable", remainingHours: 20, manualHours: 16, forgeHours: 4, probability: 0.25 }),
      ],
    })

    expect(forecast.activeProjects).toHaveLength(1)
    expect(forecast.probableIncomingWork).toHaveLength(1)
    expect(forecast.weekly[0].manualHours).toBeGreaterThan(0)
    expect(forecast.weekly[0].forgeHours).toBeGreaterThan(0)
  })

  it("applies manual capacity adjustments and tracks forecast-vs-actual variance", () => {
    const forecast = buildCapacityForecast({
      now,
      workItems: [item({ remainingHours: 24 })],
      adjustments: [
        { weekStart: "2026-07-13T00:00:00.000Z", adjustmentType: "time_off", staffName: "Rhys", role: "delivery", hours: 8, reason: "Holiday", confidence: "high" },
        { weekStart: "2026-07-13T00:00:00.000Z", adjustmentType: "contractor_capacity", staffName: "Contractor", role: "frontend", hours: 4, reason: "Approved support", confidence: "medium" },
      ],
      actuals: [
        { periodStart: "2026-07-13T00:00:00.000Z", periodType: "week", forecastHours: 24, actualHours: 30, notes: "QA overran" },
      ],
    })

    expect(forecast.weekly[0].adjustedCapacityHours).toBe(28)
    expect(forecast.forecastVsActual[0]).toMatchObject({ varianceHours: 6, variancePercent: 25 })
  })

  it("highlights approval bottlenecks and single-person dependencies", () => {
    const blocked = item({
      id: "blocked",
      status: "waiting_internal",
      blockers: ["Awaiting internal artifact approval."],
      singlePersonDependency: true,
    })
    const forecast = buildCapacityForecast({ now, workItems: [blocked] })

    expect(forecast.workAwaitingInternalApproval).toEqual([blocked])
    expect(forecast.singlePersonDependencies).toEqual([blocked])
    expect(forecast.warnings).toContain("Single-person delivery dependencies exist; check cover before promising dates.")
  })
})
