import { describe, expect, it } from "vitest"
import { buildOperatingBrief, makeRecommendation, type BriefActionState } from "./operating-brief"

const candidate = makeRecommendation({
  key: "waiting-client:1",
  category: "waiting_client",
  title: "Client has waited too long",
  summary: "Request updated 8 days ago.",
  recommendedAction: "Send an update.",
  priority: "high",
  score: 80,
  confidence: "high",
  reasoning: ["Updated 8 days ago.", "Priority is high."],
  evidence: [{ label: "Request", href: "/requests?request=1", recordType: "client_request", recordId: "1", summary: "high / in_progress", updatedAt: "2026-07-01T00:00:00.000Z" }],
})

describe("daily operating brief", () => {
  it("prioritises concise recommendations and keeps can-wait items separate", () => {
    const canWait = makeRecommendation({ ...candidate, key: "can-wait:1", category: "can_wait", title: "Can wait", priority: "low", score: 5 })
    const brief = buildOperatingBrief({ now: new Date("2026-07-12T09:00:00.000Z"), candidates: [canWait, candidate] })

    expect(brief.headline).toBe("Client has waited too long")
    expect(brief.recommendations).toHaveLength(1)
    expect(brief.safelyWaiting).toHaveLength(1)
    expect(brief.recommendations[0].evidenceHash).toMatch(/^[a-f0-9]{24}$/)
  })

  it("suppresses dismissed, completed and currently snoozed items for the same evidence", () => {
    const initial = buildOperatingBrief({ candidates: [candidate] })
    const states: BriefActionState[] = [
      { recommendationKey: candidate.key, evidenceHash: initial.recommendations[0].evidenceHash, status: "dismissed" },
    ]

    const brief = buildOperatingBrief({ candidates: [candidate], actionStates: states })
    expect(brief.recommendations).toEqual([])
    expect(brief.suppressedCount).toBe(1)
  })

  it("resurfaces dismissed recommendations when supporting evidence changes", () => {
    const initial = buildOperatingBrief({ candidates: [candidate] })
    const changed = makeRecommendation({
      ...candidate,
      evidence: [{ ...candidate.evidence[0], updatedAt: "2026-07-11T00:00:00.000Z", summary: "critical / in_progress" }],
    })
    const brief = buildOperatingBrief({
      candidates: [changed],
      actionStates: [{ recommendationKey: candidate.key, evidenceHash: initial.recommendations[0].evidenceHash, status: "dismissed" }],
    })

    expect(brief.recommendations).toHaveLength(1)
    expect(brief.suppressedCount).toBe(0)
  })

  it("lets expired snoozes return to the brief", () => {
    const initial = buildOperatingBrief({ candidates: [candidate] })
    const brief = buildOperatingBrief({
      now: new Date("2026-07-12T09:00:00.000Z"),
      candidates: [candidate],
      actionStates: [{ recommendationKey: candidate.key, evidenceHash: initial.recommendations[0].evidenceHash, status: "snoozed", snoozedUntil: "2026-07-11T09:00:00.000Z" }],
    })

    expect(brief.recommendations).toHaveLength(1)
  })
})
