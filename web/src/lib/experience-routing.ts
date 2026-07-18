import type { ExperienceExperimentVariant, StoredExperiencePreference } from "./experience-experiment"

export const CRAWLER_HOMEPAGE_VARIANT: ExperienceExperimentVariant = "normal_with_interactive_cta"
export const EXPERIENCE_QUERY_PARAMETER = "experience"
export const NORMAL_EXPERIENCE_QUERY_VALUE: StoredExperiencePreference = "normal"

const SEARCH_CRAWLER_PATTERN = /\b(?:googlebot|google-inspectiontool|bingbot|bingpreview|duckduckbot|applebot|yandexbot|baiduspider|slurp)\b/i
const GENERAL_CRAWLER_PATTERN = /\b(?:bot|crawler|spider)\b/i

export function isRecognizedCrawler(userAgent: string | null | undefined) {
  const value = userAgent ?? ""
  return SEARCH_CRAWLER_PATTERN.test(value) || GENERAL_CRAWLER_PATTERN.test(value)
}

export function normalizeExperienceQuery(value: string | null | undefined): StoredExperiencePreference | null {
  return value === NORMAL_EXPERIENCE_QUERY_VALUE ? NORMAL_EXPERIENCE_QUERY_VALUE : null
}

export function traditionalHomepageRedirectUrl(requestUrl: URL) {
  const destination = new URL(requestUrl)
  destination.pathname = "/"
  destination.search = ""
  destination.searchParams.set(EXPERIENCE_QUERY_PARAMETER, NORMAL_EXPERIENCE_QUERY_VALUE)
  destination.hash = ""
  return destination
}
