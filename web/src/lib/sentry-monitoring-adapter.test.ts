import { describe, expect, it } from "vitest"
import { createWebSentryMonitoringProvider, sanitizeSentryEvent, type WebSentryFacade, type WebSentryScopeFacade } from "./sentry-monitoring-adapter"
import type { WebMonitoringEvent } from "./server-monitoring"

function fakeSentry() {
  const tags: Record<string, string> = {}
  const contexts: Record<string, Record<string, unknown> | null> = {}
  const users: Array<{ id: string } | null> = []
  const exceptions: unknown[] = []
  const scope: WebSentryScopeFacade = {
    setLevel: () => undefined,
    setUser: (user) => { users.push(user) },
    setTag: (key, value) => { tags[key] = value },
    setContext: (name, context) => { contexts[name] = context },
  }
  const sentry: WebSentryFacade = {
    withScope: (callback) => callback(scope),
    captureException: (error) => { exceptions.push(error); return "exception-id" },
    captureMessage: () => "message-id",
  }
  return { sentry, tags, contexts, users, exceptions }
}

const event: WebMonitoringEvent = {
  level: "error",
  environment: "staging",
  release: "0123456789012345678901234567890123456789",
  actor: { id: "portal-user-id" },
  context: {
    correlationId: "request-2",
    quoteId: 12,
    errorCategory: "email_delivery",
    contactFormBody: "do not transmit the contact form",
    credentials: "do not transmit credentials",
  },
}

describe("web Sentry monitoring adapter", () => {
  it("attaches release, environment and correlation tags without form content", () => {
    const fake = fakeSentry()
    const provider = createWebSentryMonitoringProvider(fake.sentry)
    expect(provider.captureException({ name: "Error", stack: "Error: contact body\n at safe (src/file.ts:1:1)" }, event)).toBe("exception-id")
    expect(fake.tags).toMatchObject({
      application: "scalesmiths-web",
      environment: "staging",
      release: event.release,
      correlationId: "request-2",
      quoteId: "12",
      errorCategory: "email_delivery",
    })
    expect(fake.users).toEqual([{ id: "portal-user-id" }])
    const transmitted = JSON.stringify({ contexts: fake.contexts, exceptions: fake.exceptions })
    expect(transmitted).not.toContain("do not transmit")
    expect(transmitted).not.toContain("contact body")
  })

  it("strips request secrets and source context before provider delivery", () => {
    const providerEvent: Record<string, unknown> = {
      request: { url: "https://scalesmiths.co.uk/api/quote?token=secret", method: "POST", headers: { cookie: "private" }, data: "contact-form body" },
      extra: { prompt: "private", generatedSource: "source" },
      tags: { application: "scalesmiths-web", authorization: "Bearer private" },
      exception: { values: [{ type: "Error", value: "provider body", stacktrace: { frames: [{ filename: "src/file.ts", context_line: "const password = secret" }] } }] },
    }
    sanitizeSentryEvent(providerEvent)
    const transmitted = JSON.stringify(providerEvent)
    for (const forbidden of ["token=secret", "cookie", "contact-form body", "private", "generatedSource", "provider body", "password = secret", "Bearer private"]) {
      expect(transmitted).not.toContain(forbidden)
    }
    expect(providerEvent.request).toEqual({ url: "/api/quote", method: "POST" })
  })
})
