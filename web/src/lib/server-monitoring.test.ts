import { afterEach, describe, expect, it, vi } from "vitest"
import { captureWebException, registerWebErrorMonitoringProvider, sanitizeWebMonitoringContext, type WebMonitoringEvent } from "./server-monitoring"

afterEach(() => { registerWebErrorMonitoringProvider(null); vi.unstubAllEnvs() })

describe("web error monitoring", () => {
  it("redacts client forms and credentials", () => {
    expect(sanitizeWebMonitoringContext({ requestId: 4, formData: { email: "client@example.com" }, apiKey: "secret", note: "sk_1234567890abcdefghijkl" })).toEqual({ requestId: 4, formData: "[redacted]", apiKey: "[redacted]", note: "[redacted]" })
  })

  it("captures safe email failure metadata when configured", () => {
    vi.stubEnv("ERROR_MONITORING_PROVIDER", "test")
    const events: WebMonitoringEvent[] = []
    registerWebErrorMonitoringProvider({ captureException: (_error, event) => events.push(event), captureMessage: () => undefined })
    captureWebException(new Error("Resend failed with re_1234567890abcdefghijkl"), { emailOperation: "quote_confirmation", quoteId: 9 })
    expect(events[0]).toMatchObject({ level: "error", context: { emailOperation: "quote_confirmation", quoteId: 9 } })
  })
})
