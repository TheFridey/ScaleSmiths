/*
 * Operation Empower B1.1: pure rules for founder-controlled partner content. No database, no I/O, so every rule is unit-tested.
 * The database enforces the lifecycle, immutability, approval evidence and review cadence independently (migration 0091);
 * these checks give founders clear messages before a write and cover what SQL cannot express (field shapes, wording, links).
 */
import { ExpansionError } from "./expansion"
import { MEETING_TYPES } from "./expansion-operations"

export const CONTENT_KINDS = ["resource", "lesson", "knowledge", "objection", "template", "course", "agreement"] as const
export type ContentKind = (typeof CONTENT_KINDS)[number]
export const CONTENT_AUDIENCES = ["partner_only", "client_facing"] as const
export type ContentAudience = (typeof CONTENT_AUDIENCES)[number]
/** AP-GOV-06: commercial content at least every 3 months; service content at least every 6. */
export const REVIEW_CADENCES = { commercial: 3, service: 6 } as const
export type ReviewCadence = keyof typeof REVIEW_CADENCES
export const CONTENT_STATUSES = ["draft", "in_review", "changes_requested", "approved", "published", "superseded", "archived"] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]
export const CONTENT_DECISIONS = ["approved", "changes_requested", "rejected"] as const
export type ContentDecision = (typeof CONTENT_DECISIONS)[number]
export const KNOWLEDGE_TOPICS = [
  "hosting", "domains", "dns", "business-email", "website-security", "analytics", "seo", "ai-search", "wordpress-migration", "redirects",
  "accessibility", "e-commerce", "booking-systems", "crm", "custom-software", "automation", "commercial-terms", "payment-schedules", "commission", "client-onboarding", "partner-programme",
] as const
/** Commercial topics must use the 3-month cadence. */
export const COMMERCIAL_TOPICS: readonly string[] = ["commercial-terms", "payment-schedules", "commission", "partner-programme"]
export const ESCALATION_RULES = ["always", "when", "never"] as const
/** Operation Empower B1.5: objection categories. Partners only see categories that have approved, published responses. */
export const OBJECTION_CATEGORIES = [
  "price", "existing-supplier", "competitor-comparison", "website-migration", "seo", "ai-search", "hosting", "maintenance",
  "contract-length", "payment-schedules", "data-security", "bespoke-development", "delivery-times", "commercial-eligibility",
  "decision-timing", "ownership", "partner-independence",
] as const
/** Commercial objection categories are reviewed on the 3-month cadence (AP-GOV-06). */
export const COMMERCIAL_OBJECTION_CATEGORIES: readonly string[] = ["price", "contract-length", "payment-schedules", "commercial-eligibility"]
/**
 * B1.5 content safety: wording that could become an unsupported commercial promise. A hit blocks submission unless a founder records
 * why the wording is safe (for example "nobody can guarantee rankings" is a refusal, not a promise). Founders change this list by code review.
 */
