import type { JsonValue } from "./forge-ai"
import type { ForgeQaCommandStatus } from "./forge-qa"

export const FORGE_VISUAL_QA_ARTIFACT_TITLE = "Lighthouse & Visual QA"
export const FORGE_VISUAL_QA_ARTIFACT_KIND = "forge_visual_qa"

// Lighthouse category scores are normalised to a 0–100 integer scale.
export const FORGE_DEFAULT_MIN_LIGHTHOUSE_PERFORMANCE = 50
export const FORGE_DEFAULT_MIN_LIGHTHOUSE_ACCESSIBILITY = 90
export const FORGE_DEFAULT_MIN_LIGHTHOUSE_SEO = 90
export const FORGE_DEFAULT_MAX_CONSOLE_ERRORS = 0

export type ForgeVisualQaStatus = "passed" | "failed" | "skipped"
export type ForgeVisualCheckStatus = "passed" | "failed" | "skipped" | "warning"
export type ForgeQualityBadgeStatus = "pass" | "fail" | "warn" | "skipped" | "unknown"

export interface ForgeLighthouseScores extends Record<string, JsonValue> {
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}

export interface ForgeLighthouseThresholds extends Record<string, JsonValue> {
  performance: number
  accessibility: number
  seo: number
}

export interface ForgeLighthouseResult extends Record<string, JsonValue> {
  available: boolean
  status: ForgeVisualCheckStatus
  scores: ForgeLighthouseScores
  thresholds: ForgeLighthouseThresholds
  failing: string[]
  unavailableReason: string | null
}

export interface ForgeSmokeTest extends Record<string, JsonValue> {
  name: string
  status: ForgeVisualCheckStatus
  detail: string
  durationMs: number
}

export interface ForgeMobileCheck extends Record<string, JsonValue> {
  status: ForgeVisualCheckStatus
  viewport: { width: number; height: number }
  detail: string
}

export interface ForgeConsoleErrorCheck extends Record<string, JsonValue> {
  status: ForgeVisualCheckStatus
  count: number
  threshold: number
  messages: string[]
}

export interface ForgeQualityBadge extends Record<string, JsonValue> {
  key: string
  label: string
  status: ForgeQualityBadgeStatus
  value: string
}

export interface ForgeVisualQaReport extends Record<string, JsonValue> {
  kind: typeof FORGE_VISUAL_QA_ARTIFACT_KIND
  status: ForgeVisualQaStatus
  workspacePath: string
  previewUrl: string | null
  toolingAvailable: { lighthouse: boolean; browser: boolean }
  lighthouse: ForgeLighthouseResult
  smokeTests: ForgeSmokeTest[]
  mobile: ForgeMobileCheck
  consoleErrors: ForgeConsoleErrorCheck
  badges: ForgeQualityBadge[]
  recommendations: string[]
  logs: string[]
  summary: string
  generatedAt: string
  completedAt: string
}

export interface ForgeVisualQaArtifactState {
  report: ForgeVisualQaReport | null
  status: ForgeVisualQaStatus
  badges: ForgeQualityBadge[]
  updatedAt: string | null
}

/* ── env-configurable thresholds ────────────────────────────────────── */

export function resolveForgeLighthouseThresholds(env: Partial<Record<string, string | undefined>> = process.env): ForgeLighthouseThresholds {
  return {
    performance: clampScore(env.FORGE_MIN_LIGHTHOUSE_PERFORMANCE, FORGE_DEFAULT_MIN_LIGHTHOUSE_PERFORMANCE),
    accessibility: clampScore(env.FORGE_MIN_LIGHTHOUSE_ACCESSIBILITY, FORGE_DEFAULT_MIN_LIGHTHOUSE_ACCESSIBILITY),
    seo: clampScore(env.FORGE_MIN_LIGHTHOUSE_SEO, FORGE_DEFAULT_MIN_LIGHTHOUSE_SEO),
  }
}

