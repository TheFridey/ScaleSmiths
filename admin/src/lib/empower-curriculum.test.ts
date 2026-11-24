import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { parseEscalation, parseKnowledgeBase, parsePackage, parseResource } from "./empower-curriculum"
import { checkSubmission, contentFields, knowledgeChecks, linkProblems } from "./empower-content"

const dir = path.resolve(__dirname, "..", "..", "..", "docs", "expansion", "empower")
const read = (f: string) => readFileSync(path.join(dir, f), "utf8")
const pkg = parsePackage({ curriculum: read("CURRICULUM.md"), foundations: read("LESSONS-FOUNDATIONS.md"), practice: read("LESSONS-PRACTICE.md"), checks: read("KNOWLEDGE-CHECKS.md") })

describe("planning-package curriculum parser", () => {
  it("reads the audited curriculum exactly: 13 courses, 38 modules, 91 lessons, 65 draft checks, no problems", () => {
    expect(pkg.problems).toEqual([])
    expect(pkg.courses.map((c) => c.code)).toEqual(["C01", "C02", "C03", "C04", "C05", "C06", "C07", "C08", "C09", "C10", "C11", "C12", "C13"])
    expect(pkg.courses.reduce((n, c) => n + c.modules.length, 0)).toBe(38)
    expect(pkg.courses.reduce((n, c) => n + c.modules.reduce((m, x) => m + x.lessons.length, 0), 0)).toBe(91)
    expect(Object.keys(pkg.lessons)).toHaveLength(91)
    expect(pkg.courses.map((c) => Object.entries(pkg.checks).filter(([code]) => code.startsWith(c.code)).reduce((n, [, q]) => n + q.length, 0))).toEqual([5, 6, 6, 5, 5, 5, 4, 5, 4, 6, 5, 5, 4])
  })
  it("keeps source references and lesson identifiers, and drops planning-package relative links", () => {
    const l = pkg.lessons["C01-L1"]
    expect(l.title).toBe("The ScaleSmiths story in plain words")
    expect(l.sources).toEqual(expect.arrayContaining(["faq:outside-nottingham", "web/src/lib/data.ts", "docs/expansion/empower/LESSONS-FOUNDATIONS.md#c01-l1"]))
    expect(l.body).not.toMatch(/\*\*Sources?:\*\*/)
    for (const lesson of Object.values(pkg.lessons)) expect(linkProblems(lesson.body)).toEqual([])
    expect(pkg.lessons["C07-L5"].body).toContain("https://ico.org.uk/")
  })
  it("keeps proposed-policy and blocked labels in lesson text", () => {
    expect(pkg.lessons["C11-L4"].body).toContain("PROPOSED POLICY")
    expect(pkg.lessons["C07-L5"].body).toContain("BLOCKED")
    expect(pkg.courses.find((c) => c.code === "C11")!.cadence).toBe("commercial")
    expect(pkg.courses.find((c) => c.code === "C01")!.cadence).toBe("service")
  })
  it("produces lesson fields and knowledge checks that pass submission validation once a founder reviews them", () => {
    for (const [code, checks] of Object.entries(pkg.checks)) {
      expect(() => knowledgeChecks(checks, true), code).not.toThrow()
      const fields = contentFields("lesson", { course_code: code.slice(0, 3), lesson_code: code, checks }, true)
      expect(() => checkSubmission({ kind: "lesson", audience: "partner_only", cadenceMonths: 6, title: pkg.lessons[code].title, body: pkg.lessons[code].body, fields, sources: pkg.lessons[code].sources }), code).not.toThrow()
    }
  })
  it("reports malformed or missing content instead of importing it", () => {
    const broken = parsePackage({ curriculum: read("CURRICULUM.md"), foundations: read("LESSONS-FOUNDATIONS.md").replace("### C01-L3 How we work", "### C01-L3x How we work"), practice: "", checks: "### C99-L1 q1 single\nWhat?\n" })
    expect(broken.problems).toEqual(expect.arrayContaining(["C01-L3: in the curriculum but has no lesson text", "C07-L1: in the curriculum but has no lesson text", "C99-L1 q1: incomplete knowledge check", "C99-L1: knowledge check for an unknown lesson"]))
  })
})

