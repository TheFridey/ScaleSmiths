export const FORGE_HUMAN_EDIT_CATEGORIES = [
  "factual_correction",
  "tone",
  "design_preference",
  "layout",
  "conversion",
  "seo",
  "compliance",
  "client_request",
  "technical_issue",
  "generic_output",
  "missing_content",
] as const

export type ForgeHumanEditCategory = (typeof FORGE_HUMAN_EDIT_CATEGORIES)[number]

export interface ForgeHumanEditTracking {
  generatedVersion: number
  humanEditedVersion: number | null
  finalApprovedVersion: number | null
  editor: string
  editedAt: string
  approvedAt: string | null
  reason: string
  categories: ForgeHumanEditCategory[]
  approximateEditDistance: number
  normalizedEditDistance: number
  timeFromGenerationToApprovalMinutes: number | null
  correctedFactualProblem: boolean
  correctedQualityProblem: boolean
  provider: string | null
  model: string | null
  stage: string
}

export interface ForgeHumanEditArtifactInput {
  id?: number
  type: string
  title: string
  version: number
  content: string | null
  metadataJson: Record<string, unknown> | null
  provider?: string | null
  model?: string | null
  createdAt?: Date | string | null
}

export interface ForgeHumanEditReportRow {
  stage: string
  provider: string | null
  model: string | null
  editCount: number
  averageEditDistance: number
  averageNormalizedEditDistance: number
  averageApprovalMinutes: number | null
  factualCorrections: number
  qualityCorrections: number
  topCategories: Array<{ category: ForgeHumanEditCategory; count: number }>
}

export function buildForgeHumanEditTracking(input: {
  artifact: ForgeHumanEditArtifactInput
  approvedContent: string
  editor: string
  reason?: string | null
  now?: Date
}): ForgeHumanEditTracking {
  const now = input.now ?? new Date()
  const generatedContent = input.artifact.content ?? ""
  const reason = normalizeReason(input.reason, input.artifact.type)
  const categories = inferForgeHumanEditCategories(reason, generatedContent, input.approvedContent)
  const distance = approximateEditDistance(generatedContent, input.approvedContent)
  const baseLength = Math.max(generatedContent.length, input.approvedContent.length, 1)
  const createdAt = input.artifact.createdAt ? new Date(input.artifact.createdAt) : null
  const minutes = createdAt && !Number.isNaN(createdAt.getTime())
    ? Math.max(0, Math.round((now.getTime() - createdAt.getTime()) / 60_000))
    : null
  const changed = distance > 0
  return {
    generatedVersion: input.artifact.version,
    humanEditedVersion: changed ? input.artifact.version : null,
    finalApprovedVersion: input.artifact.version,
    editor: input.editor,
    editedAt: now.toISOString(),
    approvedAt: now.toISOString(),
    reason,
    categories,
    approximateEditDistance: distance,
    normalizedEditDistance: Number((distance / baseLength).toFixed(4)),
    timeFromGenerationToApprovalMinutes: minutes,
    correctedFactualProblem: categories.includes("factual_correction") || categories.includes("compliance"),
    correctedQualityProblem: categories.some((category) => ["tone", "design_preference", "layout", "conversion", "seo", "technical_issue", "generic_output", "missing_content"].includes(category)),
    provider: input.artifact.provider ?? providerFromMetadata(input.artifact.metadataJson),
    model: input.artifact.model ?? modelFromMetadata(input.artifact.metadataJson),
    stage: input.artifact.type,
  }
}

export function mergeHumanEditTracking(metadata: Record<string, unknown> | null | undefined, tracking: ForgeHumanEditTracking) {
  const previous = Array.isArray(metadata?.humanEditHistory) ? metadata.humanEditHistory as unknown[] : []
  return {
    ...(metadata ?? {}),
    humanEditTracking: tracking,
    humanEditHistory: [...previous, tracking],
  }
}

export function inferForgeHumanEditCategories(reason: string, before: string, after: string): ForgeHumanEditCategory[] {
  const text = `${reason} ${beforeDiffCue(before, after)}`.toLowerCase()
  const categories = new Set<ForgeHumanEditCategory>()
  if (/(fact|incorrect|wrong|address|phone|price|credential|insured|guarantee|stat|testimonial|accredit|legal)/.test(text)) categories.add("factual_correction")
  if (/(tone|voice|wording|friendly|formal|human|brand)/.test(text)) categories.add("tone")
  if (/(design|style|colour|color|font|animation|visual)/.test(text)) categories.add("design_preference")
  if (/(layout|spacing|section|order|responsive|mobile|grid)/.test(text)) categories.add("layout")
  if (/(cta|conversion|enquiry|quote|book|lead|contact)/.test(text)) categories.add("conversion")
  if (/(seo|keyword|meta|title|search|schema|local)/.test(text)) categories.add("seo")
  if (/(compliance|privacy|cookie|terms|accessibility|wcag|legal)/.test(text)) categories.add("compliance")
  if (/(client|customer asked|requested|feedback|brief)/.test(text)) categories.add("client_request")
  if (/(bug|build|type|lint|broken|error|technical|api|form)/.test(text)) categories.add("technical_issue")
  if (/(generic|ai|vague|bland|competitor|superlative|filler)/.test(text)) categories.add("generic_output")
  if (/(missing|add|omitted|gap|empty|absent)/.test(text)) categories.add("missing_content")
  if (!categories.size && approximateEditDistance(before, after) > 0) categories.add("client_request")
  return [...categories]
}

