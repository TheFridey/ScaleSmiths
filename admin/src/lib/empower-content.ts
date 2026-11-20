/*
 * Operation Empower B1.1: pure rules for founder-controlled partner content. No database, no I/O, so every rule is unit-tested.
 * The database enforces the lifecycle, immutability, approval evidence and review cadence independently (migration 0091);
 * these checks give founders clear messages before a write and cover what SQL cannot express (field shapes, wording, links).
 */
import { ExpansionError } from "./expansion"
import { MEETING_TYPES } from "./expansion-operations"

export const CONTENT_KINDS = ["resource", "lesson", "knowledge", "objection", "template"] as const
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
  "accessibility", "e-commerce", "booking-systems", "crm", "custom-software", "automation", "commercial-terms", "payment-schedules", "commission", "client-onboarding",
] as const
/** Commercial topics must use the 3-month cadence. */
export const COMMERCIAL_TOPICS: readonly string[] = ["commercial-terms", "payment-schedules", "commission"]
export const ESCALATION_RULES = ["always", "when", "never"] as const
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
  const keep = (keys: readonly string[]) => {
    const out: Fields = {}
    for (const key of keys) {
      const v = fields[key]
      if (v === undefined || v === null || v === "") continue
      if (key === "aliases") { out.aliases = (Array.isArray(v) ? v : String(v).split("\n")).map((a) => String(a).trim()).filter(Boolean).slice(0, 30); continue }
      if (typeof v !== "string" || v.length > FIELD_MAX) fail(`Field ${key} must be text of at most ${FIELD_MAX} characters.`)
      out[key] = (v as string).trim()
    }
    for (const key of Object.keys(fields)) if (!keys.includes(key)) fail(`Field ${key} is not used by ${kind} content.`)
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
    const out = keep(["concern", "clarifying_question", "guidance", "client_line", "limitation", "escalation", "resource"])
    if (complete) for (const [key, label] of [["concern", "Customer concern"], ["guidance", "Partner guidance"], ["client_line", "Client-facing line"], ["limitation", "Limitation"], ["escalation", "Escalation"]]) req(out, key, label)
    return out
  }
  if (kind === "lesson") {
    const out = keep(["lesson_code", "course_code", "reading_minutes"])
    if (out.lesson_code !== undefined && !/^C\d{2}-L\d{1,2}$/.test(String(out.lesson_code))) fail("Lesson codes look like C04-L3.")
    if (out.course_code !== undefined && !/^C\d{2}$/.test(String(out.course_code))) fail("Course codes look like C04.")
    if (out.reading_minutes !== undefined && !/^([1-9]|[1-5]\d|60)$/.test(String(out.reading_minutes))) fail("Reading time must be 1 to 60 minutes.")
    if (complete) { req(out, "lesson_code", "Lesson code"); req(out, "course_code", "Course code") }
    return out
  }
  return keep(kind === "resource" ? ["summary", "category"] : ["subject", "use_when"])
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
  const problems = linkProblems([input.body, ...Object.values(fields).map(String)].join("\n"))
  if (problems.length) fail(problems.join(" "))
  if (input.kind === "knowledge" && COMMERCIAL_TOPICS.includes(String(fields.topic)) && input.cadenceMonths !== REVIEW_CADENCES.commercial) fail("Commercial knowledge must use the 3-month review cadence.")
  const lintHits = audienceLintHits(input.audience, [input.title, input.body, ...Object.values(fields).map(String)])
  const lintOverrideReason = optionalText(input.lintOverrideReason, "Override reason", 2000)
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
