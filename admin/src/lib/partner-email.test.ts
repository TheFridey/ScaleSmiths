import { describe, expect, it } from "vitest"
import { buildPartnerEmail, safeLink } from "./partner-email"

describe("partner lifecycle email content", () => {
  it("escapes applicant-controlled text and keeps subjects header-safe", () => {
    const email = buildPartnerEmail({ kind: "information_requested", name: "<script>alert(1)</script> Smith\r\nBcc: x@y.z", message: "Please share <b>two</b> references & dates." })
    expect(email.html).not.toContain("<script>")
    expect(email.html).toContain("&lt;b&gt;two&lt;/b&gt; references &amp; dates.")
    expect(email.subject).not.toMatch(/[\r\n]/)
    expect(email.text).toContain("Please share <b>two</b> references & dates.")
  })

  it("never puts applicant-typed URLs, domains or addresses into the greeting", () => {
    for (const name of ["www.evil.example Free money", "https://evil.example", "evil.example", "me@evil.example", "<b>Hi</b>", "Visit:now", "1234"]) {
      const email = buildPartnerEmail({ kind: "application_received", name })
      expect(email.text.startsWith("Hello there,")).toBe(true)
      expect(`${email.html}${email.text}`).not.toMatch(/evil\.example|<b>Hi/)
    }
    expect(buildPartnerEmail({ kind: "application_received", name: "Siân O'Neill-Jones" }).text.startsWith("Hello Siân,")).toBe(true)
    expect(buildPartnerEmail({ kind: "application_received", name: "D'Arcy Smith" }).text.startsWith("Hello D'Arcy,")).toBe(true)
  })

  it("only links to ScaleSmiths HTTPS origins", () => {
    expect(safeLink("https://partners.scalesmiths.co.uk/partner/activate#token=abc")).toContain("partners.scalesmiths.co.uk")
    for (const bad of ["http://partners.scalesmiths.co.uk/x", "https://evil.example/x", "https://user:pw@partners.scalesmiths.co.uk/", "javascript:alert(1)"]) expect(() => safeLink(bad)).toThrow()
    expect(() => buildPartnerEmail({ kind: "activated", name: "A", signInUrl: "https://evil.example/login" })).toThrow()
  })

  it("states what an invitation does without commercial terms or internal detail, with a text alternative", () => {
    const email = buildPartnerEmail({ kind: "invitation", name: "Alex Partner", link: "https://partners.scalesmiths.co.uk/partner/activate#token=" + "A".repeat(43), expiresAt: "2026-12-01T10:00:00.000Z", agreementTitle: "Independent Partner Agreement", agreementVersion: 2 })
    expect(email.subject).toBe("Your invitation to join ScaleSmiths as an independent partner")
    expect(email.text).toContain("Independent Partner Agreement (version 2)")
    expect(email.text).toContain("expires on 1 December 2026")
    expect(`${email.html}${email.text}`).not.toMatch(/commission|£|\d+ ?per ?cent|review note/i)
    expect(email.text).not.toMatch(/\d+ ?%/)
    expect(email.html).toContain('lang="en-GB"')
  })

  it("declines politely without giving reasons from internal review", () => {
    const email = buildPartnerEmail({ kind: "application_declined", name: "Sam" })
    expect(email.text).toContain("not able to offer a partnership at this time")
    expect(email.text).not.toMatch(/notes|score|assessment/i)
  })
})

describe("Operation Empower B2.10 recovery and withdrawal email content", () => {
  const expiresAt = "2026-11-24T18:00:00.000Z"
  it("sends a one-time password reset link to the partner portal only", () => {
    const email = buildPartnerEmail({ kind: "password_reset", name: "Pat Partner", link: "https://partners.scalesmiths.co.uk/partner/reset#token=abc", expiresAt })
    expect(email.subject).toBe("Reset your ScaleSmiths partner password")
    expect(email.html).toContain("https://partners.scalesmiths.co.uk/partner/reset#token=abc")
    expect(email.text).toContain("If you did not ask for this, ignore this email")
    expect(email.text).toContain("24 November 2026")
    expect(() => buildPartnerEmail({ kind: "password_reset", name: "Pat", link: "https://evil.example/reset", expiresAt })).toThrow("Unsafe link")
  })
  it("asks the applicant to confirm a withdrawal and states that nothing changes until they do", () => {
    const email = buildPartnerEmail({ kind: "withdrawal_confirmation", name: "Ada", link: "https://partners.scalesmiths.co.uk/partner/withdraw#token=abc", expiresAt })
    expect(email.subject).toBe("Confirm the withdrawal of your ScaleSmiths partner application")
    expect(email.text).toContain("Nothing changes until you confirm it")
    expect(() => buildPartnerEmail({ kind: "withdrawal_confirmation", name: "Ada", link: "http://partners.scalesmiths.co.uk/x", expiresAt })).toThrow("Unsafe link")
  })
})
