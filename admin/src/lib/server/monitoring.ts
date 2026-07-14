import { AsyncLocalStorage } from "node:async_hooks"
import { normalizeUnknownError, redactLogValue, type LogContext } from "./logging"
import { currentRequestLogContext, requestLogger } from "./request-context"

export type MonitoringLevel = "debug" | "info" | "warning" | "error" | "fatal"
export interface MonitoringActor { id: string }
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
  captureException(error: unknown, event: MonitoringEvent): void | string | Promise<void | string>
  captureMessage(message: string, event: MonitoringEvent): void | string | Promise<void | string>
  setActor?(actor: MonitoringActor | null): void | Promise<void>
  setContext?(context: MonitoringContext): void | Promise<void>
  addBreadcrumb?(breadcrumb: MonitoringBreadcrumb): void | Promise<void>
}

interface MonitoringScope { actor?: MonitoringActor; context: MonitoringContext; breadcrumbs: MonitoringBreadcrumb[] }
const scopeStorage = new AsyncLocalStorage<MonitoringScope>()
interface MonitoringRegistry { provider: ErrorMonitoringProvider | null }
const registryKey = "__scalesmithsAdminMonitoringRegistry"
const monitoringGlobal = globalThis as typeof globalThis & { [registryKey]?: MonitoringRegistry }
const registry = monitoringGlobal[registryKey] ?? { provider: null }
monitoringGlobal[registryKey] = registry
const FORBIDDEN_MONITORING_KEY = /(?:prompt|messages?|provider(?:Request|Response)|requestBody|responseBody|generated(?:Source|Code)|sourceCode|fileContent|workspaceFiles?|contact(?:Form|Body)|formData|credentials?|authorization|cookies?|password|secrets?|apiKey|encryptionKey|mfaSecret)/i

export function registerErrorMonitoringProvider(next: ErrorMonitoringProvider | null) { registry.provider = next }
export function isErrorMonitoringConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(registry.provider && env.ERROR_MONITORING_PROVIDER && env.ERROR_MONITORING_PROVIDER !== "none")
}
export function errorMonitoringHealth(env: NodeJS.ProcessEnv = process.env) {
  const requestedProvider = env.ERROR_MONITORING_PROVIDER?.trim() || "none"
  const configured = Boolean(registry.provider && requestedProvider !== "none")
  return {
    application: "scalesmiths-admin",
    provider: requestedProvider,
    configured,
    status: requestedProvider === "none" ? "disabled" as const : configured ? "ready" as const : "misconfigured" as const,
    environment: env.ERROR_MONITORING_ENVIRONMENT?.trim() || env.NODE_ENV || "development",
    release: env.ERROR_MONITORING_RELEASE?.trim() || undefined,
  }
}
export function withMonitoringScope<T>(context: MonitoringContext, callback: () => T): T {
  const parent = scopeStorage.getStore()
  return scopeStorage.run({ actor: parent?.actor, context: { ...parent?.context, ...context }, breadcrumbs: [...(parent?.breadcrumbs ?? [])] }, callback)
}
export function setMonitoringActor(actor: MonitoringActor | null) {
  const scope = scopeStorage.getStore()
  if (scope) scope.actor = actor ?? undefined
  safelyInvoke(() => registry.provider?.setActor?.(actor))
}
export function setMonitoringContext(context: MonitoringContext) {
  const scope = scopeStorage.getStore()
  if (scope) Object.assign(scope.context, sanitizeMonitoringContext(context))
  safelyInvoke(() => registry.provider?.setContext?.(sanitizeMonitoringContext(context)))
}
export function addMonitoringBreadcrumb(breadcrumb: MonitoringBreadcrumb) {
  const safe = sanitizeBreadcrumb(breadcrumb)
  const scope = scopeStorage.getStore()
  if (scope) scope.breadcrumbs = [...scope.breadcrumbs.slice(-49), safe]
  safelyInvoke(() => registry.provider?.addBreadcrumb?.(safe))
}
export function captureMonitoringException(error: unknown, context: MonitoringContext = {}): string | undefined {
  if (!isErrorMonitoringConfigured()) return
  const event = buildEvent("error", context)
  const normalized = normalizeUnknownError(error, { safeMessage: "An internal operation failed." })
  return safelyInvoke(() => registry.provider?.captureException(normalized, event))
}
export function captureMonitoringMessage(message: string, level: MonitoringLevel = "info", context: MonitoringContext = {}): string | undefined {
  if (!isErrorMonitoringConfigured()) return
  return safelyInvoke(() => registry.provider?.captureMessage(String(redactLogValue(message)), buildEvent(level, context)))
}
export function sanitizeMonitoringContext(context: MonitoringContext): MonitoringContext {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, FORBIDDEN_MONITORING_KEY.test(key) ? "[redacted]" : redactLogValue(value, key)]))
}
function buildEvent(level: MonitoringLevel, context: MonitoringContext): MonitoringEvent {
  const scope = scopeStorage.getStore()
  const requestContext = currentRequestLogContext()
  const actorId = scope?.actor?.id ?? requestContext?.actorId
  return {
    level,
    context: sanitizeMonitoringContext({ ...requestContext, ...scope?.context, ...context }),
    actor: actorId ? sanitizeMonitoringActor({ id: actorId }) : undefined,
    breadcrumbs: scope?.breadcrumbs ?? [],
    release: process.env.ERROR_MONITORING_RELEASE?.trim() || undefined,
    environment: process.env.ERROR_MONITORING_ENVIRONMENT?.trim() || process.env.NODE_ENV || "development",
  }
}
function sanitizeMonitoringActor(actor: MonitoringActor): MonitoringActor {
  return { id: String(redactLogValue(actor.id, "actorId")) }
}
function sanitizeBreadcrumb(breadcrumb: MonitoringBreadcrumb): MonitoringBreadcrumb {
  return { category: String(redactLogValue(breadcrumb.category)), message: String(redactLogValue(breadcrumb.message)), level: breadcrumb.level, data: breadcrumb.data ? sanitizeMonitoringContext(breadcrumb.data) : undefined, timestamp: breadcrumb.timestamp ?? new Date().toISOString() }
}
function safelyInvoke(callback: () => void | string | Promise<void | string> | undefined): string | undefined {
  try {
    const result = callback()
    if (result instanceof Promise) {
      void result.catch((error) => requestLogger({ component: "error-monitoring" }).warn("Monitoring provider rejected an event", { error: normalizeUnknownError(error) }))
      return undefined
    }
    return typeof result === "string" ? result : undefined
  } catch (error) {
    requestLogger({ component: "error-monitoring" }).warn("Monitoring provider threw while capturing an event", { error: normalizeUnknownError(error) })
    return undefined
  }
}
