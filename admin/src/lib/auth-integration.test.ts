import { beforeEach, describe, expect, it, vi } from "vitest"

interface CapturedAuthConfig {
  providers: Array<{ authorize: (credentials: Record<string, unknown>, request: object) => Promise<unknown> }>
  callbacks: { jwt: (input: { token: Record<string, unknown>; user?: unknown }) => Promise<Record<string, unknown>> }
}

const fakes = vi.hoisted(() => ({
  config: null as CapturedAuthConfig | null,
  checkLoginRateLimit: vi.fn(),
  getAuthRequestIp: vi.fn(() => "192.0.2.1"),
  loginRateLimitKeys: vi.fn(() => ["ip-key", "email-key"]),
  authenticateAdminUser: vi.fn(),
  verifyAdminMfaChallenge: vi.fn(),
  recordSuccessfulAdminLogin: vi.fn(),
  findAdminUserById: vi.fn(),
  captureMonitoringException: vi.fn(),
  captureMonitoringMessage: vi.fn(),
}))

vi.mock("next-auth", () => ({
  default: vi.fn((config) => {
    fakes.config = config
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }
  }),
}))
vi.mock("next-auth/providers/credentials", () => ({ default: vi.fn((config) => ({ id: "credentials", ...config })) }))
vi.mock("./login-limiter", () => ({
  checkLoginRateLimit: fakes.checkLoginRateLimit,
  getAuthRequestIp: fakes.getAuthRequestIp,
  loginRateLimitKeys: fakes.loginRateLimitKeys,
}))
vi.mock("./server/monitoring", () => ({
  captureMonitoringException: fakes.captureMonitoringException,
  captureMonitoringMessage: fakes.captureMonitoringMessage,
}))
vi.mock("./server/admin-users", () => ({
  authenticateAdminUser: fakes.authenticateAdminUser,
  verifyAdminMfaChallenge: fakes.verifyAdminMfaChallenge,
  recordSuccessfulAdminLogin: fakes.recordSuccessfulAdminLogin,
  findAdminUserById: fakes.findAdminUserById,
}))

await import("../../auth")

const persistedUser = {
  id: "admin-1",
  email: "owner@example.test",
  displayName: "Owner",
  role: "owner",
  sessionVersion: 4,
  active: true,
}

function capturedConfig() {
  if (!fakes.config) throw new Error("NextAuth configuration was not captured.")
  return fakes.config
}

describe("Auth.js admin integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakes.checkLoginRateLimit.mockResolvedValue(true)
    fakes.authenticateAdminUser.mockResolvedValue(persistedUser)
    fakes.verifyAdminMfaChallenge.mockResolvedValue(true)
    fakes.recordSuccessfulAdminLogin.mockResolvedValue(undefined)
  })

  it("normalizes credentials, requires MFA, and returns the authorization claims", async () => {
    const authorize = capturedConfig().providers[0].authorize
    const result = await authorize({ email: " OWNER@EXAMPLE.TEST ", password: "password", totp: " 123456 ", recoveryCode: " code-1 " }, {})

    expect(fakes.authenticateAdminUser).toHaveBeenCalledWith("owner@example.test", "password")
    expect(fakes.verifyAdminMfaChallenge).toHaveBeenCalledWith(persistedUser, { totp: "123456", recoveryCode: "code-1" })
    expect(fakes.recordSuccessfulAdminLogin).toHaveBeenCalledWith("admin-1")
    expect(result).toEqual({ id: "admin-1", email: "owner@example.test", name: "Owner", role: "owner", sessionVersion: 4, active: true })
  })

  it("rejects an invalid MFA challenge without recording a successful login", async () => {
    fakes.verifyAdminMfaChallenge.mockResolvedValue(false)
    const result = await capturedConfig().providers[0].authorize({ email: "owner@example.test", password: "password", totp: "000000" }, {})

    expect(result).toBeNull()
    expect(fakes.recordSuccessfulAdminLogin).not.toHaveBeenCalled()
    expect(fakes.captureMonitoringMessage).toHaveBeenCalledWith("Admin MFA challenge rejected", "warning", expect.objectContaining({ errorCategory: "mfa_challenge" }))
  })

  it("rejects before credential verification when the login rate limit is exceeded", async () => {
    fakes.checkLoginRateLimit.mockResolvedValue(false)
    const result = await capturedConfig().providers[0].authorize({ email: "owner@example.test", password: "password" }, {})

    expect(result).toBeNull()
    expect(fakes.authenticateAdminUser).not.toHaveBeenCalled()
  })

  it("refreshes role state and revokes a JWT when the database session is no longer current", async () => {
    fakes.findAdminUserById.mockResolvedValue({ ...persistedUser, role: "viewer", sessionVersion: 5 })
    const token = await capturedConfig().callbacks.jwt({ token: { sub: "admin-1", sessionVersion: 4 }, user: undefined })

    expect(token).toMatchObject({ role: "viewer", active: true, accessRevoked: true })
  })
})
