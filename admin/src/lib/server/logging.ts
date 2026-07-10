export type LogLevel = "debug" | "info" | "warn" | "error"
export type LogContext = Record<string, unknown>

const REDACTED = "[redacted]"
const SENSITIVE_KEY = /(?:authorization|cookie|password|passwd|secret|api[_-]?key|private[_-]?key|credential|session|access[_-]?key|(?:^|[_-])(?:access[_-]?|refresh[_-]?|auth[_-]?|id[_-]?)?token(?:$|[_-])|(?:access|refresh|auth|id)Token)/i
const FORM_PAYLOAD_KEY = /^(?:body|payload|form|formData|clientForm|requestBody)$/i
const SECRET_VALUE_PATTERNS = [
  /\b(?:sk|re)_[A-Za-z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
]
const MAX_DEPTH = 8
const MAX_STRING_LENGTH = 4_000

export interface NormalizedError {
  name: string
  message: string
  safeMessage: string
  category: string
  code?: string
  retryable?: boolean
  stack?: string
  cause?: NormalizedError
}

export function redactLogValue(value: unknown, key = "", depth = 0, seen = new WeakSet<object>()): unknown {
  if (SENSITIVE_KEY.test(key) || FORM_PAYLOAD_KEY.test(key)) return REDACTED
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") return value
  if (typeof value === "bigint") return value.toString()
  if (typeof value === "string") return redactString(value).slice(0, MAX_STRING_LENGTH)
  if (typeof value === "function" || typeof value === "symbol") return String(value)
  if (depth >= MAX_DEPTH) return "[max-depth]"
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return redactLogValue(normalizeUnknownError(value), key, depth + 1, seen)
  if (typeof value !== "object") return value
  if (seen.has(value)) return "[circular]"
  seen.add(value)

  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactLogValue(item, "", depth + 1, seen))

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
      childKey,
      redactLogValue(childValue, childKey, depth + 1, seen),
    ]),
  )
}

export function redactLogContext(context: LogContext): LogContext {
  return redactLogValue(context) as LogContext
}

export function normalizeUnknownError(
  error: unknown,
  options: { safeMessage?: string; category?: string; includeStack?: boolean } = {},
): NormalizedError {
  const candidate = error && typeof error === "object" ? error as Record<string, unknown> : null
  const name = error instanceof Error ? error.name : "UnknownError"
  const rawMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"
  const declaredSafeMessage = candidate && typeof candidate.safeMessage === "string" ? candidate.safeMessage : null
  const code = candidate && (typeof candidate.code === "string" || typeof candidate.code === "number") ? String(candidate.code) : undefined
  const retryable = candidate && typeof candidate.retryable === "boolean" ? candidate.retryable : undefined
  const category = options.category ?? errorCategory(name, code)
  const normalized: NormalizedError = {
    name,
    message: redactString(rawMessage),
    safeMessage: redactString(declaredSafeMessage ?? options.safeMessage ?? "An internal error occurred."),
    category,
  }

  if (code) normalized.code = redactString(code)
  if (retryable !== undefined) normalized.retryable = retryable
  if (options.includeStack !== false && error instanceof Error && error.stack) normalized.stack = redactString(error.stack).slice(0, 12_000)
  if (error instanceof Error && error.cause !== undefined && error.cause !== error) {
    normalized.cause = normalizeUnknownError(error.cause, { safeMessage: normalized.safeMessage, category, includeStack: options.includeStack })
  }
  return normalized
}

export interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
  child(context: LogContext): Logger
}

export function createLogger(baseContext: LogContext = {}): Logger {
  const write = (level: LogLevel, message: string, context: LogContext = {}) => {
    const entry = redactLogContext({
      timestamp: new Date().toISOString(),
      level,
      message,
      environment: process.env.NODE_ENV ?? "development",
      ...baseContext,
      ...context,
    })

    if (process.env.NODE_ENV === "production") {
      console[level === "debug" ? "log" : level](JSON.stringify(entry))
      return
    }

    const details = { ...entry }
    delete details.timestamp
    delete details.environment
    delete details.level
    delete details.message
    const suffix = Object.keys(details).length ? ` ${JSON.stringify(details)}` : ""
    console[level === "debug" ? "log" : level](`[${String(entry.timestamp)}] ${level.toUpperCase()} ${message}${suffix}`)
  }

  return {
    debug: (message, context) => write("debug", message, context),
    info: (message, context) => write("info", message, context),
    warn: (message, context) => write("warn", message, context),
    error: (message, context) => write("error", message, context),
    child: (context) => createLogger({ ...baseContext, ...context }),
  }
}

export const logger = createLogger({ service: "scalesmiths-admin" })

function redactString(value: string) {
  return SECRET_VALUE_PATTERNS.reduce((current, pattern) => current.replace(pattern, REDACTED), value)
}

function errorCategory(name: string, code?: string) {
  if (code) return code.toLowerCase()
  return name.replace(/Error$/, "").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase() || "unknown"
}
