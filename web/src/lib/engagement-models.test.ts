import { describe, expect, it } from "vitest"
import { engagementModels } from "./engagement-models"

describe("engagement models", () => {
  it("separates SME starting prices from independently scoped larger work", () => {
    expect(engagementModels).toHaveLength(3)
    expect(engagementModels.map((model) => model.id)).toEqual([
      "business-websites-growth",
      "established-transformation",
      "custom-platforms-enterprise",
    ])
    expect(engagementModels[0]?.href).toBe("/pricing#web-growth")
    expect(engagementModels[1]?.href).toBe("/enterprise-websites")
    expect(engagementModels[2]?.href).toBe("/pricing#enterprise-systems")
    expect(engagementModels.every((model) => !/pick everard/i.test(model.description))).toBe(true)
  })
})
