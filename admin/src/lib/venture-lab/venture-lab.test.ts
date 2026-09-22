import { describe, expect, it } from "vitest"
import { assertApprovalConsumable, hashApprovalPayload } from "./approval"
import { captureEvidence, MAX_SUPPORTING_EXCERPT_CHARS } from "./evidence"
import { assertBalancedPostings } from "./ledger"
import { EXPERIMENT_ZERO_CAPITAL, assertMinorUnits } from "./money"
import { assertVentureTransition, canTransitionVenture } from "./state-machine"

describe("Venture Lab lifecycle", () => {
  it("rejects gate skipping", () => {
    expect(canTransitionVenture("DISCOVERED", "LIVE")).toBe(false)
    expect(() => assertVentureTransition("DISCOVERED", "LIVE")).toThrow()
  })

  it("allows the intended first lifecycle transition", () => {
    expect(canTransitionVenture("DISCOVERED", "RESEARCHING")).toBe(true)
  })
})

describe("Venture Lab evidence preservation", () => {
  it("creates deterministic content hashes independent of capture time", () => {
    const input = {
      sourceUrl: "https://example.test/source",
      sourceTitle: "Example source",
      evidenceType: "customer_complaint",
      claim: "Customers report a recurring problem.",
      summary: "Several customers describe the same workflow failure.",
      supportingExcerpt: "This problem costs us time every week.",
      observedAt: "2026-09-22T12:00:00.000Z",
    }

    const first = captureEvidence(input, "2026-09-22T13:00:00.000Z")
    const second = captureEvidence(input, "2026-09-22T14:00:00.000Z")
    const changed = captureEvidence({ ...input, claim: "Changed claim." }, "2026-09-22T14:00:00.000Z")

    expect(first.contentHash).toBe(second.contentHash)
    expect(changed.contentHash).not.toBe(first.contentHash)
  })

  it("rejects giant evidence excerpts", () => {
    expect(() =>
      captureEvidence({
        sourceUrl: "https://example.test",
        evidenceType: "other",
        claim: "claim",
        summary: "summary",
        supportingExcerpt: "x".repeat(MAX_SUPPORTING_EXCERPT_CHARS + 1),
      }),
    ).toThrow()
  })
})

describe("Venture Lab exact approvals", () => {
  const payload = {
    action: "REGISTER_DOMAIN",
    experimentId: "EXP-000",
    amountMinor: 999,
    currency: "GBP",
    target: "example.co.uk",
    purpose: "Validation domain",
  }

  it("binds approval to exact consequential parameters", () => {
    const approval = {
      id: "approval-1",
      status: "APPROVED" as const,
      payloadHash: hashApprovalPayload(payload),
      idempotencyKey: "spend-1",
      requestedBy: "grok",
      approvedBy: "trev",
      requestedAt: "2026-09-22T12:00:00.000Z",
      expiresAt: "2026-09-23T12:00:00.000Z",
    }

    expect(() => assertApprovalConsumable(approval, payload, new Date("2026-09-22T13:00:00.000Z"))).not.toThrow()
    expect(() =>
      assertApprovalConsumable(approval, { ...payload, amountMinor: 9_999 }, new Date("2026-09-22T13:00:00.000Z")),
    ).toThrow(/does not match/)
  })

  it("rejects consumed and expired approvals", () => {
    const base = {
      id: "approval-2",
      status: "APPROVED" as const,
      payloadHash: hashApprovalPayload(payload),
      idempotencyKey: "spend-2",
      requestedBy: "grok",
      approvedBy: "trev",
      requestedAt: "2026-09-22T12:00:00.000Z",
    }

    expect(() =>
      assertApprovalConsumable({ ...base, consumedAt: "2026-09-22T12:30:00.000Z" }, payload),
    ).toThrow(/consumed/)

    expect(() =>
      assertApprovalConsumable({ ...base, expiresAt: "2026-09-22T12:30:00.000Z" }, payload, new Date("2026-09-22T13:00:00.000Z")),
    ).toThrow(/expired/)
  })
})

describe("Venture Lab integer ledger", () => {
  it("uses the approved Experiment 000 capital split", () => {
    expect(EXPERIMENT_ZERO_CAPITAL).toEqual({
      foundingCapitalMinor: 10_000,
      protectedReserveMinor: 7_500,
      experimentAllocationMinor: 2_500,
    })
  })

  it("accepts balanced double-entry postings", () => {
    expect(() =>
      assertBalancedPostings([
        { account: "simulated_cash", debitMinor: 10_000, creditMinor: 0 },
        { account: "founding_capital", debitMinor: 0, creditMinor: 10_000 },
      ]),
    ).not.toThrow()
  })

  it("rejects unbalanced, negative and floating amounts", () => {
    expect(() =>
      assertBalancedPostings([
        { account: "domain_expense", debitMinor: 999, creditMinor: 0 },
        { account: "simulated_cash", debitMinor: 0, creditMinor: 998 },
      ]),
    ).toThrow(/Unbalanced/)

    expect(() => assertMinorUnits(-1)).toThrow()
    expect(() => assertMinorUnits(1.5)).toThrow()
  })
})
