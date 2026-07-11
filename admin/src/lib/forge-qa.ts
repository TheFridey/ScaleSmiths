import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import { FORGE_SEO_MIN_PASS_SCORE, type ForgeSeoPack } from "./forge-seo"
import type { ForgeDesignDirection } from "./forge-design"
import { redactForgeSecrets } from "./forge-security"
import { buildWhatsAppUrl, isValidWhatsAppNumber, type ForgeWhatsAppConfig } from "./forge-whatsapp"
import { assertForgeWorkspaceFileAllowed } from "./forge-workspace"

export const FORGE_QA_ARTIFACT_TITLE = "QA Report"
export const FORGE_QA_ARTIFACT_KIND = "forge_qa_report"

export type ForgeQaStatus = "passed" | "failed" | "not_run"
export type ForgeQaCommandName =
  | "install"
  | "typecheck"
  | "lint"
  | "build"
  | "resend_form"
  | "whatsapp_links"
  | "reduced_motion"
  | "placeholder_scan"
  | "copy_quality"
  | "cta_relevance"
  | "schema_appropriateness"
  | "design_alignment"
  | "mobile_responsive"
  | "content_depth"
  | "seo_score"
  | "forbidden_generic_content"
export type ForgeQaCommandStatus = "passed" | "failed" | "skipped"

export const FORGE_MANDATORY_QA_CHECKS = [
  { name: "typecheck", label: "TypeScript/typecheck" },
  { name: "build", label: "Production build" },
  { name: "placeholder_scan", label: "Placeholder scan" },
  { name: "copy_quality", label: "Copy quality scan" },
  { name: "cta_relevance", label: "CTA relevance scan" },
  { name: "schema_appropriateness", label: "Schema appropriateness" },
  { name: "design_alignment", label: "Design alignment" },
  { name: "mobile_responsive", label: "Mobile/responsive basic" },
  { name: "content_depth", label: "Content depth (no thin/generic pages)" },
  { name: "seo_score", label: "SEO/AEO/GEO metadata" },
  { name: "forbidden_generic_content", label: "Forbidden generic content" },
] as const satisfies readonly { name: ForgeQaCommandName; label: string }[]

// Conservative floor: the generator's fallback pages land near ~85 words and copy-approved pages are
// richer, so this only fails genuinely thin pages without false-failing legitimate generated sites.
export const FORGE_MIN_PAGE_BODY_WORDS = 45

export const FORGE_FORBIDDEN_FINAL_OUTPUT_TERMS = [
  "N/A",
  "Lorem ipsum",
  "clear explanation",
  "service comparison guide",
  "placeholder",
  "your business name",
  "generic instruction-like copy",
] as const

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

export interface ForgeQaGeneratedFile {
  path: string
  content: string
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
  readiness: ForgeReadinessAssessment
  repairHistory: ForgeRepairAttempt[]
}

export interface ForgeQaArtifactState {
  report: ForgeQaReport | null
  status: ForgeQaStatus
  repairHistory: ForgeRepairAttempt[]
  updatedAt: string | null
}

// Hard checks gate the "Client ready" verdict: every one must pass before a build can be certified
// for a client. typecheck and build are catastrophic — failing them caps the score in the bottom band.
export const FORGE_HARD_CHECK_NAMES = FORGE_MANDATORY_QA_CHECKS.map((check) => check.name)
export const FORGE_CATASTROPHIC_CHECK_NAMES: readonly ForgeQaCommandName[] = ["typecheck", "build"]
// install is infrastructure, not a quality signal, so it never contributes to the readiness score.
const FORGE_READINESS_IGNORED_CHECKS: readonly ForgeQaCommandName[] = ["install"]
const FORGE_HARD_CHECK_WEIGHT = 3
const FORGE_SOFT_CHECK_WEIGHT = 1

export type ForgeReadinessBand = "client_ready" | "strong_draft" | "needs_review" | "not_acceptable"