export function summarizeForgeHumanEdits(artifacts: ForgeHumanEditArtifactInput[]): ForgeHumanEditReportRow[] {
  const edits = artifacts.flatMap((artifact) => readEditHistory(artifact.metadataJson).map((edit) => ({
    ...edit,
    stage: edit.stage || artifact.type,
    provider: edit.provider ?? artifact.provider ?? null,
    model: edit.model ?? artifact.model ?? null,
  })))
  const groups = new Map<string, typeof edits>()
  for (const edit of edits) {
    const key = `${edit.stage}\u0000${edit.provider ?? ""}\u0000${edit.model ?? ""}`
    groups.set(key, [...(groups.get(key) ?? []), edit])
  }
  return [...groups.entries()].map(([key, values]) => {
    const [stage, provider, model] = key.split("\u0000")
    const approvalTimes = values.map((value) => value.timeFromGenerationToApprovalMinutes).filter((value): value is number => typeof value === "number")
    return {
      stage,
      provider: provider || null,
      model: model || null,
      editCount: values.length,
      averageEditDistance: Math.round(avg(values.map((value) => value.approximateEditDistance))),
      averageNormalizedEditDistance: Number(avg(values.map((value) => value.normalizedEditDistance)).toFixed(4)),
      averageApprovalMinutes: approvalTimes.length ? Math.round(avg(approvalTimes)) : null,
      factualCorrections: values.filter((value) => value.correctedFactualProblem).length,
      qualityCorrections: values.filter((value) => value.correctedQualityProblem).length,
      topCategories: topCategories(values),
    }
  }).sort((a, b) => b.averageNormalizedEditDistance - a.averageNormalizedEditDistance)
}

export function readEditHistory(metadata: Record<string, unknown> | null | undefined): ForgeHumanEditTracking[] {
  if (!metadata) return []
  const history = Array.isArray(metadata.humanEditHistory) ? metadata.humanEditHistory : metadata.humanEditTracking ? [metadata.humanEditTracking] : []
  return history.filter(isHumanEditTracking)
}

export function approximateEditDistance(before: string, after: string): number {
  if (before === after) return 0
  if (Math.max(before.length, after.length) > 4_000) return approximateLargeEditDistance(before, after)
  const a = before
  const b = after
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = a[i - 1] === b[j - 1]
        ? previous[j - 1]
        : Math.min(previous[j - 1], previous[j], current[j - 1]) + 1
    }
    previous = current
  }
  return previous[b.length]
}

function approximateLargeEditDistance(before: string, after: string) {
  const beforeWords = wordCounts(before)
  const afterWords = wordCounts(after)
  const keys = new Set([...beforeWords.keys(), ...afterWords.keys()])
  let delta = Math.abs(before.length - after.length)
  for (const key of keys) delta += Math.abs((beforeWords.get(key) ?? 0) - (afterWords.get(key) ?? 0))
  return delta
}

function wordCounts(value: string) {
  const counts = new Map<string, number>()
  for (const word of value.toLowerCase().match(/\b[a-z0-9][a-z0-9'-]{1,40}\b/g) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1)
  return counts
}

function readString(value: unknown) { return typeof value === "string" ? value : null }
function providerFromMetadata(metadata: Record<string, unknown> | null | undefined) { return readString((metadata?.ai as Record<string, unknown> | undefined)?.provider) }
function modelFromMetadata(metadata: Record<string, unknown> | null | undefined) { return readString((metadata?.ai as Record<string, unknown> | undefined)?.model) }
function normalizeReason(reason: string | null | undefined, stage: string) { return reason?.trim() || `Reviewed and approved ${stage} output.` }
function beforeDiffCue(before: string, after: string) { return before === after ? "" : `${before.slice(0, 500)} ${after.slice(0, 500)}` }
function avg(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }
function topCategories(values: ForgeHumanEditTracking[]) {
  const counts = new Map<ForgeHumanEditCategory, number>()
  for (const value of values) for (const category of value.categories) counts.set(category, (counts.get(category) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, count]) => ({ category, count }))
}
function isHumanEditTracking(value: unknown): value is ForgeHumanEditTracking {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return typeof item.editor === "string" && typeof item.editedAt === "string" && typeof item.approximateEditDistance === "number" && Array.isArray(item.categories)
}
