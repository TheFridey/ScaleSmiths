import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import { FORGE_SEO_MIN_PASS_SCORE, type ForgeSeoPack } from "./forge-seo"
import { redactForgeSecrets } from "./forge-security"
import { buildWhatsAppUrl, isValidWhatsAppNumber, type ForgeWhatsAppConfig } from "./forge-whatsapp"
import { assertForgeWorkspaceFileAllowed } from "./forge-workspace"

export const FORGE_QA_ARTIFACT_TITLE = "QA Report"
export const FORGE_QA_ARTIFACT_KIND = "forge_qa_report"

export type ForgeQaStatus = "passed" | "failed" | "not_run"
export type ForgeQaCommandName = "install" | "typecheck" | "lint" | "build" | "resend_form" | "whatsapp_links" | "reduced_motion" | "seo_score"
export type ForgeQaCommandStatus = "passed" | "failed" | "skipped"

export interface ForgeQaCommandResult extends Record<string, JsonValue> {
  name: ForgeQaCommandName
  command: string
  status: ForgeQaCommandStatus
  exitCode: number | null
  durationMs: number
  stdout: string
  stderr: string
  skippedReason: string | null
}

export interface ForgeRepairPatch extends Record<string, JsonValue> {
  path: string
  content: string
  reason: string
}

export interface ForgeRepairAttempt extends Record<string, JsonValue> {
  attempt: number
  taskId: number | null
  status: "applied" | "no_patch" | "failed"
  summary: string
  patches: ForgeRepairPatch[]
  startedAt: string
  completedAt: string | null
  error: string | null
}

export interface ForgeQaReport extends Record<string, JsonValue> {
  status: ForgeQaStatus
  workspacePath: string
  generatedAt: string
  completedAt: string
  commands: ForgeQaCommandResult[]
  summary: string
  failureSummary: string | null
  repairHistory: ForgeRepairAttempt[]
}

export interface ForgeQaArtifactState {
  report: ForgeQaReport | null
  status: ForgeQaStatus
  repairHistory: ForgeRepairAttempt[]
  updatedAt: string | null
}

export const FORGE_REPAIR_PATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "patches"],
  properties: {
    summary: { type: "string" },
    patches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "content", "reason"],
        properties: {
          path: { type: "string" },
          content: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
} as const satisfies ForgeJsonSchema

export interface ForgeRepairPatchResponse extends Record<string, JsonValue> {
  summary: string
  patches: ForgeRepairPatch[]
}

export function readForgeQaArtifact(metadata: Record<string, unknown> | null | undefined): ForgeQaArtifactState {
  if (!metadata || metadata.kind !== FORGE_QA_ARTIFACT_KIND || typeof metadata.report !== "object" || metadata.report === null) {
    return { report: null, status: "not_run", repairHistory: [], updatedAt: null }
  }

  const report = normalizeQaReport(metadata.report)
  if (!report) return { report: null, status: "not_run", repairHistory: [], updatedAt: null }

  return {
    report,
    status: report.status,
    repairHistory: report.repairHistory,
    updatedAt: report.completedAt,
  }
}

export function buildForgeQaArtifactContent(report: ForgeQaReport) {
  return [
    "# QA Report",
    "",
    `Status: ${report.status}`,
    `Workspace: ${report.workspacePath}`,
    `Completed: ${report.completedAt}`,
    "",
    "## Summary",
    report.summary,
    "",
    "## Commands",
    ...report.commands.flatMap((command) => [
      `### ${command.name}`,
      `- Command: ${command.command}`,
      `- Status: ${command.status}`,
      `- Exit code: ${command.exitCode ?? "n/a"}`,
      `- Duration: ${command.durationMs}ms`,
      command.skippedReason ? `- Skipped: ${command.skippedReason}` : null,
      command.stdout ? `- stdout: ${command.stdout}` : null,
      command.stderr ? `- stderr: ${command.stderr}` : null,
      "",
    ].filter(Boolean) as string[]),
    "## Repair history",
    ...(report.repairHistory.length ? report.repairHistory.map((attempt) => `- Attempt ${attempt.attempt}: ${attempt.status} - ${attempt.summary}`) : ["- No repair attempts yet."]),
  ].join("\n").trim()
}

