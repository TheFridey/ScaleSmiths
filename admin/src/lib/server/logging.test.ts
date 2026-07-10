import { afterEach, describe, expect, it, vi } from "vitest"
import { createLogger, normalizeUnknownError, redactLogContext } from "./logging"
import { normalizeRequestId, requestLogger, withRequestLogContext } from "./request-context"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("structured logging redaction", () => {
  it("recursively redacts credentials, authorization, cookies, form payloads, and secret-shaped values", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(redactLogContext({
      password: "hunter2",
      nested: {
        apiKey: "provider-secret",
        authorization: "Bearer secret-token",
        cookie: "session=secret",
        inputTokens: 123,
        note: "key sk_1234567890abcdefghijkl",
      },
      payload: { email: "client@example.com", project: "private brief" },
      circular,
    })).toEqual({
      password: "[redacted]",
      nested: {
        apiKey: "[redacted]",
        authorization: "[redacted]",
        cookie: "[redacted]",
        inputTokens: 123,
        note: "key [redacted]",
      },
      payload: "[redacted]",
      circular: { self: "[circular]" },
    })
  })

  it("emits machine-readable JSON with Forge identifiers in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined)

    withRequestLogContext({ requestId: "req-123", actorId: "admin@example.com" }, () => {
      requestLogger({ projectId: 42, taskId: 77, forgeStage: "research" })
        .error("Forge task failed", { apiKey: "must-not-leak" })
    })

    const entry = JSON.parse(String(output.mock.calls[0][0])) as Record<string, unknown>
    expect(entry).toMatchObject({
      level: "error",
      message: "Forge task failed",
      requestId: "req-123",
      actorId: "admin@example.com",
      projectId: 42,
      taskId: 77,
      forgeStage: "research",
      apiKey: "[redacted]",
    })
  })
})

describe("error normalization", () => {
  it("retains redacted diagnostics while keeping a separate safe user message", () => {
    class ProviderFailure extends Error {
      safeMessage = "The AI provider is temporarily unavailable."
      code = "PROVIDER_502"
      retryable = true
    }
    const error = new ProviderFailure("OpenAI rejected sk_1234567890abcdefghijkl at the upstream endpoint")

    expect(normalizeUnknownError(error, { category: "ai_provider" })).toMatchObject({
      name: "Error",
      message: "OpenAI rejected [redacted] at the upstream endpoint",
      safeMessage: "The AI provider is temporarily unavailable.",
      category: "ai_provider",
      code: "PROVIDER_502",
      retryable: true,
    })
  })

  it("normalizes non-Error throws without exposing them as the user-facing message", () => {
    expect(normalizeUnknownError({ diagnostic: "internal" }, { safeMessage: "Safe failure." })).toMatchObject({
      name: "UnknownError",
      message: "Unknown error",
      safeMessage: "Safe failure.",
    })
  })
})

describe("request correlation", () => {
  it("preserves safe incoming IDs and replaces unsafe values", () => {
    expect(normalizeRequestId("request-123")).toBe("request-123")
    expect(normalizeRequestId("bad id with spaces")).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("supports readable development output", () => {
    vi.stubEnv("NODE_ENV", "development")
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined)
    createLogger({ requestId: "dev-1" }).debug("Preview started", { projectId: 5 })
    expect(String(output.mock.calls[0][0])).toContain("DEBUG Preview started")
    expect(String(output.mock.calls[0][0])).toContain('"projectId":5')
  })
})
