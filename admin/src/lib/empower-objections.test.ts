import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { checkSubmission, contentFields, OBJECTION_CATEGORIES, unsupportedClaimHits } from "./empower-content"
import { parseObjectionEscalation, parseObjectionPlaybook } from "./empower-curriculum"

const complete = {
  category: "price", concern: "It's too expensive.", client_line: "A proposal lists exactly what's included, and work can be phased.",
  guidance: "Explain the starting-price boundary and phasing.", limitation: "No discount or payment plan.", escalation_required: "when",
  escalation_condition: "the client asks for a discount", escalation_route: "commercial_assistance", discovery_questions: "Compared with what?\nFor what scope?",
}
const submission = (fields: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  checkSubmission({ kind: "objection", audience: "partner_only", cadenceMonths: 3, title: "Too expensive", body: "", fields, sources: ["faq:pricing"], ...extra })

describe("B1.5 objection content rules", () => {
  it("keeps client-safe language, partner explanation, limitation and escalation as separate validated fields", () => {
    const f = contentFields("objection", complete, true)
    expect(f.discovery_questions).toEqual(["Compared with what?", "For what scope?"])
    expect(() => contentFields("objection", { ...complete, category: "anything" }, true)).toThrow(/objection category/)
    expect(() => contentFields("objection", { ...complete, escalation_route: "lunch" }, true)).toThrow(/meeting type/)
    expect(() => contentFields("objection", { ...complete, escalation_condition: undefined }, true)).toThrow(/Escalation condition/)
    expect(() => contentFields("objection", { ...complete, related: ["not-a-uuid"] }, false)).toThrow(/related item/)
    expect(() => contentFields("objection", { ...complete, surprise: "x" }, false)).toThrow(/not used by objection/)
  })

  it("never lets partner-only terms into the client-facing line, with or without an override", () => {
    for (const leak of ["Your partner earns commission on this.", "This is founder-only pricing.", "Partner only: payout schedule"]) {
      expect(() => contentFields("objection", { ...complete, client_line: leak }, false)).toThrow(/partner-only terms/)
      expect(() => submission({ ...complete, client_line: leak }, { lintOverrideReason: "Founders reviewed this wording carefully." })).toThrow(/partner-only terms/)
    }
  })

  it("requires explicit founder review for unsupported commercial claims", () => {
    const cases: [string, RegExp][] = [
      ["We guarantee page one within six weeks.", /guarantee/], ["You'll get 3x more leads.", /traffic, lead or sales/], ["We can offer a discount this week.", /discount/],
      ["We're better than other agencies.", /competitor/], ["We integrate with any system.", /integration/], ["The site will be 100% secure.", /security/],
      ["It pays for itself.", /financial return/], ["Delivery takes 4 weeks.", /delivery time/],
    ]
    for (const [line, label] of cases) {
      expect(unsupportedClaimHits([line]).join(" ")).toMatch(label)
      expect(() => submission({ ...complete, client_line: line })).toThrow(/record why the wording is safe/)
    }
    // A founder may record why wording that looks like a claim is actually a refusal; the reason is stored with the version.
    const refusal = submission({ ...complete, client_line: "No honest agency can guarantee a position." }, { lintOverrideReason: "This sentence refuses a guarantee; it does not make one." })
    expect(refusal.lintOverrideReason).toMatch(/refuses a guarantee/)
    expect(unsupportedClaimHits(["Managed Business Email starts from £15 a month for three mailboxes."])).toEqual([])
  })

  it("is partner-only and puts commercial categories on the 3-month cadence", () => {
    expect(() => submission(complete, { audience: "client_facing" })).toThrow(/partner-only/)
    expect(() => submission(complete, { cadenceMonths: 6 })).toThrow(/3-month/)
    expect(() => submission({ ...complete, category: "hosting" }, { cadenceMonths: 6 })).not.toThrow()
  })
})

describe("B1.5 objection playbook import", () => {
  const r08 = readFileSync(path.join(__dirname, "../../../docs/expansion/empower/resources/R08-objection-handling-playbook.md"), "utf8")
  it("parses all twelve source entries with their IDs, limitations, references and sources", () => {
    const problems: string[] = []
    const parsed = parseObjectionPlaybook(r08, problems)
    expect(problems).toEqual([])
    expect(parsed.map((p) => p.id)).toEqual(Array.from({ length: 12 }, (_, i) => `AP-OBJ-${String(i + 1).padStart(2, "0")}`))
    for (const p of parsed) {
      expect(OBJECTION_CATEGORIES).toContain(p.category)
      expect(p.concern.length).toBeGreaterThan(5); expect(p.clientLine.length).toBeGreaterThan(20); expect(p.limitation.length).toBeGreaterThan(10)
      expect(p.sources[0]).toMatch(/R08-objection-handling-playbook\.md#ap-obj-\d{2}$/)
      expect(p.relatedCodes.length).toBeGreaterThan(0)
      // Imported client lines must already respect the client-copy boundary.
      expect(() => contentFields("objection", { category: p.category, client_line: p.clientLine }, false)).not.toThrow()
    }
    const byId = Object.fromEntries(parsed.map((p) => [p.id, p]))
    expect(byId["AP-OBJ-03"]).toMatchObject({ category: "seo", discoveryQuestions: ["What would page one mean for the business?"], escalation: { required: "never" } })
    expect(byId["AP-OBJ-03"].sources).toContain("faq:ranking-guarantees")
    expect(byId["AP-OBJ-01"]).toMatchObject({ cadence: "commercial", escalation: { required: "when", route: "commercial_assistance" } })
    expect(byId["AP-OBJ-06"].escalation).toEqual({ required: "when", condition: "migrations", route: "technical_scoping" })
  })
  it("reports incomplete or blocked source rows instead of guessing", () => {
    const parsed = Object.fromEntries(parseObjectionPlaybook(r08, []).map((p) => [p.id, p]))
    expect(parsed["AP-OBJ-05"].escalation).toBeNull()
    expect(parsed["AP-OBJ-05"].notes.join(" ")).toMatch(/several routes/)
    expect(parsed["AP-OBJ-08"].discoveryQuestions).toEqual([])
    expect(parsed["AP-OBJ-10"].blocked).toBe("AP-GOV-05")
    expect(parseObjectionEscalation("Hard deadline → joint sales or technical scoping")).toBeNull()
    expect(parseObjectionEscalation("Never")).toEqual({ required: "never" })
  })
})
