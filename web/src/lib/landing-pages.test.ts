import { describe, expect, it } from "vitest"
import { buildLandingPageSchemas, getLandingPageFaqs, landingPages, metadataForLandingPage } from "./landing-pages"

describe("landing pages", () => {
  it("builds canonical metadata for SEO landing pages", () => {
    const metadata = metadataForLandingPage(landingPages["web-design-hucknall"])

    expect(metadata.alternates).toEqual({ canonical: "/web-design-hucknall" })
    expect(metadata.title).toBe("Web Design Hucknall | ScaleSmiths")
  })

  it("emits WebPage, Service, FAQPage and local schema where appropriate", () => {
    const schemas = buildLandingPageSchemas(landingPages["web-development-nottingham"])
    const types = schemas.map((schema) => schema["@type"])

    expect(types).toContain("WebPage")
    expect(types).toContain("Service")
    expect(types).toContain("FAQPage")
    expect(types).toContain("LocalBusiness")
  })

  it("expands landing pages to at least five FAQs", () => {
    expect(getLandingPageFaqs(landingPages["next-js-agency-uk"]).length).toBeGreaterThanOrEqual(5)
  })

  it("gives every landing page practical depth for buyers", () => {
    for (const page of Object.values(landingPages)) {
      expect(page.searchIntent.length).toBeGreaterThan(80)
      expect(page.problems.length).toBeGreaterThanOrEqual(4)
      expect(page.examples.length).toBeGreaterThanOrEqual(3)
      expect(page.buildLogLinks.length).toBeGreaterThanOrEqual(3)
      expect(getLandingPageFaqs(page).length).toBeGreaterThanOrEqual(6)
    }
  })
})
