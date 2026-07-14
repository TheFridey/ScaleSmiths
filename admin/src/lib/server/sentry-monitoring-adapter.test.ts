import { describe, expect, it } from "vitest"
import { createAdminSentryMonitoringProvider, sanitizeSentryEvent, type SentryFacade, type SentryScopeFacade } from "./sentry-monitoring-adapter"
import type { MonitoringEvent } from "./monitoring"

function fakeSentry() {
  const tags: Record<string, string> = {}
  const contexts: Record<string, Record<string, unknown> | null> = {}
  const users: Array<{ id: string } | null> = []
  const exceptions: unknown[] = []
  const messages: string[] = []
  const scope: SentryScopeFacade = {
    setLevel: () => undefined,
    setUser: (user) => { users.push(user) },
    setTag: (key, value) => { tags[key] = value },
    setContext: (name, context) => { contexts[name] = context },
    addBreadcrumb: () => undefined,
  }
  const sentry: SentryFacade = {
    withScope: (callback) => callback(scope),
    captureException: (error) => { exceptions.push(error); return "exception-id" },
    captureMessage: (message) => { messages.push(message); return "message-id" },
  }
  return { sentry, tags, contexts, users, exceptions, messages }
}

const event: MonitoringEvent = {
  level: "error",
  environment: "staging",
  release: "0123456789012345678901234567890123456789",
  actor: { id: "actor-7" },
  breadcrumbs: [],
  context: {
    requestId: "request-7",
    projectId: 22,
    taskId: 33,
    forgeStage: "build",
    prompt: "do not transmit this prompt",
    responseBody: "do not transmit this response",
    generatedSource: "do not transmit generated source",
  },
}

describe("admin Sentry monitoring adapter", () => {
  it("attaches approved release, environment, actor and Forge correlation tags only", () => {
    const fake = fakeSentry()
    const provider = createAdminSentryMonitoringProvider(fake.sentry)
    expect(provider.captureException({ name: "ProviderError", stack: "ProviderError: raw body\n at safe (src/file.ts:1:1)" }, event)).toBe("exception-id")

    expect(fake.tags).toMatchObject({
      application: "scalesmiths-admin",
      environment: "staging",
      release: event.release,
      requestId: "request-7",
      projectId: "22",
      taskId: "33",
      forgeStage: "build",
    })
    expect(fake.users).toEqual([{ id: "actor-7" }])
    const transmitted = JSON.stringify({ contexts: fake.contexts, exceptions: fake.exceptions })
    expect(transmitted).not.toContain("do not transmit")
    expect(transmitted).not.toContain("raw body")
  })

  it("strips request data, credentials and source context in the final provider hook", () => {
    const providerEvent: Record<string, unknown> = {
      request: { url: "https://admin.scalesmiths.co.uk/forge?token=secret", method: "POST", headers: { authorization: "Bearer secret" }, cookies: "session=secret", data: "contact-form body" },
      user: { id: "actor-1", email: "private@example.com", ip_address: "127.0.0.1" },
      extra: { prompt: "private prompt", fileContent: "generated source" },
      tags: { application: "scalesmiths-admin", cookie: "private-cookie" },
      breadcrumbs: [{ category: "console", message: "private prompt", data: { password: "secret" } }],
      exception: { values: [{ type: "Error", value: "provider response body", stacktrace: { frames: [{ filename: "src/file.ts", context_line: "const apiKey = secret", vars: { apiKey: "secret" } }, { filename: "generated-sites/1/page.tsx" }] } }] },
    }
    sanitizeSentryEvent(providerEvent)
    const transmitted = JSON.stringify(providerEvent)
    for (const forbidden of ["authorization", "session=secret", "contact-form body", "private prompt", "generated source", "provider response body", "apiKey = secret", "generated-sites", "private@example.com", "private-cookie"]) {
      expect(transmitted).not.toContain(forbidden)
    }
    expect(providerEvent.request).toEqual({ url: "/forge", method: "POST" })
  })
})
