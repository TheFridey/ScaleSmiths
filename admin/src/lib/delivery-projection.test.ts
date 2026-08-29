import { describe, expect, it } from "vitest"
import { assertSafeClientStagingUrl, sanitiseInternalDeliveryEvent } from "./delivery-projection"

describe("Forge to delivery projection", () => {
  it("maps internal events to fixed business language only", () => {
    const projection = sanitiseInternalDeliveryEvent("quality_checks_started")
    expect(projection).toEqual({ status: "quality_checks", title: "Internal quality checks underway", description: "Your latest build is going through internal quality checks.", nextStep: "Prepare for client review" })
    expect(JSON.stringify(projection)).not.toMatch(/forge|agent|provider|model|token|cost|prompt|axe|candidate|sandbox/i)
  })
  it("rejects admin, local, credentialled and internal staging URLs", () => {
    for (const url of ["http://preview.example.com", "https://admin.scalesmiths.co.uk/forge/1", "https://user:pass@example.com", "https://preview.example.com/?token=secret", "https://localhost:3001"]) expect(() => assertSafeClientStagingUrl(url)).toThrow()
    expect(assertSafeClientStagingUrl("https://review.example.com/site-v2")).toBe("https://review.example.com/site-v2")
  })
})
