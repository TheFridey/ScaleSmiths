import { describe, expect, it } from "vitest"
import { deriveJourney, type JourneyFacts } from "./partner-journey"

const base = (over: Partial<JourneyFacts> = {}): JourneyFacts => ({
  displayName: "Test Partner", agreement: "awaiting_acceptance", acknowledged: {},
  features: { academy: false, resources: false, knowledge: false, objections: false, pipeline: false, performance: false, guidance: false, profilePublication: false },
  content: { courses: 0, lessonsCompleted: 0, resources: 0, resourceLabels: [], knowledgeArticles: 0, objectionResponses: 0 },
  opportunities: 0, allocatedProspects: 0, referralCode: null, meetings: { open: 0, byType: {} }, profile: { eligible: false, status: null }, approvedMarkets: ["United Kingdom"], toolkit: {},
  ...over,
})
const tool = (j: ReturnType<typeof deriveJourney>, key: string) => j.tools.find((t) => t.key === key)!

describe("Operation Empower B2.10 partner journey derivation", () => {
  it("counts only the four required steps and starts with the agreement as the next action", () => {
    const j = deriveJourney(base())
    expect(j.total).toBe(4)
    expect(j.completed).toBe(0)
    expect(j.nextAction?.key).toBe("agreement")
  })

  it("reaches 100% while every optional and future capability is still unavailable", () => {
    const j = deriveJourney(base({ agreement: "accepted", acknowledged: { how_you_earn: "2026-11-24T10:00:00Z", commercial_boundaries: "2026-11-24T10:00:00Z", approved_markets: "2026-11-24T10:00:00Z" } }))
    expect(j.percent).toBe(100)
    expect(j.required.every((s) => s.status === "completed")).toBe(true)
    expect(j.upcoming.length).toBeGreaterThan(0)
    expect(tool(j, "academy").status).toBe("in_development")
    // with no prospects, the recommended next action becomes registering one
    expect(j.nextAction?.key).toBe("pipeline")
  })

  it("never claims content is available when nothing is published or the switch is off", () => {
    const off = deriveJourney(base({ content: { courses: 13, lessonsCompleted: 0, resources: 13, resourceLabels: ["R11 Commercial pricing reference reference"], knowledgeArticles: 32, objectionResponses: 12 } }))
    for (const key of ["academy", "pricing_documents", "knowledge_base", "objection_handling"]) expect(tool(off, key).status).not.toBe("available")
    const unpublished = deriveJourney(base({ features: { ...base().features, academy: true, resources: true, knowledge: true } }))
    expect(tool(unpublished, "academy").status).toBe("awaiting_setup")
    expect(tool(unpublished, "pricing_documents").status).toBe("awaiting_setup")
    expect(tool(unpublished, "knowledge_base").status).toBe("awaiting_setup")
  })

  it("marks published content available with a working action", () => {
    const j = deriveJourney(base({ features: { ...base().features, academy: true, resources: true, knowledge: true }, content: { courses: 3, lessonsCompleted: 0, resources: 4, resourceLabels: ["R11 Commercial pricing reference reference", "R12 Commission and payment reference reference", "R01 Company brochure brochure"], knowledgeArticles: 5, objectionResponses: 0 } }))
    expect(tool(j, "academy")).toMatchObject({ status: "available", action: { kind: "link", href: "/partner/academy", label: "Start learning" } })
    expect(tool(j, "pricing_documents").status).toBe("available")
    expect(tool(j, "commission_documents").status).toBe("available")
    expect(tool(j, "industry_demonstrations").status).toBe("awaiting_setup")
    const resumed = deriveJourney(base({ features: { ...base().features, academy: true }, content: { ...base().content, courses: 3, lessonsCompleted: 2 } }))
    expect(tool(resumed, "academy")).toMatchObject({ status: "in_progress", action: { label: "Resume learning" } })
  })

  it("shows built-in tools as available rather than planned", () => {
    const j = deriveJourney(base())
    expect(tool(j, "joint_meetings").status).toBe("available")
    expect(tool(j, "technical_assistance").status).toBe("available")
    expect(tool(j, "founder_training").status).toBe("available")
    expect(tool(j, "referral_identifier")).toMatchObject({ status: "ready_to_set_up", action: { kind: "command", action: "create_referral_code" } })
    expect(tool(deriveJourney(base({ referralCode: "SS-ABCDEFGH" })), "referral_identifier")).toMatchObject({ status: "available", detail: "Your code: SS-ABCDEFGH" })
  })

  it("maps founder fulfilment records for manual items without inventing availability", () => {
    expect(tool(deriveJourney(base()), "email")).toMatchObject({ status: "ready_to_set_up", action: { action: "request_toolkit_item", itemKey: "email" } })
    expect(tool(deriveJourney(base({ toolkit: { email: { status: "awaiting_approval", detail: "please" } } })), "email")).toMatchObject({ status: "awaiting_setup", responsible: "ScaleSmiths founders", action: null })
    expect(tool(deriveJourney(base({ toolkit: { email: { status: "in_preparation", detail: null } } })), "email").status).toBe("in_progress")
    expect(tool(deriveJourney(base({ toolkit: { circlecard: { status: "completed", detail: "Card issued" } } })), "circlecard").status).toBe("completed")
  })

  it("keeps the personal page locked until the five-client milestone", () => {
    expect(tool(deriveJourney(base()), "personal_webpage")).toMatchObject({ status: "coming_soon", action: null })
    expect(tool(deriveJourney(base({ profile: { eligible: true, status: null } })), "personal_webpage").status).toBe("ready_to_set_up")
    expect(tool(deriveJourney(base({ profile: { eligible: true, status: "submitted" } })), "personal_webpage").status).toBe("in_progress")
  })

  it("does not promise researched prospects", () => {
    expect(tool(deriveJourney(base()), "researched_prospects")).toMatchObject({ status: "awaiting_setup" })
    expect(tool(deriveJourney(base()), "researched_prospects").detail).toMatch(/No number is guaranteed/)
    expect(tool(deriveJourney(base({ allocatedProspects: 2 })), "researched_prospects").status).toBe("available")
  })

  it("states when no market is approved instead of implying one", () => {
    expect(deriveJourney(base({ approvedMarkets: [] })).required.find((s) => s.key === "approved_markets")!.detail).toMatch(/has not yet approved a market/)
  })

  it("never shows release dates or percentages for upcoming capabilities", () => {
    for (const u of deriveJourney(base()).upcoming) expect(`${u.title} ${u.benefit}`).not.toMatch(/\d{4}|%|Q[1-4]/)
  })
})
