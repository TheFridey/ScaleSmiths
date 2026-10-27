import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { COOKIE_CONSENT_COOKIE, COOKIE_POLICY_VERSION } from "./cookie-consent"

type ClientModule = typeof import("./experience-analytics-client")

const SENT_KEY = "scalesmiths.analytics.sent"
const SESSION_KEY = "scalesmiths.analytics.session"

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    removeItem: vi.fn((key: string) => { values.delete(key) }),
  }
}

function consentCookie(analytics: boolean) {
  const value = { version: COOKIE_POLICY_VERSION, functional: false, analytics, marketing: false, decidedAt: "2026-01-01T00:00:00.000Z" }
  return `${COOKIE_CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(value))}`
}

let sessionStorage: ReturnType<typeof memoryStorage>
let sendBeacon: ReturnType<typeof vi.fn>
let fetchMock: ReturnType<typeof vi.fn>
let navigatorStub: Record<string, unknown>
let documentStub: { cookie: string; referrer: string }

async function loadClient(): Promise<ClientModule> {
  vi.resetModules()
  return import("./experience-analytics-client")
}

function sentKeys(): string[] {
  return JSON.parse(sessionStorage.values.get(SENT_KEY) ?? "[]") as string[]
}

function beaconPayload(callIndex = 0) {
  return sendBeacon.mock.calls[callIndex][1] as Blob
}

async function flushPromises() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
}

beforeEach(() => {
  sessionStorage = memoryStorage()
  sendBeacon = vi.fn(() => true)
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
  navigatorStub = { sendBeacon }
  documentStub = { cookie: consentCookie(true), referrer: "" }

  vi.stubGlobal("window", {
    location: { pathname: "/services", search: "" },
    sessionStorage,
    localStorage: memoryStorage(),
    innerWidth: 1280,
  })
  vi.stubGlobal("document", documentStub)
  vi.stubGlobal("navigator", navigatorStub)
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("trackExperienceEvent transport", () => {
  it("records the event after sendBeacon queues it and does not fall back to fetch", async () => {
    const { trackExperienceEvent } = await loadClient()

    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(sendBeacon).toHaveBeenCalledWith("/api/experience-events", expect.any(Blob))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sentKeys()).toHaveLength(1)
  })

  it("falls back to keepalive fetch when sendBeacon declines to queue the event", async () => {
    sendBeacon.mockReturnValue(false)
    const { trackExperienceEvent } = await loadClient()

    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(sentKeys()).toHaveLength(0)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/experience-events")
    expect(init).toMatchObject({ method: "POST", keepalive: true, headers: { "Content-Type": "application/json" } })
    expect(init.body).toBe(await beaconPayload().text())

    await flushPromises()
    expect(sentKeys()).toHaveLength(1)
  })

  it("falls back to fetch without surfacing an error when sendBeacon throws", async () => {
    sendBeacon.mockImplementation(() => { throw new TypeError("Beacon payload too large") })
    const { trackExperienceEvent } = await loadClient()

    expect(() => trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })).not.toThrow()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    await flushPromises()
    expect(sentKeys()).toHaveLength(1)
  })

  it("uses fetch directly when the Beacon API is unavailable", async () => {
    delete navigatorStub.sendBeacon
    const { trackExperienceEvent } = await loadClient()

    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    await flushPromises()
    expect(sentKeys()).toHaveLength(1)
  })

  it("does not mark the event sent when the fallback fetch rejects, so a later attempt can resend it", async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    const { trackExperienceEvent } = await loadClient()

    expect(() => trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })).not.toThrow()
    await flushPromises()
    expect(sentKeys()).toHaveLength(0)

    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await flushPromises()
    expect(sentKeys()).toHaveLength(1)
  })

  it("does not mark the event sent when the server responds with a retryable error", async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
    const { trackExperienceEvent } = await loadClient()

    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })
    await flushPromises()

    expect(sentKeys()).toHaveLength(0)
  })

  it("does not throw when fetch itself throws synchronously", async () => {
    sendBeacon.mockReturnValue(false)
    fetchMock.mockImplementation(() => { throw new TypeError("fetch unavailable") })
    const { trackExperienceEvent } = await loadClient()

    expect(() => trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })).not.toThrow()
    expect(sentKeys()).toHaveLength(0)
  })
})

describe("trackExperienceEvent duplicate suppression", () => {
  it("sends a repeated event only once after it has been queued", async () => {
    const { trackExperienceEvent } = await loadClient()

    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })
    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })
    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not start a second request while the first fallback request is still in flight", async () => {
    sendBeacon.mockReturnValue(false)
    let resolveFetch: (response: Response) => void = () => undefined
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFetch = resolve }))
    const { trackExperienceEvent } = await loadClient()

    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })
    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })

    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFetch(new Response(null, { status: 200 }))
    await flushPromises()
    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })
    expect(sendBeacon).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("treats distinct targets as distinct events", async () => {
    const { trackExperienceEvent } = await loadClient()

    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })
    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/services" } })

    expect(sendBeacon).toHaveBeenCalledTimes(2)
    expect(sentKeys()).toHaveLength(2)
  })
})

describe("trackExperienceEvent privacy", () => {
  it.each([
    ["analytics consent denied", () => { documentStub.cookie = consentCookie(false) }],
    ["no consent decision", () => { documentStub.cookie = "" }],
    ["Global Privacy Control", () => { navigatorStub.globalPrivacyControl = true }],
    ["Do Not Track", () => { navigatorStub.doNotTrack = "1" }],
    ["analytics opt-out cookie", () => { documentStub.cookie = `${consentCookie(true)}; ss_analytics_opt_out=1` }],
  ])("neither transmits nor writes analytics storage with %s", async (_label, applyOptOut) => {
    applyOptOut()
    const { trackExperienceEvent } = await loadClient()

    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })
    await flushPromises()

    expect(sendBeacon).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(sessionStorage.setItem).not.toHaveBeenCalled()
    expect(sessionStorage.values.has(SESSION_KEY)).toBe(false)
    expect(sessionStorage.values.has(SENT_KEY)).toBe(false)
  })

  it("sends the same privacy-minimised payload shape on both transports", async () => {
    const { trackExperienceEvent } = await loadClient()
    trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })
    const beaconBody = JSON.parse(await beaconPayload().text()) as Record<string, unknown>

    sendBeacon.mockReturnValue(false)
    const fallbackClient = await loadClient()
    sessionStorage.values.delete(SENT_KEY)
    fallbackClient.trackExperienceEvent("quote_cta_clicked", { metadata: { target: "/quote" } })
    const fetchBody = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string) as Record<string, unknown>

    const expectedKeys = [
      "campaign", "completionDepth", "deviceClass", "errorCategory", "eventKey", "eventName", "fromExperience",
      "interactiveStep", "metadata", "path", "preference", "referrer", "returningPreference", "sessionId", "toExperience",
    ]
    expect(Object.keys(beaconBody).sort()).toEqual(expectedKeys)
    expect(Object.keys(fetchBody).sort()).toEqual(expectedKeys)
    expect(fetchBody).toEqual(beaconBody)
    expect(fetchBody.metadata).toEqual({ target: "/quote" })
    const serialised = JSON.stringify(fetchBody)
    for (const forbidden of ["userAgent", "email", "ipAddress", "cookie", "attempt", "transport"]) {
      expect(serialised).not.toContain(forbidden)
    }
  })
})
