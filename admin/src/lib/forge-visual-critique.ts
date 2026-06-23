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
  designQuality: number
  conversionQuality: number
  trustSignals: number
  mobileExperience: number
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
      required: ["designQuality", "conversionQuality", "trustSignals", "mobileExperience"],
      properties: {
        designQuality: { type: "integer" },
        conversionQuality: { type: "integer" },
        trustSignals: { type: "integer" },
        mobileExperience: { type: "integer" },
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
  const errors = validateJsonSchemaValue(FORGE_VISUAL_CRITIQUE_SCHEMA, input)
  if (errors.length) return { ok: false, error: errors.join(" ") }
  const raw = input as ForgeVisualCritiqueDraft
  return {
    ok: true,
    data: {
      ...raw,
      overallScore: clampScore(raw.overallScore),
      scores: {
        designQuality: clampScore(raw.scores.designQuality),
        conversionQuality: clampScore(raw.scores.conversionQuality),
        trustSignals: clampScore(raw.scores.trustSignals),
        mobileExperience: clampScore(raw.scores.mobileExperience),
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
  return {
    report: report as ForgeVisualCritiqueReport,
    status,
    score: clampScore(report.overallScore),
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
    `- Design Quality: ${report.scores.designQuality}/100`,
    `- Conversion Quality: ${report.scores.conversionQuality}/100`,
    `- Trust Signals: ${report.scores.trustSignals}/100`,
    `- Mobile Experience: ${report.scores.mobileExperience}/100`,
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
  const scores: ForgeVisualCritiqueScores = {
    designQuality: animationOveruse ? 78 : 86,
    conversionQuality: input.copy.pages.some((page) => page.primaryCta) ? 84 : 68,
    trustSignals: hasTrust ? 82 : 62,
    mobileExperience: hasMobileNotes ? 80 : 66,
  }
  const overallScore = Math.round((scores.designQuality + scores.conversionQuality + scores.trustSignals + scores.mobileExperience) / 4)
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
