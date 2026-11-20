import { describe, expect, it } from "vitest"
import { isValidProfileSlug, publicProfilesEnabled, toPublicProfile } from "./partner-profile-public"

describe("public partner profile projection", () => {
  it("is switched off unless explicitly enabled", () => {
    expect(publicProfilesEnabled({})).toBe(false)
    expect(publicProfilesEnabled({ PUBLIC_PARTNER_PROFILES_ENABLED: "1" })).toBe(false)
    expect(publicProfilesEnabled({ PUBLIC_PARTNER_PROFILES_ENABLED: "true" })).toBe(true)
  })
  it("accepts only well-formed addresses, so nothing odd reaches the database", () => {
    for (const ok of ["jane-doe", "a1b", "synthetic-partner-2"]) expect(isValidProfileSlug(ok)).toBe(true)
    for (const bad of ["", "a", "-ab", "ab-", "a--b", "UPPER", "has space", "../etc", "a'b", "x".repeat(41), undefined, 5, null]) expect(isValidProfileSlug(bad as never)).toBe(false)
  })
  it("maps a view row onto the whitelisted fields only and drops anything extra", () => {
    const profile = toPublicProfile({ slug: "jane", display_name: "Jane", biography: "Bio", operating_area: "Notts", enquiry_mode: "referral_code", achievements: ["A", "", "B"], referral_code: "SS-ABCDEFG2", founding_recognition_date: "2026-03-01", email: "private@example.test", partner_id: "x", review_note: "secret" })
    expect(profile).toEqual({ slug: "jane", displayName: "Jane", biography: "Bio", operatingArea: "Notts", enquiryMode: "referral_code", referralCode: "SS-ABCDEFG2", achievements: ["A", "B"], foundingPartnerSince: "2026-03-01" })
    expect(JSON.stringify(profile)).not.toMatch(/private@|partner_id|secret/)
  })
  it("never shows a referral code unless the partner chose it, and rejects malformed codes", () => {
    expect(toPublicProfile({ slug: "j", display_name: "J", biography: "b", operating_area: "o", enquiry_mode: "scalesmiths_contact", referral_code: "SS-ABCDEFG2" })?.referralCode).toBeNull()
    expect(toPublicProfile({ slug: "j", display_name: "J", biography: "b", operating_area: "o", enquiry_mode: "referral_code", referral_code: "<script>" })?.referralCode).toBeNull()
    expect(toPublicProfile(undefined)).toBeNull()
  })
})
