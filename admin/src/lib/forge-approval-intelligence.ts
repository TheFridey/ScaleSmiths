export const FORGE_APPROVAL_DECISIONS = ["approved", "rejected"] as const
export const FORGE_REJECTION_CATEGORIES = [
  "factual_accuracy",
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
export const FORGE_REJECTION_SEVERITIES = ["low", "medium", "high", "critical"] as const
export const FORGE_ACCEPTANCE_SCOPES = ["full_rejection", "partial_acceptance"] as const

export type ForgeApprovalDecision = (typeof FORGE_APPROVAL_DECISIONS)[number]
export type ForgeRejectionCategory = (typeof FORGE_REJECTION_CATEGORIES)[number]
export type ForgeRejectionSeverity = (typeof FORGE_REJECTION_SEVERITIES)[number]
export type ForgeAcceptanceScope = (typeof FORGE_ACCEPTANCE_SCOPES)[number]

export interface ForgeArtifactDecisionInput {
  decision?: unknown
  primaryReason?: unknown
  reason?: unknown
  category?: unknown
  severity?: unknown
  clientCorrection?: unknown
  internalNote?: unknown
  affectsFutureRegeneration?: unknown
  projectSpecific?: unknown
  reusableAcrossProjects?: unknown
  acceptanceScope?: unknown
  pagePath?: unknown
}

export interface ForgeArtifactDecision {
  decision: ForgeApprovalDecision
  primaryReason: string
  category: ForgeRejectionCategory
  severity: ForgeRejectionSeverity
  clientSuppliedCorrection: string | null
  internalNote: string | null
  affectsFutureRegeneration: boolean
  projectSpecific: boolean
  reusableAcrossProjects: boolean
  acceptanceScope: ForgeAcceptanceScope
  pagePath: string | null
  decidedBy: string
  decidedAt: string
}

export interface ForgeApprovalIntelligenceArtifact {
  id?: number
  projectId?: number
  type: string
  title: string
  approvalState: string
  approvalHistory: Array<Record<string, unknown>>
  provider?: string | null
  model?: string | null
  qualityState?: string | null
  sourceTaskId?: number | null
  createdAt?: Date | string | null
  metadataJson?: Record<string, unknown> | null
}

export interface ForgeApprovalIntelligenceProject {
  id: number
  status?: string | null
  projectType?: string | null
  industry?: string | null
}

export function parseForgeArtifactDecision(input: ForgeArtifactDecisionInput, actor: string, now = new Date()): ForgeArtifactDecision {
  const decision = input.decision === "approved" ? "approved" : "rejected"
  const primaryReason = requiredString(input.primaryReason ?? input.reason, decision === "approved" ? "Approved after review." : "A rejection reason is required.")
  const category = isCategory(input.category) ? input.category : inferCategory(primaryReason)
  const severity = isSeverity(input.severity) ? input.severity : category === "factual_accuracy" || category === "compliance" ? "high" : "medium"
  const acceptanceScope = isAcceptanceScope(input.acceptanceScope) ? input.acceptanceScope : decision === "approved" ? "partial_acceptance" : "full_rejection"
  const projectSpecific = input.projectSpecific === undefined ? true : input.projectSpecific === true
  const reusableAcrossProjects = input.reusableAcrossProjects === true && !projectSpecific
  return {
    decision,
    primaryReason,
    category,
    severity,
    clientSuppliedCorrection: optionalString(input.clientCorrection),
    internalNote: optionalString(input.internalNote),
    affectsFutureRegeneration: input.affectsFutureRegeneration !== false,
    projectSpecific,
    reusableAcrossProjects,
    acceptanceScope,
    pagePath: optionalString(input.pagePath),
    decidedBy: actor,
    decidedAt: now.toISOString(),
  }
}

export function appendArtifactDecision(metadata: Record<string, unknown> | null | undefined, history: Array<Record<string, unknown>> | null | undefined, decision: ForgeArtifactDecision) {
  const previous = Array.isArray(metadata?.approvalDecisionHistory) ? metadata.approvalDecisionHistory as unknown[] : []
  const entry = { state: decision.decision, actor: decision.decidedBy, reason: decision.primaryReason, at: decision.decidedAt, approvalDecision: decision }
  return {
    metadataJson: {
      ...(metadata ?? {}),
      approvalDecision: decision,
      approvalDecisionHistory: [...previous, decision],
    },
    approvalHistory: [...(history ?? []), entry],
  }
}

export function summarizeForgeApprovalIntelligence(artifacts: ForgeApprovalIntelligenceArtifact[], projects: ForgeApprovalIntelligenceProject[] = []) {
  const projectById = new Map(projects.map((project) => [project.id, project]))
  const rows = artifacts.map((artifact) => ({ artifact, decisions: readArtifactDecisions(artifact) }))
  const rejected = rows.flatMap(({ artifact, decisions }) => decisions.filter((decision) => decision.decision === "rejected").map((decision) => ({ artifact, decision })))
  const approved = rows.flatMap(({ artifact, decisions }) => decisions.filter((decision) => decision.decision === "approved").map((decision) => ({ artifact, decision })))

  return {
    totalArtifacts: artifacts.length,
    totalDecisions: rejected.length + approved.length,
    mostCommonRejectionReasons: top(rejected, (row) => row.decision.primaryReason.toLowerCase()),
    rejectionRateByForgeAgent: rateBy(artifacts, rejected, (item) => "decision" in item ? item.artifact.type : item.type),
    rejectionRateByModel: rateBy(artifacts.filter((artifact) => artifact.model), rejected.filter((row) => row.artifact.model), (item) => ("decision" in item ? item.artifact.model : item.model) ?? "unknown"),
    rejectionRateByProvider: rateBy(artifacts.filter((artifact) => artifact.provider), rejected.filter((row) => row.artifact.provider), (item) => ("decision" in item ? item.artifact.provider : item.provider) ?? "unknown"),
    rejectionRateByProjectType: rateBy(
      artifacts.filter((artifact) => artifact.projectId && projectById.has(artifact.projectId)),
      rejected.filter((row) => row.artifact.projectId && projectById.has(row.artifact.projectId)),
      (item) => {
        const artifact = "decision" in item ? item.artifact : item
        const project = artifact.projectId ? projectById.get(artifact.projectId) : null
        return project?.projectType ?? project?.industry ?? "unknown"
      },
    ),
    regenerationSuccessRate: regenerationSuccessRate(artifacts),
    averageRevisionsBeforeApproval: averageRevisionsBeforeApproval(artifacts),
    averageTimeToApprovalMinutes: averageTimeToApprovalMinutes(artifacts),
    fallbackOutputApprovalRate: fallbackOutputApprovalRate(artifacts),
  }
}

export function readArtifactDecisions(artifact: ForgeApprovalIntelligenceArtifact): ForgeArtifactDecision[] {
  const metadataHistory = Array.isArray(artifact.metadataJson?.approvalDecisionHistory) ? artifact.metadataJson.approvalDecisionHistory : []
  const approvalHistory = artifact.approvalHistory.flatMap((entry) => entry.approvalDecision ? [entry.approvalDecision] : [])
  return [...metadataHistory, ...approvalHistory].filter(isDecision)
}

function requiredString(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value.trim() : ""
  if (text.length >= 3) return text.slice(0, 1000)
  if (fallback.startsWith("A rejection")) throw new Error(fallback)
  return fallback
}
function optionalString(value: unknown) { const text = typeof value === "string" ? value.trim() : ""; return text ? text.slice(0, 2000) : null }
function isCategory(value: unknown): value is ForgeRejectionCategory { return typeof value === "string" && (FORGE_REJECTION_CATEGORIES as readonly string[]).includes(value) }
function isSeverity(value: unknown): value is ForgeRejectionSeverity { return typeof value === "string" && (FORGE_REJECTION_SEVERITIES as readonly string[]).includes(value) }
function isAcceptanceScope(value: unknown): value is ForgeAcceptanceScope { return typeof value === "string" && (FORGE_ACCEPTANCE_SCOPES as readonly string[]).includes(value) }
function inferCategory(text: string): ForgeRejectionCategory {
  const value = text.toLowerCase()
  if (/fact|wrong|phone|address|price|claim|testimonial|guarantee/.test(value)) return "factual_accuracy"
  if (/tone|voice|generic|ai|bland|vague/.test(value)) return /generic|ai|vague/.test(value) ? "generic_output" : "tone"
  if (/design|colour|color|font|style/.test(value)) return "design_preference"
  if (/layout|spacing|mobile|section/.test(value)) return "layout"
  if (/cta|conversion|lead|quote|book/.test(value)) return "conversion"
  if (/seo|keyword|meta|search/.test(value)) return "seo"
  if (/legal|privacy|accessibility|compliance|wcag/.test(value)) return "compliance"
  if (/client|customer|requested|feedback/.test(value)) return "client_request"
  if (/bug|build|error|broken|technical/.test(value)) return "technical_issue"
  if (/missing|empty|add|omitted/.test(value)) return "missing_content"
  return "client_request"
}
function isDecision(value: unknown): value is ForgeArtifactDecision {
  return Boolean(value && typeof value === "object" && (value as Record<string, unknown>).decision && (value as Record<string, unknown>).primaryReason)
}
function countBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>()
  for (const item of items) { const k = key(item); if (k) counts.set(k, (counts.get(k) ?? 0) + 1) }
  return counts
}
function top<T>(items: T[], key: (item: T) => string) {
  return [...countBy(items, key).entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([value, count]) => ({ value, count }))
}
function rateBy<TBase, TRejected>(base: TBase[], rejected: TRejected[], key: (item: TBase | TRejected) => string) {
  const totals = countBy(base, (item) => key(item))
  const failures = countBy(rejected, (item) => key(item))
  return [...totals.entries()].map(([value, total]) => {
    const rejectedCount = failures.get(value) ?? 0
    return { value, total, rejected: rejectedCount, rate: total ? Number((rejectedCount / total).toFixed(4)) : 0 }
  }).sort((a, b) => b.rate - a.rate)
}
function regenerationSuccessRate(artifacts: ForgeApprovalIntelligenceArtifact[]) {
  const byKey = groupArtifacts(artifacts)
  let attempts = 0, successes = 0
  for (const versions of byKey.values()) {
    const sorted = versions.sort((a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0))
    for (let i = 0; i < sorted.length - 1; i += 1) if (readArtifactDecisions(sorted[i]).some((d) => d.decision === "rejected")) {
      attempts += 1
      if (readArtifactDecisions(sorted.slice(i + 1).find((a) => a.approvalState === "approved") ?? sorted[i]).some((d) => d.decision === "approved")) successes += 1
    }
  }
  return attempts ? Number((successes / attempts).toFixed(4)) : null
}
function averageRevisionsBeforeApproval(artifacts: ForgeApprovalIntelligenceArtifact[]) {
  const counts: number[] = []
  for (const versions of groupArtifacts(artifacts).values()) {
    const approvedIndex = versions.sort((a, b) => (a.createdAt ? new Date(a.createdAt).getTime() : 0) - (b.createdAt ? new Date(b.createdAt).getTime() : 0)).findIndex((artifact) => artifact.approvalState === "approved")
    if (approvedIndex >= 0) counts.push(approvedIndex)
  }
  return counts.length ? Number(avg(counts).toFixed(2)) : null
}
function averageTimeToApprovalMinutes(artifacts: ForgeApprovalIntelligenceArtifact[]) {
  const values = artifacts.flatMap((artifact) => readArtifactDecisions(artifact).filter((d) => d.decision === "approved").map((d) => {
    const start = artifact.createdAt ? new Date(artifact.createdAt).getTime() : Number.NaN
    const end = new Date(d.decidedAt).getTime()
    return Number.isNaN(start) || Number.isNaN(end) ? null : Math.max(0, Math.round((end - start) / 60000))
  }).filter((v): v is number => typeof v === "number"))
  return values.length ? Math.round(avg(values)) : null
}
function fallbackOutputApprovalRate(artifacts: ForgeApprovalIntelligenceArtifact[]) {
  const fallback = artifacts.filter((artifact) => artifact.qualityState === "fallback")
  if (!fallback.length) return null
  const approved = fallback.filter((artifact) => readArtifactDecisions(artifact).some((decision) => decision.decision === "approved")).length
  return Number((approved / fallback.length).toFixed(4))
}
function groupArtifacts(artifacts: ForgeApprovalIntelligenceArtifact[]) {
  const groups = new Map<string, ForgeApprovalIntelligenceArtifact[]>()
  for (const artifact of artifacts) {
    const key = `${artifact.projectId ?? "global"}:${artifact.type}:${artifact.title}`
    groups.set(key, [...(groups.get(key) ?? []), artifact])
  }
  return groups
}
function avg(values: number[]) { return values.reduce((sum, value) => sum + value, 0) / values.length }
