import { describe, expect, it } from "vitest"
import { parsePublicClaimId, parsePublicClaimReviewInput } from "./public-claims"

const base = {
  approvedWording: "The exact approved statement.",
  claimType: "customer_result",
  sourceName: "Fixture Client",
  attributionName: null,
  attributionBusiness: null,
  clientApprovalStatus: "approved",
  status: "verified",
  reviewExpiresAt: "2099-01-01T00:00:00.000Z",
  permittedRoutes: ["/", "/work/fixture"],
  permittedComponents: ["project_outcomes"],
  evidenceDescription: "Signed client confirmation and analytics export.",
  evidenceReference: "vault://claims/fixture",
  reason: "Evidence and wording reviewed.",
}

describe("public claim review validation", () => {
  it("accepts a complete evidence-backed verification", () => {
    expect(parsePublicClaimReviewInput(base)).toMatchObject({ ok: true, data: { status: "verified", clientApprovalStatus: "approved" } })
  })

  it("refuses verification without private evidence, approval or an expiry", () => {
    expect(parsePublicClaimReviewInput({ ...base, evidenceReference: "" })).toMatchObject({ ok: false })
    expect(parsePublicClaimReviewInput({ ...base, clientApprovalStatus: "pending" })).toMatchObject({ ok: false })
    expect(parsePublicClaimReviewInput({ ...base, reviewExpiresAt: "2020-01-01" })).toMatchObject({ ok: false })
  })

  it("accepts draft records without pretending they are verified", () => {
    expect(parsePublicClaimReviewInput({ ...base, status: "draft", clientApprovalStatus: "pending", reviewExpiresAt: null, evidenceDescription: null, evidenceReference: null })).toMatchObject({ ok: true, data: { status: "draft" } })
  })

  it("requires stable safe registry identifiers", () => {
    expect(parsePublicClaimId("testimonial.client.person")).toBe("testimonial.client.person")
    expect(parsePublicClaimId("../../private")).toBeNull()
  })
})