export function resolveForgeMaxConsoleErrors(env: Partial<Record<string, string | undefined>> = process.env): number {
  const parsed = Number(env.FORGE_MAX_CONSOLE_ERRORS)
  if (!Number.isInteger(parsed) || parsed < 0) return FORGE_DEFAULT_MAX_CONSOLE_ERRORS
  return Math.min(parsed, 100)
}

/* ── Lighthouse normalisation + evaluation ──────────────────────────── */

export function normalizeLighthouseScore(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null
  const scaled = value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, Math.round(scaled)))
}

export function evaluateForgeLighthouse(
  scores: ForgeLighthouseScores,
  thresholds: ForgeLighthouseThresholds,
  available: boolean,
  unavailableReason: string | null = null,
): ForgeLighthouseResult {
  if (!available) {
    return {
      available: false,
      status: "skipped",
      scores,
      thresholds,
      failing: [],
      unavailableReason: unavailableReason ?? "Lighthouse was not available in this environment.",
    }
  }

  const failing: string[] = []
  if (isBelow(scores.performance, thresholds.performance)) failing.push(`performance ${scores.performance} < ${thresholds.performance}`)
  if (isBelow(scores.accessibility, thresholds.accessibility)) failing.push(`accessibility ${scores.accessibility} < ${thresholds.accessibility}`)
  if (isBelow(scores.seo, thresholds.seo)) failing.push(`seo ${scores.seo} < ${thresholds.seo}`)

  return {
    available: true,
    status: failing.length ? "failed" : "passed",
    scores,
    thresholds,
    failing,
    unavailableReason: null,
  }
}

/* ── dashboard badges ───────────────────────────────────────────────── */

export function buildForgeQualityBadges(input: {
  build: ForgeQaCommandStatus | null
  typecheck: ForgeQaCommandStatus | null
  seoScore: number | null
  seoThreshold: number
  lighthouse: ForgeLighthouseResult
  mobile: ForgeMobileCheck
}): ForgeQualityBadge[] {
  const lighthouseSeo = input.lighthouse.available ? input.lighthouse.scores.seo : null
  const seoValue = lighthouseSeo ?? input.seoScore
  const accessibility = input.lighthouse.scores.accessibility
  const performance = input.lighthouse.scores.performance

  return [
    badge("build", "Build", fromCommandStatus(input.build), commandValue(input.build)),
    badge("typecheck", "Typecheck", fromCommandStatus(input.typecheck), commandValue(input.typecheck)),
    badge("seo", "SEO", fromScore(seoValue, input.seoThreshold), scoreValue(seoValue)),
    badge("accessibility", "Accessibility", input.lighthouse.available ? fromScore(accessibility, input.lighthouse.thresholds.accessibility) : "skipped", input.lighthouse.available ? scoreValue(accessibility) : "n/a"),
    badge("performance", "Performance", input.lighthouse.available ? fromScore(performance, input.lighthouse.thresholds.performance) : "skipped", input.lighthouse.available ? scoreValue(performance) : "n/a"),
    badge("mobile", "Mobile", fromCheckStatus(input.mobile.status), checkValue(input.mobile.status)),
  ]
}

/* ── report assembly ────────────────────────────────────────────────── */

