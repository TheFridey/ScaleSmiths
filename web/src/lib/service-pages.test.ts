import { describe, expect, it } from "vitest"
import { buildPricingSchema, buildServiceHubSchema, managedBusinessEmailService, pricingItems } from "./service-pages"
import { retainers } from "./data"

describe("service and pricing schemas", () => {
  it("builds a services collection schema", () => {
    const schema = buildServiceHubSchema()

    expect(schema["@type"]).toBe("CollectionPage")
    expect(schema.hasPart.length).toBeGreaterThanOrEqual(7)
  })

  it("builds pricing FAQ schema", () => {
    const schema = buildPricingSchema()

    expect(schema["@type"]).toBe("FAQPage")
    expect(schema.mainEntity.length).toBeGreaterThanOrEqual(2)
  })

  it("publishes managed email without commodity pricing or provider disclosure", () => {
    const schema = buildServiceHubSchema()
    const emailService = schema.hasPart.find((item) => item.name === managedBusinessEmailService.title)
    const publicSurface = JSON.stringify({ schema, pricingItems })

    expect(emailService?.description).toContain("own domain")
    expect(pricingItems.find((item) => item.name === managedBusinessEmailService.title)?.range).toBe("Scoped separately")
    expect(publicSurface).not.toMatch(/mailbox count|storage quota/i)
  })

  it("keeps managed email available rather than silently included in retainers", () => {
    expect(retainers).toHaveLength(3)
    expect(retainers.every((retainer) => retainer.managedEmail === "available")).toBe(true)
  })
})
