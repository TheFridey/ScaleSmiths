export type WebMonitoringLevel = "info" | "warning" | "error"
export interface WebMonitoringEvent { level: WebMonitoringLevel; context: Record<string, unknown>; release?: string; environment: string }
export interface WebErrorMonitoringProvider {
  captureException(error: unknown, event: WebMonitoringEvent): void | Promise<void>
  captureMessage(message: string, event: WebMonitoringEvent): void | Promise<void>
}

let provider: WebErrorMonitoringProvider | null = null
const SENSITIVE_KEY = /(?:password|secret|authorization|cookie|api[_-]?key|token|payload|form|body|prompt|source)/i
const SECRET_PATTERN = /\b(?:sk|re)_[A-Za-z0-9_-]{12,}\b/g

export function registerWebErrorMonitoringProvider(next: WebErrorMonitoringProvider | null) { provider = next }
export function captureWebException(error: unknown, context: Record<string, unknown> = {}) {
  if (!configured()) return
  const safeError = error instanceof Error
    ? { name: error.name, message: sanitizeString(error.message), stack: error.stack ? sanitizeString(error.stack).slice(0, 12_000) : undefined }
    : { name: "UnknownError", message: "Unknown error" }
  invoke(() => provider?.captureException(safeError, event("error", context)))
}
export function captureWebMessage(message: string, level: WebMonitoringLevel = "info", context: Record<string, unknown> = {}) {
  if (!configured()) return
  invoke(() => provider?.captureMessage(sanitizeString(message), event(level, context)))
}
export function sanitizeWebMonitoringContext(context: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeValue(value)]))
}
function configured() { return Boolean(provider && process.env.ERROR_MONITORING_PROVIDER && process.env.ERROR_MONITORING_PROVIDER !== "none") }
function event(level: WebMonitoringLevel, context: Record<string, unknown>): WebMonitoringEvent {
  return { level, context: sanitizeWebMonitoringContext(context), release: process.env.ERROR_MONITORING_RELEASE?.trim() || undefined, environment: process.env.ERROR_MONITORING_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development" }
}
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeString(value).slice(0, 4_000)
  if (Array.isArray(value)) return value.slice(0, 50).map(sanitizeValue)
  if (value && typeof value === "object") return sanitizeWebMonitoringContext(value as Record<string, unknown>)
  return value
}
function sanitizeString(value: string) { return value.replace(SECRET_PATTERN, "[redacted]") }
function invoke(callback: () => void | Promise<void> | undefined) {
  try { const result = callback(); if (result && "catch" in result) void result.catch(() => undefined) } catch { /* monitoring must never affect the request */ }
}