export function buildForgeVisualQaReport(input: {
  workspacePath: string
  previewUrl: string | null
  lighthouse: ForgeLighthouseResult
  smokeTests: ForgeSmokeTest[]
  mobile: ForgeMobileCheck
  consoleErrors: ForgeConsoleErrorCheck
  build: ForgeQaCommandStatus | null
  typecheck: ForgeQaCommandStatus | null
  seoScore: number | null
  seoThreshold: number
  logs: string[]
  generatedAt?: string
}): ForgeVisualQaReport {
  const completedAt = new Date().toISOString()
  const badges = buildForgeQualityBadges({
    build: input.build,
    typecheck: input.typecheck,
    seoScore: input.seoScore,
    seoThreshold: input.seoThreshold,
    lighthouse: input.lighthouse,
    mobile: input.mobile,
  })

  const hardFailures: string[] = []
  if (input.lighthouse.status === "failed") hardFailures.push(`Lighthouse below threshold (${input.lighthouse.failing.join(", ")}).`)
  const failedSmoke = input.smokeTests.filter((test) => test.status === "failed")
  if (failedSmoke.length) hardFailures.push(`Smoke tests failed: ${failedSmoke.map((test) => test.name).join(", ")}.`)
  if (input.mobile.status === "failed") hardFailures.push("Mobile viewport check failed.")
  if (input.consoleErrors.status === "failed") hardFailures.push(`Console errors above threshold (${input.consoleErrors.count} > ${input.consoleErrors.threshold}).`)

  const ranSomething =
    input.lighthouse.available ||
    input.smokeTests.some((test) => test.status !== "skipped") ||
    input.mobile.status !== "skipped" ||
    input.consoleErrors.status !== "skipped"

  const status: ForgeVisualQaStatus = hardFailures.length ? "failed" : ranSomething ? "passed" : "skipped"

  const recommendations = buildRecommendations(input.lighthouse, failedSmoke, input.mobile, input.consoleErrors, ranSomething)

  return {
    kind: FORGE_VISUAL_QA_ARTIFACT_KIND,
    status,
    workspacePath: input.workspacePath,
    previewUrl: input.previewUrl,
    toolingAvailable: { lighthouse: input.lighthouse.available, browser: input.mobile.status !== "skipped" || input.consoleErrors.status !== "skipped" },
    lighthouse: input.lighthouse,
    smokeTests: input.smokeTests,
    mobile: input.mobile,
    consoleErrors: input.consoleErrors,
    badges,
    recommendations,
    logs: input.logs.slice(-80),
    summary: status === "failed"
      ? `Visual QA failed: ${hardFailures.join(" ")}`
      : status === "skipped"
        ? "Visual QA skipped: Lighthouse and browser tooling were unavailable in this environment. Generated-site progress is not blocked."
        : "Visual QA passed: smoke tests, mobile viewport, console errors, and Lighthouse thresholds are within limits where available.",
    generatedAt: input.generatedAt ?? completedAt,
    completedAt,
  }
}

export function readForgeVisualQaArtifact(metadata: Record<string, unknown> | null | undefined): ForgeVisualQaArtifactState {
  if (!metadata || metadata.kind !== FORGE_VISUAL_QA_ARTIFACT_KIND || typeof metadata.report !== "object" || metadata.report === null) {
    return { report: null, status: "skipped", badges: [], updatedAt: null }
  }

  const report = metadata.report as Partial<ForgeVisualQaReport>
  if (
    report.kind !== FORGE_VISUAL_QA_ARTIFACT_KIND ||
    typeof report.workspacePath !== "string" ||
    !Array.isArray(report.smokeTests) ||
    !Array.isArray(report.badges) ||
    typeof report.status !== "string"
  ) {
    return { report: null, status: "skipped", badges: [], updatedAt: null }
  }

  return {
    report: report as ForgeVisualQaReport,
    status: report.status as ForgeVisualQaStatus,
    badges: report.badges as ForgeQualityBadge[],
    updatedAt: typeof report.completedAt === "string" ? report.completedAt : null,
  }
}

