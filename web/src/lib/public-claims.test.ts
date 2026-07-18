import { describe, expect, it } from "vitest"
import { selectVerifiedPublicClaims, type PublicClaim, type PublicClaimCandidate } from "./public-claims"

const NOW = new Date("2026-07-18T12:00:00.000Z")

function claim(overrides: Partial<PublicClaimCandidate> = {}): PublicClaimCandidate {
  return {
    id: "testimonial.fixture",
    approvedWording: "Approved exact wording.",
    claimType: "testimonial",
    attributionName: "A. Client",
    attributionBusiness: "Fixture Ltd",
    permittedRoutes: ["/"],
    permittedComponents: ["testimonials"],
    verifiedAt: new Date("2026-07-01T00:00:00.000Z"),
    reviewExpiresAt: new Date("2027-07-01T00:00:00.000Z"),
    status: "verified",
    clientApprovalStatus: "approved",
    ...overrides,
  }
}

describe("public claim selection", () => {
  it("hides draft, rejected and expired claims", () => {
    const selected = selectVerifiedPublicClaims([
      claim({ id: "draft", status: "draft" }),
      claim({ id: "rejected", status: "rejected" }),
      claim({ id: "expired", reviewExpiresAt: new Date("2026-07-17T00:00:00.000Z") }),
    ], { route: "/", component: "testimonials", now: NOW })
    expect(selected).toEqual([])
  })

  it("renders a verified claim only on its permitted route and component", () => {
    const candidate = claim()
    expect(selectVerifiedPublicClaims([candidate], { route: "/", component: "testimonials", now: NOW })).toHaveLength(1)
    expect(selectVerifiedPublicClaims([candidate], { route: "/pricing", component: "testimonials", now: NOW })).toEqual([])
    expect(selectVerifiedPublicClaims([candidate], { route: "/", component: "hero_stats", now: NOW })).toEqual([])
  })

  it("never exposes evidence or verifier metadata in the public projection", () => {
    const selected = selectVerifiedPublicClaims([
      claim({ evidenceDescription: "Private invoice", evidenceReference: "vault://private", verifiedBy: "internal-user-id" }),
    ], { route: "/", component: "testimonials", now: NOW })[0] as PublicClaim & Record<string, unknown>
    expect(selected).not.toHaveProperty("evidenceDescription")
    expect(selected).not.toHaveProperty("evidenceReference")
    expect(selected).not.toHaveProperty("verifiedBy")
  })

  it("keeps testimonial wording and attribution from one registry row", () => {
    const selected = selectVerifiedPublicClaims([claim()], { route: "/", component: "testimonials", now: NOW })[0]
    expect(selected).toMatchObject({ approvedWording: "Approved exact wording.", attributionName: "A. Client", attributionBusiness: "Fixture Ltd" })
  })
})
