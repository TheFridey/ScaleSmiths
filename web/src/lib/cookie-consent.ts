export const COOKIE_POLICY_VERSION = "2.0"
export const COOKIE_CONSENT_COOKIE = "ss_cookie_consent"
export const COOKIE_CONSENT_MAX_AGE = 60 * 60 * 24 * 180

export type CookiePreferences = {
  version: string
  functional: boolean
  analytics: boolean
  marketing: boolean
  decidedAt: string
}

export const defaultCookiePreferences: CookiePreferences = {
  version: COOKIE_POLICY_VERSION,
  functional: false,
  analytics: false,
  marketing: false,
  decidedAt: "",
}

export const storageInventory = [
  { name: "ss-client-session", provider: "ScaleSmiths", purpose: "Authenticates an authorised client-portal session.", category: "Strictly necessary", duration: "8 hours", party: "First party", consent: "No — required for the requested portal service" },
  { name: COOKIE_CONSENT_COOKIE, provider: "ScaleSmiths", purpose: "Records anonymous cookie/storage category choices and policy version.", category: "Strictly necessary", duration: "180 days", party: "First party", consent: "No — required to remember the privacy choice" },
  { name: "ss_analytics_opt_out", provider: "ScaleSmiths", purpose: "Preserves an analytics objection for compatibility with earlier preference controls.", category: "Strictly necessary", duration: "Up to 1 year", party: "First party", consent: "No — records an objection" },
  { name: "ss_experience_preference / scalesmiths.experience", provider: "ScaleSmiths", purpose: "Remembers an experience explicitly selected by the visitor.", category: "Functional", duration: "Up to 1 year / until cleared", party: "First party", consent: "Yes" },
  { name: "scalesmiths.v2.industry", provider: "ScaleSmiths", purpose: "Remembers an industry explicitly selected in the interactive journey.", category: "Functional", duration: "Until cleared", party: "First party", consent: "Yes" },
  { name: "scalesmiths.analytics.session / scalesmiths.analytics.sent", provider: "ScaleSmiths", purpose: "Groups privacy-minimised first-party experience events and prevents duplicates within a browser tab.", category: "Analytics", duration: "Browser tab/session", party: "First party", consent: "Yes" },
  { name: "ss_exp_id / ss_exp_variant", provider: "ScaleSmiths", purpose: "Maintains an anonymous controlled-experience experiment assignment when an experiment is enabled.", category: "Analytics", duration: "Up to 90 days", party: "First party", consent: "Yes" },
] as const

export function readCookiePreferences(cookieHeader: string | undefined): CookiePreferences | null {
  const raw = (cookieHeader ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_CONSENT_COOKIE}=`))?.split("=").slice(1).join("=")
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<CookiePreferences>
    if (parsed.version !== COOKIE_POLICY_VERSION || typeof parsed.analytics !== "boolean" || typeof parsed.functional !== "boolean" || typeof parsed.marketing !== "boolean") return null
    return { version: parsed.version, analytics: parsed.analytics, functional: parsed.functional, marketing: parsed.marketing, decidedAt: typeof parsed.decidedAt === "string" ? parsed.decidedAt : "" }
  } catch { return null }
}