export function buildForgeVisualQaArtifactContent(report: ForgeVisualQaReport): string {
  return [
    "# Lighthouse & Visual QA",
    "",
    `Status: ${report.status}`,
    `Workspace: ${report.workspacePath}`,
    `Preview URL: ${report.previewUrl ?? "n/a"}`,
    `Completed: ${report.completedAt}`,
    "",
    "## Quality badges",
    ...report.badges.map((b) => `- ${b.label}: ${b.status.toUpperCase()} (${b.value})`),
    "",
    "## Lighthouse",
    report.lighthouse.available
      ? `- Performance: ${fmt(report.lighthouse.scores.performance)} (min ${report.lighthouse.thresholds.performance})`
      : `- Skipped: ${report.lighthouse.unavailableReason ?? "unavailable"}`,
    ...(report.lighthouse.available ? [
      `- Accessibility: ${fmt(report.lighthouse.scores.accessibility)} (min ${report.lighthouse.thresholds.accessibility})`,
      `- Best practices: ${fmt(report.lighthouse.scores.bestPractices)}`,
      `- SEO: ${fmt(report.lighthouse.scores.seo)} (min ${report.lighthouse.thresholds.seo})`,
    ] : []),
    "",
    "## Smoke tests",
    ...(report.smokeTests.length ? report.smokeTests.map((test) => `- ${test.name}: ${test.status} — ${test.detail}`) : ["- No smoke tests ran."]),
    "",
    "## Mobile viewport",
    `- ${report.mobile.status}: ${report.mobile.detail}`,
    "",
    "## Console errors",
    `- ${report.consoleErrors.status}: ${report.consoleErrors.count} error(s), threshold ${report.consoleErrors.threshold}`,
    ...report.consoleErrors.messages.slice(0, 10).map((message) => `  - ${message}`),
    "",
    "## Recommendations",
    ...(report.recommendations.length ? report.recommendations.map((item) => `- ${item}`) : ["- No recommendations."]),
    "",
    "## Logs",
    "```",
    ...(report.logs.length ? report.logs : ["No logs captured."]),
    "```",
  ].join("\n").trim()
}

/* ── internal helpers ───────────────────────────────────────────────── */

function buildRecommendations(
  lighthouse: ForgeLighthouseResult,
  failedSmoke: ForgeSmokeTest[],
  mobile: ForgeMobileCheck,
  consoleErrors: ForgeConsoleErrorCheck,
  ranSomething: boolean,
): string[] {
  const recommendations: string[] = []
  if (!ranSomething) {
    recommendations.push("Install Lighthouse (`lighthouse`, `chrome-launcher`) and a browser engine (`playwright`) in the admin app to enable objective scoring. Progress is not blocked without them.")
  }
  if (lighthouse.available) {
    for (const failure of lighthouse.failing) recommendations.push(`Improve Lighthouse ${failure}.`)
  } else if (ranSomething) {
    recommendations.push("Lighthouse was unavailable; performance/accessibility scores were not captured for this run.")
  }
  for (const test of failedSmoke) recommendations.push(`Fix smoke test: ${test.name} — ${test.detail}`)
  if (mobile.status === "failed") recommendations.push(`Resolve mobile viewport issues: ${mobile.detail}`)
  if (consoleErrors.status === "failed") {
    recommendations.push(`Remove runtime console errors (found ${consoleErrors.count}, threshold ${consoleErrors.threshold}). First: ${consoleErrors.messages[0] ?? "see logs"}.`)
  }
  return [...new Set(recommendations)]
}

function badge(key: string, label: string, status: ForgeQualityBadgeStatus, value: string): ForgeQualityBadge {
  return { key, label, status, value }
}

function fromCommandStatus(status: ForgeQaCommandStatus | null): ForgeQualityBadgeStatus {
  if (status === "passed") return "pass"
  if (status === "failed") return "fail"
  if (status === "skipped") return "skipped"
  return "unknown"
}

function fromCheckStatus(status: ForgeVisualCheckStatus): ForgeQualityBadgeStatus {
  if (status === "passed") return "pass"
  if (status === "failed") return "fail"
  if (status === "warning") return "warn"
  return "skipped"
}

function fromScore(score: number | null, threshold: number): ForgeQualityBadgeStatus {
  if (score === null) return "unknown"
  if (score >= threshold) return "pass"
  if (score >= threshold - 10) return "warn"
  return "fail"
}

function commandValue(status: ForgeQaCommandStatus | null): string {
  return status ?? "not run"
}

function checkValue(status: ForgeVisualCheckStatus): string {
  return status
}

function scoreValue(score: number | null): string {
  return score === null ? "n/a" : String(score)
}

function isBelow(score: number | null, threshold: number): boolean {
  return score !== null && score < threshold
}

function clampScore(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(100, Math.round(parsed)))
}

function fmt(value: number | null): string {
  return value === null ? "n/a" : String(value)
}
