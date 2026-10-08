import { createHash } from "node:crypto"
import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"
vi.mock("@/lib/server/admin-users", () => ({findAdminUserById: vi.fn()}))
vi.mock("@/lib/server/jarvis-service", () => ({readJarvisPage: vi.fn()}))
vi.mock("@/lib/server/rate-limit-store", () => ({checkDurableRateLimit: vi.fn()}))
vi.mock("@/lib/server/request-context", () => ({requestIdFromRequest: () => "request", requestLogger: () => ({info: vi.fn(), warn: vi.fn()})}))
import { findAdminUserById } from "@/lib/server/admin-users"
import { readJarvisPage } from "@/lib/server/jarvis-service"
import { checkDurableRateLimit } from "@/lib/server/rate-limit-store"
import { GET } from "./route"
const token = "a".repeat(64)
function setup() {
  vi.stubEnv("JARVIS_SERVICE_TOKEN_SHA256", createHash("sha256").update(token).digest("hex"))
  vi.stubEnv("JARVIS_SERVICE_ADMIN_ID", "operator")
  vi.stubEnv("JARVIS_SERVICE_SESSION_VERSION", "3")
  vi.stubEnv("JARVIS_SERVICE_SCOPES", "clients.read")
  vi.mocked(findAdminUserById).mockResolvedValue({active: true, sessionVersion: 3, role: "owner"} as NonNullable<Awaited<ReturnType<typeof findAdminUserById>>>)
  vi.mocked(checkDurableRateLimit).mockResolvedValue({ok: true} as Awaited<ReturnType<typeof checkDurableRateLimit>>)
  vi.mocked(readJarvisPage).mockResolvedValue({records: [], complete: true})
}
const request = (key = token) => new NextRequest("https://admin.scalesmiths.co.uk/api/jarvis/v1/clients.read?limit=10", {headers: {authorization: `Bearer ${key}`}})
afterEach(() => {vi.unstubAllEnvs(); vi.resetAllMocks()})
describe("authenticated JARVIS read endpoint", () => {
  it("authenticates before reading data and returns private noncacheable pages", async () => {
    setup()
    expect((await GET(request("b".repeat(64)), {params: Promise.resolve({action: "clients.read"})})).status).toBe(401)
    expect(findAdminUserById).not.toHaveBeenCalled()
    expect(readJarvisPage).not.toHaveBeenCalled()
    const response = await GET(request(), {params: Promise.resolve({action: "clients.read"})})
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toContain("no-store")
    expect(await response.json()).toEqual({records: [], complete: true})
  })
  it("fails closed on disabled identity, unavailable DB and rate limiting", async () => {
    setup()
    vi.mocked(findAdminUserById).mockResolvedValue({active: false, sessionVersion: 3, role: "owner"} as Awaited<ReturnType<typeof findAdminUserById>>)
    expect((await GET(request(), {params: Promise.resolve({action: "clients.read"})})).status).toBe(401)
    expect(readJarvisPage).not.toHaveBeenCalled()
    setup()
    vi.mocked(checkDurableRateLimit).mockResolvedValue({ok: false, retryAfterMs: 1000} as Awaited<ReturnType<typeof checkDurableRateLimit>>)
    expect((await GET(request(), {params: Promise.resolve({action: "clients.read"})})).status).toBe(429)
    setup()
    vi.mocked(readJarvisPage).mockRejectedValue(new Error("sensitive database detail"))
    const unavailable = await GET(request(), {params: Promise.resolve({action: "clients.read"})})
    expect(unavailable.status).toBe(503)
    expect(await unavailable.text()).not.toContain("sensitive")
  })
})
