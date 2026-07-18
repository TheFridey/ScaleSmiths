import { describe, expect, it } from "vitest"
import { summarizeExperienceAnalytics, type ExperienceAnalyticsRow } from "./experience-analytics"

describe("experience analytics dashboard summary", () => {
  it("compares normal and interactive journey outcomes from aggregate rows", () => {
    const now = new Date("2026-07-13T12:00:00.000Z")
    const rows: ExperienceAnalyticsRow[] = [
      row("experience_choice_displayed", "none", now),
      row("experience_normal_selected", "normal", now),
      row("quote_form_submitted", "normal", now),
      row("experience_interactive_selected", "interactive", now),
      row("interactive_completion_depth", "interactive", now, 100),
      row("quote_form_submitted", "interactive", now),
      { ...row("experience_returning_preference", "interactive", now), returningPreference: true },
      row("local_growth_check_viewed", "normal", now),
      row("local_growth_check_form_started", "normal", now),
      row("local_growth_check_form_submitted", "normal", now),
    ]

    const summary = summarizeExperienceAnalytics(rows)

    expect(summary.normalSelected).toBe(1)
    expect(summary.interactiveSelected).toBe(1)
    expect(summary.normalFormSubmitted).toBe(1)
    expect(summary.interactiveFormSubmitted).toBe(1)
    expect(summary.returningPreference).toBe(1)
    expect(summary.averageInteractiveDepth).toBe(100)
    expect(summary.localGrowthViewed).toBe(1)
    expect(summary.localGrowthStarted).toBe(1)
    expect(summary.localGrowthSubmitted).toBe(1)
  })
})

function row(eventName: ExperienceAnalyticsRow["eventName"], preference: ExperienceAnalyticsRow["preference"], occurredAt: Date, completionDepth: number | null = null): ExperienceAnalyticsRow {
  return {
    eventName,
    preference,
    occurredAt,
    completionDepth,
    deviceClass: "desktop",
    returningPreference: false,
    campaignSource: null,
    campaignMedium: null,
    campaignName: null,
  }
}