export const FORGE_READINESS_BANDS = [
  { band: "client_ready" as const, min: 90, label: "Client ready" },
  { band: "strong_draft" as const, min: 75, label: "Strong draft" },
  { band: "needs_review" as const, min: 60, label: "Needs review" },
  { band: "not_acceptable" as const, min: 0, label: "Not acceptable" },
]

export interface ForgeReadinessCheckState extends Record<string, JsonValue> {
  name: ForgeQaCommandName
  label: string
  hard: boolean
  status: ForgeQaCommandStatus | "missing"
}

export interface ForgeReadinessAssessment extends Record<string, JsonValue> {
  score: number
  band: ForgeReadinessBand
  label: string
  clientReady: boolean
  hardChecksPassed: boolean
  summary: string
  blockingReasons: string[]
  checks: ForgeReadinessCheckState[]
}

function bandForScore(score: number): { band: ForgeReadinessBand; label: string } {
  const match = FORGE_READINESS_BANDS.find((entry) => score >= entry.min) ?? FORGE_READINESS_BANDS[FORGE_READINESS_BANDS.length - 1]
  return { band: match.band, label: match.label }
}

// Deterministic readiness score derived solely from actual command results — never from AI claims.
// Hard checks are weighted and mandatory; "Client ready" is impossible unless all of them pass.
export function computeForgeReadiness(commands: ForgeQaCommandResult[]): ForgeReadinessAssessment {
  const byName = new Map(commands.map((command) => [command.name, command]))
  const hardNames = new Set<ForgeQaCommandName>(FORGE_HARD_CHECK_NAMES)

  const checks: ForgeReadinessCheckState[] = []
  for (const { name, label } of FORGE_MANDATORY_QA_CHECKS) {
    checks.push({ name, label, hard: true, status: byName.get(name)?.status ?? "missing" })
  }
  for (const command of commands) {
    if (hardNames.has(command.name) || FORGE_READINESS_IGNORED_CHECKS.includes(command.name)) continue
    checks.push({ name: command.name, label: command.name, hard: false, status: command.status })
  }

  let earned = 0
  let total = 0
  for (const check of checks) {
    const weight = check.hard ? FORGE_HARD_CHECK_WEIGHT : FORGE_SOFT_CHECK_WEIGHT
    // Skipped checks are neutral (excluded). Hard checks always count: a missing hard check means we
    // could not certify it, so it weighs against the score.
    if (check.status === "skipped") continue
    if (!check.hard && check.status === "missing") continue
    total += weight
    if (check.status === "passed") earned += weight
  }

  const rawScore = total === 0 ? 0 : Math.round((earned / total) * 100)
  const hardChecksPassed = checks.every((check) => !check.hard || check.status === "passed")
  const catastrophicFailed = FORGE_CATASTROPHIC_CHECK_NAMES.some((name) => (byName.get(name)?.status ?? "missing") !== "passed")

  let score = rawScore
  if (catastrophicFailed) score = Math.min(score, 49)
  else if (!hardChecksPassed) score = Math.min(score, 74)

  const { band, label } = bandForScore(score)
  const clientReady = band === "client_ready" && hardChecksPassed
  const blockingReasons = checks
    .filter((check) => check.hard && check.status !== "passed")
    .map((check) => `${check.label} did not pass (${check.status}).`)

  const summary = clientReady
    ? `Client ready (${score}/100): all hard checks passed.`
    : `${label} (${score}/100): ${blockingReasons.length ? `${blockingReasons.length} hard check(s) outstanding.` : "all hard checks passed but quality is below the client-ready threshold."}`

  return { score, band, label, clientReady, hardChecksPassed, summary, blockingReasons, checks }
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
    "## Readiness",
    `Score: ${report.readiness.score}/100 (${report.readiness.label})`,
    `Client ready: ${report.readiness.clientReady ? "yes" : "no"}`,
    report.readiness.blockingReasons.length
      ? `Blocking hard checks:\n${report.readiness.blockingReasons.map((reason) => `- ${reason}`).join("\n")}`
      : "All hard checks passed.",
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
  const readiness = computeForgeReadiness(commands)

  return {
    status: failed ? "failed" : "passed",
    workspacePath,
    generatedAt: completedAt,
    completedAt,
    commands,
    summary: failed
      ? `QA failed at ${failed.name}. Completion is based on actual command results, not AI claims.`
      : `QA passed. ${readiness.summary}`,
    failureSummary: failed ? summarizeCommandFailure(failed) : null,
    readiness,
    repairHistory,
  }
}

