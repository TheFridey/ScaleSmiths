import type { JsonValue } from "./forge-ai"

export const FORGE_OPERATOR_ERROR_CATEGORIES = [
  "missing_input",
  "approval_required",
  "provider_unavailable",
  "provider_rate_limited",
  "provider_output_invalid",
  "budget_exceeded",
  "worker_unavailable",
  "queue_stalled",
  "workspace_error",
  "build_error",
  "quality_failure",
  "integration_missing",
  "deployment_blocked",
  "internal_error",
] as const

export type ForgeOperatorErrorCategory = (typeof FORGE_OPERATOR_ERROR_CATEGORIES)[number]

export interface ForgeOperatorError extends Record<string, JsonValue> {
  stage: string
  category: ForgeOperatorErrorCategory
  summary: string
  technicalReference: string
  retryable: boolean
  recommendedAction: string
  affectedArtifactIds: number[]
  jobId: number | null
  runId: number | null
  timestamp: string
  metadata: Record<string, JsonValue>
}

export interface ForgeOperatorErrorContext {
  stage?: string | null
  category?: ForgeOperatorErrorCategory
  technicalReference?: string
  retryable?: boolean
  recommendedAction?: string
  affectedArtifactIds?: readonly number[]
  jobId?: number | null
  runId?: number | null
  timestamp?: Date
  metadata?: Record<string, unknown>
}

const SECRET_KEY = /(^|_)(secret|token|password|authorization|cookie|api_?key|access_?key|private_?key|provider_?response|raw_?response|response_?body|prompt)($|_)/i
const ABSOLUTE_PATH = /(?:[a-z]:[\\/][^\s"'`]+|\/(?:var|home|root|tmp|etc|opt|srv)\/[^\s"'`]+)/gi
const TOKEN_LIKE = /\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._~-]{12,})\b/gi

export function normalizeForgeOperatorError(error: unknown, context: ForgeOperatorErrorContext = {}): ForgeOperatorError {
  const raw = safeErrorMessage(error)
  const category = context.category ?? categoriseForgeFailure(raw)
  const retryable = context.retryable ?? defaultRetryable(category)
  return {
    stage: cleanText(context.stage ?? "forge", 80),
    category,
    summary: operatorSummary(category, raw),
    technicalReference: cleanReference(context.technicalReference ?? referenceFor(context)),
    retryable,
    recommendedAction: cleanText(context.recommendedAction ?? recommendedAction(category, retryable), 300),
    affectedArtifactIds: [...new Set(context.affectedArtifactIds ?? [])].filter((id) => Number.isInteger(id) && id > 0),
    jobId: positiveIdOrNull(context.jobId),
    runId: positiveIdOrNull(context.runId),
    timestamp: (context.timestamp ?? new Date()).toISOString(),
    metadata: redactForgeOperatorMetadata(context.metadata ?? {}),
  }
}

export function redactForgeOperatorMetadata(value: Record<string, unknown>): Record<string, JsonValue> {
  return redactRecord(value, 0)
}

export function categoriseForgeFailure(message: string): ForgeOperatorErrorCategory {
  const value = message.toLowerCase()
  if (/approval|required decision|awaiting approval/.test(value)) return "approval_required"
  if (/budget|spend limit|cost limit/.test(value)) return "budget_exceeded"
  if (/rate.?limit|too many requests|\b429\b/.test(value)) return "provider_rate_limited"
  if (/structured output|invalid json|schema validation|provider output/.test(value)) return "provider_output_invalid"
  if (/provider|openai|anthropic|model unavailable|circuit.*open/.test(value)) return "provider_unavailable"
  if (/worker|heartbeat|lease/.test(value)) return "worker_unavailable"
  if (/queue|stalled|queued too long/.test(value)) return "queue_stalled"
  if (/workspace|sandbox|permission denied|enoent/.test(value)) return "workspace_error"
  if (/build|compile|typecheck|syntax error/.test(value)) return "build_error"
  if (/quality|qa|lighthouse|accessibility|originality/.test(value)) return "quality_failure"
  if (/integration|resend|whatsapp|cloudinary|stripe/.test(value)) return "integration_missing"
  if (/deploy|release gate|publication blocked/.test(value)) return "deployment_blocked"
  if (/missing|required input|prerequisite|artifact/.test(value)) return "missing_input"
  return "internal_error"
}

