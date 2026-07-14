export type WebMonitoringLevel = "info" | "warning" | "error"
export interface WebMonitoringEvent {
  level: WebMonitoringLevel
  context: Record<string, unknown>
  actor?: { id: string }
  release?: string
  environment: string
}
export interface WebErrorMonitoringProvider {
  captureException(error: unknown, event: WebMonitoringEvent): void | string | Promise<void | string>
  captureMessage(message: string, event: WebMonitoringEvent): void | string | Promise<void | string>
}

interface WebMonitoringRegistry { provider: WebErrorMonitoringProvider | null }
const registryKey = "__scalesmithsWebMonitoringRegistry"
const monitoringGlobal = globalThis as typeof globalThis & { [registryKey]?: WebMonitoringRegistry }
const registry = monitoringGlobal[registryKey] ?? { provider: null }
monitoringGlobal[registryKey] = registry

const SENSITIVE_KEY = /(?:password|secret|authorization|cookie|api[_-]?key|token|payload|form|body|prompt|messages?|provider(?:Request|Response)|generated(?:Source|Code)|sourceCode|fileContent|workspaceFiles?|credential|encryptionKey)/i
const SECRET_PATTERNS = [
  /\b(?:sk|re)_[A-Za-z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
]

export function registerWebErrorMonitoringProvider(next: WebErrorMonitoringProvider | null) { registry.provider = next }

export function webErrorMonitoringHealth(env: NodeJS.ProcessEnv = process.env) {
  const requestedProvider = env.ERROR_MONITORING_PROVIDER?.trim() || "none"
  const configured = Boolean(registry.provider && requestedProvider !== "none")
  return {
    application: "scalesmiths-web",
    provider: requestedProvider,
    configured,
    status: requestedProvider === "none" ? "disabled" as const : configured ? "ready" as const : "misconfigured" as const,
    environment: env.ERROR_MONITORING_ENVIRONMENT?.trim() || env.NODE_ENV || "development",
    release: env.ERROR_MONITORING_RELEASE?.trim() || undefined,
  }
}

export function captureWebException(error: unknown, context: Record<string, unknown> = {}): string | undefined {
  if (!configured()) return
  const safeError = error instanceof Error
    ? { name: error.name, message: sanitizeString(error.message), stack: error.stack ? sanitizeString(error.stack).slice(0, 12_000) : undefined }
    : { name: "UnknownError", message: "Unknown error" }
  return invoke(() => registry.provider?.captureException(safeError, event("error", context)))
}

export function captureWebMessage(message: string, level: WebMonitoringLevel = "info", context: Record<string, unknown> = {}): string | undefined {
  if (!configured()) return
  return invoke(() => registry.provider?.captureMessage(sanitizeString(message), event(level, context)))
}

export function sanitizeWebMonitoringContext(context: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeValue(value)]))
}

function configured() {
  const requestedProvider = process.env.ERROR_MONITORING_PROVIDER?.trim()
  return Boolean(registry.provider && requestedProvider && requestedProvider !== "none")
}

function event(level: WebMonitoringLevel, context: Record<string, unknown>): WebMonitoringEvent {
  const actorId = typeof context.actorId === "string" && context.actorId.trim() ? sanitizeString(context.actorId) : undefined
  return {
    level,
    context: sanitizeWebMonitoringContext(context),
    actor: actorId ? { id: actorId } : undefined,
    release: process.env.ERROR_MONITORING_RELEASE?.trim() || undefined,
    environment: process.env.ERROR_MONITORING_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development",
  }
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeString(value).slice(0, 4_000)
  if (Array.isArray(value)) return value.slice(0, 50).map(sanitizeValue)
  if (isRecord(value)) return sanitizeWebMonitoringContext(value)
  return value
}

function sanitizeString(value: string) {
  return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, "[redacted]"), value)
}

function invoke(callback: () => void | string | Promise<void | string> | undefined): string | undefined {
  try {
    const result = callback()
    if (result instanceof Promise) {
      void result.catch(() => undefined)
      return undefined
    }
    return typeof result === "string" ? result : undefined
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