export function getForgeQaCommands(packageJson: string | null | undefined) {
  const scripts = parsePackageScripts(packageJson)
  return [
    { name: "install" as const, command: "npm install --ignore-scripts --include=dev --no-audit --no-fund", shouldRun: true, skippedReason: null },
    { name: "typecheck" as const, command: scripts.typecheck ? "npm run typecheck" : "npx tsc --noEmit", shouldRun: true, skippedReason: null },
    { name: "lint" as const, command: "npm run lint", shouldRun: Boolean(scripts.lint), skippedReason: "No lint script defined." },
    { name: "build" as const, command: scripts.build ? "npm run build" : "npx next build", shouldRun: true, skippedReason: null },
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

export function buildDesignAlignmentQaResult(
  design: ForgeDesignDirection | null,
  files: { globalsCss: string | null; tailwindConfig: string | null; heroComponent: string | null; siteData: string | null },
): ForgeQaCommandResult {
  if (!design) {
    return {
      name: "design_alignment",
      command: "verify generated design tokens match approved direction",
      status: "skipped",
      exitCode: null,
      durationMs: 0,
      stdout: "",
      stderr: "",
      skippedReason: "No approved design direction artifact was available.",
    }
  }

  const tokens = design.designTokens
  const globalsCss = files.globalsCss ?? ""
  const tailwindConfig = files.tailwindConfig ?? ""
  const heroComponent = files.heroComponent ?? ""
  const siteData = files.siteData ?? ""
  const cssAndConfig = `${globalsCss}\n${tailwindConfig}`
  const renderedContext = `${heroComponent}\n${siteData}`
  const missing = [
    globalsCss ? null : "src/app/globals.css",
    tailwindConfig ? null : "tailwind.config.ts",
    heroComponent ? null : "src/components/Hero.tsx",
    siteData ? null : "src/lib/site-data.ts",
  ].filter(Boolean) as string[]
  const requiredTokenChecks = [
    ["font display", tokens.fontDisplay],
    ["font body", tokens.fontBody],
    ["surface", tokens.surface],
    ["surface alt", tokens.surfaceAlt],
    ["ink", tokens.ink],
    ["brand", tokens.brand],
    ["accent", tokens.accent],
    ["hero background", tokens.heroBackground],
  ] as const
  const missingTokens = requiredTokenChecks
    .filter(([, value]) => value && !cssAndConfig.includes(value))
    .map(([label]) => label)

  const errors = [
    missing.length ? `Missing generated design files: ${missing.join(", ")}.` : null,
    missingTokens.length ? `Generated CSS/config is missing locked design tokens: ${missingTokens.join(", ")}.` : null,
    /hero-brand-surface/.test(heroComponent) ? null : "Hero component is not using the locked hero-brand-surface background.",
    /bg-brand/.test(heroComponent) ? null : "Hero primary CTA is not using the locked brand token.",
    ...packSpecificDesignErrors(design, { cssAndConfig, renderedContext }),
  ].filter(Boolean) as string[]

  return {
    name: "design_alignment",
    command: "verify generated design tokens match approved direction",
    status: errors.length ? "failed" : "passed",
    exitCode: errors.length ? 1 : 0,
    durationMs: 0,
    stdout: errors.length ? "" : `Generated CSS, Tailwind config, and hero component match the approved ${design.selectedStylePack} design tokens.`,
    stderr: errors.join(" "),
    skippedReason: null,
  }
}

export function buildPlaceholderScanQaResult(files: ForgeQaGeneratedFile[]): ForgeQaCommandResult {
  const text = collectClientFacingText(files)
  const hits = findForbiddenTerms(text, [
    /\bN\/A\b/i,
    /lorem ipsum/i,
    /\byour business name\b/i,
    /\bTODO\b/i,
    /\[[a-z0-9 _-]+\]/i,
    /\bplaceholder\b/i,
  ])

  return scanResult({
    name: "placeholder_scan",
    command: "scan generated client-facing copy for placeholders",
    errors: hits.map((hit) => `Forbidden placeholder-like output found: ${hit}.`),
    success: "No placeholder-like client-facing copy was found.",
  })
}

export function buildCopyQualityQaResult(files: ForgeQaGeneratedFile[]): ForgeQaCommandResult {
  const text = collectClientFacingText(files)
  const errors = [
    /\bclear explanation\b/i.test(text) ? "Copy contains generic 'clear explanation' wording." : null,
    /\bservice comparison guide\b/i.test(text) ? "Copy contains generic 'service comparison guide' wording." : null,
    /\bgeneric instruction-like copy\b/i.test(text) ? "Copy contains generic instruction-like copy." : null,
    /\b(insert|replace|write|add)\s+(your|the)\b/i.test(text) ? "Copy still reads like an instruction to the builder/admin." : null,
    /\b(fake|made-up|invented)\s+(statistic|metric|number|result)s?\b/i.test(text) ? "Copy references fake or invented statistics." : null,
  ].filter(Boolean) as string[]

  return scanResult({
    name: "copy_quality",
    command: "scan generated copy quality",
    errors,
    success: "Generated copy avoids instruction-like filler and obvious generic text.",
  })
}

export function buildCtaRelevanceQaResult(files: ForgeQaGeneratedFile[]): ForgeQaCommandResult {
  const site = parseGeneratedSite(files)
  if (!site) {
    return scanResult({
      name: "cta_relevance",
      command: "verify generated CTA relevance",
      errors: ["Unable to parse src/lib/site-data.ts for CTA checks."],
      success: "",
    })
  }

  const text = stringifyText(site)
  const ctas = extractCtas(site)
  const ctaText = ctas.join(" ").toLowerCase()
  const genericOnly = ctas.length === 0 || ctas.every((cta) => /^(learn more|read more|click here|submit|contact)$/i.test(cta.trim()))
  const gaming = /minecraft|gaming|discord|server ip|player|game mode|store|vote/i.test(text)
  const ecommerce = !gaming && /ecommerce|shop|store|cart|checkout|product/i.test(text)
  const localService = !gaming && /quote|call|book|appointment|service area|localbusiness|near me/i.test(text)
  const errors = [
    genericOnly ? "CTAs are missing or only generic labels such as Learn more, Read more, Click here, Submit, or Contact." : null,
    gaming && !/(server ip|discord|login|register|store|vote|play|join)/i.test(ctaText) ? "Gaming/community site CTAs must include relevant actions such as server IP, Discord, login/register, store, vote, play, or join." : null,
    ecommerce && !/(shop|buy|cart|checkout|store|product|basket)/i.test(ctaText) ? "Ecommerce/store site CTAs must include purchase or shopping actions." : null,
    localService && !/(quote|call|book|contact|enquire|enquiry|appointment)/i.test(ctaText) ? "Local/service site CTAs must include relevant enquiry, quote, call, booking, or contact actions." : null,
  ].filter(Boolean) as string[]

  return scanResult({
    name: "cta_relevance",
    command: "verify generated CTA relevance",
    errors,
    success: "Generated CTAs match the detected site type and conversion intent.",
  })
}

export function buildSchemaAppropriatenessQaResult(files: ForgeQaGeneratedFile[]): ForgeQaCommandResult {
  const site = parseGeneratedSite(files)
  const seo = files.find((file) => file.path === "src/lib/seo.ts")?.content ?? ""
  const text = stringifyText(site ?? {}) + "\n" + seo
  const gaming = /minecraft|gaming|discord|server ip|player|game mode|vote/i.test(text)
  const localSignal = /nottingham|london|manchester|birmingham|service area|near me|local/i.test(text)
  const schemas = [...text.matchAll(/\b(LocalBusiness|Service|Product|Organization|FAQPage|BreadcrumbList|WebSite|WebPage)\b/g)].map((match) => match[1])
  // Only flag *actual* LocalBusiness JSON-LD usage in the generated seo.ts, not recommendation prose
  // in site-data such as "No LocalBusiness unless truly local", which would be a false positive.
  const usesLocalBusinessSchema = /"@type"\s*:\s*"LocalBusiness"/.test(seo)
  const errors = [
    !seo ? "Missing generated SEO metadata file." : null,
    schemas.length === 0 ? "No recognizable JSON-LD schema types were generated." : null,
    gaming && usesLocalBusinessSchema ? "Gaming/community/server sites must not use LocalBusiness schema unless truly local." : null,
    !localSignal && /home in \[[^\]]+\]/i.test(text) ? "Generated output contains 'home in [location]' without a local-site context." : null,
  ].filter(Boolean) as string[]

  return scanResult({
    name: "schema_appropriateness",
    command: "verify schema matches site type",
    errors,
    success: "Generated schema is present and appropriate for the detected site type.",
  })
}

export function buildMobileResponsiveQaResult(files: ForgeQaGeneratedFile[]): ForgeQaCommandResult {
  const componentText = files
    .filter((file) => /^src\/(app|components)\//.test(file.path) && /\.(tsx|css)$/.test(file.path))
    .map((file) => file.content)
    .join("\n")
  const errors = [
    /md:|sm:|lg:|xl:/.test(componentText) ? null : "Generated components do not include responsive breakpoint classes.",
    /grid|flex/.test(componentText) ? null : "Generated components do not use flexible grid/flex layouts.",
    /max-w-|w-full|min-h-|overflow-/.test(componentText) ? null : "Generated components are missing basic width/overflow constraints.",
    /\bw-\[(?:7|8|9)\d{2,}px\]|\bwidth:\s*(?:7|8|9)\d{2,}px/i.test(componentText) ? "Generated components contain large fixed-width layout values." : null,
  ].filter(Boolean) as string[]

  return scanResult({
    name: "mobile_responsive",
    command: "verify basic responsive layout support",
    errors,
    success: "Generated components include responsive breakpoints, flexible layout, and basic width constraints.",
  })
}

export function buildContentDepthQaResult(files: ForgeQaGeneratedFile[]): ForgeQaCommandResult {
  const site = parseGeneratedSite(files)
  if (!site || !Array.isArray(site.pages)) {
    return scanResult({
      name: "content_depth",
      command: "verify pages are not thin or generic",
      errors: ["Unable to parse src/lib/site-data.ts for content depth checks."],
      success: "",
    })
  }

  const pages = site.pages.filter((page): page is Record<string, unknown> => Boolean(page) && typeof page === "object")
  const thinPages: string[] = []
  const bodySignatures = new Map<string, number>()

  for (const page of pages) {
    const path = typeof page.path === "string" ? page.path : "(unknown page)"
    const bodyText = [
      page.heroSubheading,
      stringifyText(page.sections ?? []),
      stringifyText(page.serviceDescriptions ?? []),
      stringifyText(page.faqItems ?? []),
      page.trustProofCopy,
      page.localSeoCopy,
    ].map((value) => stringifyText(value ?? "")).join(" ")
    const wordCount = countWords(bodyText)
    if (wordCount < FORGE_MIN_PAGE_BODY_WORDS) {
      thinPages.push(`${path} (${wordCount} words)`)
    }

    const signature = normaliseSignature(bodyText)
    if (signature) bodySignatures.set(signature, (bodySignatures.get(signature) ?? 0) + 1)
  }

  const duplicatePages = [...bodySignatures.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0)
  const errors = [
    pages.length === 0 ? "Generated site has no pages." : null,
    thinPages.length ? `Thin pages below ${FORGE_MIN_PAGE_BODY_WORDS} words of substantive copy: ${thinPages.join(", ")}.` : null,
    duplicatePages >= 2 ? `${duplicatePages} pages share near-identical body copy, indicating generic/duplicated content.` : null,
  ].filter(Boolean) as string[]

  return scanResult({
    name: "content_depth",
    command: "verify pages are not thin or generic",
    errors,
    success: `All ${pages.length} pages carry substantive, non-duplicated copy.`,
  })
}

export function buildForbiddenGenericContentQaResult(files: ForgeQaGeneratedFile[]): ForgeQaCommandResult {
  const text = collectClientFacingText(files)
  const site = parseGeneratedSite(files)
  const intentionallyWorldwide = /worldwide/i.test(stringifyText(site?.targetAudience ?? "") + " " + stringifyText(site?.primaryGoal ?? "") + " " + stringifyText(site?.brandNotes ?? ""))
  const forbidden = findForbiddenTerms(text, [
    /\bN\/A\b/i,
    /lorem ipsum/i,
    /\bclear explanation\b/i,
    /\bservice comparison guide\b/i,
    /\bplaceholder\b/i,
    /\byour business name\b/i,
    /\bgeneric instruction-like copy\b/i,
    /\bhome in \[[^\]]+\]/i,
    /\b\d{2,3}%\b.*\b(increase|growth|improvement|uplift|conversion|traffic|revenue)\b/i,
    /\b(increase|growth|improvement|uplift|conversion|traffic|revenue)\b.*\b\d{2,3}%\b/i,
    intentionallyWorldwide ? /$a/ : /\bworldwide\b/i,
  ])

  return scanResult({
    name: "forbidden_generic_content",
    command: "scan forbidden final-output terms",
    errors: forbidden.map((hit) => `Forbidden final output content found: ${hit}.`),
    success: "No forbidden generic final-output terms were found.",
  })
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

function packSpecificDesignErrors(
  design: ForgeDesignDirection,
  files: { cssAndConfig: string; renderedContext: string },
) {
  if (design.selectedStylePack !== "Neon command hub") return []
  const css = files.cssAndConfig
  const renderedContext = files.renderedContext
  return [
    /Georgia/.test(css) ? "Neon command hub output must not use Georgia/editorial typography." : null,
    /#f7f4ef|#fbfaf7|#f4efe6/i.test(css) ? "Neon command hub output contains the old beige/editorial palette." : null,
    /\b(beige|cream|tan|brown)\b/i.test(css) ? "Neon command hub output contains forbidden beige/cream/tan/brown design language." : null,
    /server|discord|store|status|player|command|minecraft|gaming/i.test(renderedContext)
      ? null
      : "Neon command hub hero does not include any gaming/server/status signal.",
  ].filter(Boolean) as string[]
}

function scanResult({
  name,
  command,
  errors,
  success,
}: {
  name: ForgeQaCommandName
  command: string
  errors: string[]
  success: string
}): ForgeQaCommandResult {
  return {
    name,
    command,
    status: errors.length ? "failed" : "passed",
    exitCode: errors.length ? 1 : 0,
    durationMs: 0,
    stdout: errors.length ? "" : success,
    stderr: errors.join(" "),
    skippedReason: null,
  }
}

function collectClientFacingText(files: ForgeQaGeneratedFile[]) {
  const site = parseGeneratedSite(files)
  const siteText = site ? stringifyText({
    businessName: site.businessName,
    industry: site.industry,
    brandNotes: site.brandNotes,
    targetAudience: site.targetAudience,
    primaryGoal: site.primaryGoal,
    nav: site.nav,
    services: site.services,
    pages: site.pages,
  }) : ""
  const componentStrings = files
    .filter((file) => /^src\/components\/.*\.tsx$/.test(file.path))
    .flatMap((file) => extractHumanStrings(file.content))
    .join("\n")

  return `${siteText}\n${componentStrings}`
}

function parseGeneratedSite(files: ForgeQaGeneratedFile[]) {
  const siteData = files.find((file) => file.path === "src/lib/site-data.ts")?.content
  if (!siteData) return null
  const match = siteData.match(/export const site = ([\s\S]*?) as const/)
  if (!match) return null
  try {
    return JSON.parse(match[1]) as Record<string, unknown>
  } catch {
    return null
  }
}

function extractCtas(site: Record<string, unknown>) {
  const pages = Array.isArray(site.pages) ? site.pages : []
  return pages.flatMap((page) => {
    if (!page || typeof page !== "object") return []
    const record = page as Record<string, unknown>
    return [record.primaryCta, record.secondaryCta].filter((value): value is string => typeof value === "string" && value.trim().length > 0)
  })
}

function extractHumanStrings(source: string) {
  const strings: string[] = []
  const regex = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(source))) {
    const value = match[2]
      .replace(/\\n/g, " ")
      .replace(/\\"/g, "\"")
      .replace(/\\'/g, "'")
      .replace(/\s+/g, " ")
      .trim()
    if (/[a-zA-Z]{3,}\s+[a-zA-Z]{3,}/.test(value) && !/^https?:/i.test(value) && !/^[\w:/@.-]+$/.test(value)) {
      strings.push(value)
    }
  }
  return strings
}

function stringifyText(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return value.map(stringifyText).join("\n")
  if (value && typeof value === "object") return Object.values(value).map(stringifyText).join("\n")
  return ""
}

function countWords(text: string) {
  const words = text.trim().match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g)
  return words ? words.length : 0
}

