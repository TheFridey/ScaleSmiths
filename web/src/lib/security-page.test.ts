import { describe, expect, it } from "vitest"
import {
  SECURITY_PATH,
  buildSecurityPageSchemas,
  metadataForSecurityPage,
  securityAssurance,
  securityFaqs,
  securityPageCopy,
  securitySections,
} from "./security-page"

describe("security page content", () => {
  it("states the architecture-first philosophy without certification overclaims", () => {
    expect(securityPageCopy.title).toMatch(/architecture/i)
    expect(securityPageCopy.lede).toMatch(/rather than treating it as a final checklist/i)
    expect(securityAssurance.held.toLowerCase()).toContain("does not currently claim")
    expect(securityAssurance.held).toMatch(/ISO 27001/i)
    expect(securityAssurance.held).toMatch(/Cyber Essentials/i)
    expect(securityAssurance.planned.toLowerCase()).toMatch(/under consideration|planned/)
    expect(securityAssurance.boundary.toLowerCase()).toContain("do not by themselves constitute regulatory compliance")

    const answers = securityFaqs.map((item) => item.a).join(" ").toLowerCase()
    expect(answers).not.toMatch(/iso 27001 certified/)
    expect(answers).not.toMatch(/cyber essentials certified/)
  })

  it("covers the core secure-delivery topics buyers ask for", () => {
    const blob = [
      ...securitySections.flatMap((section) => [section.title, ...section.items.map((item) => `${item.title} ${item.body}`)]),
      ...securityFaqs.map((item) => `${item.q} ${item.a}`),
    ].join(" ").toLowerCase()

    for (const term of ["tls", "rbac", "sso", "oidc", "saml", "mfa", "csp", "secrets", "audit", "backup", "penetration"]) {
      expect(blob).toContain(term)
    }
    expect(securityFaqs.length).toBeGreaterThanOrEqual(8)
  })

  it("publishes metadata, canonical and schemas", () => {
    const metadata = metadataForSecurityPage()
    expect(metadata.alternates?.canonical).toBe(SECURITY_PATH)
    expect(String(metadata.description)).toMatch(/secure software development/i)

    const schemas = buildSecurityPageSchemas("https://scalesmiths.co.uk")
    expect(schemas.map((schema) => schema["@type"])).toEqual(["WebPage", "FAQPage"])
    expect(JSON.stringify(schemas)).toContain("https://scalesmiths.co.uk/security")
    expect(JSON.stringify(schemas)).toContain("Enterprise software security")
  })
})
