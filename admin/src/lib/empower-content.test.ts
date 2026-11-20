import { describe, expect, it } from "vitest"
import {
  approvalAuthority, audienceLintHits, checkSubmission, contentFields, contentSlug, courseLessonIds, expandQuery, gradeCheck, isServable, linkProblems, publicChecks, reviewByDate, reviewCadence, searchQuery, sourceRefs, synonymExpansion, synonymTerm,
} from "./empower-content"

const knowledge = {
  question: "Do you provide hosting?", answer: "Yes, as part of a build or as a managed service.", client_explanation: "Yes. ScaleSmiths can host your site.",
  limitations: "No published hosting price.", escalation_required: "when", escalation_condition: "The client needs a price", escalation_route: "technical_scoping", topic: "hosting",
}
const base = { kind: "knowledge" as const, audience: "client_facing" as const, cadenceMonths: 6, title: "Do you provide hosting?", body: "", fields: knowledge, sources: ["faq:hosting-provided"] }

describe("content identity and inputs", () => {
  it("accepts tidy slugs and rejects unsafe ones", () => {
    expect(contentSlug(" KB-HOST-01 ")).toBe("kb-host-01")
    for (const bad of ["ab", "kb--host", "-kb", "kb host", "kb_host", "x".repeat(121)]) expect(() => contentSlug(bad)).toThrow()
  })
  it("maps cadences to AP-GOV-06 months", () => {
    expect(reviewCadence("commercial")).toBe(3)
    expect(reviewCadence("service")).toBe(6)
    expect(() => reviewCadence("yearly")).toThrow()
  })
  it("parses sources from lines, removes duplicates and refuses markup", () => {
    expect(sourceRefs("faq:cost\n\n faq:cost \nweb/src/lib/published-starting-prices.ts")).toEqual(["faq:cost", "web/src/lib/published-starting-prices.ts"])
    expect(() => sourceRefs(["<script>x</script>"])).toThrow()
    expect(() => sourceRefs(Array.from({ length: 31 }, (_, i) => `source-${i}`))).toThrow()
  })
})

describe("kind-specific fields", () => {
  it("lets drafts be partial but demands every knowledge field before review", () => {
    expect(contentFields("knowledge", { question: "Hosting?" }, false)).toEqual({ question: "Hosting?" })
    expect(() => contentFields("knowledge", { question: "Hosting?" }, true)).toThrow(/Answer/)
    expect(contentFields("knowledge", knowledge, true)).toMatchObject({ topic: "hosting", escalation_route: "technical_scoping" })
  })
  it("requires a condition when escalation is conditional, and a route unless it is never", () => {
    expect(() => contentFields("knowledge", { ...knowledge, escalation_condition: "" }, true)).toThrow(/condition/)
    expect(() => contentFields("knowledge", { ...knowledge, escalation_required: "always", escalation_route: "" }, true)).toThrow(/meeting type/)
    expect(contentFields("knowledge", { ...knowledge, escalation_required: "never", escalation_condition: "", escalation_route: "" }, true)).not.toHaveProperty("escalation_route")
  })
  it("rejects unknown fields, unknown topics and unknown meeting types", () => {
    expect(() => contentFields("knowledge", { ...knowledge, price: "£1" }, false)).toThrow(/not used/)
    expect(() => contentFields("knowledge", { ...knowledge, topic: "crypto" }, false)).toThrow(/topic/)
    expect(() => contentFields("knowledge", { ...knowledge, escalation_route: "phone_call" }, false)).toThrow(/meeting type/)
  })
  it("validates objection and lesson structure", () => {
    expect(() => contentFields("objection", { concern: "Too expensive" }, true)).toThrow(/Partner guidance/)
    expect(() => contentFields("lesson", { lesson_code: "C4-L3" }, false)).toThrow(/C04-L3/)
    expect(contentFields("lesson", { lesson_code: "C04-L3", course_code: "C04", reading_minutes: "7" }, true)).toEqual({ lesson_code: "C04-L3", course_code: "C04", reading_minutes: "7" })
  })
})

describe("links and audience lint", () => {
  it("allows HTTPS links to allow-listed hosts and internal paths only", () => {
    expect(linkProblems("See https://ico.org.uk/for-organisations/ and https://www.gov.uk/vat and [pricing](/pricing).")).toEqual([])
    expect(linkProblems("http://ico.org.uk/x")).toEqual(["Links must use HTTPS: http://ico.org.uk/x"])
    expect(linkProblems("https://evil.example/ico.org.uk")[0]).toMatch(/allow-list/)
    expect(linkProblems("https://ico.org.uk.evil.example")[0]).toMatch(/allow-list/)
    expect(linkProblems("[x](javascript:alert(1))")[0]).toMatch(/Unsafe/)
    expect(linkProblems("[x](//evil.example)")[0]).toMatch(/HTTPS or site-internal/)
  })
  it("flags partner-only commercial language in client-facing content, not partner-only content", () => {
    expect(audienceLintHits("client_facing", ["Your partner earns commission and a referral reward"])).toEqual(["commission", "referral reward"])
    expect(audienceLintHits("client_facing", ["This is founder only guidance"])).toEqual(["founder-only"])
    expect(audienceLintHits("partner_only", ["commission"])).toEqual([])
  })
})

