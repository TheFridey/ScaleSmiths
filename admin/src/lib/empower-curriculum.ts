/*
 * Operation Empower B1.2: parser for the planning-package curriculum (CURRICULUM.md, LESSONS-*.md, KNOWLEDGE-CHECKS.md).
 * Pure and dependency-free so it is unit-tested and can be loaded by the importer script with Node's type stripping.
 * Parsing never approves anything: the importer creates drafts only.
 */
export interface ParsedCheck { id: string; type: "single" | "multiple" | "true_false"; prompt: string; options: { id: string; text: string }[]; answer: string[]; explanation: string }
export interface ParsedLesson { code: string; courseCode: string; title: string; body: string; sources: string[]; sourceFile: string }
export interface ParsedCourse { code: string; title: string; description: string; objectives: string[]; category: string; cadence: "service" | "commercial"; modules: { title: string; lessons: string[] }[]; reviewNotes: string }
export interface ParsedCurriculum { courses: ParsedCourse[]; lessons: Record<string, ParsedLesson>; checks: Record<string, ParsedCheck[]>; problems: string[] }

export const COURSE_CATEGORY_BY_CODE: Record<string, string> = {
  C01: "getting-started", C02: "services", C03: "digital-growth", C04: "services", C05: "technical-knowledge", C06: "technical-knowledge", C07: "sales-fundamentals",
  C08: "discovery", C09: "sales-fundamentals", C10: "sales-fundamentals", C11: "commercial-policies", C12: "professional-conduct", C13: "advanced-opportunities",
}
/** AP-GOV-06: commercial content is reviewed every 3 months. */
const COMMERCIAL_COURSES = new Set(["C11"])
export const cadenceFor = (courseCode: string) => (COMMERCIAL_COURSES.has(courseCode) ? "commercial" : "service") as "service" | "commercial"
export const lessonSlug = (code: string) => `academy-${code.toLowerCase()}`
export const courseSlug = (code: string) => `academy-${code.toLowerCase()}`

const clean = (s: string) => s.replace(/\r\n/g, "\n")
/** Relative links into the planning package are not valid destinations for partners; keep the text, drop the link. */
const unlinkRelative = (s: string) => s.replace(/\[([^\]]+)\]\((?!https:\/\/|\/)([^)]+)\)/g, "$1")
const plainSource = (s: string) => s.replace(/`/g, "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1").trim()

function splitSources(list: string): string[] {
  const out: string[] = []
  let depth = 0, current = ""
  for (const ch of list) {
    if (ch === "(" || ch === "[") depth++
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1)
    if (ch === "," && depth === 0) { out.push(current); current = "" } else current += ch
  }
  out.push(current)
  return out.map(plainSource).filter((s) => s.length >= 3).map((s) => s.slice(0, 300))
}

export function parseCurriculum(markdown: string, problems: string[]): ParsedCourse[] {
  const text = clean(markdown)
  const sections = text.split(/\n(?=## C\d{2} )/).filter((s) => /^## C\d{2} /.test(s))
  return sections.map((section) => {
    const [, code, title] = section.match(/^## (C\d{2}) (.+)$/m) ?? []
    const purpose = section.match(/\*\*Purpose:\*\*\s*(.+)/)?.[1]?.trim() ?? ""
    const statusNote = section.match(/\*\*Status note:\*\*\s*(.+)/)?.[1]?.trim()
    const objectivesBlock = section.split(/\*\*Learning objectives[^*]*\*\*/)[1]?.split(/\n\n\|/)[0] ?? ""
    const objectives = [...objectivesBlock.matchAll(/^\d+\.\s+(.+)$/gm)].map((m) => {
      const o = m[1].trim().replace(/[;.]$/, "")
      return o.charAt(0).toUpperCase() + o.slice(1)
    })
    const modules: { title: string; lessons: string[] }[] = []
    for (const row of section.matchAll(/^\|\s*(M\d+[^|]*)?\|\s*(C\d{2}-L\d+)\s[^|]*\|/gm)) {
      if (row[1]?.trim()) modules.push({ title: row[1].trim().replace(/^M\d+\s+/, ""), lessons: [] })
      if (!modules.length) { problems.push(`${code}: lesson ${row[2]} appears before any module`); continue }
      modules[modules.length - 1].lessons.push(row[2])
    }
    const reviewNotes = section.match(/\*\*Founder review requirements:\*\*\s*(.+)/)?.[1]?.trim() ?? ""
    if (!code || !title) problems.push("A course heading could not be read")
    if (!purpose) problems.push(`${code}: no purpose`)
    if (!objectives.length) problems.push(`${code}: no learning objectives`)
    if (!modules.length) problems.push(`${code}: no modules`)
    const description = [purpose, statusNote ? `*Status: ${unlinkRelative(statusNote)}*` : "", "This course is optional and voluntary."].filter(Boolean).join("\n\n")
    return { code, title: title?.trim(), description, objectives, category: COURSE_CATEGORY_BY_CODE[code] ?? "getting-started", cadence: cadenceFor(code), modules, reviewNotes }
  })
}

export function parseLessons(markdown: string, sourceFile: string, problems: string[]): ParsedLesson[] {
  const text = clean(markdown)
  const blocks = text.split(/\n(?=### C\d{2}-L\d+ )/).filter((b) => /^### C\d{2}-L\d+ /.test(b))
  return blocks.map((block) => {
    const [, code, title] = block.match(/^### (C\d{2}-L\d+) (.+)$/m) ?? []
    let body = block.replace(/^### .+\n/, "").split(/\n---\n|\n## /)[0].trim()
    const sources: string[] = []
    const sourceLine = body.match(/^\*\*Sources?:\*\*\s*(.+?)\.(?=\s|$)/)
    if (sourceLine) { sources.push(...splitSources(sourceLine[1])); body = body.slice(sourceLine[0].length).trim() }
    sources.push(`docs/expansion/empower/${sourceFile}#${code.toLowerCase()}`)
    body = unlinkRelative(body)
    if (body.length < 20) problems.push(`${code}: lesson body is missing or too short`)
    return { code, courseCode: code.slice(0, 3), title: title.trim(), body, sources: [...new Set(sources)], sourceFile }
  })
}

