import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({ execute: vi.fn(), limiter: vi.fn(), monitor: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: { execute: mocks.execute } }))
vi.mock("@/lib/server/rate-limit", () => ({ checkWebRateLimit: mocks.limiter }))
vi.mock("@/lib/server-monitoring", () => ({ captureWebException: mocks.monitor }))
import { POST } from "./route"

const valid = { name: "Example Partner", email: "partner@example.test", region: "East Midlands", experience: "Independent commercial experience.", motivation: "Build strong client relationships.", privacyAcknowledged: true, privacyVersion: "approved-test-v1" }
const origin = "https://scalesmiths.co.uk"
function request(body: unknown, requestOrigin = origin) { return new NextRequest(`${origin}/api/partner-applications`, { method: "POST", headers: { "content-type": "application/json", origin: requestOrigin }, body: JSON.stringify(body) }) }

describe("partner application route", () => {
  beforeEach(() => {
    vi.stubEnv("PARTNER_APPLICATIONS_ENABLED", "true")
    vi.stubEnv("PARTNER_APPLICATION_PRIVACY_VERSION", "approved-test-v1")
    vi.stubEnv("PARTNER_APPLICATION_RETENTION_DAYS", "180")
    mocks.execute.mockReset().mockResolvedValue({ rows: [] })
    mocks.monitor.mockReset()
    mocks.limiter.mockReset().mockResolvedValue({ ok: true, remaining: 2, limit: 3, resetAt: Date.now() + 10000 })
  })
  afterEach(() => vi.unstubAllEnvs())
  it("fails closed before database access while admissions are disabled", async () => {
    vi.stubEnv("PARTNER_APPLICATIONS_ENABLED", "false")
    expect((await POST(request(valid))).status).toBe(503)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.limiter).not.toHaveBeenCalled()
  })
  it("rejects forged origins before database access", async () => {
    expect((await POST(request(valid, "https://attacker.test"))).status).toBe(403)
    expect(mocks.execute).not.toHaveBeenCalled()
    expect(mocks.limiter).not.toHaveBeenCalled()
  })
  it("limits malformed attempts and rejects invalid fields", async () => {
    expect((await POST(request({ ...valid, privacyAcknowledged: false }))).status).toBe(400)
    expect(mocks.limiter).toHaveBeenCalledOnce()
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it("rejects a stale privacy acknowledgement instead of recording the current version", async () => {
    expect((await POST(request({ ...valid, privacyVersion: "old-version" }))).status).toBe(409)
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it("returns rate limit headers without persisting", async () => {
    mocks.limiter.mockResolvedValue({ ok: false, remaining: 0, limit: 3, resetAt: Date.now() + 10000 })
    const response = await POST(request(valid))
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBeTruthy()
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it("ignores honeypot attempts without storing a record", async () => {
    expect((await POST(request({ ...valid, website: "spam" }))).status).toBe(200)
    expect(mocks.execute).not.toHaveBeenCalled()
  })
  it("persists validated applications only and returns no applicant identity", async () => {
    const response = await POST(request({ ...valid, status: "activated", reviewNotes: "client injection" }))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ ok: true })
    expect(response.headers.get("Cache-Control")).toContain("no-store")
    expect(mocks.execute).toHaveBeenCalledOnce()
    expect(mocks.limiter).toHaveBeenCalledTimes(2)
  })
  it("fails closed on database outage and never reports success", async () => {
    mocks.execute.mockRejectedValue(new Error("offline"))
    const response = await POST(request(valid))
    expect(response.status).toBe(503)
    expect(await response.json()).toHaveProperty("error")
  })
  it("never forwards applicant information from production database exceptions to monitoring", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", origin)
    const privateFields = ["Private Applicant Name", "private-applicant@example.invalid", "Confidential commercial notes"]
    const originalError = new Error(`Failed query: insert into partner_applications; params: ${privateFields.join(", ")}`, {
      cause: new Error(`Database detail: ${privateFields.join(", ")}`),
    })
    mocks.execute.mockRejectedValue(originalError)
    const response = await POST(request({ ...valid, name: privateFields[0], email: privateFields[1], motivation: privateFields[2] }))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: "We could not save your application. Please try again later." })
    expect(mocks.monitor).toHaveBeenCalledOnce()
    const [reportedError, context] = mocks.monitor.mock.calls[0]
    expect(reportedError).toBeInstanceOf(Error)
    expect(reportedError).not.toBe(originalError)
    expect(reportedError.message).toBe("Partner application persistence failed.")
    expect(reportedError).not.toHaveProperty("cause")
    const reported = [reportedError.message, reportedError.stack, JSON.stringify(reportedError), JSON.stringify(context)].join("\n")
    for (const value of [...privateFields, "Failed query:", "Database detail:"]) expect(reported).not.toContain(value)
  })
})
