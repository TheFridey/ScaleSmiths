/**
 * Public partner profile projection. The page reads ONLY the database view `expansion_public_partner_profiles`, which the restricted web
 * role may SELECT and which already applies live checks (publication, partner status, recognition, reward entitlement). This module
 * validates the address, maps the view row onto the only fields a page may render, and decides whether the feature is switched on.
 */
export const PUBLIC_PROFILE_SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/
export interface PublicPartnerProfile {
  slug: string; displayName: string; biography: string; operatingArea: string
  enquiryMode: "scalesmiths_contact" | "referral_code"; referralCode: string | null
  achievements: string[]; foundingPartnerSince: string | null
}
/** Public profiles are off unless an environment explicitly enables them; real partner pages are a separate release gate. */
export const publicProfilesEnabled = (env: Record<string, string | undefined> = process.env) => env.PUBLIC_PARTNER_PROFILES_ENABLED === "true"
export const isValidProfileSlug = (value: unknown): value is string => typeof value === "string" && PUBLIC_PROFILE_SLUG.test(value) && !value.includes("--")

type ViewRow = Record<string, unknown>
const text = (v: unknown) => (typeof v === "string" ? v : "")
export function toPublicProfile(row: ViewRow | undefined): PublicPartnerProfile | null {
  if (!row) return null
  const mode = row.enquiry_mode === "referral_code" ? "referral_code" : "scalesmiths_contact"
  const date = row.founding_recognition_date
  const founding = date instanceof Date ? date.toISOString().slice(0, 10) : typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : null
  const code = typeof row.referral_code === "string" && /^SS-[A-Z2-7]{8}$/.test(row.referral_code) ? row.referral_code : null
  return {
    slug: text(row.slug), displayName: text(row.display_name), biography: text(row.biography), operatingArea: text(row.operating_area),
    enquiryMode: mode, referralCode: mode === "referral_code" ? code : null,
    achievements: Array.isArray(row.achievements) ? row.achievements.map(text).filter(Boolean).slice(0, 5) : [],
    foundingPartnerSince: founding,
  }
}
