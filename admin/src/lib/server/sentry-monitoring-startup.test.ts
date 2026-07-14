import { afterEach, describe, expect, it, vi } from "vitest"

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(() => "exception-id"),
  captureMessage: vi.fn(() => "message-id"),
  withScope: vi.fn((callback: (scope: Record<string, ReturnType<typeof vi.fn>>) => unknown) => callback({
    setLevel: vi.fn(), setUser: vi.fn(), setTag: vi.fn(), setContext: vi.fn(), addBreadcrumb: vi.fn(),
  })),
}))
vi.mock("@sentry/nextjs", () => sentry)

import { captureMonitoringMessage, registerErrorMonitoringProvider } from "./monitoring"
import { initializeAdminMonitoring } from "./sentry-monitoring-startup"

afterEach(() => {
  registerErrorMonitoringProvider(null)
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe("admin Sentry monitoring startup", () => {
  it("registers the concrete adapter when complete configuration is provided", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      ERROR_MONITORING_PROVIDER: "sentry",
      ERROR_MONITORING_DSN: "https://public@example.invalid/2",
      ERROR_MONITORING_RELEASE: "0".repeat(40),
      ERROR_MONITORING_ENVIRONMENT: "staging",
      ERROR_MONITORING_SAMPLE_RATE: "1",
    }
    expect(initializeAdminMonitoring(env)).toEqual({ status: "ready" })
    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({ sendDefaultPii: false, environment: "staging", release: "0".repeat(40), tracesSampleRate: 0 }))

    vi.stubEnv("ERROR_MONITORING_PROVIDER", "sentry")
    expect(captureMonitoringMessage("self-test", "info", { errorCategory: "monitoring_self_test" })).toBe("message-id")
  })

  it("contains SDK initialisation failure", () => {
    sentry.init.mockImplementationOnce(() => { throw new Error("SDK failed") })
    expect(() => initializeAdminMonitoring({
      NODE_ENV: "production",
      ERROR_MONITORING_PROVIDER: "sentry",
      ERROR_MONITORING_DSN: "https://public@example.invalid/2",
      ERROR_MONITORING_RELEASE: "0".repeat(40),
    })).not.toThrow()
  })
})