describe("Resource Centre drafts (B1.3)", () => {
  const files = readdirSync(path.join(dir, "resources")).filter((f) => /^R\d{2}-.+\.md$/.test(f)).sort()
  const problems: string[] = []
  const parsed = files.map((f) => parseResource(read(`resources/${f}`), f, problems)!)
  it("reads all 13 resources with their audience, category and sources, and no problems", () => {
    expect(problems).toEqual([])
    expect(parsed.map((r) => r.code)).toEqual(["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09", "R10", "R11", "R12", "R13"])
    expect(parsed.filter((r) => r.audience === "client_facing").map((r) => r.code)).toEqual(["R01", "R03", "R04", "R05", "R06"])
    expect(parsed.find((r) => r.code === "R12")!.cadence).toBe("commercial")
    for (const r of parsed) { expect(r.body).not.toMatch(/^\| Field \| Value \|/m); expect(r.sources).toContain(`docs/expansion/empower/resources/${r.file}`) }
  })
  it("produces resources that pass submission, including the client-facing audience check, with no override", () => {
    for (const r of parsed) {
      const fields = contentFields("resource", { summary: r.summary, category: r.category }, true)
      expect(() => checkSubmission({ kind: "resource", audience: r.audience, cadenceMonths: r.cadence === "commercial" ? 3 : 6, title: r.title, body: r.body, fields, sources: r.sources }), r.code).not.toThrow()
      expect(linkProblems(r.body), r.code).toEqual([])
    }
  })
})

describe("Knowledge Base drafts (B1.4)", () => {
  const problems: string[] = []
  const entries = parseKnowledgeBase(read("KNOWLEDGE-BASE.md"), { r08: read("resources/R08-objection-handling-playbook.md"), r11: read("resources/R11-commercial-pricing-reference.md") }, problems)
  it("reads all 46 entries (32 from B1.4, the package summary said 33; plus 14 B2.10 partner-programme entries) with topics, escalation and resolved client explanations, and no problems", () => {
    expect(problems).toEqual([])
    expect(entries).toHaveLength(46)
    expect(new Set(entries.map((e) => e.code)).size).toBe(46)
    expect(entries.filter((e) => e.code.startsWith("KB-PROG-")).every((e) => e.topic === "partner-programme" && e.audience === "partner_only" && e.cadence === "commercial")).toBe(true)
    expect(entries.find((e) => e.code === "KB-SEO-01")!.clientExplanation).toMatch(/^No honest agency can promise a position/)
    expect(entries.find((e) => e.code === "KB-TERMS-01")!.clientExplanation).toMatch(/^A starting price is the entry point/)
    expect(entries.find((e) => e.code === "KB-ONB-02")!.clientExplanation).toBe(entries.find((e) => e.code === "KB-ONB-02")!.answer)
    expect(entries.filter((e) => e.audience === "partner_only" && !e.code.startsWith("KB-PROG-")).map((e) => e.code)).toEqual(["KB-COMM-01", "KB-COMM-02", "KB-COMM-03"])
    expect(entries.find((e) => e.code === "KB-HOST-01")!.escalation).toEqual({ required: "when", condition: "the client needs a price, a specific provider or a migration", route: "technical_scoping" })
    expect(entries.find((e) => e.code === "KB-MIG-01")!.escalation).toEqual({ required: "always", route: "technical_scoping" })
    expect(entries.find((e) => e.code === "KB-COMM-02")!.escalation).toEqual({ required: "always", route: "commercial_assistance" })
    expect(entries.find((e) => e.code === "KB-SEO-01")!.escalation).toEqual({ required: "never" })
  })
  it("produces entries that pass submission, including the client-facing audience check, with no override", () => {
    for (const e of entries) {
      const fields = contentFields("knowledge", { question: e.question, answer: e.answer, client_explanation: e.clientExplanation, limitations: e.limitations, escalation_required: e.escalation.required,
        escalation_condition: e.escalation.condition, escalation_route: e.escalation.route, topic: e.topic }, true)
      expect(() => checkSubmission({ kind: "knowledge", audience: e.audience, cadenceMonths: e.cadence === "commercial" ? 3 : 6, title: e.question, body: "", fields, sources: e.sources }), e.code).not.toThrow()
    }
  })
})

describe("knowledge parser review fixes (B1.4)", () => {
  it("refuses an escalation that names more than one route instead of keeping only the first", () => {
    expect(parseEscalation("always for X → `technical_scoping` or `escalation`.")).toBeNull()
    expect(parseEscalation("when the client sends a security questionnaire or procurement requirements → `technical_scoping`. A suspected incident is always reported the same day as an escalation request (see R10).")).toMatchObject({ required: "when", route: "technical_scoping" })
  })
  it("treats any entry without a client-safe explanation as partner-only", () => {
    const problems: string[] = []
    const md = "**KB-HOST-09 Internal question?**\n- Answer: An internal answer.\n- Client explanation: none.\n- Source: faq:hosting-provided.\n- Limitation: Partner preparation only.\n- Escalation: never.\n"
    const [entry] = parseKnowledgeBase(md, { r08: "", r11: "" }, problems)
    expect(problems).toEqual([])
    expect(entry).toMatchObject({ code: "KB-HOST-09", audience: "partner_only", clientExplanation: "none" })
  })
})
