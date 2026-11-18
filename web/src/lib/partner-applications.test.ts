import { describe, expect, it } from "vitest"
import { formatPartnerMoney, illustrativeCommissionMinor, isPartnerApplicationOriginAllowed, partnerApplicationConfig, readPartnerApplicationJson, validatePartnerApplication } from "./partner-applications"

const valid = { name: "Example Partner", email: "PARTNER@example.test", region: "East Midlands", experience: "Independent commercial sales experience.", motivation: "Build useful long term business relationships.", privacyAcknowledged: true, privacyVersion: "approved-test-v1" }

describe("partner recruitment", () => {
  it.each([[1, "£705"], [4, "£2,820"], [5, "£3,525"], [8, "£5,640"], [10, "£7,050"]])("calculates %i qualifying sales exactly", (sales, expected) => {
    expect(formatPartnerMoney(illustrativeCommissionMinor(sales as number))).toBe(expected)
  })
  it("rejects fractional and unbounded illustrative counts", () => {
    for (const sales of [-1, 1.5, 101, NaN]) expect(() => illustrativeCommissionMinor(sales)).toThrow()
  })
  it("requires operational enablement, privacy version and bounded retention together", () => {
    expect(partnerApplicationConfig({}).enabled).toBe(false)
    expect(partnerApplicationConfig({ PARTNER_APPLICATIONS_ENABLED: "true" }).enabled).toBe(false)
    expect(partnerApplicationConfig({ PARTNER_APPLICATIONS_ENABLED: "true", PARTNER_APPLICATION_PRIVACY_VERSION: "approved-v1", PARTNER_APPLICATION_RETENTION_DAYS: "180" }).enabled).toBe(true)
    expect(partnerApplicationConfig({ PARTNER_APPLICATIONS_ENABLED: "true", PARTNER_APPLICATION_PRIVACY_VERSION: "approved-v1", PARTNER_APPLICATION_RETENTION_DAYS: "731" }).enabled).toBe(false)
    expect(partnerApplicationConfig({ PARTNER_APPLICATIONS_ENABLED: "true", PARTNER_APPLICATION_PRIVACY_VERSION: "approved-v1", PARTNER_APPLICATION_RETENTION_DAYS: "12days" }).enabled).toBe(false)
  })
  it("normalizes email and accepts only necessary bounded fields", () => {
    const result = validatePartnerApplication(valid)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.email).toBe("partner@example.test")
    expect(validatePartnerApplication({ ...valid, motivation: "x".repeat(2001) }).ok).toBe(false)
    expect(validatePartnerApplication({ ...valid, name: { injected: true } }).ok).toBe(false)
  })
  it("requires explicit privacy acknowledgement and valid required data", () => {
    for (const payload of [null, [], { ...valid, privacyAcknowledged: "true" }, { ...valid, email: "bad" }, { ...valid, experience: "short" }]) expect(validatePartnerApplication(payload).ok).toBe(false)
  })
  it("rejects unsafe or impersonated LinkedIn URLs", () => {
    for (const linkedin of ["javascript:alert(1)", "http://linkedin.com/in/person", "https://linkedin.com.attacker.test", "https://attacker@linkedin.com/in/person"]) expect(validatePartnerApplication({ ...valid, linkedin }).ok).toBe(false)
    expect(validatePartnerApplication({ ...valid, linkedin: "https://www.linkedin.com/in/example" }).ok).toBe(true)
  })
  it("flags the honeypot without accepting client supplied review/activation values", () => {
    const result = validatePartnerApplication({ ...valid, website: "spam", status: "activated", onboardingConfirmations: { legal: true } })
    expect(result.ok).toBe(true)
    if (result.ok) { expect(result.honeypot).toBe(true); expect(result.data).not.toHaveProperty("status") }
  })
  it("denies cross-origin, missing and malformed origins", () => {
    expect(isPartnerApplicationOriginAllowed("https://scalesmiths.co.uk", "https://scalesmiths.co.uk/")).toBe(true)
    for (const origin of [null, "null", "https://attacker.test", "https://scalesmiths.co.uk.attacker.test", "https://scalesmiths.co.uk/path"]) expect(isPartnerApplicationOriginAllowed(origin, "https://scalesmiths.co.uk")).toBe(false)
  })
  it("bounds chunked and multi-byte bodies before parsing", async () => {
    const request = new Request("https://scalesmiths.co.uk/api/partner-applications", { method: "POST", body: JSON.stringify({ name: "€".repeat(20) }) })
    const result = await readPartnerApplicationJson(request, 50)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(413)
    expect((await readPartnerApplicationJson(new Request("https://scalesmiths.co.uk", { method: "POST", body: "{" }))).ok).toBe(false)
  })
})
