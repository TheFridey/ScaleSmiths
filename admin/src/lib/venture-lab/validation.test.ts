import { describe, expect, it } from "vitest"
import {
  deriveValidationOutcomeStatus,
  parseValidationSubmission,
  publicBusinessUrl,
  validationPayloadHash,
  validationSubmitInputSchema,
  ValidationInputError,
} from "./validation"

const base = {
  opportunityId: "0ca5fb93-7f56-4d11-b121-bff6f2428e35",
  prospectCode: "P01",
  businessUrl: "https://example.co.uk/path?utm=1#section",
  qualificationEvidenceId: "8e258acf-dbe4-4052-99ea-63e5cf1fbb11",
  supplier: "Webtik",
  qualificationReason: "site_removed",
  path: "rebuild",
  ownershipAwareness: "unknown",
  cancellationBelief: "unknown",
  controlMatters: "yes",
  spendBand: "50_to_99_pcm",
  satisfaction: "mixed",
  timing: "unknown",
  alternativeConsidered: "yes",
  pricedProjectAcceptance: "accepted",
  careAcceptance: "declined",
  strongCommitment: "none",
}

describe("customer validation outcomes", () => {
  it("derives outcome status on the server and never from a caller field", () => {
    expect(deriveValidationOutcomeStatus({ pricedProjectAcceptance: "accepted", careAcceptance: "accepted" })).toBe("care_accepted")
    expect(deriveValidationOutcomeStatus({ pricedProjectAcceptance: "accepted", careAcceptance: "declined" })).toBe("priced_next_step")
    expect(deriveValidationOutcomeStatus({ pricedProjectAcceptance: "declined", careAcceptance: "not_offered" })).toBe("no_priced_step")
    expect(deriveValidationOutcomeStatus({ pricedProjectAcceptance: "deferred", careAcceptance: "deferred" })).toBe("incomplete")
    expect(deriveValidationOutcomeStatus({ pricedProjectAcceptance: "not_offered", careAcceptance: "not_offered" })).toBe("incomplete")
  })

  it("hashes the canonical payload without accepting a caller hash or notes", () => {
    const submission = parseValidationSubmission(base)
    expect(submission.businessUrl).toBe("https://example.co.uk/path")
    const hash = validationPayloadHash(1, submission, "priced_next_step")
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(validationPayloadHash(1, submission, "priced_next_step")).toBe(hash)
    expect(validationPayloadHash(1, submission, "incomplete")).not.toBe(hash)
    expect("notes" in submission).toBe(false)
    expect("outcomeStatus" in submission).toBe(false)
    expect("payloadHash" in submission).toBe(false)
  })

  it("rejects an accepted project when the path is unknown, bad enums, and credentialed URLs", () => {
    expect(() => parseValidationSubmission({ ...base, path: "unknown", pricedProjectAcceptance: "accepted" })).toThrow(ValidationInputError)
    expect(() => parseValidationSubmission({ ...base, qualificationReason: "legal-advice" })).toThrow(ValidationInputError)
    expect(() => parseValidationSubmission({ ...base, prospectCode: "P21" })).toThrow(ValidationInputError)
    expect(() => publicBusinessUrl("https://user:secret@example.co.uk/site")).toThrow(ValidationInputError)
  })

  it("rejects care acceptance and strong commitment unless the priced project was accepted", () => {
    expect(() => parseValidationSubmission({ ...base, pricedProjectAcceptance: "declined", careAcceptance: "accepted" })).toThrow(/careAcceptance/)
    expect(() => parseValidationSubmission({ ...base, pricedProjectAcceptance: "deferred", strongCommitment: "deposit_ready" })).toThrow(/strongCommitment/)
    expect(() => parseValidationSubmission({ ...base, pricedProjectAcceptance: "not_offered", strongCommitment: "written_commitment" })).toThrow(/strongCommitment/)
    expect(parseValidationSubmission({ ...base, pricedProjectAcceptance: "accepted", careAcceptance: "accepted", strongCommitment: "written_commitment" }).careAcceptance).toBe("accepted")
  })

  it("requires an identifiable supplier and publishes enum input schema", () => {
    expect(() => parseValidationSubmission({ ...base, supplier: "Unknown" })).toThrow(/supplier/)
    expect(() => parseValidationSubmission({ ...base, supplier: " unknown " })).toThrow(/supplier/)
    const schema = validationSubmitInputSchema()
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.prospectCode.pattern).toBe("^P(0[1-9]|1[0-9]|20)$")
    expect(schema.properties.qualificationReason.enum).toContain("site_removed")
    expect(schema.properties.path.enum).toEqual(["migration", "rebuild", "unknown"])
    expect(schema.properties.careAcceptance.enum).toContain("accepted")
    expect(schema.properties.strongCommitment.enum).toEqual(["deposit_ready", "written_commitment", "none"])
    expect("notes" in schema.properties).toBe(false)
  })
})
