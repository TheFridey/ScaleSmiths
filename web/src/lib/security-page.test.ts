import { describe, expect, it } from "vitest"
import {
  SECURITY_PATH,
  buildSecurityPageSchemas,
  metadataForSecurityPage,
  securityAssurance,
  securityFaqs,
  securityIncidentResponse,
  securityInsurance,
  securityOperatingControls,
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
      ...securityOperatingControls.map((item) => `${item.title} ${item.body}`),
      securityIncidentResponse.title,
      securityIncidentResponse.intro,
      ...securityIncidentResponse.phases.map((phase) => `${phase.title} ${phase.body}`),
      securityInsurance.title,
      ...securityInsurance.coverages.map((item) => `${item.name} ${item.summary} ${item.limit}`),
    ].join(" ").toLowerCase()

    for (const term of ["tls", "rbac", "sso", "oidc", "saml", "mfa", "csp", "secrets", "audit", "backup", "penetration"]) {
      expect(blob).toContain(term)
    }
    expect(securityFaqs.length).toBeGreaterThanOrEqual(8)
  })

  it("publishes operating security controls and a written incident response process", () => {
    expect(securityOperatingControls.length).toBeGreaterThanOrEqual(6)
    expect(securityOperatingControls.map((item) => item.title).join(" ")).toMatch(/identity|change|secrets|dependency|logging|backup/i)

    expect(securityIncidentResponse.title).toMatch(/written incident response/i)
    expect(securityIncidentResponse.phases.map((phase) => phase.title)).toEqual([
      "Declare and contain",
      "Diagnose",
      "Recover",
      "Verify and close",
    ])
    expect(securityIncidentResponse.notification.toLowerCase()).toContain("notification")
  })

  it("states held business insurance cover with limits", () => {
    expect(securityInsurance.coverages).toEqual([
      {
        name: "Professional Indemnity",
        summary: "Negligence, professional errors, omissions and associated claims",
        limit: "£1,000,000",
      },
      {
        name: "Public & Products Liability",
        summary: "Third-party injury and property damage",
        limit: "£5,000,000",
      },
      {
        name: "Employers' Liability",
        summary: "Employee injuries and work-related illness",
        limit: "£10,000,000",
      },
    ])
    expect(securityInsurance.boundary.toLowerCase()).toContain("subject to the terms")
    expect(securityFaqs.some((item) => /insurance/i.test(item.q))).toBe(true)
  })

  it("publishes metadata, canonical and schemas", () => {
    const metadata = metadataForSecurityPage()
    expect(metadata.alternates?.canonical).toBe(SECURITY_PATH)
    expect(String(metadata.description)).toMatch(/secure software development/i)
    expect(String(metadata.description)).toMatch(/incident response/i)
    expect(String(metadata.description)).toMatch(/insurance/i)

    const schemas = buildSecurityPageSchemas("https://scalesmiths.co.uk")
    expect(schemas.map((schema) => schema["@type"])).toEqual(["WebPage", "FAQPage"])
    expect(JSON.stringify(schemas)).toContain("https://scalesmiths.co.uk/security")
    expect(JSON.stringify(schemas)).toContain("Enterprise software security")
  })
})
