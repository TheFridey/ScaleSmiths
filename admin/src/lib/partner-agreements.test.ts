import { describe, expect, it } from "vitest"
import { agreementNeedsAcceptance, agreementState } from "./partner-agreements"

/* B1.7: the agreement state shown on Today comes only from the partner's own records; acceptance is never inferred. */
describe("agreementState", () => {
  const V1 = "00000000-0000-4000-8000-000000000001", V2 = "00000000-0000-4000-8000-000000000002"
  it("maps every combination of issued, current and accepted to exactly one state", () => {
    expect(agreementState({ issuedVersionId: null, issuedCurrent: false, acceptedVersionId: null })).toBe("none")
    expect(agreementState({ issuedVersionId: V1, issuedCurrent: true, acceptedVersionId: null })).toBe("awaiting_acceptance")
    expect(agreementState({ issuedVersionId: V1, issuedCurrent: true, acceptedVersionId: V1 })).toBe("accepted")
    expect(agreementState({ issuedVersionId: V2, issuedCurrent: true, acceptedVersionId: V1 })).toBe("update_awaiting_acceptance")
  })
  it("never reports a withdrawn, superseded or expired issued version as accepted, even with an acceptance on record", () => {
    expect(agreementState({ issuedVersionId: V1, issuedCurrent: false, acceptedVersionId: V1 })).toBe("unavailable")
    expect(agreementState({ issuedVersionId: V1, issuedCurrent: false, acceptedVersionId: null })).toBe("unavailable")
  })
  it("sends the partner to the existing agreement page only when an acceptance is actually due", () => {
    expect(["awaiting_acceptance", "update_awaiting_acceptance"].every((s) => agreementNeedsAcceptance(s as never))).toBe(true)
    expect(["none", "accepted", "unavailable"].some((s) => agreementNeedsAcceptance(s as never))).toBe(false)
  })
})
