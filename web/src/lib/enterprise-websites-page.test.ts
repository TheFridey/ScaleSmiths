import { describe, expect, it } from "vitest"
import {
  ENTERPRISE_WEBSITES_PATH,
  ENTERPRISE_WEBSITES_PROOF_SLUGS,
  buildEnterpriseWebsitesPageSchemas,
  enterpriseWebsitesCopy,
  enterpriseWebsitesFaqs,
  metadataForEnterpriseWebsitesPage,
} from "./enterprise-websites-page"

describe("enterprise websites page content", () => {
  it("keeps the commercial H1 and enquiry CTA honest", () => {
    expect(ENTERPRISE_WEBSITES_PATH).toBe("/enterprise-websites")
    expect(enterpriseWebsitesCopy.title).toMatch(/Enterprise Websites & Digital Experiences Built Around Your Organisation/i)
    expect(enterpriseWebsitesCopy.primaryCta.label).toMatch(/Discuss Your Digital Transformation/i)
    expect(enterpriseWebsitesCopy.primaryCta.href).toBe("/enterprise/contact")
    expect(enterpriseWebsitesCopy.lede.toLowerCase()).toContain("improve")
    expect(enterpriseWebsitesCopy.lede.toLowerCase()).toContain("integrate")
    expect(enterpriseWebsitesCopy.lede.toLowerCase()).toContain("rebuild")
    expect(enterpriseWebsitesCopy.lede.toLowerCase()).not.toContain("astro")
    expect(enterpriseWebsitesCopy.lede.toLowerCase()).not.toContain("pick everard")
  })

  it("prioritises verified complex-system proof without inventing endorsements", () => {
    expect([...ENTERPRISE_WEBSITES_PROOF_SLUGS]).toEqual(
      expect.arrayContaining(["prymal", "veteranfinder", "the-business-circle"]),
    )
    expect(enterpriseWebsitesFaqs.some((faq) => /£2,000/i.test(faq.a))).toBe(true)
    expect(enterpriseWebsitesFaqs.every((faq) => !/iso 27001 certified/i.test(faq.a))).toBe(true)
  })

  it("publishes crawlable metadata and structured data", () => {
    const metadata = metadataForEnterpriseWebsitesPage()
    expect(metadata.alternates?.canonical).toBe("/enterprise-websites")
    const schemas = buildEnterpriseWebsitesPageSchemas("https://scalesmiths.co.uk")
    const blob = JSON.stringify(schemas)
    expect(blob).toContain("https://scalesmiths.co.uk/enterprise-websites")
    expect(blob).toContain("WebPage")
    expect(blob).toContain("Service")
    expect(blob).toContain("FAQPage")
  })
})
