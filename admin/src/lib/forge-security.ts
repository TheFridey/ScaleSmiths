export const FORGE_RATE_LIMIT_WINDOW_MS = 60_000
export const FORGE_MUTATION_RATE_LIMIT = 30
export const FORGE_TASK_RATE_LIMIT = 10

export interface ForgeRateLimitBucket {
  count: number
  resetAt: number
}

export type ForgeRateLimitStore = Map<string, ForgeRateLimitBucket>

type ForgeRateLimitEnv = NodeJS.ProcessEnv | {
  FORGE_RATE_LIMIT_WINDOW_MS?: string
  FORGE_MUTATION_RATE_LIMIT?: string
  FORGE_TASK_RATE_LIMIT?: string
}

export function resolveForgeRateLimitConfig(env: ForgeRateLimitEnv = process.env) {
  return {
    windowMs: readPositiveInteger(env.FORGE_RATE_LIMIT_WINDOW_MS, FORGE_RATE_LIMIT_WINDOW_MS),
    mutationLimit: readPositiveInteger(env.FORGE_MUTATION_RATE_LIMIT, FORGE_MUTATION_RATE_LIMIT),
    taskLimit: readPositiveInteger(env.FORGE_TASK_RATE_LIMIT, FORGE_TASK_RATE_LIMIT),
  }
}

export function isForgeMutatingMethod(method: string) {
  return method === "POST" || method === "PATCH" || method === "DELETE"
}

export function isForgeTaskEndpoint(pathname: string) {
  return /^\/api\/forge\/ai\/test$/.test(pathname) ||
    /^\/api\/forge\/projects\/[^/]+\/(?:accessibility|command-chat|component-spec|copy|copy-quality|deploy|design|export|generate-site|preview|proposal|qa|research|seo|sitemap|visual-critique|visual-qa|workspace)(?:\/)?$/.test(pathname)
}

export function buildForgeRateLimitKey(parts: {
  actor: string | null | undefined
  method: string
  pathname: string
  bucket: "mutation" | "task"
}) {
  return [parts.bucket, parts.actor || "anonymous", parts.method.toUpperCase(), parts.pathname].join(":")
}

export function resolveForgeRateLimitActor(parts: {
  userId?: string | null
  email?: string | null
  forwardedFor?: string | null
}) {
  return parts.userId?.trim() || parts.email?.trim() || parts.forwardedFor?.trim() || "admin"
}

export function checkForgeRateLimit(
  store: ForgeRateLimitStore,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  const existing = store.get(key)

  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true as const, remaining: Math.max(0, limit - 1), resetAt: now + windowMs }
  }

  if (existing.count >= limit) {
    return {
      ok: false as const,
      retryAfterMs: Math.max(0, existing.resetAt - now),
      resetAt: existing.resetAt,
    }
  }

  existing.count += 1
  return { ok: true as const, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt }
}

export function redactForgeSecrets(value: string) {
  return value
    .replace(/\b(OPENAI_API_KEY|ANTHROPIC_API_KEY|RESEND_API_KEY|WHATSAPP_ACCESS_TOKEN|STRIPE_SECRET_KEY)\s*[:=]\s*["']?[^"'\s]+/gi, "$1=[redacted]")
    .replace(/\b(?:sk|re)_[A-Za-z0-9_\-]{12,}\b/g, "[redacted-secret]")
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[redacted-private-key]")
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
