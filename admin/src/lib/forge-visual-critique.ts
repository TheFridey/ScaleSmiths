import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import type { ForgeComponentSpecification } from "./forge-component-spec"
import type { ForgeCopyDocument } from "./forge-copy"
import type { ForgeDesignDirection } from "./forge-design"
import type { ForgeGeneratedCodeSummary } from "./forge-frontend-code"
import { validateJsonSchemaValue } from "./forge-ai"

export const FORGE_VISUAL_CRITIQUE_ARTIFACT_TITLE = "Visual Critique Report"
export const FORGE_VISUAL_CRITIQUE_ARTIFACT_KIND = "forge_visual_critique"

export const FORGE_VISUAL_CRITIQUE_SEVERITIES = ["Low", "Medium", "High"] as const
export const FORGE_VISUAL_CRITIQUE_SAFE_FIX_TYPES = ["spacing", "section_ordering", "cta_positioning", "trust_section_placement", "none"] as const

export type ForgeVisualCritiqueSeverity = (typeof FORGE_VISUAL_CRITIQUE_SEVERITIES)[number]
export type ForgeVisualCritiqueSafeFixType = (typeof FORGE_VISUAL_CRITIQUE_SAFE_FIX_TYPES)[number]
export type ForgeVisualCritiqueStatus = "draft" | "approved" | "empty"

export interface ForgeVisualCritiqueScores extends Record<string, JsonValue> {
  brandFit: number
  visualQuality: number
  ctaRelevance: number
  contentSpecificity: number
  seoAeoQuality: number
  accessibility: number
  mobileReadiness: number
  clientReadiness: number
}

export interface ForgeVisualCritiqueIssue extends Record<string, JsonValue> {
  category: string
  severity: ForgeVisualCritiqueSeverity
  finding: string
  evidence: string
}

export interface ForgeVisualCritiqueRecommendation extends Record<string, JsonValue> {
  title: string
  category: string
  severity: ForgeVisualCritiqueSeverity
  rationale: string
  safeAutoFix: boolean
  safeFixType: ForgeVisualCritiqueSafeFixType
}

export interface ForgeVisualCritiqueReport extends Record<string, JsonValue> {
  kind: typeof FORGE_VISUAL_CRITIQUE_ARTIFACT_KIND
  status: Exclude<ForgeVisualCritiqueStatus, "empty">
  overallScore: number
  scores: ForgeVisualCritiqueScores
  strengths: string[]
  weaknesses: ForgeVisualCritiqueIssue[]
  recommendations: ForgeVisualCritiqueRecommendation[]
  summary: string
  generatedAt: string
  approvedAt: string | null
  approvedBy: string | null
  autoFixAppliedAt: string | null
  autoFixesApplied: string[]
}

export interface ForgeVisualCritiqueApprovalRecord extends Record<string, JsonValue> {
  actor: string
  timestamp: string
  reason: string
  previousQualityState: "requires_review" | "validated" | "failed"
  resultingQualityState: "validated"
  relevantArtifacts: number[]
  overridePolicy: string | null
  downstreamImpact: string
}

export interface ForgeVisualCritiqueArtifactState {
  report: ForgeVisualCritiqueReport | null
  status: ForgeVisualCritiqueStatus
  score: number | null
  approvedAt: string | null
  approvedBy: string | null
  autoFixAppliedAt: string | null
}

export interface ForgeVisualCritiqueDraft extends Record<string, JsonValue> {
  overallScore: number
  scores: ForgeVisualCritiqueScores
  strengths: string[]
  weaknesses: ForgeVisualCritiqueIssue[]
  recommendations: ForgeVisualCritiqueRecommendation[]
  summary: string
}

