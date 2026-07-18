export type ExperienceEventName =
  | "experience_choice_displayed"
  | "experience_normal_selected"
  | "experience_interactive_selected"
  | "experience_choice_abandoned"
  | "experience_returning_preference"
  | "experience_switched"
  | "quote_cta_clicked"
  | "quote_form_started"
  | "quote_form_submitted"
  | "navigation_exit"
  | "interactive_completion_depth"
  | "experience_fallback_activated"
  | "experience_error"
  | "local_growth_check_viewed"
  | "local_growth_check_form_started"
  | "local_growth_check_form_submitted"
  | "local_growth_check_full_quote_selected"
  | "local_growth_check_strategy_call_requested"

export interface ExperienceAnalyticsRow {
  eventName: ExperienceEventName
  preference: "normal" | "interactive" | "none" | "unknown"
  deviceClass: "mobile" | "tablet" | "desktop" | "unknown"
  returningPreference: boolean
  completionDepth: number | null
  campaignSource: string | null
  campaignMedium: string | null
  campaignName: string | null
  occurredAt: Date
}

export function summarizeExperienceAnalytics(rows: ExperienceAnalyticsRow[]) {
  const count = (name: ExperienceEventName, preference?: "normal" | "interactive") =>
    rows.filter((row) => row.eventName === name && (!preference || row.preference === preference)).length
  const choiceDisplayed = count("experience_choice_displayed")
  const normalSelected = count("experience_normal_selected")
  const interactiveSelected = count("experience_interactive_selected")
  const formStarted = count("quote_form_started")
  const formSubmitted = count("quote_form_submitted")
  const interactiveDepths = rows
    .filter((row) => row.eventName === "interactive_completion_depth" && typeof row.completionDepth === "number")
    .map((row) => row.completionDepth as number)

  return {
    totalEvents: rows.length,
    choiceDisplayed,
    normalSelected,
    interactiveSelected,
    choiceAbandoned: count("experience_choice_abandoned"),
    returningPreference: rows.filter((row) => row.returningPreference).length,
    experienceSwitched: count("experience_switched"),
    quoteCtaClicked: count("quote_cta_clicked"),
    formStarted,
    formSubmitted,
    normalFormSubmitted: count("quote_form_submitted", "normal"),
    interactiveFormSubmitted: count("quote_form_submitted", "interactive"),
    navigationExit: count("navigation_exit"),
    fallbackOrError: count("experience_fallback_activated") + count("experience_error"),
    localGrowthViewed: count("local_growth_check_viewed"),
    localGrowthStarted: count("local_growth_check_form_started"),
    localGrowthSubmitted: count("local_growth_check_form_submitted"),
    localGrowthFullQuoteSelected: count("local_growth_check_full_quote_selected"),
    localGrowthStrategyCallRequested: count("local_growth_check_strategy_call_requested"),
    normalSelectionRate: percentage(normalSelected, choiceDisplayed),
    interactiveSelectionRate: percentage(interactiveSelected, choiceDisplayed),
    quoteSubmissionRate: percentage(formSubmitted, formStarted),
    averageInteractiveDepth: interactiveDepths.length ? Math.round(interactiveDepths.reduce((sum, value) => sum + value, 0) / interactiveDepths.length) : null,
    byDevice: groupCount(rows, (row) => row.deviceClass),
    byCampaign: groupCount(rows, (row) => [row.campaignSource, row.campaignMedium, row.campaignName].filter(Boolean).join(" / ") || "direct-or-unattributed"),
    byDay: groupCount(rows, (row) => row.occurredAt.toISOString().slice(0, 10)).sort((a, b) => a.label.localeCompare(b.label)),
  }
}

function percentage(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : null
}

function groupCount<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1)
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
}
