export type RetryCategory =
  | "authentication"
  | "invalid_request"
  | "model_unsupported"
  | "safety"
  | "budget"
  | "rate_limit"
  | "timeout"
  | "unavailable"
  | "invalid_response"
  | "network"
  | "schema_mismatch"

export interface RetryClassification {
  retryable: boolean
  category: RetryCategory
  retryAfterMs?: number
}

export interface RetryPolicyConfig {
  baseMs: number
  maxMs: number
  maxElapsedMs: number
  maxAttempts: number
}

const PERMANENT: ReadonlySet<RetryCategory> = new Set([
  "authentication",
  "invalid_request",
  "model_unsupported",
  "safety",
  "budget",
])

// Maps a provider-adapter error category (or a legacy "request" category) onto our retry taxonomy.
const CATEGORY_ALIASES: Record<string, RetryCategory> = {
  authentication: "authentication",
  invalid_request: "invalid_request",
  request: "invalid_request",
  model_unsupported: "model_unsupported",
  safety: "safety",
  budget: "budget",
  rate_limit: "rate_limit",
  timeout: "timeout",
  unavailable: "unavailable",
  invalid_response: "invalid_response",
  network: "network",
  schema_mismatch: "schema_mismatch",
}

export function classifyRetryability(error: unknown): RetryClassification {
  const shape = error as { category?: string; code?: string; retryable?: boolean; retryAfterMs?: number } | null
  const rawCategory = shape?.category ?? shape?.code
  const category = (rawCategory && CATEGORY_ALIASES[rawCategory]) || "network"
  const retryable = !PERMANENT.has(category)
  const retryAfterMs = typeof shape?.retryAfterMs === "number" && Number.isFinite(shape.retryAfterMs) ? shape.retryAfterMs : undefined
  return { retryable, category, retryAfterMs }
}

export function computeBackoffMs(
  attempt: number,
  opts: { baseMs: number; maxMs: number; retryAfterMs?: number; random?: () => number },
): number {
  const random = opts.random ?? Math.random
  const exponential = opts.baseMs * 2 ** Math.max(0, attempt)
  const cap = Math.min(opts.maxMs, exponential)
  const jittered = Math.round(random() * cap) // full jitter in [0, cap]
  if (typeof opts.retryAfterMs === "number" && Number.isFinite(opts.retryAfterMs)) {
    return Math.max(opts.retryAfterMs, jittered)
  }
  return jittered
}

export function nextRetryDecision(input: {
  classification: RetryClassification
  attempt: number
  elapsedMs: number
  config: RetryPolicyConfig
  random?: () => number
}): { retry: boolean; delayMs: number; reason: string } {
  const { classification, attempt, elapsedMs, config } = input
  if (!classification.retryable) {
    return { retry: false, delayMs: 0, reason: `permanent error (${classification.category})` }
  }
  if (attempt >= config.maxAttempts) {
    return { retry: false, delayMs: 0, reason: "max attempts reached" }
  }
  const delayMs = computeBackoffMs(attempt, {
    baseMs: config.baseMs,
    maxMs: config.maxMs,
    retryAfterMs: classification.retryAfterMs,
    random: input.random,
  })
  if (elapsedMs + delayMs > config.maxElapsedMs) {
    return { retry: false, delayMs: 0, reason: "max elapsed retry time reached" }
  }
  return { retry: true, delayMs, reason: `retrying ${classification.category}` }
}

export function resolveRetryPolicyConfig(
  env: Record<string, string | undefined>,
  maxAttempts: number,
): RetryPolicyConfig {
  return {
    baseMs: clampInt(env.FORGE_AI_RETRY_BASE_MS, 250, 50, 10_000),
    maxMs: clampInt(env.FORGE_AI_RETRY_MAX_MS, 8_000, 250, 60_000),
    maxElapsedMs: clampInt(env.FORGE_AI_RETRY_MAX_ELAPSED_MS, 30_000, 1_000, 300_000),
    maxAttempts: Math.max(0, maxAttempts),
  }
}

export function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}
