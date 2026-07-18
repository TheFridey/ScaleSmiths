import * as Sentry from "@sentry/nextjs"
import type { ErrorEvent } from "@sentry/nextjs"
import { registerErrorMonitoringProvider } from "./monitoring"
import {
  createAdminSentryMonitoringProvider,
  sanitizeSentryEvent,
  type SentryFacade,
} from "./sentry-monitoring-adapter"

const RELEASE_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i

export function initializeAdminMonitoring(env: NodeJS.ProcessEnv = process.env) {
  const provider = env.ERROR_MONITORING_PROVIDER?.trim() || "none"
  if (provider === "none") {
    registerErrorMonitoringProvider(null)
    return { status: "disabled" as const }
  }
  if (provider !== "sentry") {
    registerErrorMonitoringProvider(null)
    return { status: "unsupported_provider" as const }
  }

  const dsn = env.ERROR_MONITORING_DSN?.trim()
  const environment = env.ERROR_MONITORING_ENVIRONMENT?.trim() || env.NODE_ENV || "development"
  const release = env.ERROR_MONITORING_RELEASE?.trim()
  if (!dsn || !release || (env.NODE_ENV === "production" && !RELEASE_SHA.test(release))) {
    registerErrorMonitoringProvider(null)
    return { status: "misconfigured" as const }
  }

  try {
    Sentry.init({
      dsn,
      environment,
      release,
      enabled: true,
      sendDefaultPii: false,
      sampleRate: errorSampleRate(env.ERROR_MONITORING_SAMPLE_RATE),
      tracesSampleRate: 0,
      beforeSend(event: ErrorEvent) {
        sanitizeSentryEvent(event)
        return event
      },
    })
    registerErrorMonitoringProvider(createAdminSentryMonitoringProvider(sentryFacade()))
    return { status: "ready" as const }
  } catch {
    registerErrorMonitoringProvider(null)
    return { status: "provider_failure" as const }
  }
}

function sentryFacade(): SentryFacade {
  return {
    withScope: (callback) => Sentry.withScope((scope) => callback({
      setLevel: (level) => scope.setLevel(level),
      setUser: (user) => scope.setUser(user),
      setTag: (key, value) => scope.setTag(key, value),
      setContext: (name, context) => scope.setContext(name, context),
      addBreadcrumb: (breadcrumb) => scope.addBreadcrumb(breadcrumb),
    })),
    captureException: (error) => Sentry.captureException(error),
    captureMessage: (message) => Sentry.captureMessage(message),
  }
}

function errorSampleRate(value: string | undefined) {
  const parsed = Number(value ?? "1")
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 1
}