export function buildQaReport({
  workspacePath,
  commands,
  repairHistory = [],
}: {
  workspacePath: string
  commands: ForgeQaCommandResult[]
  repairHistory?: ForgeRepairAttempt[]
}): ForgeQaReport {
  const failed = commands.find((command) => command.status === "failed")
  const completedAt = new Date().toISOString()

  return {
    status: failed ? "failed" : "passed",
    workspacePath,
    generatedAt: completedAt,
    completedAt,
    commands,
    summary: failed
      ? `QA failed at ${failed.name}. Completion is based on actual command results, not AI claims.`
      : "QA passed. Install, typecheck/lint where available, and build completed successfully.",
    failureSummary: failed ? summarizeCommandFailure(failed) : null,
    repairHistory,
  }
}

export function getForgeQaCommands(packageJson: string | null | undefined) {
  const scripts = parsePackageScripts(packageJson)
  return [
    { name: "install" as const, command: "npm install --no-audit --no-fund", shouldRun: true, skippedReason: null },
    { name: "typecheck" as const, command: "npm run typecheck", shouldRun: Boolean(scripts.typecheck), skippedReason: "No typecheck script defined." },
    { name: "lint" as const, command: "npm run lint", shouldRun: Boolean(scripts.lint), skippedReason: "No lint script defined." },
    { name: "build" as const, command: "npm run build", shouldRun: Boolean(scripts.build), skippedReason: "No build script defined." },
  ]
}

export function buildResendFormQaResult(files: { contactRoute: boolean; config: boolean; validation: boolean; template: boolean }, enabled: boolean): ForgeQaCommandResult {
  if (!enabled) {
    return {
      name: "resend_form",
      command: "verify generated Resend form route",
      status: "skipped",
      exitCode: null,
      durationMs: 0,
      stdout: "",
      stderr: "",
      skippedReason: "Resend integration is disabled.",
    }
  }

  const missing = Object.entries(files)
    .filter(([, exists]) => !exists)
    .map(([name]) => name)

  return {
    name: "resend_form",
    command: "verify generated Resend form route",
    status: missing.length ? "failed" : "passed",
    exitCode: missing.length ? 1 : 0,
    durationMs: 0,
    stdout: missing.length ? "" : "Resend contact route, config, validation, and email template exist.",
    stderr: missing.length ? `Missing generated Resend form files: ${missing.join(", ")}.` : "",
    skippedReason: null,
  }
}

export function buildWhatsAppLinkQaResult(
  files: { config: boolean; cta: boolean; sticky: boolean },
  config: ForgeWhatsAppConfig,
): ForgeQaCommandResult {
  if (!config.enabled) {
    return {
      name: "whatsapp_links",
      command: "verify generated WhatsApp wa.me links",
      status: "skipped",
      exitCode: null,
      durationMs: 0,
      stdout: "",
      stderr: "",
      skippedReason: "WhatsApp integration is disabled.",
    }
  }

  const missing = Object.entries(files)
    .filter(([, exists]) => !exists)
    .map(([name]) => name)
  const url = buildWhatsAppUrl(config.businessNumber, config.defaultMessage)
  const invalidNumber = !isValidWhatsAppNumber(config.businessNumber) || !url
  const errors = [
    missing.length ? `Missing generated WhatsApp files: ${missing.join(", ")}.` : null,
    invalidNumber ? "Configured WhatsApp number cannot produce a valid wa.me link." : null,
  ].filter(Boolean)

  return {
    name: "whatsapp_links",
    command: "verify generated WhatsApp wa.me links",
    status: errors.length ? "failed" : "passed",
    exitCode: errors.length ? 1 : 0,
    durationMs: 0,
    stdout: errors.length ? "" : `WhatsApp config and CTA components exist. Example link: ${url}`,
    stderr: errors.join(" "),
    skippedReason: null,
  }
}

