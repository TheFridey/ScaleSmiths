import { NextRequest, type NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { AdminRole } from "./admin-users"

const identity = vi.hoisted(() => ({ find: vi.fn() }))

// Supply an unauthenticated request at the Auth.js boundary and execute the
// production middleware callback; token validation is covered by Auth.js tests.
vi.mock("next-auth", () => ({ default: () => ({ auth: (callback: unknown) => callback }) }))
vi.mock("@/lib/server/admin-users", () => ({ findAdminUserById: identity.find }))
vi.mock("@/lib/server/rate-limit-store", () => ({ checkDurableRateLimit: vi.fn() }))
vi.mock("@/lib/server/request-context", () => ({ requestLogger: () => ({ warn: vi.fn() }) }))
vi.mock("@/lib/server/monitoring", () => ({ captureMonitoringMessage: vi.fn() }))
import middleware from "../middleware"

type CookieSession = { user: { id: string; role: AdminRole; sessionVersion: number } } | null
const route = middleware as unknown as (request: NextRequest & { auth: CookieSession }) => Promise<NextResponse>
function request(path: string, method = "GET", auth: CookieSession = null) {
  return Object.assign(new NextRequest(`http://localhost:3001${path}`, { method }), { auth })
}

beforeEach(() => { vi.stubEnv("AUTH_URL", "http://localhost:3001"); identity.find.mockReset().mockResolvedValue(null) })
afterEach(() => vi.unstubAllEnvs())

describe("partner activation public middleware boundary", () => {
  it("admits only page reads and the dedicated activation POST without a session", async () => {
    for (const method of ["GET", "HEAD"]) expect((await route(request("/partner/activate", method))).headers.get("x-middleware-next")).toBe("1")
    expect((await route(request("/api/partner/activate", "POST"))).headers.get("x-middleware-next")).toBe("1")
    const pagePost = await route(request("/partner/activate", "POST"))
    expect(pagePost.status).toBe(307)
    expect(pagePost.headers.get("location")).toBe("http://localhost:3001/login")
    for (const method of ["GET", "PUT", "DELETE"]) expect((await route(request("/api/partner/activate", method))).status).toBe(401)
  })
  it("keeps the workspace, neighbouring paths and founder APIs behind sessions", async () => {
    for (const path of ["/api/partner", "/api/partner/activate/extra", "/api/expansion", "/api/forge/projects"]) expect((await route(request(path))).status).toBe(401)
    expect((await route(request("/partner"))).status).toBe(307)
  })
})

describe("persisted session state on login", () => {
  it.each(["independent_partner", "owner"] as const)("lets a revoked %s cookie reach login without a redirect loop", async (role) => {
    const auth = { user: { id: "user", role, sessionVersion: 1 } }
    identity.find.mockResolvedValue({ id: "user", role, active: false, sessionVersion: 2 })
    const protectedResponse = await route(request(role === "independent_partner" ? "/partner" : "/dashboard", "GET", auth))
    expect(protectedResponse.status).toBe(307)
    expect(protectedResponse.headers.get("location")).toBe("http://localhost:3001/login?reason=session")
    const login = await route(request("/login?reason=session", "GET", auth))
    expect(login.headers.get("x-middleware-next")).toBe("1")
    expect(login.headers.get("location")).toBeNull()
  })
  it("lets a stale active session reach login while protecting API data", async () => {
    const auth = { user: { id: "user", role: "independent_partner" as const, sessionVersion: 1 } }
    identity.find.mockResolvedValue({ id: "user", role: "independent_partner", active: true, sessionVersion: 2 })
    expect((await route(request("/login", "GET", auth))).headers.get("x-middleware-next")).toBe("1")
    expect((await route(request("/api/partner", "GET", auth))).status).toBe(401)
  })
  it.each(["missing", "unavailable"])("allows login with a %s identity but fails protected requests closed", async (state) => {
    const auth = { user: { id: "user", role: "owner" as const, sessionVersion: 1 } }
    if (state === "unavailable") identity.find.mockRejectedValue(new Error("database unavailable"))
    expect((await route(request("/login", "GET", auth))).headers.get("x-middleware-next")).toBe("1")
    expect((await route(request("/api/expansion", "GET", auth))).status).toBe(401)
  })
  it.each([
    ["owner", "independent_partner", "/partner"],
    ["independent_partner", "owner", "/command-centre"],
  ] as const)("routes a current session using persisted %s to %s role state", async (tokenRole, persistedRole, home) => {
    const auth = { user: { id: "user", role: tokenRole, sessionVersion: 1 } }
    identity.find.mockResolvedValue({ id: "user", role: persistedRole, active: true, sessionVersion: 1 })
    const login = await route(request("/login", "GET", auth))
    expect(login.status).toBe(307)
    expect(login.headers.get("location")).toBe(`http://localhost:3001${home}`)
  })
})