export const FORGE_VISUAL_CRITIQUE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overallScore", "scores", "strengths", "weaknesses", "recommendations", "summary"],
  properties: {
    overallScore: { type: "integer" },
    scores: {
      type: "object",
      additionalProperties: false,
      required: ["brandFit", "visualQuality", "ctaRelevance", "contentSpecificity", "seoAeoQuality", "accessibility", "mobileReadiness", "clientReadiness"],
      properties: {
        brandFit: { type: "integer" },
        visualQuality: { type: "integer" },
        ctaRelevance: { type: "integer" },
        contentSpecificity: { type: "integer" },
        seoAeoQuality: { type: "integer" },
        accessibility: { type: "integer" },
        mobileReadiness: { type: "integer" },
        clientReadiness: { type: "integer" },
      },
    },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "severity", "finding", "evidence"],
        properties: {
          category: { type: "string" },
          severity: { type: "string", enum: [...FORGE_VISUAL_CRITIQUE_SEVERITIES] },
          finding: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "category", "severity", "rationale", "safeAutoFix", "safeFixType"],
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          severity: { type: "string", enum: [...FORGE_VISUAL_CRITIQUE_SEVERITIES] },
          rationale: { type: "string" },
          safeAutoFix: { type: "boolean" },
          safeFixType: { type: "string", enum: [...FORGE_VISUAL_CRITIQUE_SAFE_FIX_TYPES] },
        },
      },
    },
    summary: { type: "string" },
  },
} as const satisfies ForgeJsonSchema

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function parseForgeVisualCritiquePayload(input: unknown): ParseResult<ForgeVisualCritiqueDraft> {
  const normalizedInput = normalizeVisualCritiquePayload(input)
  const errors = validateJsonSchemaValue(FORGE_VISUAL_CRITIQUE_SCHEMA, normalizedInput)
  if (errors.length) return { ok: false, error: errors.join(" ") }
  const raw = normalizedInput as ForgeVisualCritiqueDraft
  return {
    ok: true,
    data: {
      ...raw,
      overallScore: clampScore(raw.overallScore),
      scores: {
        brandFit: clampScore(raw.scores.brandFit),
        visualQuality: clampScore(raw.scores.visualQuality),
        ctaRelevance: clampScore(raw.scores.ctaRelevance),
        contentSpecificity: clampScore(raw.scores.contentSpecificity),
        seoAeoQuality: clampScore(raw.scores.seoAeoQuality),
        accessibility: clampScore(raw.scores.accessibility),
        mobileReadiness: clampScore(raw.scores.mobileReadiness),
        clientReadiness: clampScore(raw.scores.clientReadiness),
      },
      recommendations: raw.recommendations.map((item) => ({
        ...item,
        safeAutoFix: item.safeAutoFix && item.safeFixType !== "none",
      })),
    },
  }
}

export function buildForgeVisualCritiqueReport(input: {
  data: ForgeVisualCritiqueDraft
  generatedAt?: string
}): ForgeVisualCritiqueReport {
  return {
    kind: FORGE_VISUAL_CRITIQUE_ARTIFACT_KIND,
    status: "draft",
    ...input.data,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    approvedAt: null,
    approvedBy: null,
    autoFixAppliedAt: null,
    autoFixesApplied: [],
  }
}

export function approveForgeVisualCritiqueReport(report: ForgeVisualCritiqueReport, actor: string, now = new Date().toISOString()): ForgeVisualCritiqueReport {
  return {
    ...report,
    status: "approved",
    approvedAt: now,
    approvedBy: actor,
  }
}

export function buildForgeVisualCritiqueApprovalRecord(input: {
  report: ForgeVisualCritiqueReport
  actor: string
  reason: string
  relevantArtifacts: number[]
  overridePolicy?: string | null
  now?: string
}): ForgeVisualCritiqueApprovalRecord {
  const reason = input.reason.trim()
  if (reason.length < 10) throw new Error("Visual critique approval requires a meaningful reason.")
  const failed = forgeVisualCritiqueScoresBelowThreshold(input.report).length > 0
  if (failed && !input.overridePolicy?.trim()) throw new Error("A critique below policy thresholds requires an explicit override policy.")
  return {
    actor: input.actor,
    timestamp: input.now ?? new Date().toISOString(),
    reason,
    previousQualityState: failed ? "requires_review" : "validated",
    resultingQualityState: "validated",
    relevantArtifacts: [...new Set(input.relevantArtifacts)],
    overridePolicy: input.overridePolicy?.trim() || null,
    downstreamImpact: failed
      ? "Downstream QA may continue under the recorded policy override; the original critique findings remain auditable."
      : "Downstream functional and visual QA may continue without regenerating approved upstream artifacts.",
  }
}

export function withForgeVisualCritiqueAutoFixes(report: ForgeVisualCritiqueReport, applied: string[], now = new Date().toISOString()): ForgeVisualCritiqueReport {
  return {
    ...report,
    autoFixAppliedAt: now,
    autoFixesApplied: [...new Set([...(report.autoFixesApplied ?? []), ...applied])],
  }
}

