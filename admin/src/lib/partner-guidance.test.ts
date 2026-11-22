import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { DISCOVERY_FIELDS } from "./expansion"
import { COURSE_CATEGORIES, KNOWLEDGE_TOPICS } from "./empower-content"
import { discoveryGaps, explain, GUIDANCE_RULES, guidancePlanFor, MEETING_GUIDANCE, MEETING_STATUS, OPPORTUNITY_STATUS } from "./partner-guidance"

const sql = (file: string) => readFileSync(path.join(__dirname, "../../drizzle", file), "utf8")
const statusList = (text: string, table: string) => {
  const block = text.slice(text.indexOf(`CREATE TABLE ${table}`))
  return [...(block.match(/status text NOT NULL DEFAULT '[a-z_]+' CHECK \(status IN \(([^)]*)\)\)/)?.[1].matchAll(/'([a-z_]+)'/g) ?? [])].map((m) => m[1])
}

describe("B1.6 deterministic prospect guidance", () => {
  it("maps recorded needs to approved-content topics, with a reason for each rule", () => {
    const plan = guidancePlanFor({ seoConcerns: "Not showing on Google", integrations: "Xero and our booking system", budget: "Around five thousand" }, { website: "https://example.co.uk" })
    expect(plan.rules.map((r) => r.id)).toEqual(["existing-website", "cost", "seo", "automation"])
    expect(plan.knowledgeTopics).toEqual(expect.arrayContaining(["seo", "ai-search", "crm", "automation", "commercial-terms"]))
    expect(plan.courseCategories[0]).toBe("discovery")
    expect(plan.escalation).toBe("commercial_assistance")
    for (const r of plan.rules) expect(r.reason.length).toBeGreaterThan(20)
  })

  it("is stable: the same record always gives the same plan, in table order", () => {
    const record = { functionality: "Online shop with checkout", existingWebsite: "Wix site, moving away", timescale: "Spring" }
    const a = guidancePlanFor(record, {}), b = guidancePlanFor({ ...record }, {})
    expect(a).toEqual(b)
    expect(a.rules.map((r) => r.id)).toEqual(["existing-website", "ecommerce", "migration", "timing"])
    expect(guidancePlanFor({}, {}).rules.map((r) => r.id)).toEqual(["new-website"])
  })

  it("never turns prospect text into search terms or topics", () => {
    const secret = "Zebulon Quixotic Holdings secretproject42"
    const plan = guidancePlanFor({ objectives: `${secret} wants seo and a crm`, restrictions: secret }, { website: secret })
    const out = JSON.stringify(plan)
    expect(out).not.toMatch(/zebulon|quixotic|secretproject/i)
    for (const t of plan.searchTerms) expect(t).toMatch(/^[a-z]{2,30}$/)
    for (const rule of GUIDANCE_RULES) {
      for (const t of rule.searchTerms) expect(t).toMatch(/^[a-z]{2,30}$/)
      for (const t of rule.knowledgeTopics) expect(KNOWLEDGE_TOPICS).toContain(t)
      for (const c of rule.courseCategories) expect(COURSE_CATEGORIES).toContain(c)
    }
    for (const g of Object.values(MEETING_GUIDANCE)) for (const t of g.knowledgeTopics) expect(KNOWLEDGE_TOPICS).toContain(t)
  })

  it("ignores unknown or malformed discovery input", () => {
    expect(guidancePlanFor(null, {}).rules.map((r) => r.id)).toEqual(["new-website"])
    expect(guidancePlanFor(["seo"], { website: 42 }).rules.map((r) => r.id)).toEqual(["new-website"])
    expect(guidancePlanFor({ __proto__: { seoConcerns: "x" }, unknownField: "seo crm" }, {}).rules.map((r) => r.id)).toEqual(["new-website"])
  })

  it("prompts only for discovery fields that are still empty", () => {
    const gaps = discoveryGaps({ objectives: "Grow", existingWebsite: "  " }, 3)
    expect(gaps.map((g) => g.field)).toEqual(["existingWebsite", "marketingChannels", "targetCustomers"])
    expect(discoveryGaps(Object.fromEntries(DISCOVERY_FIELDS.map((f) => [f, "recorded"])))).toEqual([])
  })
})

describe("B1.6 plain-language statuses use the real backend states", () => {
  it("explains every opportunity and meeting status in the database, and nothing else", () => {
    const opp = statusList(sql("0068_expansion_foundation.sql"), "expansion_opportunities")
    const meet = statusList(sql("0081_expansion_toolkit_meetings.sql"), "expansion_meeting_requests")
    expect(opp.length).toBeGreaterThan(8); expect(meet.length).toBe(8)
    expect(Object.keys(OPPORTUNITY_STATUS).sort()).toEqual([...opp].sort())
    expect(Object.keys(MEETING_STATUS).sort()).toEqual([...meet].sort())
  })
  it("never presents a request as a booking", () => {
    expect(MEETING_STATUS.requested.label).toBe("Meeting requested")
    expect(MEETING_STATUS.requested.meaning).toMatch(/not booked/i)
    expect(MEETING_STATUS.confirmed.label).toBe("Meeting confirmed")
    expect(OPPORTUNITY_STATUS.contract_accepted.meaning).toMatch(/only when qualifying payments are verified/)
    expect(explain(OPPORTUNITY_STATUS, "nonsense")).toMatchObject({ label: "nonsense", tone: "neutral" })
  })
})

describe("B1.7 objection vocabulary", () => {
  it("uses only real objection categories for every rule and meeting type, and covers every meeting type", async () => {
    const { OBJECTION_CATEGORIES } = await import("./empower-content")
    const { GUIDANCE_RULES, MEETING_GUIDANCE, MEETING_OBJECTIONS } = await import("./partner-guidance")
    for (const c of [...GUIDANCE_RULES.flatMap((r) => r.objectionCategories), ...Object.values(MEETING_OBJECTIONS).flat()]) expect(OBJECTION_CATEGORIES).toContain(c)
    expect(Object.keys(MEETING_OBJECTIONS).sort()).toEqual(Object.keys(MEETING_GUIDANCE).sort())
  })
})