describe("submission", () => {
  it("passes a complete, sourced knowledge entry", () => {
    expect(checkSubmission(base)).toMatchObject({ lintHits: [], lintOverrideReason: null })
  })
  it("refuses content without a source", () => {
    expect(() => checkSubmission({ ...base, sources: [] })).toThrow(/no source, no content/)
  })
  it("refuses client-facing blocked terms unless a reasoned override is recorded", () => {
    const leaky = { ...base, fields: { ...knowledge, client_explanation: "Your partner earns commission on this." } }
    expect(() => checkSubmission(leaky)).toThrow(/commission/)
    expect(() => checkSubmission({ ...leaky, lintOverrideReason: "short" })).toThrow(/at least 10/)
    expect(checkSubmission({ ...leaky, lintOverrideReason: "Explains to the client that partners are paid by ScaleSmiths." })).toMatchObject({ lintHits: ["commission"] })
  })
  it("forces commercial knowledge onto the 3-month cadence", () => {
    const commercial = { ...base, audience: "partner_only" as const, fields: { ...knowledge, topic: "commission" } }
    expect(() => checkSubmission(commercial)).toThrow(/3-month/)
    expect(() => checkSubmission({ ...commercial, cadenceMonths: 3 })).not.toThrow()
  })
  it("refuses disallowed links anywhere in the content", () => {
    expect(() => checkSubmission({ ...base, fields: { ...knowledge, answer: "See http://example.com" } })).toThrow(/HTTPS/)
  })
  it("requires a real body for lessons and resources", () => {
    expect(() => checkSubmission({ ...base, kind: "resource", audience: "partner_only", fields: { summary: "A short guide", category: "guide" }, body: "short" })).toThrow(/body/)
  })
})

describe("review dates and approval authority", () => {
  const today = new Date("2026-11-20T10:00:00Z")
  it("requires a future review date within the cadence", () => {
    expect(reviewByDate("2027-05-20", 6, today)).toBe("2027-05-20")
    expect(() => reviewByDate("2027-05-21", 6, today)).toThrow(/within 6 months/)
    expect(() => reviewByDate("2027-02-21", 3, today)).toThrow(/within 3 months/)
    expect(() => reviewByDate("2026-11-20", 6, today)).toThrow(/future/)
    expect(() => reviewByDate("20/05/2027", 6, today)).toThrow(/YYYY-MM-DD/)
  })
  it("applies the two-founder rule (AP-GOV-04)", () => {
    expect(approvalAuthority({ approverId: "b", authorId: "a", activeFounders: 2 })).toEqual({ selfApprovalReason: null })
    expect(() => approvalAuthority({ approverId: "a", authorId: "a", activeFounders: 2 })).toThrow(/Another active founder/)
    expect(() => approvalAuthority({ approverId: "a", authorId: "a", activeFounders: 1 })).toThrow(/only active founder/)
    expect(approvalAuthority({ approverId: "a", authorId: "a", activeFounders: 1, selfApprovalReason: "Sole active founder this quarter." })).toEqual({ selfApprovalReason: "Sole active founder this quarter." })
    expect(() => approvalAuthority({ approverId: "b", authorId: "a", activeFounders: 2, selfApprovalReason: "Not mine" })).toThrow(/only when approving your own/)
  })
  it("serves only published content inside its review window", () => {
    const today2 = new Date("2026-11-20T23:00:00Z")
    expect(isServable({ status: "published", review_by: "2026-11-20" }, today2)).toBe(true)
    expect(isServable({ status: "published", review_by: "2026-11-19" }, today2)).toBe(false)
    for (const status of ["draft", "in_review", "approved", "superseded", "archived", "changes_requested"]) expect(isServable({ status, review_by: "2027-01-01" }, today2)).toBe(false)
  })
})