export function readForgeVisualCritiqueArtifact(metadata: Record<string, unknown> | null | undefined): ForgeVisualCritiqueArtifactState {
  if (!metadata || metadata.kind !== FORGE_VISUAL_CRITIQUE_ARTIFACT_KIND || typeof metadata.report !== "object" || metadata.report === null) {
    return emptyForgeVisualCritiqueState()
  }

  const report = metadata.report as Partial<ForgeVisualCritiqueReport>
  if (
    report.kind !== FORGE_VISUAL_CRITIQUE_ARTIFACT_KIND ||
    typeof report.overallScore !== "number" ||
    !report.scores ||
    !Array.isArray(report.strengths) ||
    !Array.isArray(report.weaknesses) ||
    !Array.isArray(report.recommendations)
  ) {
    return emptyForgeVisualCritiqueState()
  }

  const status = report.status === "approved" ? "approved" : "draft"
  const normalizedReport = {
    ...report,
    scores: normalizeVisualCritiqueScores(report.scores as Record<string, unknown>),
  } as ForgeVisualCritiqueReport
  return {
    report: normalizedReport,
    status,
    score: clampScore(normalizedReport.overallScore),
    approvedAt: typeof report.approvedAt === "string" ? report.approvedAt : null,
    approvedBy: typeof report.approvedBy === "string" ? report.approvedBy : null,
    autoFixAppliedAt: typeof report.autoFixAppliedAt === "string" ? report.autoFixAppliedAt : null,
  }
}

export function buildForgeVisualCritiqueArtifactContent(report: ForgeVisualCritiqueReport): string {
  return [
    "# Visual Critique",
    "",
    `Status: ${report.status}`,
    `Overall score: ${report.overallScore}/100`,
    `Generated: ${report.generatedAt}`,
    report.approvedAt ? `Approved: ${report.approvedAt} by ${report.approvedBy ?? "admin"}` : null,
    "",
    "## Scores",
    `- Brand Fit: ${report.scores.brandFit}/100`,
    `- Visual Quality: ${report.scores.visualQuality}/100`,
    `- CTA Relevance: ${report.scores.ctaRelevance}/100`,
    `- Content Specificity: ${report.scores.contentSpecificity}/100`,
    `- SEO/AEO Quality: ${report.scores.seoAeoQuality}/100`,
    `- Accessibility: ${report.scores.accessibility}/100`,
    `- Mobile Readiness: ${report.scores.mobileReadiness}/100`,
    `- Client Readiness: ${report.scores.clientReadiness}/100`,
    "",
    "## Strengths",
    ...(report.strengths.length ? report.strengths.map((item) => `- ${item}`) : ["- None recorded."]),
    "",
    "## Weaknesses",
    ...(report.weaknesses.length ? report.weaknesses.map((item) => `- ${item.severity}: ${item.category} - ${item.finding} (${item.evidence})`) : ["- None recorded."]),
    "",
    "## Recommendations",
    ...(report.recommendations.length ? report.recommendations.map((item) => `- ${item.severity}: ${item.title} (${item.safeAutoFix ? `safe auto-fix: ${item.safeFixType}` : "manual"})`) : ["- None recorded."]),
    "",
    "## Auto-fixes Applied",
    ...(report.autoFixesApplied.length ? report.autoFixesApplied.map((item) => `- ${item}`) : ["- None."]),
    "",
    "## Summary",
    report.summary,
  ].filter((line): line is string => line !== null).join("\n").trim()
}

