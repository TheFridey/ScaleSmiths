export const FORGE_CLARIFICATION_VERSION = "2026-07-12.1"

export type ForgeClarificationUrgency = "low" | "medium" | "high" | "critical"
export type ForgeClarificationCategory = "service_area" | "credential" | "contact" | "pricing" | "testimonial" | "business_fact" | "compliance" | "content"
export type ForgeClarificationStatus = "open" | "answered" | "approved" | "dismissed" | "expired"

export interface ForgeKnownFact {
  key: string
  value: string
  category?: string
  approvedAt?: Date | string | null
  expiresAt?: Date | string | null
  revalidateAfter?: Date | string | null
}

export interface ForgeClarificationSignal {
  factKey?: string
  text: string
  sourceType: "intake" | "artifact" | "memory" | "planner" | "task"
  sourceDetail?: string
  taskId?: number | null
  artifactId?: number | null
  urgency?: ForgeClarificationUrgency
}

export interface ForgeClarificationQuestionDraft {
  factKey: string
  question: string
  category: ForgeClarificationCategory
  urgency: ForgeClarificationUrgency
  assignee: "client" | "internal" | "owner"
  groupKey: string
  duplicateKey: string
  evidence: string[]
  sourceType: ForgeClarificationSignal["sourceType"]
  sourceDetail?: string
  taskId?: number | null
  artifactId?: number | null
  expiresAt?: Date | null
  revalidateAfter?: Date | null
}

export interface ForgePersistedClarification {
  factKey: string
  status: ForgeClarificationStatus | string
  taskId?: number | null
  answer?: string | null
}

export interface ForgeClarificationInput {
  missingFacts?: ForgeClarificationSignal[]
  contradictoryFacts?: ForgeClarificationSignal[]
  timeSensitiveFacts?: ForgeClarificationSignal[]
  approvedFacts?: ForgeKnownFact[]
  existingQuestions?: ForgePersistedClarification[]
  now?: Date
}

const OPEN_STATUSES = new Set(["open", "answered"])

export function buildForgeClarificationQueue(input: ForgeClarificationInput): ForgeClarificationQuestionDraft[] {
  const now = input.now ?? new Date()
  const answeredKeys = new Set((input.approvedFacts ?? []).filter((fact) => factIsCurrentlyApproved(fact, now)).map((fact) => normalizeFactKey(fact.key)))
  const existingOpenKeys = new Set((input.existingQuestions ?? []).filter((item) => OPEN_STATUSES.has(item.status)).map((item) => normalizeFactKey(item.factKey)))
  const drafts = new Map<string, ForgeClarificationQuestionDraft>()

  for (const signal of [...(input.contradictoryFacts ?? []), ...(input.missingFacts ?? []), ...(input.timeSensitiveFacts ?? [])]) {
    const classified = classifyClarificationSignal(signal)
    const factKey = normalizeFactKey(signal.factKey ?? classified.factKey)
    if (!factKey || answeredKeys.has(factKey) || existingOpenKeys.has(factKey)) continue
    const duplicateKey = buildDuplicateKey(factKey, signal.taskId ?? null)
    if (drafts.has(duplicateKey)) {
      const existing = drafts.get(duplicateKey)
      if (existing) existing.evidence = uniqueStrings([...existing.evidence, signal.text])
      continue
    }
    drafts.set(duplicateKey, {
      factKey,
      question: classified.question,
      category: classified.category,
      urgency: signal.urgency ?? classified.urgency,
      assignee: classified.assignee,
      groupKey: classified.category,
      duplicateKey,
      evidence: [signal.text],
      sourceType: signal.sourceType,
      sourceDetail: signal.sourceDetail,
      taskId: signal.taskId ?? null,
      artifactId: signal.artifactId ?? null,
      expiresAt: classified.expiresAt ?? null,
      revalidateAfter: classified.revalidateAfter ?? null,
    })
  }

  return [...drafts.values()].sort((a, b) => urgencyRank(b.urgency) - urgencyRank(a.urgency) || a.category.localeCompare(b.category) || a.factKey.localeCompare(b.factKey))
}

export function taskCanResumeAfterClarifications({
  blockedTaskId,
  questions,
  approvedFacts,
  now = new Date(),
}: {
  blockedTaskId: number
  questions: ForgePersistedClarification[]
  approvedFacts: ForgeKnownFact[]
  now?: Date
}) {
  const relevant = questions.filter((question) => question.taskId === blockedTaskId)
  if (!relevant.length) return true
  const approvedKeys = new Set(approvedFacts.filter((fact) => factIsCurrentlyApproved(fact, now)).map((fact) => normalizeFactKey(fact.key)))
  return relevant.every((question) => question.status === "approved" && approvedKeys.has(normalizeFactKey(question.factKey)))
}

