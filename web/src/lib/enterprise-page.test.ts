import { describe, expect, it } from "vitest"
import {
  ENTERPRISE_PATH,
  ENTERPRISE_PROOF_SLUGS,
  buildEnterprisePageSchemas,
  enterpriseCapabilities,
  enterpriseFaqs,
  enterprisePageCopy,
  enterpriseProblems,
  metadataForEnterprisePage,
} from "./enterprise-page"
import { projects } from "./data"

describe("enterprise page content", () => {
  it("keeps the positioning credible and free of certification overclaims", () => {
    const blob = [
      enterprisePageCopy.metaDescription,
      enterprisePageCopy.lede,
      ...enterpriseFaqs.map((item) => item.a),
    ].join(" ").toLowerCase()

    expect(blob).not.toMatch(/iso 27001 certified/)
    expect(blob).not.toMatch(/cyber essentials certified/)
    expect(blob).not.toContain("guaranteed compliance")
    expect(enterpriseFaqs.some((item) => /iso 27001|cyber essentials/i.test(item.q))).toBe(true)
    expect(enterpriseFaqs.some((item) => /do not claim certifications/i.test(item.a))).toBe(true)
    expect(enterprisePageCopy.title).toMatch(/organisation actually operates/i)
    expect(enterprisePageCopy.primaryCta.href).toBe(`${ENTERPRISE_PATH}#discuss`)
    expect(enterprisePageCopy.enquiryCta.href).toBe("/enterprise/contact")
  })

  it("covers the problem set buyers expect on an enterprise route", () => {
    const titles = enterpriseProblems.map((problem) => problem.title.toLowerCase())
    expect(titles.some((title) => title.includes("fragmented"))).toBe(true)
    expect(titles.some((title) => title.includes("multi-site"))).toBe(true)
    expect(titles.some((title) => title.includes("offline"))).toBe(true)
    expect(enterpriseCapabilities).toEqual(expect.arrayContaining([
      "Offline-first applications",
      "Identity and SSO",
      "RBAC / ABAC",
      "Disaster recovery planning",
      "CI/CD",
    ]))
  })

  it("maps proof to existing case studies", () => {
    for (const slug of ENTERPRISE_PROOF_SLUGS) {
      expect(projects.some((project) => project.slug === slug)).toBe(true)
    }
  })

  it("publishes metadata, canonical and enterprise schemas", () => {
    const metadata = metadataForEnterprisePage()
    expect(metadata.alternates?.canonical).toBe(ENTERPRISE_PATH)
    expect(metadata.description).toContain("Nottingham")

    const schemas = buildEnterprisePageSchemas("https://scalesmiths.co.uk")
    const types = schemas.map((schema) => schema["@type"])
    expect(types).toEqual(["WebPage", "Service", "FAQPage"])
    expect(JSON.stringify(schemas)).toContain("Enterprise software development UK")
    expect(JSON.stringify(schemas)).toContain("https://scalesmiths.co.uk/enterprise")
  })
})
