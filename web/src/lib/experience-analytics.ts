export const EXPERIENCE_EVENT_NAMES = [
  "experience_choice_displayed",
  "experience_normal_selected",
  "experience_interactive_selected",
  "experience_choice_abandoned",
  "experience_returning_preference",
  "experience_switched",
  "quote_cta_clicked",
  "quote_form_started",
  "quote_form_submitted",
  "navigation_exit",
  "interactive_completion_depth",
  "experience_fallback_activated",
  "experience_error",
  "local_growth_check_viewed",
  "local_growth_check_form_started",
  "local_growth_check_form_submitted",
  "local_growth_check_full_quote_selected",
  "local_growth_check_strategy_call_requested",
] as const

export const ANALYTICS_OPT_OUT_COOKIE = "ss_analytics_opt_out"

export type ExperienceEventName = (typeof EXPERIENCE_EVENT_NAMES)[number]
export type ExperiencePreferenceValue = "normal" | "interactive" | "none" | "unknown"
export type ExperienceDeviceClass = "mobile" | "tablet" | "desktop" | "unknown"

export interface ExperienceEventPayload {
  eventName: ExperienceEventName
  eventKey: string
  sessionId: string
  path?: string
  deviceClass?: ExperienceDeviceClass
  preference?: ExperiencePreferenceValue
  returningPreference?: boolean
  fromExperience?: ExperiencePreferenceValue | null
  toExperience?: ExperiencePreferenceValue | null
  interactiveStep?: string | null
  completionDepth?: number | null
  referrer?: string | null
  campaign?: {
    source?: string | null
    medium?: string | null
    name?: string | null
  }
  errorCategory?: string | null
  metadata?: Record<string, unknown>
}

export interface SanitizedExperienceEvent {
  eventName: ExperienceEventName
  eventKey: string
  sessionId: string
  path: string
  deviceClass: ExperienceDeviceClass
  preference: ExperiencePreferenceValue
  returningPreference: boolean
  fromExperience: ExperiencePreferenceValue | null
  toExperience: ExperiencePreferenceValue | null
  interactiveStep: string | null
  completionDepth: number | null
  referrerHost: string | null
  campaignSource: string | null
  campaignMedium: string | null
  campaignName: string | null
  errorCategory: string | null
  metadata: Record<string, string | number | boolean>
}

const EVENT_NAME_SET = new Set<string>(EXPERIENCE_EVENT_NAMES)
const PREFERENCE_SET = new Set(["normal", "interactive", "none", "unknown"])
const DEVICE_SET = new Set(["mobile", "tablet", "desktop", "unknown"])

export function shouldRespectPrivacyOptOut(headers: Headers) {
  return headers.get("sec-gpc") === "1" || headers.get("dnt") === "1" || hasCookie(headers.get("cookie"), ANALYTICS_OPT_OUT_COOKIE, "1")
}

function hasCookie(header: string | null, name: string, value: string) {
  return (header ?? "").split(";").some((part) => {
    const [key, rawValue] = part.trim().split("=", 2)
    if (key !== name) return false
    try {
      return decodeURIComponent(rawValue ?? "") === value
    } catch {
      return false
    }
  })
}

export function sanitizeExperienceEvent(input: unknown): SanitizedExperienceEvent | null {
  if (!input || typeof input !== "object") return null
  const payload = input as ExperienceEventPayload
  if (!EVENT_NAME_SET.has(payload.eventName)) return null

  const eventKey = safeToken(payload.eventKey, 160)
  const sessionId = safeToken(payload.sessionId, 96)
  if (!eventKey || !sessionId) return null

  return {
    eventName: payload.eventName,
    eventKey,
    sessionId,
    path: safePath(payload.path),
    deviceClass: normalizeDevice(payload.deviceClass),
    preference: normalizePreference(payload.preference),
    returningPreference: payload.returningPreference === true,
    fromExperience: nullablePreference(payload.fromExperience),
    toExperience: nullablePreference(payload.toExperience),
    interactiveStep: safeLabel(payload.interactiveStep, 64),
    completionDepth: normalizeDepth(payload.completionDepth),
    referrerHost: referrerHost(payload.referrer),
    campaignSource: safeLabel(payload.campaign?.source, 80),
    campaignMedium: safeLabel(payload.campaign?.medium, 80),
    campaignName: safeLabel(payload.campaign?.name, 120),
    errorCategory: safeLabel(payload.errorCategory, 80),
    metadata: safeMetadata(payload.metadata),
  }
}