function normaliseSignature(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 400)
}

function findForbiddenTerms(text: string, patterns: RegExp[]) {
  const hits = new Set<string>()
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[0]) hits.add(match[0])
  }
  return [...hits]
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

export function buildDeterministicForgeRepairPatchResponse({
  report,
  files,
}: {
  report: ForgeQaReport
  files: { path: string; content: string }[]
}): ForgeRepairPatchResponse {
  const failureText = [
    report.failureSummary,
    ...report.commands.flatMap((command) => [command.stdout, command.stderr]),
  ].filter(Boolean).join("\n")
  const patches: ForgeRepairPatch[] = []
  const siteData = files.find((file) => file.path === "src/lib/site-data.ts")

  if (
    siteData &&
    (/readonly|trustElements|SitePage|not comparable to type 'SitePage'|cannot be assigned to the mutable type/i.test(failureText) ||
      /trustElements: string\[\]|sectionHeadings: string\[\]|serviceDescriptions: string\[\]/.test(siteData.content))
  ) {
    const updated = siteData.content
      .replace(/trustElements: string\[\]/g, "trustElements: readonly string[]")
      .replace(/sectionHeadings: string\[\]/g, "sectionHeadings: readonly string[]")
      .replace(/sections: \{ heading: string; body: string \}\[\]/g, "sections: readonly { readonly heading: string; readonly body: string }[]")
      .replace(/faqItems: \{ question: string; answer: string \}\[\]/g, "faqItems: readonly { readonly question: string; readonly answer: string }[]")
      .replace(/serviceDescriptions: string\[\]/g, "serviceDescriptions: readonly string[]")

    if (updated !== siteData.content) {
      patches.push({
        path: siteData.path,
        content: updated,
        reason: "Align generated SitePage array fields with the readonly site data emitted using as const.",
      })
    }
  }

  return {
    summary: patches.length
      ? "Applied deterministic generated-site repairs after the AI repair provider was unavailable."
      : "AI repair provider was unavailable; no deterministic file patch matched, so QA should be rerun with the current local checks.",
    patches,
  }
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
    const commands = record.commands as ForgeQaCommandResult[]
    return {
      status: record.status,
      workspacePath: record.workspacePath,
      generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : record.completedAt,
      completedAt: record.completedAt,
      commands,
      summary: record.summary,
      failureSummary: typeof record.failureSummary === "string" ? record.failureSummary : null,
      // Older persisted reports predate the readiness field; recompute it from their command results.
      readiness: isReadinessAssessment(record.readiness) ? record.readiness : computeForgeReadiness(commands),
      repairHistory: Array.isArray(record.repairHistory) ? record.repairHistory as ForgeRepairAttempt[] : [],
    }
  }

  return null
}

function isReadinessAssessment(value: unknown): value is ForgeReadinessAssessment {
  return Boolean(value) && typeof value === "object" &&
    typeof (value as ForgeReadinessAssessment).score === "number" &&
    typeof (value as ForgeReadinessAssessment).band === "string" &&
    Array.isArray((value as ForgeReadinessAssessment).checks)
}