export function createMockVisualCritiqueReport(input: {
  design: ForgeDesignDirection
  copy: ForgeCopyDocument
  spec: ForgeComponentSpecification
  generated: ForgeGeneratedCodeSummary
}): ForgeVisualCritiqueDraft {
  const hasTrust = input.copy.pages.some((page) => page.trustProofCopy.trim() || page.localSeoCopy.trim())
  const hasMobileNotes = input.design.mobileUxNotes.length > 0 || input.spec.responsiveBehaviour.length > 0
  const animationOveruse = input.generated.animationStack.length > 5 || /over|excess/i.test(input.design.overAnimationWarning)
  const ctaCount = input.copy.pages.filter((page) => page.primaryCta || page.secondaryCta).length
  const hasSeoContent = input.copy.pages.some((page) => page.seoTitle && page.metaDescription && page.faqItems.length)
  const scores: ForgeVisualCritiqueScores = {
    brandFit: input.design.selectedStylePack ? 84 : 68,
    visualQuality: animationOveruse ? 78 : 86,
    ctaRelevance: ctaCount ? 84 : 68,
    contentSpecificity: hasTrust ? 82 : 66,
    seoAeoQuality: hasSeoContent ? 82 : 68,
    accessibility: hasMobileNotes && !animationOveruse ? 80 : 72,
    mobileReadiness: hasMobileNotes ? 80 : 66,
    clientReadiness: hasTrust && ctaCount && input.generated.routeCount > 0 ? 82 : 70,
  }
  const overallScore = averageCritiqueScores(scores)
  return {
    overallScore,
    scores,
    strengths: [
      `Design direction is anchored by ${input.design.selectedStylePack}.`,
      `${input.generated.routeCount} generated route(s) have consistent component coverage.`,
      "Primary CTAs are present in the generated page data.",
    ],
    weaknesses: [
      ...(animationOveruse ? [{ category: "Animation overuse", severity: "Medium" as const, finding: "Motion stack may distract from conversion actions.", evidence: input.generated.animationStack.join(", ") }] : []),
      ...(hasTrust ? [] : [{ category: "Local-business trust signals", severity: "High" as const, finding: "Trust proof needs stronger placement and specificity.", evidence: "Generated copy lacks clear trust proof entries." }]),
      ...(hasMobileNotes ? [] : [{ category: "Mobile UX", severity: "Medium" as const, finding: "Mobile hierarchy needs explicit review.", evidence: "Design/spec mobile notes are thin." }]),
    ],
    recommendations: [
      { title: "Keep the trust section immediately after the hero on key pages", category: "Trust section placement", severity: "Medium", rationale: "Local-service visitors need proof before service exploration.", safeAutoFix: true, safeFixType: "trust_section_placement" },
      { title: "Keep primary CTA visible in the hero and final contact section", category: "CTA prominence", severity: "Medium", rationale: "Repeated, predictable conversion paths reduce friction.", safeAutoFix: true, safeFixType: "cta_positioning" },
      { title: "Use consistent section spacing across service and proof blocks", category: "Spacing consistency", severity: "Low", rationale: "A consistent rhythm makes the site feel more premium.", safeAutoFix: true, safeFixType: "spacing" },
      { title: "Review final mobile screenshots manually before deployment", category: "Mobile UX", severity: "Medium", rationale: "Automated metadata checks cannot fully judge viewport composition.", safeAutoFix: false, safeFixType: "none" },
    ],
    summary: `Visual critique score ${overallScore}/100. Review trust proof, CTA rhythm, mobile hierarchy, and motion restraint before QA.`,
  }
}

export function safeForgeVisualCritiqueRecommendations(report: ForgeVisualCritiqueReport) {
  return report.recommendations.filter((item) => item.safeAutoFix && item.safeFixType !== "none")
}

export function forgeVisualCritiqueScoresBelowThreshold(report: ForgeVisualCritiqueReport, threshold = 75) {
  return Object.entries(report.scores)
    .filter(([, score]) => typeof score === "number" && score < threshold)
    .map(([key, score]) => ({ key, score: score as number }))
}

function emptyForgeVisualCritiqueState(): ForgeVisualCritiqueArtifactState {
  return {
    report: null,
    status: "empty",
    score: null,
    approvedAt: null,
    approvedBy: null,
    autoFixAppliedAt: null,
  }
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function averageCritiqueScores(scores: ForgeVisualCritiqueScores) {
  const values = Object.values(scores).filter((value): value is number => typeof value === "number")
  return values.length ? Math.round(values.reduce((total, score) => total + score, 0) / values.length) : 0
}

function normalizeVisualCritiquePayload(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input
  const record = { ...(input as Record<string, unknown>) }
  record.scores = normalizeVisualCritiqueScores(record.scores)
  return record
}

function normalizeVisualCritiqueScores(input: unknown): ForgeVisualCritiqueScores {
  const scores = input && typeof input === "object" && !Array.isArray(input)
    ? { ...(input as Record<string, unknown>) }
    : {}
  const numberOr = (value: unknown, fallback: unknown) => typeof value === "number" ? value : typeof fallback === "number" ? fallback : 75

  return {
    brandFit: clampScore(numberOr(scores.brandFit, scores.designQuality ?? scores.visualQuality)),
    visualQuality: clampScore(numberOr(scores.visualQuality, scores.designQuality)),
    ctaRelevance: clampScore(numberOr(scores.ctaRelevance, scores.conversionQuality)),
    contentSpecificity: clampScore(numberOr(scores.contentSpecificity, scores.trustSignals)),
    seoAeoQuality: clampScore(numberOr(scores.seoAeoQuality, 75)),
    accessibility: clampScore(numberOr(scores.accessibility, scores.mobileExperience)),
    mobileReadiness: clampScore(numberOr(scores.mobileReadiness, scores.mobileExperience)),
    clientReadiness: clampScore(numberOr(scores.clientReadiness, scores.trustSignals ?? scores.conversionQuality)),
  }
}
