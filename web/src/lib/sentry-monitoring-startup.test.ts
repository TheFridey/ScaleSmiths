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

import { captureWebMessage, registerWebErrorMonitoringProvider } from "./server-monitoring"
import { initializeWebMonitoring } from "./sentry-monitoring-startup"

afterEach(() => {
  registerWebErrorMonitoringProvider(null)
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe("web Sentry monitoring startup", () => {
  it("registers the concrete adapter when complete configuration is provided", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "production",
      ERROR_MONITORING_PROVIDER: "sentry",
      ERROR_MONITORING_DSN: "https://public@example.invalid/1",
      ERROR_MONITORING_RELEASE: "0".repeat(40),
      ERROR_MONITORING_ENVIRONMENT: "staging",
      ERROR_MONITORING_SAMPLE_RATE: "1",
    }
    expect(initializeWebMonitoring(env)).toEqual({ status: "ready" })
    expect(sentry.init).toHaveBeenCalledWith(expect.objectContaining({ sendDefaultPii: false, environment: "staging", release: "0".repeat(40), tracesSampleRate: 0 }))

    vi.stubEnv("ERROR_MONITORING_PROVIDER", "sentry")
    expect(captureWebMessage("self-test", "info", { errorCategory: "monitoring_self_test" })).toBe("message-id")
  })

  it("contains SDK initialisation failure", () => {
    sentry.init.mockImplementationOnce(() => { throw new Error("SDK failed") })
    expect(() => initializeWebMonitoring({
      NODE_ENV: "production",
      ERROR_MONITORING_PROVIDER: "sentry",
      ERROR_MONITORING_DSN: "https://public@example.invalid/1",
      ERROR_MONITORING_RELEASE: "0".repeat(40),
    })).not.toThrow()
  })
})
