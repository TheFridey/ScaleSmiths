import { describe, expect, it } from "vitest"
import { buildBusinessGrowthAuditSchema, businessGrowthAudit, formatAuditPrice } from "./business-growth-audit"

describe("Business Growth Audit product", () => {
  it("keeps price, one-time billing and build credit canonical", () => {
    expect(businessGrowthAudit).toMatchObject({ priceMinor: 39500, currency: "GBP", billingType: "one_time", buildCreditMinor: 39500, deliveryCommitment: null, eligibleBuildRule: null })
    expect(formatAuditPrice()).toBe("£395")
  })

  it("publishes accurate service, offer and visible FAQ schema", () => {
    const schema = JSON.stringify(buildBusinessGrowthAuditSchema())
    expect(schema).toContain('"price":395')
    expect(schema).toContain("FAQPage")
    expect(schema).not.toMatch(/rating|reviewCount|discount|normally £|turnaround/i)
  })
})