describe("Academy course structure and knowledge checks (B1.2)", () => {
  const lessonA = "11111111-1111-4111-8111-111111111111", lessonB = "22222222-2222-4222-8222-222222222222"
  it("validates course structure and refuses duplicate lessons", () => {
    const fields = contentFields("course", { category: "getting-started", objectives: "Describe ScaleSmiths\nFind approved answers", modules: [{ title: "Who we are", lessons: [lessonA] }, { title: "Your role", lessons: [lessonB.toUpperCase()] }] }, true)
    expect(fields.objectives).toEqual(["Describe ScaleSmiths", "Find approved answers"])
    expect(courseLessonIds(fields)).toEqual([lessonA, lessonB])
    expect(() => contentFields("course", { category: "getting-started", objectives: ["Describe it"], modules: [{ title: "One", lessons: [lessonA] }, { title: "Two", lessons: [lessonA] }] }, false)).toThrow(/only once/)
    expect(() => contentFields("course", { category: "getting-started", objectives: ["Describe it"], modules: [{ title: "Empty", lessons: [] }] }, true)).toThrow(/at least one lesson/)
    expect(() => contentFields("course", { category: "mandatory", modules: [] }, false)).toThrow(/category/)
    expect(() => contentFields("course", { modules: [{ title: "Bad", lessons: ["not-a-uuid"] }] }, false)).toThrow(/invalid lesson reference/)
  })
  const q = (over: Record<string, unknown> = {}) => ({ id: "q1", type: "single", prompt: "Can anyone guarantee first place on Google?", options: [{ id: "a", text: "Yes" }, { id: "b", text: "No" }], answer: ["b"], explanation: "Rankings depend on Google, competitors and the searcher.", ...over })
  it("requires an approved answer and explanation before review", () => {
    expect(contentFields("lesson", { checks: [q({ answer: [], explanation: "" })] }, false).checks).toHaveLength(1)
    expect(() => contentFields("lesson", { lesson_code: "C03-L4", course_code: "C03", checks: [q({ answer: [] })] }, true)).toThrow(/approved answer/)
    expect(() => contentFields("lesson", { lesson_code: "C03-L4", course_code: "C03", checks: [q({ explanation: "" })] }, true)).toThrow(/explanation/)
    expect(() => contentFields("lesson", { checks: [q({ answer: ["a", "b"] })] }, false)).toThrow(/exactly one/)
    expect(() => contentFields("lesson", { checks: [q({ answer: ["z"] })] }, false)).toThrow(/one of its options/)
    expect(() => contentFields("lesson", { checks: [q(), q()] }, false)).toThrow(/used twice/)
    expect(contentFields("lesson", { lesson_code: "C03-L4", course_code: "C03", checks: [q({ type: "true_false", options: undefined, answer: ["false"] })] }, true).checks).toEqual([expect.objectContaining({ options: [{ id: "true", text: "True" }, { id: "false", text: "False" }] })])
  })
  it("never exposes answers before grading, and grades single, multiple and true/false", () => {
    const checks = [q(), q({ id: "q2", type: "multiple", options: [{ id: "a", text: "Hosting" }, { id: "b", text: "Email" }, { id: "c", text: "Unlimited support" }], answer: ["a", "b"] })]
    expect(JSON.stringify(publicChecks(checks))).not.toMatch(/answer|explanation|Rankings depend/)
    expect(gradeCheck(checks, "q1", ["b"])).toMatchObject({ correct: true })
    expect(gradeCheck(checks, "q1", "a")).toMatchObject({ correct: false, answer: ["b"] })
    expect(gradeCheck(checks, "q2", ["b", "a"])).toMatchObject({ correct: true })
    expect(gradeCheck(checks, "q2", ["a"])).toMatchObject({ correct: false })
    expect(() => gradeCheck(checks, "q1", ["a", "b"])).toThrow(/one answer/)
    expect(() => gradeCheck(checks, "q1", ["x"])).toThrow(/listed answers/)
    expect(() => gradeCheck(checks, "q9", ["a"])).toThrow(/not part/)
  })
})

describe("Resource Centre search rules (B1.3)", () => {
  it("normalises search text and bounds it", () => {
    expect(searchQuery("  hosting \u0000 price  ")).toBe("hosting price")
    expect(searchQuery("   ")).toBeNull()
    expect(searchQuery(undefined)).toBeNull()
    expect(() => searchQuery("x".repeat(201))).toThrow(/200/)
    expect(() => searchQuery({})).toThrow(/text/)
  })
  it("expands whole-word synonyms deterministically, keeping the original query first", () => {
    const synonyms = [{ term: "wp", expansion: "wordpress" }, { term: "ssl", expansion: "https certificate" }, { term: "ssl cert", expansion: "https certificate" }]
    expect(expandQuery("Do you do SSL?", synonyms)).toBe("Do you do SSL? or https certificate")
    expect(expandQuery("ssl cert for wp", synonyms)).toBe("ssl cert for wp or https certificate or wordpress")
    expect(expandQuery("sslx", synonyms)).toBe("sslx")
    expect(expandQuery("ssl", synonyms)).toBe(expandQuery("ssl", [...synonyms].reverse()))
  })
  it("validates synonyms and resource fields", () => {
    expect(synonymTerm(" SSL ")).toBe("ssl")
    expect(() => synonymTerm("<b>")).toThrow()
    expect(() => synonymExpansion("say \"hi\"")).toThrow()
    expect(contentFields("resource", { summary: "A guide", category: "guide", related: ["11111111-1111-4111-8111-111111111111"] }, true)).toMatchObject({ category: "guide", related: ["11111111-1111-4111-8111-111111111111"] })
    expect(() => contentFields("resource", { summary: "A guide", category: "secret" }, false)).toThrow(/resource category/)
    expect(() => contentFields("resource", { summary: "A guide", category: "guide", related: ["nope"] }, false)).toThrow(/not valid/)
    expect(() => contentFields("resource", { category: "guide" }, true)).toThrow(/summary/)
  })
})

describe("synonym expansions cannot change query meaning (B1.3 review)", () => {
  it("drops exclusion prefixes and bare or/and words", () => {
    expect(expandQuery("ssl", [{ term: "ssl", expansion: "-https or certificate and renewal" }])).toBe("ssl or https certificate renewal")
  })
})