export function buildApprovedFactFromClarification({
  factKey,
  answer,
  category,
  questionId,
  taskId,
  artifactId,
  answeredBy,
  approvedBy,
  approvedAt = new Date(),
  expiresAt,
  revalidateAfter,
}: {
  factKey: string
  answer: string
  category: string
  questionId: number
  taskId?: number | null
  artifactId?: number | null
  answeredBy: string
  approvedBy: string
  approvedAt?: Date
  expiresAt?: Date | null
  revalidateAfter?: Date | null
}) {
  return {
    key: normalizeFactKey(factKey),
    value: answer.trim(),
    category,
    sourceType: "clarification_answer",
    sourceQuestionId: questionId,
    sourceTaskId: taskId ?? null,
    sourceArtifactId: artifactId ?? null,
    answeredBy,
    approvedBy,
    approvedAt,
    expiresAt: expiresAt ?? null,
    revalidateAfter: revalidateAfter ?? null,
    provenanceJson: {
      clarificationVersion: FORGE_CLARIFICATION_VERSION,
      questionId,
      approvedAt: approvedAt.toISOString(),
    },
  }
}

export function normalizeFactKey(value: string) {
  return value.trim().toLowerCase().replace(/['"]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

function classifyClarificationSignal(signal: ForgeClarificationSignal): Omit<ForgeClarificationQuestionDraft, "duplicateKey" | "evidence" | "sourceType"> {
  const text = signal.text.toLowerCase()
  if (text.includes("postcode") || text.includes("serve") || text.includes("service area") || text.includes("location")) {
    return template("service_areas", "Which postcode areas or locations should this project say you serve?", "service_area", "high", "client")
  }
  if (text.includes("accreditation") || text.includes("certification") || text.includes("licence") || text.includes("license")) {
    return template("current_accreditations", "Is this accreditation current, and may it be shown publicly?", "credential", "high", "client")
  }
  if (text.includes("phone") || text.includes("telephone") || text.includes("mobile")) {
    return template("authoritative_phone_number", "Which phone number is authoritative for this website?", "contact", "critical", "client")
  }
  if (text.includes("price") || text.includes("pricing") || text.includes("quote") || text.includes("cost")) {
    return template("public_pricing_policy", "Are these prices public, indicative, or quote-only?", "pricing", "high", "client")
  }
  if (text.includes("testimonial") || text.includes("review")) {
    return template("testimonial_publication_permission", "May this testimonial or review be published on the website?", "testimonial", "high", "client")
  }
  if (text.includes("claim") || text.includes("guarantee") || text.includes("years") || text.includes("award")) {
    return template("claim_evidence", "What evidence supports this claim, or should it be removed?", "compliance", "high", "internal")
  }
  return template(signal.factKey ?? signal.text, `Please confirm the authoritative ${humaniseFactLabel(signal.factKey ?? signal.text)}.`, "business_fact", signal.urgency ?? "medium", "client")
}

function template(factKey: string, question: string, category: ForgeClarificationCategory, urgency: ForgeClarificationUrgency, assignee: "client" | "internal" | "owner") {
  return {
    factKey: normalizeFactKey(factKey),
    question,
    category,
    urgency,
    assignee,
    groupKey: category,
    taskId: null,
    artifactId: null,
    expiresAt: null,
    revalidateAfter: category === "credential" || category === "pricing" ? addDays(new Date(), 180) : null,
    sourceDetail: undefined,
  }
}

function factIsCurrentlyApproved(fact: ForgeKnownFact, now: Date) {
  if (!fact.value.trim()) return false
  const expiresAt = dateOrNull(fact.expiresAt)
  if (expiresAt && expiresAt <= now) return false
  const revalidateAfter = dateOrNull(fact.revalidateAfter)
  if (revalidateAfter && revalidateAfter <= now) return false
  return true
}

function buildDuplicateKey(factKey: string, taskId: number | null) {
  return `${taskId ?? "project"}:${normalizeFactKey(factKey)}`
}

function urgencyRank(value: ForgeClarificationUrgency) {
  return { low: 0, medium: 1, high: 2, critical: 3 }[value]
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function humaniseFactLabel(value: string) {
  return normalizeFactKey(value).replace(/_/g, " ") || "missing business fact"
}

function dateOrNull(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy
}
