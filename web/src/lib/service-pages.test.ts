import { describe, expect, it } from "vitest"
import {
  buildPricingSchema,
  buildServiceHubSchema,
  enterpriseCommercialComponents,
  enterpriseCostFactors,
  managedBusinessEmailService,
  pricingItems,
  webGrowthPricingItems,
} from "./service-pages"
import { digitalGrowthPartnerships } from "./data"

describe("service and pricing schemas", () => {
  it("builds a services collection schema", () => {
    const schema = buildServiceHubSchema()

    expect(schema["@type"]).toBe("CollectionPage")
    expect(schema.hasPart.length).toBeGreaterThanOrEqual(7)
  })

  it("builds pricing FAQ schema", () => {
    const schema = buildPricingSchema()

    expect(schema["@type"]).toBe("FAQPage")
    expect(schema.mainEntity.length).toBeGreaterThanOrEqual(4)
    expect(JSON.stringify(schema)).toMatch(/scoped following discovery/i)
  })

  it("keeps SME offers transparent while enterprise work is discovery-scoped", () => {
    expect(webGrowthPricingItems.map((item) => item.name)).toEqual(expect.arrayContaining([
      "Managed Business Email",
      "Business Growth Audit",
      "Digital Growth Partnership",
      "Local business growth site",
    ]))
    expect(webGrowthPricingItems.some((item) => /custom web app|enterprise/i.test(item.name))).toBe(false)
    expect(pricingItems.find((item) => item.name === managedBusinessEmailService.title)?.range).toBe("£15/month")
    expect(pricingItems.find((item) => /custom web app|enterprise system/i.test(item.name))?.range).toMatch(/scoped following discovery/i)
    expect(enterpriseCommercialComponents.map((item) => item.title)).toEqual(expect.arrayContaining([
      "Discovery",
      "Architecture",
      "Implementation",
      "Migration",
      "Managed support",
    ]))
    expect(enterpriseCostFactors.map((item) => item.title)).toEqual(expect.arrayContaining([
      "User count",
      "Integrations",
      "Security requirements",
      "Mobile / offline",
    ]))
    expect(JSON.stringify({ enterpriseCommercialComponents, enterpriseCostFactors })).not.toMatch(/£\s*100|£\s*200|100k|200k/i)
  })

  it("publishes the confirmed managed email starting offer without provider disclosure", () => {
    const schema = buildServiceHubSchema()
    const emailService = schema.hasPart.find((item) => item.name === managedBusinessEmailService.title)
    const publicSurface = JSON.stringify({ schema, pricingItems, webGrowthPricingItems })

    expect(emailService?.description).toContain("custom-domain")
    expect(webGrowthPricingItems.find((item) => item.name === managedBusinessEmailService.title)?.range).toBe("£15/month")
    expect(publicSurface).toContain("Three professional 5GB mailboxes")
    expect(publicSurface).not.toMatch(/mailcow|sogo|smtp infrastructure topology/i)
  })

  it("keeps managed email available rather than silently included in partnerships", () => {
    expect(digitalGrowthPartnerships).toHaveLength(3)
    expect(digitalGrowthPartnerships.every((partnership) => partnership.managedEmail === "available")).toBe(true)
  })
})