export function buildReducedMotionQaResult(files: { globalsCss: string | null; motionSection: string | null; animationConfig: boolean }): ForgeQaCommandResult {
  const missing = [
    files.globalsCss ? null : "src/app/globals.css",
    files.motionSection ? null : "src/components/MotionSection.tsx",
    files.animationConfig ? null : "src/lib/animation-config.ts",
  ].filter(Boolean)
  const css = files.globalsCss ?? ""
  const motion = files.motionSection ?? ""
  const hasMedia = /prefers-reduced-motion:\s*reduce/.test(css)
  const disablesTransform = /transform:\s*none\s*!important/.test(css)
  const hasMotionClass = /motion-safe-(card|cta)/.test(css)
  const hasReducedMotionHook = /useReducedMotion/.test(motion)
  const errors = [
    missing.length ? `Missing reduced-motion files: ${missing.join(", ")}.` : null,
    hasMedia ? null : "globals.css is missing prefers-reduced-motion support.",
    disablesTransform ? null : "globals.css does not disable transforms for reduced motion.",
    hasMotionClass ? null : "globals.css is missing stable motion-safe utility classes.",
    hasReducedMotionHook ? null : "MotionSection does not use Framer Motion reduced-motion detection.",
  ].filter(Boolean)

  return {
    name: "reduced_motion",
    command: "verify generated reduced-motion support",
    status: errors.length ? "failed" : "passed",
    exitCode: errors.length ? 1 : 0,
    durationMs: 0,
    stdout: errors.length ? "" : "Generated CSS and MotionSection include reduced-motion fallbacks and stable motion classes.",
    stderr: errors.join(" "),
    skippedReason: null,
  }
}

export function buildSeoScoreQaResult(
  pack: ForgeSeoPack | null,
  generatedFiles: { sitemap: boolean; robots: boolean; seoLib: boolean },
  minScore = FORGE_SEO_MIN_PASS_SCORE,
): ForgeQaCommandResult {
  if (!pack) {
    return {
      name: "seo_score",
      command: "verify generated SEO/AEO/GEO pack",
      status: "skipped",
      exitCode: null,
      durationMs: 0,
      stdout: "",
      stderr: "",
      skippedReason: "No SEO pack has been generated for this project yet.",
    }
  }

  const missingFiles = [
    generatedFiles.sitemap ? null : "src/app/sitemap.ts",
    generatedFiles.robots ? null : "src/app/robots.ts",
    generatedFiles.seoLib ? null : "src/lib/seo.ts",
  ].filter(Boolean) as string[]
  const failingChecks = pack.checklist.filter((item) => item.status === "fail")
  const errors = [
    missingFiles.length ? `Missing generated SEO files: ${missingFiles.join(", ")}.` : null,
    pack.score.overall < minScore ? `SEO/AEO/GEO score ${pack.score.overall} is below the minimum ${minScore}.` : null,
    failingChecks.length ? `Failing checks: ${failingChecks.map((item) => item.label).join(", ")}.` : null,
  ].filter(Boolean) as string[]

  return {
    name: "seo_score",
    command: "verify generated SEO/AEO/GEO pack",
    status: errors.length ? "failed" : "passed",
    exitCode: errors.length ? 1 : 0,
    durationMs: 0,
    stdout: errors.length
      ? ""
      : `SEO ${pack.score.seo} / AEO ${pack.score.aeo} / GEO ${pack.score.geo} (overall ${pack.score.overall}). sitemap.xml, robots.txt, and JSON-LD schema generated.`,
    stderr: errors.join(" "),
    skippedReason: null,
  }
}

export function parsePackageScripts(packageJson: string | null | undefined) {
  if (!packageJson) return {} as Record<string, string>
  try {
    const parsed = JSON.parse(packageJson) as { scripts?: unknown }
    if (!parsed.scripts || typeof parsed.scripts !== "object" || Array.isArray(parsed.scripts)) return {}
    return Object.fromEntries(
      Object.entries(parsed.scripts).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    )
  } catch {
    return {}
  }
}

export function truncateForgeQaLog(value: string, maxLength = 12_000) {
  const redacted = redactForgeSecrets(value)
  if (redacted.length <= maxLength) return redacted
  return `${redacted.slice(0, 2_000)}\n\n[...truncated ${redacted.length - maxLength} chars...]\n\n${redacted.slice(-10_000)}`
}

