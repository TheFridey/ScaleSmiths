import { describe, expect, it } from "vitest"
import { DISCOVERY_FIELDS } from "./expansion"
import { QUALIFICATION_NOTICE, qualificationFor, READINESS_FACTORS } from "./partner-qualification"

const full = { objectives: "Win more local enquiries from the website", pages: "Home, services, contact", functionality: "Enquiry form", budget: "Discussed", timescale: "Spring",
  decisionProcess: "Owner decides", existingWebsite: "Old site", marketingChannels: "Word of mouth", targetCustomers: "Homeowners", serviceArea: "Leeds" }

describe("qualification readiness", () => {
  it("is an explainable checklist with equal, declared factors and an honest notice", () => {
    const q = qualificationFor({}, {})
    expect(q.total).toBe(READINESS_FACTORS.length)
    expect(q.met).toBe(0)
    expect(q.notice).toBe(QUALIFICATION_NOTICE)
    expect(q.notice).toMatch(/not a prediction/)
    for (const f of q.factors) { expect(f.why.length).toBeGreaterThan(10); expect(f.how.length).toBeGreaterThan(10) }
  })
  it("marks factors met only from recorded discovery answers", () => {
    const q = qualificationFor(full, { website: "https://x.example" })
    expect(q.factors.every((f) => f.met)).toBe(true)
    expect(q.met).toBe(q.total)
    const partial = qualificationFor({ objectives: "Too short", timescale: "Q2" }, {})
    expect(Object.fromEntries(partial.factors.map((f) => [f.id, f.met]))).toEqual({ requirement: false, service_fit: false, decision: false, timeline: true, documented: false, scope_ready: false })
  })
  it("reads only business discovery fields: unknown or personal keys change nothing", () => {
    const base = qualificationFor(full, {})
    const withPersonal = qualificationFor({ ...full, ownerAge: "62", ethnicity: "x", religion: "y", disability: "z", gender: "w", contactPhone: "07000" }, {})
    expect(withPersonal).toEqual(base)
    for (const f of READINESS_FACTORS) for (const k of f.fields) expect(DISCOVERY_FIELDS).toContain(k)
  })
  it("is deterministic and never mutates its input", () => {
    const input = { ...full }
    expect(qualificationFor(input, {})).toEqual(qualificationFor(input, {}))
    expect(input).toEqual(full)
  })
  it("suggests follow-up questions for unanswered fields and technical escalation when needed", () => {
    const q = qualificationFor({ objectives: "Move our shop from Shopify and connect the CRM", functionality: "e-commerce with payment and booking" }, {})
    expect(q.questions.length).toBeGreaterThan(0)
    expect(q.questions.map((x) => x.field)).not.toContain("objectives")
    expect(q.technicalFlags).toEqual(expect.arrayContaining(["e-commerce", "payment", "booking"]))
    expect(q.escalations.map((e) => e.route)).toContain("technical_scoping")
    expect(qualificationFor(full, {}).technicalFlags).toEqual([])
  })
  it("ignores non-object input", () => {
    for (const v of [null, undefined, "x", 3, [1, 2]]) expect(qualificationFor(v, {}).met).toBe(0)
  })
})