function redactRecord(value: Record<string, unknown>, depth: number): Record<string, JsonValue> {
  if (depth > 5) return { truncated: true }
  const result: Record<string, JsonValue> = {}
  for (const [key, item] of Object.entries(value).slice(0, 50)) {
    if (SECRET_KEY.test(key)) {
      result[key] = "[redacted]"
    } else {
      result[key] = redactValue(item, depth + 1)
    }
  }
  return result
}

function redactValue(value: unknown, depth: number): JsonValue {
  if (value === null || typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") return cleanText(value, 1000)
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactValue(item, depth + 1))
  if (value && typeof value === "object") return redactRecord(value as Record<string, unknown>, depth)
  return String(value ?? "")
}

function safeErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "An unexpected Forge operation failed."
}

function cleanText(value: string, max: number) {
  return value.replace(TOKEN_LIKE, "[redacted]").replace(ABSOLUTE_PATH, "[sensitive path]").replace(/\s+/g, " ").trim().slice(0, max)
}

function cleanReference(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9:_-]/g, "").slice(0, 120)
  return cleaned || "forge:unavailable"
}

function referenceFor(context: ForgeOperatorErrorContext) {
  return `forge:${context.runId ?? "no-run"}:${context.jobId ?? "no-job"}:${Date.now().toString(36)}`
}

function positiveIdOrNull(value: number | null | undefined) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null
}

function defaultRetryable(category: ForgeOperatorErrorCategory) {
  return ["provider_unavailable", "provider_rate_limited", "provider_output_invalid", "worker_unavailable", "queue_stalled", "workspace_error", "build_error", "quality_failure", "internal_error"].includes(category)
}

function operatorSummary(category: ForgeOperatorErrorCategory, raw: string) {
  const cleaned = cleanText(raw, 260)
  const safeFallback: Record<ForgeOperatorErrorCategory, string> = {
    missing_input: "Forge is missing a required production input.",
    approval_required: "Forge is waiting for an authorised approval.",
    provider_unavailable: "The selected AI provider is currently unavailable.",
    provider_rate_limited: "The selected AI provider is temporarily rate limited.",
    provider_output_invalid: "The provider returned output that failed validation.",
    budget_exceeded: "The approved Forge budget has been exhausted.",
    worker_unavailable: "No healthy Forge worker can process this work.",
    queue_stalled: "The job has remained queued beyond the operational threshold.",
    workspace_error: "Forge could not safely access the generated-site workspace.",
    build_error: "The generated site failed its build checks.",
    quality_failure: "The output did not meet the required quality gate.",
    integration_missing: "A required production integration is not configured.",
    deployment_blocked: "Deployment is blocked by an unresolved release gate.",
    internal_error: "Forge encountered an internal operational error.",
  }
  return cleaned && category !== "internal_error" ? cleaned : safeFallback[category]
}

function recommendedAction(category: ForgeOperatorErrorCategory, retryable: boolean) {
  if (!retryable) {
    if (category === "approval_required") return "Open the required approval and record an authorised decision."
    if (category === "budget_exceeded") return "Review the approved budget or provide an authorised override with a reason."
    if (category === "integration_missing") return "Configure and validate the required integration."
    if (category === "deployment_blocked") return "Resolve the failed release gate before attempting deployment."
    return "Correct the recorded prerequisite before continuing."
  }
  if (category.startsWith("provider_")) return "Retry with a healthy configured fallback provider."
  if (category === "worker_unavailable" || category === "queue_stalled") return "Restore worker health, then retry or cancel the affected job."
  if (category === "quality_failure" || category === "build_error") return "Inspect the failed checks, apply a repair, then retry the stage."
  return "Open the technical details, correct the cause, and retry when safe."
}
