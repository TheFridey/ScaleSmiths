import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ limit: vi.fn(), activate: vi.fn() }))
vi.mock("@/lib/login-limiter", () => ({ checkLoginRateLimit: mocks.limit, getAuthRequestIp: () => "127.0.0.1", loginRateLimitKeys: () => ["partner-activation:test"] }))
vi.mock("@/lib/server/partner-invitations", () => ({ activatePartnerInvitation: mocks.activate }))
import { POST } from "./route"

function request(body: string, origin = "http://localhost:3001", contentType = "application/json") {
  return new Request("http://localhost:3001/api/partner/activate", { method: "POST", headers: { origin, "content-type": contentType }, body })
}

describe("public invitation consumer", () => {
  beforeEach(() => { vi.stubEnv("AUTH_URL", "http://localhost:3001"); mocks.limit.mockReset().mockResolvedValue(true); mocks.activate.mockReset().mockResolvedValue(undefined) })
  afterEach(() => vi.unstubAllEnvs())
  it("rejects cross-origin requests before the token consumer", async () => {
    expect((await POST(request("{}", "https://attacker.example"))).status).toBe(403)
    expect(mocks.activate).not.toHaveBeenCalled()
    expect(mocks.limit).not.toHaveBeenCalled()
  })
  it("fails closed when durable rate limiting is exhausted or unavailable", async () => {
    mocks.limit.mockResolvedValueOnce(false)
    expect((await POST(request("{}"))).status).toBe(429)
    mocks.limit.mockRejectedValueOnce(new Error("db unavailable"))
    expect((await POST(request("{}"))).status).toBe(503)
    expect(mocks.activate).not.toHaveBeenCalled()
  })
  it("bounds the actual streamed body and rejects malformed JSON", async () => {
    expect((await POST(request("x".repeat(4097)))).status).toBe(413)
    expect((await POST(request("["))).status).toBe(400)
    expect((await POST(request("[]"))).status).toBe(400)
    expect((await POST(request("{}", "http://localhost:3001", "text/plain"))).status).toBe(415)
    expect(mocks.activate).not.toHaveBeenCalled()
  })
  it("passes only token/password to the single-use consumer and returns no session", async () => {
    const response = await POST(request(JSON.stringify({ token: "A".repeat(43), password: "secure-example-password", role: "owner" })))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.activate).toHaveBeenCalledExactlyOnceWith("A".repeat(43), "secure-example-password")
    expect(response.headers.get("set-cookie")).toBeNull()
    expect(response.headers.get("cache-control")).toContain("no-store")
  })
})
