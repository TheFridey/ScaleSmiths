import { afterEach, describe, expect, it, vi } from "vitest"
import { addMonitoringBreadcrumb, captureMonitoringException, captureMonitoringMessage, registerErrorMonitoringProvider, setMonitoringActor, withMonitoringScope, type ErrorMonitoringProvider, type MonitoringEvent } from "./monitoring"

afterEach(() => { registerErrorMonitoringProvider(null); vi.unstubAllEnvs() })

describe("error monitoring abstraction", () => {
  it("is a graceful no-op without a configured provider", () => {
    expect(() => captureMonitoringException(new Error("ignored"))).not.toThrow()
    expect(() => captureMonitoringMessage("ignored")).not.toThrow()
  })

  it("captures scoped context, breadcrumbs, release and environment without sensitive content", () => {
    vi.stubEnv("ERROR_MONITORING_PROVIDER", "test")
    vi.stubEnv("ERROR_MONITORING_RELEASE", "release-123")
    vi.stubEnv("ERROR_MONITORING_ENVIRONMENT", "staging")
    const events: Array<{ error: unknown; event: MonitoringEvent }> = []
    const adapter: ErrorMonitoringProvider = {
      captureException: (error, event) => events.push({ error, event }),
      captureMessage: () => undefined,
    }
    registerErrorMonitoringProvider(adapter)

    withMonitoringScope({ projectId: 12, taskId: 34, forgeStage: "build", prompt: "private prompt" }, () => {
      setMonitoringActor({ id: "admin-1", email: "admin@example.com" })
      addMonitoringBreadcrumb({ category: "forge", message: "Task started", data: { apiKey: "secret", artifactId: 9 } })
      captureMonitoringException(new Error("failed with sk_1234567890abcdefghijkl"), { generatedSource: "full source", retryCount: 2 })
    })

    expect(events[0].event).toMatchObject({ release: "release-123", environment: "staging", actor: { id: "admin-1" }, context: { projectId: 12, taskId: 34, forgeStage: "build", prompt: "[redacted]", generatedSource: "[redacted]", retryCount: 2 } })
    expect(events[0].event.breadcrumbs[0]).toMatchObject({ data: { apiKey: "[redacted]", artifactId: 9 } })
    expect(JSON.stringify(events[0].error)).not.toContain("sk_1234567890")
  })

  it("contains provider failures and never changes the application control flow", () => {
    vi.stubEnv("ERROR_MONITORING_PROVIDER", "broken")
    registerErrorMonitoringProvider({ captureException: () => { throw new Error("adapter failed") }, captureMessage: () => Promise.reject(new Error("adapter failed")) })
    expect(() => captureMonitoringException(new Error("application failed"))).not.toThrow()
    expect(() => captureMonitoringMessage("application warning", "warning")).not.toThrow()
  })
})