export const UNSUPPORTED_CLAIM_PATTERNS: readonly { label: string; pattern: RegExp }[] = [
  { label: "a guarantee", pattern: /\bguarantee(?:d|s|ing)?\b/i },
  { label: "a ranking position", pattern: /\b(?:page (?:one|1)|first page|top (?:spot|position|three|3|ten|10)|number one|#1)\b/i },
  { label: "a traffic, lead or sales figure", pattern: /\b(?:\d+\s*%|\d+x|double|triple)\s+(?:more\s+)?(?:traffic|visitors|leads|enquiries|sales|revenue|conversions)\b/i },
  { label: "a discount or special price", pattern: /\b(?:discount|special price|money off|price match|cheaper than)\b/i },
  { label: "a delivery time", pattern: /\b(?:\d+|one|two|three|four|six|eight|twelve)\s*(?:-\s*\d+\s*)?(?:working\s+)?(?:days?|weeks?|months?)\b(?!\s+(?:a|per)\s+month)/i },
  { label: "a competitor comparison", pattern: /\b(?:better|faster|cheaper) than\b|\bunlike (?:other|most) agencies\b/i },
  { label: "an integration promise", pattern: /\b(?:any|every|all) (?:integration|system|platform)s?\b|\bintegrates? with anything\b/i },
  { label: "a security guarantee", pattern: /\b(?:100\s*%\s*secure|fully secure|unhackable|cannot be hacked|never be hacked|bullet-?proof)\b/i },
  { label: "a financial return", pattern: /\b(?:roi|return on investment|pay(?:s)? for itself|guaranteed income)\b/i },
]
export function unsupportedClaimHits(parts: readonly string[]): string[] {
  const haystack = parts.join("\n")
  return UNSUPPORTED_CLAIM_PATTERNS.filter((c) => c.pattern.test(haystack)).map((c) => c.label)
}
/** External link hosts a body may reference. Founders change this list by code review only. */
export const LINK_ALLOW_LIST = ["scalesmiths.co.uk", "ico.org.uk", "gov.uk"] as const
/** Terms that must not appear in client-facing content without a recorded override (SECURITY-MODEL 3.1). A safety net, not a guarantee. */
export const CLIENT_BLOCKED_TERMS = ["commission", "basis points", "payout", "withdrawal", "referral reward", "founder-only", "internal only", "partner only", "achievement bonus"] as const
export const TITLE_MAX = 200, BODY_MAX = 30000, FIELD_MAX = 4000, SOURCE_MAX = 30

export class ContentError extends ExpansionError { constructor(message: string, status = 400) { super(message, status); this.name = "ContentError" } }
const fail = (message: string): never => { throw new ContentError(message) }
const oneOf = <T extends string>(value: unknown, options: readonly T[], label: string): T =>
  typeof value === "string" && (options as readonly string[]).includes(value) ? value as T : fail(`Choose a valid ${label}.`)
const text = (value: unknown, label: string, min: number, max: number) => {
  const trimmed = typeof value === "string" ? value.trim() : ""
  if (trimmed.length < min || trimmed.length > max) fail(`${label} must be ${min} to ${max} characters.`)
  return trimmed
}
const optionalText = (value: unknown, label: string, max: number) => (value === undefined || value === null || (typeof value === "string" && !value.trim())) ? null : text(value, label, 1, max)

export const contentKind = (value: unknown) => oneOf(value, CONTENT_KINDS, "content type")
export const contentAudience = (value: unknown) => oneOf(value, CONTENT_AUDIENCES, "audience")
export const reviewCadence = (value: unknown) => REVIEW_CADENCES[oneOf(value, Object.keys(REVIEW_CADENCES) as ReviewCadence[], "review cadence")]
export const contentDecision = (value: unknown) => oneOf(value, CONTENT_DECISIONS, "decision")
export const contentTitle = (value: unknown) => text(value, "Title", 3, TITLE_MAX)
export const contentBody = (value: unknown) => typeof value === "string" && value.length <= BODY_MAX ? value.replace(/\r\n/g, "\n") : fail(`Body must be at most ${BODY_MAX} characters.`)
export const changeSummary = (value: unknown) => optionalText(value, "Change summary", 2000)

export function contentSlug(value: unknown) {
  const slug = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (slug.length < 3 || slug.length > 120 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail("Use a slug of 3 to 120 lowercase letters, numbers and single hyphens.")
  return slug
}

/** Sources: a list (or one per line) of repository paths, `faq:<key>` references or approved document references. */
export function sourceRefs(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : value == null ? [] : fail("Sources must be a list.")
  const cleaned = [...new Set(list.map((entry) => typeof entry === "string" ? entry.trim() : fail("Each source must be text.")).filter(Boolean))]
  if (cleaned.length > SOURCE_MAX) fail(`List at most ${SOURCE_MAX} sources.`)
  for (const source of cleaned) if (source.length < 3 || source.length > 300 || /[\u0000-\u001f<>]/.test(source)) fail("Each source must be 3 to 300 characters of plain text.")
  return cleaned
}

type Fields = Record<string, unknown>
const req = (fields: Fields, key: string, label: string) => text(fields[key], label, 2, FIELD_MAX)

/** Normalises kind-specific fields. `complete` demands everything required before review (drafts may be partial). */
export function contentFields(kind: ContentKind, value: unknown, complete: boolean): Fields {
  if (value == null) value = {}
  if (typeof value !== "object" || Array.isArray(value)) fail("Content fields must be an object.")
  const fields = value as Fields
  const keep = (keys: readonly string[], structured: readonly string[] = []) => {
    const out: Fields = {}
    for (const key of [...keys, ...structured]) {
      const v = fields[key]
      if (v === undefined || v === null || v === "") continue
      if (structured.includes(key)) { out[key] = v; continue }
      if (key === "aliases") { out.aliases = (Array.isArray(v) ? v : String(v).split("\n")).map((a) => String(a).trim()).filter(Boolean).slice(0, 30); continue }
      if (typeof v !== "string" || v.length > FIELD_MAX) fail(`Field ${key} must be text of at most ${FIELD_MAX} characters.`)
      out[key] = (v as string).trim()
    }
    for (const key of Object.keys(fields)) if (!keys.includes(key) && !structured.includes(key)) fail(`Field ${key} is not used by ${kind} content.`)
    return out
  }
  if (kind === "course") {
    const out = keep(["category", "estimated_minutes"], ["objectives", "modules"])
    if (out.category !== undefined) oneOf(out.category, COURSE_CATEGORIES, "course category")
    if (out.estimated_minutes !== undefined && !/^([1-9]\d{0,2})$/.test(String(out.estimated_minutes))) fail("Estimated learning time must be 1 to 999 minutes.")
    out.objectives = courseObjectives(out.objectives, complete)
    out.modules = courseModules(out.modules, complete)
    if (complete) oneOf(out.category, COURSE_CATEGORIES, "course category")
    return out
  }
  if (kind === "knowledge") {
    const out = keep(["question", "answer", "client_explanation", "limitations", "escalation_required", "escalation_condition", "escalation_route", "aliases", "topic"])
    if (out.topic !== undefined) oneOf(out.topic, KNOWLEDGE_TOPICS, "topic")
    if (out.escalation_required !== undefined) oneOf(out.escalation_required, ESCALATION_RULES, "escalation rule")
    if (out.escalation_route !== undefined) oneOf(out.escalation_route, MEETING_TYPES, "escalation meeting type")
    if (complete) {
      req(out, "question", "Question"); req(out, "answer", "Answer"); req(out, "client_explanation", "Client-friendly explanation (write \"none\" for partner-only entries)")
      req(out, "limitations", "Limitation"); oneOf(out.topic, KNOWLEDGE_TOPICS, "topic")
      const rule = oneOf(out.escalation_required, ESCALATION_RULES, "escalation rule")
      if (rule === "when") req(out, "escalation_condition", "Escalation condition")
      if (rule !== "never") oneOf(out.escalation_route, MEETING_TYPES, "escalation meeting type")
    }
    return out
  }
  if (kind === "objection") {
    // B1.5: partner-only explanation (guidance), client-safe language (client_line), limitation and escalation are separate fields
    // so the one thing a partner can copy to a client never contains internal policy.
    const out = keep(["category", "source_id", "concern", "client_line", "guidance", "limitation", "escalation_required", "escalation_condition", "escalation_route"], ["discovery_questions", "aliases", "related"])
    if (out.category !== undefined) oneOf(out.category, OBJECTION_CATEGORIES, "objection category")
    if (out.escalation_required !== undefined) oneOf(out.escalation_required, ESCALATION_RULES, "escalation rule")
    if (out.escalation_route !== undefined) oneOf(out.escalation_route, MEETING_TYPES, "escalation meeting type")
    if (out.source_id !== undefined && !/^[A-Z]{2,8}-[A-Z]{2,8}-\d{2}$/.test(String(out.source_id))) fail("Source ID must look like AP-OBJ-01.")
    for (const key of ["discovery_questions", "aliases"] as const) {
      if (out[key] === undefined) continue
      const list = (Array.isArray(out[key]) ? out[key] as unknown[] : String(out[key]).split("\n")).map((v) => String(v).trim()).filter(Boolean)
      if (list.length > 10) fail(`List at most 10 ${key === "aliases" ? "alternative phrasings" : "discovery questions"}.`)
      for (const v of list) if (v.length > 300 || /[\u0000-\u001f<>]/.test(v)) fail("Each list entry must be plain text of at most 300 characters.")
      if (list.length) out[key] = list; else delete out[key]
    }
    const related = relatedItems(out.related)
    if (related.length) out.related = related; else delete out.related
    if (typeof out.client_line === "string" && audienceLintHits("client_facing", [out.client_line]).length) fail(`The client-facing line must not contain partner-only terms (${audienceLintHits("client_facing", [out.client_line]).join(", ")}).`)
    if (complete) {
      oneOf(out.category, OBJECTION_CATEGORIES, "objection category")
      req(out, "concern", "Customer concern"); req(out, "client_line", "Recommended client-facing response"); req(out, "guidance", "Why this response is appropriate")
      req(out, "limitation", "Limitation")
      const rule = oneOf(out.escalation_required, ESCALATION_RULES, "escalation rule")
      if (rule === "when") req(out, "escalation_condition", "Escalation condition")
      if (rule !== "never") oneOf(out.escalation_route, MEETING_TYPES, "escalation meeting type")
    }
    return out
  }
  if (kind === "lesson") {
    const out = keep(["lesson_code", "course_code", "reading_minutes"], ["checks"])
    const checks = knowledgeChecks(out.checks, complete)
    if (checks.length) out.checks = checks; else delete out.checks
    if (out.lesson_code !== undefined && !/^C\d{2}-L\d{1,2}$/.test(String(out.lesson_code))) fail("Lesson codes look like C04-L3.")
    if (out.course_code !== undefined && !/^C\d{2}$/.test(String(out.course_code))) fail("Course codes look like C04.")
    if (out.reading_minutes !== undefined && !/^([1-9]|[1-5]\d|60)$/.test(String(out.reading_minutes))) fail("Reading time must be 1 to 60 minutes.")
    if (complete) { req(out, "lesson_code", "Lesson code"); req(out, "course_code", "Course code") }
    return out
  }
  if (kind === "resource") {
    const out = keep(["summary", "category"], ["related"])
    if (out.category !== undefined) oneOf(out.category, RESOURCE_CATEGORIES, "resource category")
    const related = relatedItems(out.related)
    if (related.length) out.related = related; else delete out.related
    if (complete) { req(out, "summary", "One-line summary"); oneOf(out.category, RESOURCE_CATEGORIES, "resource category") }
    return out
  }
  // An agreement is its title and full text only; nothing structured that could diverge from the accepted text.
  if (kind === "agreement") return keep([])
  return keep(["subject", "use_when"])
}

/** Every http(s) link must be HTTPS to an allow-listed host; relative links must be site-internal paths. */
export function linkProblems(body: string): string[] {
  const problems: string[] = []
  for (const match of body.matchAll(/\b(?:https?:\/\/|www\.)[^\s)<>"']+/gi)) {
    const raw = match[0].startsWith("www.") ? `https://${match[0]}` : match[0]
    let url: URL | null = null
    try { url = new URL(raw) } catch { problems.push(`Unreadable link: ${match[0]}`); continue }
    const host = url.hostname.toLowerCase()
    if (url.protocol !== "https:") problems.push(`Links must use HTTPS: ${match[0]}`)
    else if (url.username || url.password) problems.push(`Links must not carry credentials: ${match[0]}`)
    else if (!LINK_ALLOW_LIST.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) problems.push(`Link host is not on the allow-list: ${host}`)
  }
  for (const match of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = match[1]
    if (/^(javascript|data|vbscript|file):/i.test(target)) problems.push(`Unsafe link target: ${target}`)
    else if (!/^(https:\/\/|\/(?!\/)|#)/i.test(target)) problems.push(`Links must be HTTPS or site-internal paths: ${target}`)
  }
  return [...new Set(problems)]
}

/** Client-facing wording must not carry partner-only commercial language unless a founder overrides it with a reason. */
export function audienceLintHits(audience: ContentAudience, parts: readonly string[]): string[] {
  if (audience !== "client_facing") return []
  const haystack = parts.join("\n").toLowerCase()
  return CLIENT_BLOCKED_TERMS.filter((term) => new RegExp(`\\b${term.replace(/[-\s]/g, "[-\\s]")}\\b`, "i").test(haystack))
}

export interface SubmissionCheck { fields: Fields; sources: string[]; lintHits: string[] }
/** Everything a version must satisfy before review. Throws with a founder-readable reason; returns lint hits for the override decision. */
export function checkSubmission(input: { kind: ContentKind; audience: ContentAudience; cadenceMonths: number; title: string; body: string; fields: unknown; sources: unknown; lintOverrideReason?: unknown }): SubmissionCheck & { lintOverrideReason: string | null } {
  contentTitle(input.title)
  const fields = contentFields(input.kind, input.fields, true)
  const sources = sourceRefs(input.sources)
  if (!sources.length) fail("Add at least one source: no source, no content.")
  if (input.kind !== "knowledge" && input.kind !== "objection" && input.body.trim().length < 20) fail("The body must contain the content (at least 20 characters).")
  const problems = linkProblems([input.body, ...flatText(fields)].join("\n"))
  if (problems.length) fail(problems.join(" "))
  if (input.kind === "knowledge" && COMMERCIAL_TOPICS.includes(String(fields.topic)) && input.cadenceMonths !== REVIEW_CADENCES.commercial) fail("Commercial knowledge must use the 3-month review cadence.")
  if (input.kind === "agreement") {
    if (input.audience !== "partner_only" || input.cadenceMonths !== REVIEW_CADENCES.commercial) fail("Partner agreements are partner-only and reviewed on the commercial (3-month) cadence.")
    if (input.body.trim().length < 200) fail("An agreement must contain its full text.")
    // Software does not decide legal sufficiency: a founder must cite the legal review this text relies on.
    if (!sources.some((s) => /^legal:\S{3,}/.test(s))) fail("Cite the legal review of this agreement as a source starting legal: (for example legal:solicitor-review-2026-12).")
  }
  if (input.kind === "objection") {
    if (input.audience !== "partner_only") fail("Objection responses are partner-only; the client-facing line is the only text a partner copies to a client.")
    if (COMMERCIAL_OBJECTION_CATEGORIES.includes(String(fields.category)) && input.cadenceMonths !== REVIEW_CADENCES.commercial) fail("Commercial objection responses must use the 3-month review cadence.")
  }
  // The limitation and escalation condition list what must NOT be promised, so they are excluded from the claim check by design.
  const listText = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
  const claimHits = input.kind === "objection" ? unsupportedClaimHits([input.title, input.body, String(fields.concern ?? ""), String(fields.client_line ?? ""), String(fields.guidance ?? ""),
    ...listText(fields.discovery_questions), ...listText(fields.aliases)]).map((c) => `possible ${c}`) : []
  const lintHits = [...audienceLintHits(input.audience, [input.title, input.body, ...flatText(fields)]), ...claimHits]
  const lintOverrideReason = optionalText(input.lintOverrideReason, "Override reason", 2000)
  if (claimHits.length && (!lintOverrideReason || lintOverrideReason.length < 10)) fail(`This response may contain ${claimHits.map((c) => c.replace(/^possible /, "")).join(", ")}. Remove it, or record why the wording is safe for founder review (at least 10 characters).`)
  if (lintHits.length && (!lintOverrideReason || lintOverrideReason.length < 10)) fail(`Client-facing content mentions ${lintHits.join(", ")}. Remove it, or record why it is safe (at least 10 characters).`)
  return { fields, sources, lintHits, lintOverrideReason: lintHits.length ? lintOverrideReason : null }
}

const isoDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : fail("Enter the review date as YYYY-MM-DD.")
/** A review-by date must be after today and within the item's cadence (the database checks the same bound). */
export function reviewByDate(value: unknown, cadenceMonths: number, today = new Date()) {
  const date = isoDate(value)
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  const limit = new Date(start); limit.setUTCMonth(limit.getUTCMonth() + cadenceMonths)
  const chosen = Date.parse(`${date}T00:00:00Z`)
  if (chosen <= start) fail("The review date must be in the future.")
  if (chosen > limit.getTime()) fail(`The review date must be within ${cadenceMonths} months.`)
  return date
}

/**
 * AP-GOV-04. A founder may not approve their own version while another founder is active; with only one active founder they may,
 * if they record why. Returns whether a self-approval reason is required.
 */
export function approvalAuthority(input: { approverId: string; authorId: string; activeFounders: number; selfApprovalReason?: unknown }) {
  if (input.approverId !== input.authorId) {
    if (input.selfApprovalReason) fail("A self-approval reason applies only when approving your own version.")
    return { selfApprovalReason: null }
  }
  if (input.activeFounders > 1) throw new ContentError("Another active founder must approve content you wrote.", 403)
  const reason = optionalText(input.selfApprovalReason, "Self-approval reason", 2000)
  if (!reason || reason.length < 10) fail("You are the only active founder: record why you are approving your own version (at least 10 characters).")
  return { selfApprovalReason: reason }
}

/** Partner-facing serving rule, mirrored in SQL: published, inside its review window, and in an audience the reader may see. */
export function isServable(version: { status: string; review_by: string | null }, today = new Date()) {
  if (version.status !== "published" || !version.review_by) return false
  return version.review_by >= today.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------- Operation Empower B1.2: Academy rules
export const COURSE_CATEGORIES = ["getting-started", "services", "technical-knowledge", "digital-growth", "sales-fundamentals", "discovery", "commercial-policies", "professional-conduct", "advanced-opportunities"] as const
export type CourseCategory = (typeof COURSE_CATEGORIES)[number]
export const CHECK_TYPES = ["single", "multiple", "true_false"] as const
export type CheckType = (typeof CHECK_TYPES)[number]
export interface KnowledgeCheck { id: string; type: CheckType; prompt: string; options: { id: string; text: string }[]; answer: string[]; explanation: string }
export interface CourseModule { title: string; summary?: string; lessons: string[] }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Every string inside a fields object, for link and audience scanning of structured content. */
export function flatText(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(flatText)
  if (value && typeof value === "object") return Object.values(value).flatMap(flatText)
  return []
}

function courseObjectives(value: unknown, complete: boolean): string[] {
  const list = value == null ? [] : Array.isArray(value) ? value : typeof value === "string" ? value.split("\n") : fail("Learning objectives must be a list.")
  const out = list.map((o) => typeof o === "string" ? o.trim() : fail("Each objective must be text.")).filter(Boolean)
  if (out.length > 10) fail("List at most 10 learning objectives.")
  for (const o of out) if (o.length < 5 || o.length > 300) fail("Each learning objective must be 5 to 300 characters.")
  if (complete && !out.length) fail("Add at least one learning objective.")
  return out
}

function courseModules(value: unknown, complete: boolean): CourseModule[] {
  if (value == null) return complete ? fail("Add at least one module.") : []
  if (!Array.isArray(value)) fail("Modules must be a list.")
  const modules = value as unknown[]
  if (modules.length > 20) fail("A course can have at most 20 modules.")
  const seen = new Set<string>()
  const out = modules.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(`Module ${index + 1} is not valid.`)
    const m = raw as Record<string, unknown>
    for (const key of Object.keys(m)) if (!["title", "summary", "lessons"].includes(key)) fail(`Module field ${key} is not used.`)
    const title = text(m.title, `Module ${index + 1} title`, 3, 200)
    const summary = optionalText(m.summary, `Module ${index + 1} summary`, 1000)
    const lessons = m.lessons == null ? [] : Array.isArray(m.lessons) ? m.lessons : fail(`Module ${index + 1} lessons must be a list.`)
    if (lessons.length > 30) fail(`Module ${index + 1} can have at most 30 lessons.`)
    const ids = lessons.map((id) => typeof id === "string" && UUID.test(id.toLowerCase()) ? id.toLowerCase() : fail(`Module ${index + 1} contains an invalid lesson reference.`))
    for (const id of ids) { if (seen.has(id)) fail("A lesson can appear only once in a course."); seen.add(id) }
    if (complete && !ids.length) fail(`Module ${index + 1} needs at least one lesson.`)
    return summary ? { title, summary, lessons: ids } : { title, lessons: ids }
  })
  if (complete && !out.length) fail("Add at least one module.")
  return out
}

export const courseLessonIds = (fields: unknown): string[] => {
  const modules = (fields as { modules?: CourseModule[] } | null)?.modules
  return Array.isArray(modules) ? modules.flatMap((m) => Array.isArray(m.lessons) ? m.lessons : []) : []
}

/** Optional knowledge checks belong to a lesson version and are approved with it. No check is publishable without an answer and explanation. */
export function knowledgeChecks(value: unknown, complete: boolean): KnowledgeCheck[] {
  if (value == null || value === "") return []
  if (!Array.isArray(value)) fail("Knowledge checks must be a list.")
  const list = value as unknown[]
  if (list.length > 10) fail("A lesson can have at most 10 knowledge-check questions.")
  const ids = new Set<string>()
  return list.map((raw, index) => {
    const label = `Question ${index + 1}`
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(`${label} is not valid.`)
    const q = raw as Record<string, unknown>
    for (const key of Object.keys(q)) if (!["id", "type", "prompt", "options", "answer", "explanation"].includes(key)) fail(`${label}: field ${key} is not used.`)
    const id = typeof q.id === "string" && /^q\d{1,2}$/.test(q.id) ? q.id : fail(`${label} needs an id like q1.`)
    if (ids.has(id)) fail(`Question id ${id} is used twice.`)
    ids.add(id)
    const type = oneOf(q.type, CHECK_TYPES, `${label} type`)
    const prompt = text(q.prompt, `${label} prompt`, 5, 500)
    const rawOptions = type === "true_false" ? [{ id: "true", text: "True" }, { id: "false", text: "False" }] : Array.isArray(q.options) ? q.options : fail(`${label} needs options.`)
    if (rawOptions.length < 2 || rawOptions.length > 6) fail(`${label} needs 2 to 6 options.`)
    const optionIds = new Set<string>()
    const options = rawOptions.map((o, i) => {
      const opt = (o ?? {}) as Record<string, unknown>
      const oid = typeof opt.id === "string" && /^[a-z0-9_]{1,12}$/.test(opt.id) ? opt.id : fail(`${label} option ${i + 1} needs a short id.`)
      if (optionIds.has(oid)) fail(`${label} has a repeated option id.`)
      optionIds.add(oid)
      return { id: oid, text: text(opt.text, `${label} option ${i + 1}`, 1, 300) }
    })
    const answer = Array.isArray(q.answer) ? [...new Set(q.answer.map(String))] : q.answer == null || q.answer === "" ? [] : [String(q.answer)]
    for (const a of answer) if (!optionIds.has(a)) fail(`${label} answer must be one of its options.`)
    if (complete || answer.length) {
      if (!answer.length) fail(`${label} needs an approved answer before review.`)
      if (type !== "multiple" && answer.length !== 1) fail(`${label} must have exactly one correct answer.`)
      if (type === "multiple" && answer.length === options.length) fail(`${label}: not every option can be correct.`)
    }
    const explanation = complete ? text(q.explanation, `${label} explanation`, 5, 1000) : (optionalText(q.explanation, `${label} explanation`, 1000) ?? "")
    return { id, type, prompt, options, answer: answer.sort(), explanation }
  })
}

const looseChecks = (checks: unknown): KnowledgeCheck[] => Array.isArray(checks) ? checks as KnowledgeCheck[] : []
/** What a partner may see before answering: never the answer or the explanation. */
export const publicChecks = (checks: unknown) => looseChecks(checks).map(({ id, type, prompt, options }) => ({ id, type, prompt, options }))

/** Grades one answer. A multiple-choice question needs every correct option and no others. */
export function gradeCheck(checks: unknown, questionId: unknown, answer: unknown) {
  const question = looseChecks(checks).find((q) => q.id === questionId)
  if (!question) throw new ContentError("That question is not part of this lesson.", 404)
  const given = Array.isArray(answer) ? [...new Set(answer.map(String))].sort() : typeof answer === "string" && answer ? [answer] : []
  if (!given.length || given.length > 6 || given.some((g) => !question.options.some((o) => o.id === g))) throw new ContentError("Choose one of the listed answers.")
  if (question.type !== "multiple" && given.length !== 1) throw new ContentError("Choose one answer.")
  const correct = given.length === question.answer.length && given.every((g, i) => g === question.answer[i])
  return { questionId: question.id, given, correct, answer: question.answer, explanation: question.explanation }
}

// ---------------------------------------------------------------- Operation Empower B1.3: Resource Centre rules
export const RESOURCE_CATEGORIES = ["brochure", "guide", "checklist", "template", "reference"] as const
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]
export const SEARCH_QUERY_MAX = 200

/** Related lessons or resources, by item id (at most 10). Whether each is servable is decided when the resource is read. */
function relatedItems(value: unknown): string[] {
  if (value == null || value === "") return []
  const list = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\s,]+/) : fail("Related items must be a list.")
  const ids = [...new Set(list.map((v) => String(v).trim().toLowerCase()).filter(Boolean))]
  if (ids.length > 10) fail("Link at most 10 related items.")
  for (const id of ids) if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) fail("A related item reference is not valid.")
  return ids
}

/** Normalises a partner's search text. Returns null when there is nothing to search for. */
export function searchQuery(value: unknown): string | null {
  if (value == null) return null
  if (typeof value !== "string") fail("Search text must be text.")
  const cleaned = (value as string).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim()
  if (cleaned.length > SEARCH_QUERY_MAX) fail(`Search text must be at most ${SEARCH_QUERY_MAX} characters.`)
  return cleaned.length ? cleaned : null
}

export interface Synonym { term: string; expansion: string }
export const synonymTerm = (value: unknown) => {
  const term = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (term.length < 2 || term.length > 60 || !/^[a-z0-9][a-z0-9 .+-]*$/.test(term)) fail("A synonym term is 2 to 60 lowercase letters, numbers, spaces, dots, plus signs or hyphens.")
  return term
}
export const synonymExpansion = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : ""
  if (text.length < 2 || text.length > 200 || /[<>"\\]/.test(text)) fail("A synonym expansion is 2 to 200 characters of plain text.")
  return text
}

/**
 * Deterministic synonym expansion for websearch_to_tsquery: every active synonym whose term appears as a whole word or phrase
 * in the query adds "or <expansion>". The original query always stays first, so exact wording ranks highest.
 */
export function expandQuery(query: string, synonyms: readonly Synonym[]): string {
  const lower = ` ${query.toLowerCase().replace(/[^a-z0-9 .+-]/g, " ").replace(/\s+/g, " ")} `
  const additions: string[] = []
  for (const s of [...synonyms].sort((a, b) => a.term.localeCompare(b.term))) {
    // Expansions are founder text, but must still never change query meaning: no exclusions, no bare or/and operators.
    const safe = s.expansion.split(/\s+/).filter((w) => !/^(or|and)$/i.test(w)).map((w) => w.replace(/^-+/, "")).filter(Boolean).join(" ")
    if (safe && lower.includes(` ${s.term} `) && !additions.includes(safe)) additions.push(safe)
  }
  return [query, ...additions].join(" or ").slice(0, 600)
}
