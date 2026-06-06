import { describe, expect, it } from "vitest"
import { buildPricingSchema, buildServiceHubSchema } from "./service-pages"

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
})
