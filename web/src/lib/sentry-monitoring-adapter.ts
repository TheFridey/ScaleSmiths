import type { WebErrorMonitoringProvider, WebMonitoringEvent, WebMonitoringLevel } from "./server-monitoring"

export interface WebSentryScopeFacade {
  setLevel(level: WebMonitoringLevel): void
  setUser(user: { id: string } | null): void
  setTag(key: string, value: string): void
  setContext(name: string, context: Record<string, unknown> | null): void
}
export interface WebSentryFacade {
  withScope<T>(callback: (scope: WebSentryScopeFacade) => T): T
  captureException(error: unknown): string
  captureMessage(message: string): string
}

const SAFE_CONTEXT_KEYS = new Set([
  "requestId", "correlationId", "actorId", "projectId", "taskId", "forgeStage", "provider", "model",
  "artifactId", "duration", "durationMs", "errorCategory", "retryCount", "fallbackUsed", "deploymentEnvironment",
  "emailOperation", "quoteId", "clientRequestId", "statusCode", "method", "routePath",
])
const SAFE_TAG_KEYS = new Set(["application", "environment", "release", ...SAFE_CONTEXT_KEYS])
const SAFE_VALUE = /^[\p{L}\p{N} ._:/@+-]{1,256}$/u
const SECRET_VALUE_PATTERNS = [
  /\b(?:sk|re)_[A-Za-z0-9_-]{12,}\b/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*\b/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
]
const FORBIDDEN_FRAME = /(?:generated-sites|workspaceFiles?|workspace[/\\])/i

export function createWebSentryMonitoringProvider(sentry: WebSentryFacade): WebErrorMonitoringProvider {
  return {
    captureException(error, event) {
      return sentry.withScope((scope) => {
        configureScope(scope, event)
        return sentry.captureException(safeException(error, event))
      })
    },
    captureMessage(_message, event) {
      return sentry.withScope((scope) => {
        configureScope(scope, event)
        return sentry.captureMessage(eventTitle(event))
      })
    },
  }
}

export function sanitizeSentryEvent(event: unknown): void {
  if (!isRecord(event)) return
  delete event.extra
  delete event.modules
  delete event.server_name
  delete event.transaction_info
  delete event.transaction
  delete event.sdkProcessingMetadata
  delete event.spans

  if (isRecord(event.tags)) {
    event.tags = Object.fromEntries(
      Object.entries(event.tags).flatMap(([key, value]) => {
        const safe = SAFE_TAG_KEYS.has(key) ? safeString(String(value)) : undefined
        return safe ? [[key, safe]] : []
      }),
    )
  }

  if (isRecord(event.request)) {
    const method = safeString(event.request.method)
    const url = safeUrlPath(event.request.url)
    event.request = { ...(method ? { method } : {}), ...(url ? { url } : {}) }
  }
  if (isRecord(event.user)) {
    const id = safeString(event.user.id)
    event.user = id ? { id } : undefined
  }
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.slice(-50).map((breadcrumb) => {
      const record = isRecord(breadcrumb) ? breadcrumb : {}
      return { category: safeString(record.category) || "application", message: "Recorded server operation", level: safeLevel(record.level) }
    })
  }
  if (isRecord(event.contexts)) {
    event.contexts = Object.fromEntries(
      Object.entries(event.contexts)
        .filter(([key]) => key === "scalesmiths" || key === "runtime" || key === "os" || key === "device")
        .map(([key, value]) => [key, key === "scalesmiths" ? safeContext(isRecord(value) ? value : {}) : value]),
    )
  }
  if (isRecord(event.exception) && Array.isArray(event.exception.values)) {
    event.exception.values = event.exception.values.map((exception) => {
      if (!isRecord(exception)) return { type: "ServerError", value: "Captured server exception" }
      const stacktrace = isRecord(exception.stacktrace) ? exception.stacktrace : undefined
      if (stacktrace && Array.isArray(stacktrace.frames)) {
        stacktrace.frames = stacktrace.frames
          .filter((frame) => !isRecord(frame) || !FORBIDDEN_FRAME.test(String(frame.filename ?? frame.abs_path ?? "")))
          .map((frame) => {
            if (!isRecord(frame)) return frame
            delete frame.pre_context
            delete frame.context_line
            delete frame.post_context
            delete frame.vars
            return frame
          })
      }
      return { ...exception, type: safeErrorName(exception.type), value: "Captured server exception", ...(stacktrace ? { stacktrace } : {}) }
    })
  }
  event.message = typeof event.message === "string" ? "Captured server monitoring message" : event.message
  if (isRecord(event.logentry)) event.logentry = { formatted: "Captured server monitoring message" }
}

function configureScope(scope: WebSentryScopeFacade, event: WebMonitoringEvent) {
  scope.setLevel(event.level)
  scope.setUser(event.actor?.id ? { id: safeString(event.actor.id) || "unknown" } : null)
  scope.setTag("application", "scalesmiths-web")
  scope.setTag("environment", safeString(event.environment) || "unknown")
  if (event.release) scope.setTag("release", safeString(event.release) || "unknown")
  const context = safeContext(event.context)
  for (const [key, value] of Object.entries(context)) scope.setTag(key, String(value))
  scope.setContext("scalesmiths", context)
}

function safeContext(context: Record<string, unknown>) {
  const result: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(context)) {
    if (!SAFE_CONTEXT_KEYS.has(key)) continue
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value
    else if (typeof value === "boolean") result[key] = value
    else if (typeof value === "string") {
      const safe = safeString(value)
      if (safe) result[key] = safe
    }
  }
  return result
}

function safeException(error: unknown, event: WebMonitoringEvent) {
  const exception = new Error(eventTitle(event))
  if (!isRecord(error)) return exception
  exception.name = safeErrorName(error.name)
  if (typeof error.stack === "string") {
    const frames = error.stack.split("\n").slice(1).filter((line) => !FORBIDDEN_FRAME.test(line))
    exception.stack = [`${exception.name}: ${exception.message}`, ...frames].join("\n")
  }
  return exception
}

function eventTitle(event: WebMonitoringEvent) {
  const category = safeString(event.context.errorCategory) || "server_error"
  return `scalesmiths-web: ${category}`
}

function safeString(value: unknown) {
  if (typeof value !== "string") return undefined
  const redacted = SECRET_VALUE_PATTERNS.reduce((current, pattern) => current.replace(pattern, "[redacted]"), value).trim().slice(0, 256)
  return SAFE_VALUE.test(redacted) ? redacted : undefined
}
function safeUrlPath(value: unknown) {
  if (typeof value !== "string") return undefined
  try { return new URL(value, "https://monitoring.invalid").pathname.slice(0, 512) } catch { return undefined }
}
function safeErrorName(value: unknown) {
  const candidate = typeof value === "string" ? value.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80) : "ServerError"
  return candidate || "ServerError"
}
function safeLevel(value: unknown): WebMonitoringLevel | undefined {
  return value === "info" || value === "warning" || value === "error" ? value : undefined
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