export function resolveForgeMaxRepairAttempts(env: Partial<Record<string, string | undefined>> = process.env) {
  const parsed = Number(env.FORGE_MAX_REPAIR_ATTEMPTS)
  if (!Number.isInteger(parsed) || parsed < 0) return 3
  return Math.min(parsed, 10)
}

export function canAttemptForgeRepair(report: ForgeQaReport | null, maxAttempts: number) {
  if (!report) return { ok: false as const, error: "Run QA before attempting repair." }
  if (report.status !== "failed") return { ok: false as const, error: "Repair is only available after a failed QA run." }
  if (report.repairHistory.length >= maxAttempts) return { ok: false as const, error: `Maximum repair attempts reached (${maxAttempts}).` }
  return { ok: true as const, nextAttempt: report.repairHistory.length + 1 }
}

export function validateForgeRepairPatches(patches: ForgeRepairPatch[]) {
  if (!Array.isArray(patches)) return { ok: false as const, error: "Repair patches must be an array." }
  if (patches.length > 20) return { ok: false as const, error: "Repair response included too many file updates." }

  for (const patch of patches) {
    const allowed = assertForgeWorkspaceFileAllowed(patch.path, patch.content, { allowExecutableScripts: true })
    if (!allowed.ok) return { ok: false as const, error: allowed.error }
  }

  return { ok: true as const }
}

export function buildRepairPrompt({
  report,
  files,
}: {
  report: ForgeQaReport
  files: { path: string; content: string }[]
}) {
  return [
    "Repair the generated client site so it passes the actual QA commands.",
    "Return full replacement file contents only for files that need changes.",
    "Never edit files outside the generated workspace. Never target admin/, web/, .git/, node_modules/, or absolute paths.",
    "Do not claim success. The system will rerun install/typecheck/lint/build after applying safe file updates.",
    "",
    "Failure summary:",
    report.failureSummary ?? report.summary,
    "",
    "Command results:",
    JSON.stringify(report.commands.map((command) => ({
      name: command.name,
      command: command.command,
      status: command.status,
      exitCode: command.exitCode,
      stdout: command.stdout.slice(-4000),
      stderr: command.stderr.slice(-4000),
    })), null, 2),
    "",
    "Relevant files:",
    JSON.stringify(files, null, 2),
  ].join("\n")
}

export function extractLikelyRelevantFiles(report: ForgeQaReport) {
  const text = report.commands.map((command) => `${command.stdout}\n${command.stderr}`).join("\n")
  const matches = new Set<string>(["package.json", "tsconfig.json", "src/lib/site-data.ts"])
  const regex = /(?:^|\s|["'`(])((?:src|app|components|lib)\/[A-Za-z0-9._~/-]+\.(?:ts|tsx|css|json|mjs))/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text))) {
    matches.add(match[1])
  }

  return [...matches].slice(0, 12)
}

function summarizeCommandFailure(command: ForgeQaCommandResult) {
  const detail = command.stderr || command.stdout || command.skippedReason || "No output captured."
  return `${command.name} failed with exit code ${command.exitCode ?? "unknown"}: ${detail.slice(-1800)}`
}

function normalizeQaReport(input: object): ForgeQaReport | null {
  const record = input as Partial<ForgeQaReport>
  if (
    (record.status === "passed" || record.status === "failed" || record.status === "not_run") &&
    typeof record.workspacePath === "string" &&
    typeof record.completedAt === "string" &&
    Array.isArray(record.commands) &&
    typeof record.summary === "string"
  ) {
    return {
      status: record.status,
      workspacePath: record.workspacePath,
      generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : record.completedAt,
      completedAt: record.completedAt,
      commands: record.commands as ForgeQaCommandResult[],
      summary: record.summary,
      failureSummary: typeof record.failureSummary === "string" ? record.failureSummary : null,
      repairHistory: Array.isArray(record.repairHistory) ? record.repairHistory as ForgeRepairAttempt[] : [],
    }
  }

  return null
}
