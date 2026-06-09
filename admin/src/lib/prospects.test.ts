import { describe, expect, it } from "vitest"
import {
  buildClientFromWonProspect,
  computeSalesMetrics,
  getFollowUpBucket,
  parseOutreachActivityPayload,
  parseProspectPayload,
  stageDateUpdates,
} from "./prospects"

describe("prospect pipeline", () => {
  it("validates prospect creation fields", () => {
    expect(parseProspectPayload({ contactEmail: "owner@example.com" }).ok).toBe(false)
    expect(parseProspectPayload({ businessName: "Acme", contactEmail: "bad-email" }).ok).toBe(false)
    expect(parseProspectPayload({ businessName: "Acme", websiteUrl: "example.com" }).ok).toBe(false)
    expect(parseProspectPayload({ businessName: "Acme", estimatedProjectValue: "-1" }).ok).toBe(false)
    expect(parseProspectPayload({ businessName: "Acme", revenueScore: "11" }).ok).toBe(false)
    expect(parseProspectPayload({ businessName: "Acme", source: "trade_show" }).ok).toBe(false)

    const parsed = parseProspectPayload({
      businessName: "Acme",
      contactEmail: "owner@example.com",
      websiteUrl: "https://example.com",
      source: "linkedin",
      revenueScore: "7",
    })

    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.data.stage).toBe("found")
      expect(parsed.data.revenueScore).toBe(7)
    }
  })

  it("sets stage timestamps without invalid stage values", () => {
    const now = new Date("2026-06-03T10:00:00.000Z")

    expect(stageDateUpdates("contacted", now).lastContactedAt).toBe(now)
    expect(stageDateUpdates("proposal_sent", now).proposalSentAt).toBe(now)
    expect(stageDateUpdates("won", now).wonAt).toBe(now)
    expect(stageDateUpdates("lost", now).lostAt).toBe(now)
  })

  it("validates outreach activity creation", () => {
    expect(parseOutreachActivityPayload({ type: "email", direction: "sideways", subject: "Hello" }).ok).toBe(false)
    expect(parseOutreachActivityPayload({ type: "email", direction: "outbound" }).ok).toBe(false)

    const parsed = parseOutreachActivityPayload({
      type: "email",
      direction: "outbound",
      subject: "Audit notes",
    })

    expect(parsed.ok).toBe(true)
  })

  it("calculates dashboard metrics and follow-up buckets", () => {
    const now = new Date("2026-06-03T12:00:00.000Z")
    const metrics = computeSalesMetrics(
      [
        {
          stage: "contacted",
          estimatedProjectValue: 5000,
          estimatedMonthlyRetainer: 500,
          nextFollowUpAt: "2026-06-03T14:00:00.000Z",
          wonAt: null,
          lostAt: null,
          proposalSentAt: null,
        },
        {
          stage: "proposal_sent",
          estimatedProjectValue: 8000,
          estimatedMonthlyRetainer: 900,
          nextFollowUpAt: "2026-06-02T09:00:00.000Z",
          wonAt: null,
          lostAt: null,
          proposalSentAt: "2026-06-02T10:00:00.000Z",
        },
        {
          stage: "won",
          estimatedProjectValue: 12000,
          estimatedMonthlyRetainer: 1200,
          nextFollowUpAt: null,
          wonAt: "2026-06-01T10:00:00.000Z",
          lostAt: null,
          proposalSentAt: null,
        },
      ],
      [
        { direction: "outbound", createdAt: "2026-06-03T09:00:00.000Z" },
        { direction: "inbound", createdAt: "2026-06-03T11:00:00.000Z" },
      ],
      [{ status: "sent", sentAt: "2026-06-02T10:00:00.000Z" }],
      now,
    )

    expect(metrics.outreachSentThisWeek).toBe(1)
    expect(metrics.repliesThisWeek).toBe(1)
    expect(metrics.dealsWonThisMonth).toBe(1)
    expect(metrics.pipelineValue).toBe(13000)
    expect(metrics.expectedMonthlyRetainerValue).toBe(1400)
    expect(metrics.followUpsDueToday).toBe(1)
    expect(metrics.overdueFollowUps).toBe(1)
    expect(getFollowUpBucket("2026-06-04T10:00:00.000Z", now)).toBe("upcoming")

    // Derived executive metrics.
    expect(metrics.weightedPipelineValue).toBe(5550) // 5000*0.15 + 8000*0.6
    expect(metrics.closeRate).toBe(100) // 1 won, 0 lost
    expect(metrics.proposalConversionRate).toBe(50) // 1 won of 2 proposals sent
    expect(metrics.avgProjectValue).toBe(6500) // 13000 across 2 open prospects
    expect(metrics.avgRetainerValue).toBe(700) // (500 + 900) / 2
    expect(metrics.openProspects).toBe(2)
  })

  it("maps won prospects into existing client fields", () => {
    expect(buildClientFromWonProspect({
      businessName: "Forge Cafe",
      contactName: "Riley",
      contactEmail: "riley@example.com",
      estimatedMonthlyRetainer: 750,
    })).toEqual({
      name: "Forge Cafe",
      contactName: "Riley",
      contactEmail: "riley@example.com",
      tier: "Retainer",
      mrr: 750,
      status: "active",
      progress: 0,
    })
  })
})