export function summarizeExperienceEvents(events: Array<Pick<SanitizedExperienceEvent, "eventName" | "preference" | "deviceClass" | "returningPreference" | "completionDepth" | "campaignSource" | "campaignMedium" | "campaignName">>) {
  const total = events.length
  const count = (name: ExperienceEventName) => events.filter((event) => event.eventName === name).length
  const normalSelected = count("experience_normal_selected")
  const interactiveSelected = count("experience_interactive_selected")
  const quoteSubmitted = count("quote_form_submitted")
  const choiceDisplayed = count("experience_choice_displayed")
  const interactiveDepths = events
    .filter((event) => event.eventName === "interactive_completion_depth" && typeof event.completionDepth === "number")
    .map((event) => event.completionDepth as number)

  return {
    totalEvents: total,
    choiceDisplayed,
    normalSelected,
    interactiveSelected,
    choiceAbandoned: count("experience_choice_abandoned"),
    returningPreference: events.filter((event) => event.returningPreference).length,
    experienceSwitched: count("experience_switched"),
    quoteCtaClicked: count("quote_cta_clicked"),
    formStarted: count("quote_form_started"),
    formSubmitted: quoteSubmitted,
    navigationExit: count("navigation_exit"),
    fallbackOrError: count("experience_fallback_activated") + count("experience_error"),
    normalSelectionRate: rate(normalSelected, choiceDisplayed),
    interactiveSelectionRate: rate(interactiveSelected, choiceDisplayed),
    quoteSubmissionRate: rate(quoteSubmitted, count("quote_form_started")),
    averageInteractiveDepth: interactiveDepths.length
      ? Math.round(interactiveDepths.reduce((sum, value) => sum + value, 0) / interactiveDepths.length)
      : null,
    byDevice: groupCount(events, (event) => event.deviceClass),
    byCampaign: groupCount(events, (event) => [event.campaignSource, event.campaignMedium, event.campaignName].filter(Boolean).join(" / ") || "direct-or-unattributed"),
  }
}

function safeToken(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null
  const trimmed = value.trim().slice(0, maxLength)
  return /^[a-zA-Z0-9:._-]+$/.test(trimmed) ? trimmed : null
}

function safePath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/"
  return value.split(/[?#]/)[0].slice(0, 160) || "/"
}

function safeLabel(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null
  const trimmed = value.trim().replace(/[^\w .:/+-]/g, "").slice(0, maxLength)
  return trimmed || null
}

function normalizePreference(value: unknown): ExperiencePreferenceValue {
  return typeof value === "string" && PREFERENCE_SET.has(value) ? value as ExperiencePreferenceValue : "unknown"
}

function nullablePreference(value: unknown): ExperiencePreferenceValue | null {
  return value === null || value === undefined ? null : normalizePreference(value)
}

function normalizeDevice(value: unknown): ExperienceDeviceClass {
  return typeof value === "string" && DEVICE_SET.has(value) ? value as ExperienceDeviceClass : "unknown"
}

function normalizeDepth(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null
}

function referrerHost(value: unknown) {
  if (typeof value !== "string" || !value) return null
  try {
    return new URL(value).hostname.slice(0, 120)
  } catch {
    return null
  }
}

function safeMetadata(value: unknown) {
  if (!value || typeof value !== "object") return {}
  const allowed = new Set(["source", "reason", "step", "target", "variant", "recommendation", "funnelType"])
  const output: Record<string, string | number | boolean> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!allowed.has(key)) continue
    if (typeof item === "string") output[key] = item.slice(0, 120)
    if (typeof item === "number" && Number.isFinite(item)) output[key] = item
    if (typeof item === "boolean") output[key] = item
  }
  return output
}

function rate(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 10_000) / 100 : null
}

function groupCount<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1)
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
}
