import { describe, expect, it } from "vitest"
import {
  ENTERPRISE_DELIVERY_PATH,
  buildEnterpriseDeliveryPageSchemas,
  deliveryPhases,
  deliveryStages,
  discoveryTopics,
  enterpriseDeliveryCopy,
  metadataForEnterpriseDeliveryPage,
  supportModels,
  testingTypes,
} from "./enterprise-delivery-page"

describe("enterprise delivery page content", () => {
  it("keeps founder-led structured delivery positioning", () => {
    expect(enterpriseDeliveryCopy.title).toMatch(/founder-led engineering with structured enterprise delivery/i)
    expect(enterpriseDeliveryCopy.lede).toMatch(/does not start coding from a vague brief/i)
    expect(enterpriseDeliveryCopy.primaryCta.label).toBe("Start with Discovery")
    expect(enterpriseDeliveryCopy.secondaryCta.label).toBe("Discuss Your Existing Systems")
    expect(enterpriseDeliveryCopy.enquiryCta.href).toBe("/quote?intent=enterprise")
  })

  it("covers the staged methodology and fourteen phases", () => {
    expect(deliveryStages.map((stage) => stage.label)).toEqual([
      "Discovery",
      "Prototype",
      "Validated Scope",
      "MVP",
      "UAT",
      "Production",
      "Expansion",
    ])
    expect(deliveryPhases).toHaveLength(14)
    expect(deliveryPhases[0]?.title).toBe("Discovery")
    expect(deliveryPhases.at(-1)?.title).toBe("Support and continuous improvement")
    expect(discoveryTopics).toEqual(expect.arrayContaining([
      "Users and actors",
      "Integrations",
      "Existing security requirements",
      "Deployment requirements",
    ]))
  })

  it("keeps support boundaries explicit and testing coverage broad", () => {
    const supportBlob = supportModels.map((item) => `${item.title} ${item.body}`).join(" ").toLowerCase()
    expect(supportBlob).toContain("unlimited development")
    expect(testingTypes.map((item) => item.title)).toEqual(expect.arrayContaining([
      "Unit testing",
      "E2E testing",
      "Permission testing",
      "Migration testing",
      "Security testing",
      "Backup / recovery testing",
    ]))
  })

  it("publishes metadata, canonical and schemas", () => {
    const metadata = metadataForEnterpriseDeliveryPage()
    expect(metadata.alternates?.canonical).toBe(ENTERPRISE_DELIVERY_PATH)
    expect(String(metadata.description)).toMatch(/discovery through production/i)

    const schemas = buildEnterpriseDeliveryPageSchemas("https://scalesmiths.co.uk")
    expect(schemas.map((schema) => schema["@type"])).toEqual(["WebPage", "HowTo", "FAQPage"])
    expect(JSON.stringify(schemas)).toContain("https://scalesmiths.co.uk/enterprise/delivery")
  })
})
