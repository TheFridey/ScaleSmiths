import { describe, expect, it } from "vitest"
import { scoreLead } from "./lead-scoring"

const baseProspect = {
  businessName: "North City Plastering",
  industry: "Home services plastering contractor",
  source: "referral" as const,
  stage: "replied" as const,
  priority: "high" as const,
  websiteUrl: "https://example.com",
  contactName: "Sam Owner",
  contactEmail: "sam@example.com",
  contactPhone: null,
  estimatedProjectValue: 8500,
  estimatedMonthlyRetainer: 750,
  revenueScore: 3,
  trustScore: 4,
  conversionScore: 3,
  seoScore: 2,
  mobileScore: 4,
  auditSummary: "Current site is dated and needs a rebuild, SEO foundations, and a care plan.",
  painPoints: "Urgent: contact form is broken and they are losing leads.",
  opportunityNotes: "Scope includes new website, copy, SEO and maintenance.",
  objectionNotes: null,
}

describe("lead scoring", () => {
  it("returns an explainable high score from evidenced pipeline fields", () => {
    const result = scoreLead({
      prospect: baseProspect,
      activities: [
        { direction: "outbound", type: "email", subject: "Audit", createdAt: "2026-07-10T10:00:00.000Z" },
        { direction: "inbound", type: "email", subject: "Re: Audit", outcome: "Interested", createdAt: "2026-07-11T10:00:00.000Z" },
      ],
      proposals: [{ status: "sent", quotedAmount: 9000, monthlyRetainerAmount: 850, sentAt: "2026-07-11T12:00:00.000Z" }],
      now: new Date("2026-07-12T10:00:00.000Z"),
    })

    expect(result.score).toBeGreaterThanOrEqual(75)
    expect(result.confidence).toBe("high")
    expect(result.estimatedProjectValue).toBe(9000)
    expect(result.estimatedRetainerPotential).toBe(850)
    expect(result.positiveFactors.some((factor) => factor.category === "decision_maker_access")).toBe(true)
    expect(result.positiveFactors.flatMap((factor) => factor.sourceFields)).toContain("source")
    expect(result.recommendedNextAction).toContain("Prioritise")
  })

  it("marks uncertain and missing data instead of fabricating qualification facts", () => {
    const result = scoreLead({
      prospect: {
        ...baseProspect,
        industry: null,
        source: "other",
        stage: "found",
        priority: "medium",
        websiteUrl: null,
        contactName: null,
        contactEmail: null,
        estimatedProjectValue: 0,
        estimatedMonthlyRetainer: 0,
        revenueScore: 0,
        trustScore: 0,
        conversionScore: 0,
        seoScore: 0,
        mobileScore: 0,
        auditSummary: null,
        painPoints: null,
        opportunityNotes: null,
      },
      activities: [],
      proposals: [],
    })

    expect(result.confidence).toBe("low")
    expect(result.missingInformation).toEqual(expect.arrayContaining([
      "Business type or industry.",
      "Existing website URL.",
      "Budget or estimated project value.",
      "Decision-maker contact details.",
    ]))
    expect(result.negativeFactors.some((factor) => factor.category === "decision_maker_access")).toBe(true)
    expect(result.protectedCharacteristicsExcluded).toBe(true)
    expect(result.affectedData.some((item) => item.field === "industry")).toBe(true)
  })

  it("keeps protected personal characteristics out of affected data", () => {
    const result = scoreLead({ prospect: baseProspect })
    const affected = result.affectedData.map((item) => item.field.toLowerCase())

    expect(affected).not.toContain("age")
    expect(affected).not.toContain("gender")
    expect(affected).not.toContain("race")
    expect(affected).not.toContain("religion")
  })
})
