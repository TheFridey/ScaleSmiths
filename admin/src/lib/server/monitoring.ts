import { AsyncLocalStorage } from "node:async_hooks"
import { normalizeUnknownError, redactLogValue, type LogContext } from "./logging"
import { requestLogger } from "./request-context"

export type MonitoringLevel = "debug" | "info" | "warning" | "error" | "fatal"
export interface MonitoringActor { id: string; email?: string; username?: string }
export interface MonitoringBreadcrumb { category: string; message: string; level?: MonitoringLevel; data?: LogContext; timestamp?: string }
export interface MonitoringContext extends LogContext { actorId?: string; projectId?: number; taskId?: number; forgeStage?: string }
export interface MonitoringEvent {
  level: MonitoringLevel
  context: MonitoringContext
  actor?: MonitoringActor
  breadcrumbs: MonitoringBreadcrumb[]
  release?: string
  environment: string
}
export interface ErrorMonitoringProvider {
  captureException(error: unknown, event: MonitoringEvent): void | Promise<void>
  captureMessage(message: string, event: MonitoringEvent): void | Promise<void>
  setActor?(actor: MonitoringActor | null): void | Promise<void>
  setContext?(context: MonitoringContext): void | Promise<void>
  addBreadcrumb?(breadcrumb: MonitoringBreadcrumb): void | Promise<void>
}

interface MonitoringScope { actor?: MonitoringActor; context: MonitoringContext; breadcrumbs: MonitoringBreadcrumb[] }
const scopeStorage = new AsyncLocalStorage<MonitoringScope>()
let provider: ErrorMonitoringProvider | null = null
const FORBIDDEN_MONITORING_KEY = /(?:prompt|systemPrompt|providerResponse|responseBody|generatedSource|sourceCode|fileContent|workspaceFiles|requestBody|formData)/i

export function registerErrorMonitoringProvider(next: ErrorMonitoringProvider | null) { provider = next }
export function isErrorMonitoringConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(provider && env.ERROR_MONITORING_PROVIDER && env.ERROR_MONITORING_PROVIDER !== "none")
}
export function withMonitoringScope<T>(context: MonitoringContext, callback: () => T): T {
  const parent = scopeStorage.getStore()
  return scopeStorage.run({ actor: parent?.actor, context: { ...parent?.context, ...context }, breadcrumbs: [...(parent?.breadcrumbs ?? [])] }, callback)
}
export function setMonitoringActor(actor: MonitoringActor | null) {
  const scope = scopeStorage.getStore()
  if (scope) scope.actor = actor ?? undefined
  safelyInvoke(() => provider?.setActor?.(actor))
}
export function setMonitoringContext(context: MonitoringContext) {
  const scope = scopeStorage.getStore()
  if (scope) Object.assign(scope.context, sanitizeMonitoringContext(context))
  safelyInvoke(() => provider?.setContext?.(sanitizeMonitoringContext(context)))
}
export function addMonitoringBreadcrumb(breadcrumb: MonitoringBreadcrumb) {
  const safe = sanitizeBreadcrumb(breadcrumb)
  const scope = scopeStorage.getStore()
  if (scope) scope.breadcrumbs = [...scope.breadcrumbs.slice(-49), safe]
  safelyInvoke(() => provider?.addBreadcrumb?.(safe))
}
export function captureMonitoringException(error: unknown, context: MonitoringContext = {}) {
  if (!isErrorMonitoringConfigured()) return
  const event = buildEvent("error", context)
  const normalized = normalizeUnknownError(error, { safeMessage: "An internal operation failed." })
  safelyInvoke(() => provider?.captureException(normalized, event))
}
export function captureMonitoringMessage(message: string, level: MonitoringLevel = "info", context: MonitoringContext = {}) {
  if (!isErrorMonitoringConfigured()) return
  safelyInvoke(() => provider?.captureMessage(String(redactLogValue(message)), buildEvent(level, context)))
}
export function sanitizeMonitoringContext(context: MonitoringContext): MonitoringContext {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, FORBIDDEN_MONITORING_KEY.test(key) ? "[redacted]" : redactLogValue(value, key)]))
}
function buildEvent(level: MonitoringLevel, context: MonitoringContext): MonitoringEvent {
  const scope = scopeStorage.getStore()
  return {
    level,
    context: sanitizeMonitoringContext({ ...scope?.context, ...context }),
    actor: scope?.actor ? sanitizeMonitoringActor(scope.actor) : undefined,
    breadcrumbs: scope?.breadcrumbs ?? [],
    release: process.env.ERROR_MONITORING_RELEASE?.trim() || undefined,
    environment: process.env.ERROR_MONITORING_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development",
  }
}
function sanitizeMonitoringActor(actor: MonitoringActor): MonitoringActor {
  return {
    id: String(redactLogValue(actor.id, "actorId")),
    email: actor.email ? String(redactLogValue(actor.email, "actorEmail")) : undefined,
    username: actor.username ? String(redactLogValue(actor.username, "actorUsername")) : undefined,
  }
}
function sanitizeBreadcrumb(breadcrumb: MonitoringBreadcrumb): MonitoringBreadcrumb {
  return { category: String(redactLogValue(breadcrumb.category)), message: String(redactLogValue(breadcrumb.message)), level: breadcrumb.level, data: breadcrumb.data ? sanitizeMonitoringContext(breadcrumb.data) : undefined, timestamp: breadcrumb.timestamp ?? new Date().toISOString() }
}
function safelyInvoke(callback: () => void | Promise<void> | undefined) {
  try {
    const result = callback()
    if (result && typeof result.catch === "function") void result.catch((error) => requestLogger({ component: "error-monitoring" }).warn("Monitoring provider rejected an event", { error: normalizeUnknownError(error) }))
  } catch (error) {
    requestLogger({ component: "error-monitoring" }).warn("Monitoring provider threw while capturing an event", { error: normalizeUnknownError(error) })
  }
}