export function parseChecks(markdown: string, problems: string[]): Record<string, ParsedCheck[]> {
  const out: Record<string, ParsedCheck[]> = {}
  const text = clean(markdown)
  for (const block of text.split(/\n(?=### C\d{2}-L\d+ q\d+ )/).filter((b) => /^### C\d{2}-L\d+ q\d+ /.test(b))) {
    const [, code, id, type] = block.match(/^### (C\d{2}-L\d+) (q\d+) (single|multiple|true_false)\s*$/m) ?? []
    if (!code) { problems.push(`Unreadable knowledge-check heading: ${block.split("\n")[0]}`); continue }
    const lines = block.split("\n").slice(1).map((l) => l.trim()).filter((l) => l && !l.startsWith("## "))
    const prompt = lines.find((l) => !l.startsWith("- ") && !l.startsWith(">")) ?? ""
    const explanation = lines.find((l) => l.startsWith("> Explanation:"))?.replace("> Explanation:", "").trim() ?? ""
    let options: { id: string; text: string }[] = [], answer: string[] = []
    if (type === "true_false") {
      const a = lines.find((l) => /^- answer:\s*(true|false)$/.test(l))?.match(/(true|false)$/)?.[1]
      options = [{ id: "true", text: "True" }, { id: "false", text: "False" }]
      answer = a ? [a] : []
    } else {
      for (const l of lines) {
        const m = l.match(/^- \[( |x)\] ([a-f]): (.+)$/)
        if (m) { options.push({ id: m[2], text: m[3].trim() }); if (m[1] === "x") answer.push(m[2]) }
      }
    }
    if (!prompt || !explanation || !answer.length || options.length < 2) problems.push(`${code} ${id}: incomplete knowledge check`)
    ;(out[code] ??= []).push({ id, type: type as ParsedCheck["type"], prompt, options, answer: answer.sort(), explanation })
  }
  return out
}

/** Parses the whole package and cross-checks it: every curriculum lesson has a body, IDs are unique, checks attach to real lessons. */
export function parsePackage(files: { curriculum: string; foundations: string; practice: string; checks: string }): ParsedCurriculum {
  const problems: string[] = []
  const courses = parseCurriculum(files.curriculum, problems)
  const parsed = [...parseLessons(files.foundations, "LESSONS-FOUNDATIONS.md", problems), ...parseLessons(files.practice, "LESSONS-PRACTICE.md", problems)]
  const lessons: Record<string, ParsedLesson> = {}
  for (const l of parsed) { if (lessons[l.code]) problems.push(`${l.code}: duplicate lesson body`); lessons[l.code] = l }
  const referenced = courses.flatMap((c) => c.modules.flatMap((m) => m.lessons))
  const seen = new Set<string>()
  for (const code of referenced) { if (seen.has(code)) problems.push(`${code}: listed twice in the curriculum`); seen.add(code); if (!lessons[code]) problems.push(`${code}: in the curriculum but has no lesson text`) }
  for (const code of Object.keys(lessons)) if (!seen.has(code)) problems.push(`${code}: lesson text not listed in the curriculum`)
  const checks = parseChecks(files.checks, problems)
  for (const code of Object.keys(checks)) if (!lessons[code]) problems.push(`${code}: knowledge check for an unknown lesson`)
  return { courses, lessons, checks, problems }
}

// ---------------------------------------------------------------- B1.3: Resource Centre drafts (resources/R01..R13)
export interface ParsedResource { code: string; title: string; audience: "client_facing" | "partner_only"; category: string; cadence: "service" | "commercial"; summary: string; body: string; sources: string[]; file: string }
/** Category and one-line summary per resource. R13 is imported partner-only: the file mixes client templates with partner instructions. */
export const RESOURCE_PLAN: Record<string, { category: string; summary: string; partnerOnly?: boolean; commercial?: boolean }> = {
  R01: { category: "brochure", summary: "Who ScaleSmiths is, how it works and its published starting prices." },
  R02: { category: "reference", summary: "How the partnership works day to day, subject to the partner agreement." },
  R03: { category: "guide", summary: "What a website project includes, what is separate, timing, ownership and migration." },
  R04: { category: "guide", summary: "What a Growth Partnership can include, how work is prioritised and what it is not." },
  R05: { category: "guide", summary: "When custom software makes sense, how it is scoped and delivered, and automation." },
  R06: { category: "guide", summary: "SEO, local and technical SEO, AI search and honest expectations." },
  R07: { category: "template", summary: "Questions for a first discovery conversation, with partner notes." },
  R08: { category: "reference", summary: "Approved responses to twelve common objections, with limits and escalation." },
  R09: { category: "checklist", summary: "What to do before, during and after a client meeting." },
  R10: { category: "guide", summary: "Which meeting to request, what always needs escalating and what to include." },
  R11: { category: "reference", summary: "Published client prices and the starting-price boundary.", commercial: true },
  R12: { category: "reference", summary: "How commission is proposed to work. Proposed policy, not an entitlement.", commercial: true },
  R13: { category: "template", summary: "Follow-up email templates for prospects who agreed to be contacted.", partnerOnly: true },
}
export const resourceSlug = (code: string) => `resource-${code.toLowerCase()}`

export function parseResource(markdown: string, file: string, problems: string[]): ParsedResource | null {
  const text = clean(markdown)
  const [, code, title] = text.match(/^# (R\d{2}) (.+)$/m) ?? []
  if (!code) { problems.push(`${file}: no "# Rnn Title" heading`); return null }
  const plan = RESOURCE_PLAN[code]
  if (!plan) { problems.push(`${code}: not in the resource plan`); return null }
  const lines = text.split("\n")
  let i = lines.findIndex((l) => /^# R\d{2} /.test(l)) + 1
  while (i < lines.length && !lines[i].startsWith("|")) i++
  const header = [] as string[]
  while (i < lines.length && lines[i].startsWith("|")) header.push(lines[i++])
  while (i < lines.length && (lines[i].trim() === "" || lines[i].trim() === "---")) i++
  const body = unlinkRelative(lines.slice(i).join("\n").trim())
  const audienceRow = header.find((l) => /^\|\s*Audience\s*\|/.test(l)) ?? ""
  const sourcesRow = header.find((l) => /^\|\s*Sources\s*\|/.test(l))?.replace(/^\|\s*Sources\s*\|/, "").replace(/\|\s*$/, "") ?? ""
  // Classify by how the audience cell starts: "Partner only, with client-facing lines marked" is partner-only.
  const audienceCell = audienceRow.split("|")[2]?.trim() ?? ""
  const audience = plan.partnerOnly || !/^client-facing/i.test(audienceCell) ? "partner_only" : "client_facing"
  if (!audienceRow) problems.push(`${code}: no audience row`)
  if (body.length < 20) problems.push(`${code}: body is missing`)
  const sources = [...new Set([...splitSources(sourcesRow.replace(/faq:\s/g, "faq:")), `docs/expansion/empower/resources/${file}`])]
  return { code, title: title.trim(), audience, category: plan.category, cadence: plan.commercial ? "commercial" : "service", summary: plan.summary, body, sources, file }
}

// ---------------------------------------------------------------- B1.4: Knowledge Base drafts (KNOWLEDGE-BASE.md)
export interface ParsedKnowledge { code: string; question: string; answer: string; clientExplanation: string; limitations: string; escalation: { required: "always" | "when" | "never"; condition?: string; route?: string }; topic: string; audience: "client_facing" | "partner_only"; cadence: "service" | "commercial"; sources: string[] }
export const KNOWLEDGE_TOPIC_BY_PREFIX: Record<string, string> = {
  HOST: "hosting", DOM: "domains", DNS: "dns", EMAIL: "business-email", SEC: "website-security", ANL: "analytics", SEO: "seo", AIS: "ai-search", MIG: "wordpress-migration", RED: "redirects",
  ACC: "accessibility", ECOM: "e-commerce", BOOK: "booking-systems", CRM: "crm", SW: "custom-software", AUTO: "automation", TERMS: "commercial-terms", PAY: "payment-schedules", COMM: "commission", ONB: "client-onboarding", COM: "client-onboarding",
}
const COMMERCIAL_TOPIC_SET = new Set(["commercial-terms", "payment-schedules", "commission"])
export const knowledgeSlug = (code: string) => code.toLowerCase()
const unquote = (s: string) => s.trim().replace(/^"([\s\S]*)"\.?$/, "$1").trim()
const stripEnd = (s: string) => s.trim().replace(/\.$/, "").trim()

/** "never", "always → `route`", "always for X → `route`", "when X → `route`", or just "`route`". */
export function parseEscalation(text: string): ParsedKnowledge["escalation"] | null {
  const t = stripEnd(text)
  if (/^never$/i.test(t)) return { required: "never" }
  // One entry, one route: an entry naming several routes is refused rather than silently reduced to the first.
  if ((t.match(/`[a-z_]+`/g) ?? []).length > 1) return null
  const route = t.match(/`([a-z_]+)`/)?.[1]
  if (!route) return null
  const before = t.split("→")[0].trim()
  if (!before || /^`/.test(before)) return { required: "always", route }
  if (/^always$/i.test(before)) return { required: "always", route }
  const condition = before.replace(/^always\s+/i, "").replace(/^(for|when)\s+/i, "").trim()
  return { required: "when", condition: condition.charAt(0).toLowerCase() + condition.slice(1), route }
}

/** Client-facing lines from the objection playbook, by AP-OBJ id. */
export function objectionLines(r08: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of clean(r08).split("\n")) {
    const cells = line.split("|").map((c) => c.trim())
    const id = cells[1]?.match(/`(AP-OBJ-\d{2})`/)?.[1]
    if (id && cells.length >= 7 && !out[id]) out[id] = unquote(cells[5])
  }
  return out
}

export function parseKnowledgeBase(markdown: string, refs: { r08: string; r11: string }, problems: string[]): ParsedKnowledge[] {
  const lines = objectionLines(refs.r08)
  const boundary = clean(refs.r11).match(/\*\*Starting-price boundary[^*]*\*\*\s*"([^"]+)"/)?.[1] ?? ""
  const blocks = ("\n" + clean(markdown)).split(/\n(?=\*\*KB-[A-Z]+-\d{2} )/).filter((b) => /^\*\*KB-[A-Z]+-\d{2} /.test(b))
  return blocks.flatMap((block) => {
    const [, code, question] = block.match(/^\*\*(KB-[A-Z]+-\d{2}) (.+?)\*\*/) ?? []
    const field = (name: string) => unlinkRelative(block.match(new RegExp(`^- ${name}: (.+)$`, "m"))?.[1]?.trim() ?? "")
    const prefix = code?.split("-")[1] ?? ""
    const topic = KNOWLEDGE_TOPIC_BY_PREFIX[prefix]
    const answer = field("Answer"), limitations = field("Limitation"), rawClient = field("Client explanation")
    let clientExplanation = unquote(rawClient)
    const objection = rawClient.match(/`(AP-OBJ-\d{2})`/)?.[1]
    if (objection) clientExplanation = lines[objection] ?? ""
    else if (/^the published wording in/i.test(rawClient)) clientExplanation = boundary
    else if (/^none\b/i.test(rawClient)) clientExplanation = "none"
    else if (/^as answer/i.test(rawClient)) clientExplanation = answer
    const escalation = parseEscalation(field("Escalation"))
    if (!code || !topic) { problems.push(`Unreadable knowledge entry: ${block.split("\n")[0].slice(0, 60)}`); return [] }
    if (!answer || !limitations || !clientExplanation || !escalation) problems.push(`${code}: incomplete entry`)
    const sources = [...new Set([...splitSources(stripEnd(field("Source").replace(/\(\*owner review\*\)/g, "").replace(/No FAQ answer exists\.?/i, ""))), `docs/expansion/empower/KNOWLEDGE-BASE.md#${code.toLowerCase()}`])]
    // Partner-only when the entry is commission guidance or has no client-safe explanation at all.
    const partnerOnly = prefix === "COMM" || clientExplanation === "none"
    return [{ code, question: question.trim(), answer, clientExplanation, limitations: stripEnd(limitations) + ".", escalation: escalation ?? { required: "never" }, topic,
      audience: partnerOnly ? "partner_only" : "client_facing", cadence: COMMERCIAL_TOPIC_SET.has(topic) ? "commercial" : "service", sources }] as ParsedKnowledge[]
  })
}
