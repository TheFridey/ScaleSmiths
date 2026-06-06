import { describe, expect, it } from "vitest"
import {
  authenticateDemoPortal,
  authenticatePortalAccount,
  createPortalSessionToken,
  portalLogoutCookieOptions,
  portalSessionCookieOptions,
  verifyPortalSessionToken,
} from "./portal-auth"

describe("portal auth", () => {
  it("rejects invalid database-backed login credentials", async () => {
    const session = await authenticatePortalAccount(
      { email: "client@example.com", password: "wrong" },
      async () => ({
        clientId: "client-one",
        email: "client@example.com",
        passwordHash: "hash",
        active: true,
      }),
      async () => false,
    )

    expect(session).toBeNull()
  })

  it("does not allow demo credentials unless demo mode is explicitly enabled", () => {
    const session = authenticateDemoPortal(
      { email: "demo@example.com", password: "demo-password" },
      {
        DEMO_PORTAL_ENABLED: "false",
        DEMO_PORTAL_EMAIL: "demo@example.com",
        DEMO_PORTAL_PASSWORD: "demo-password",
        DEMO_PORTAL_CLIENT_ID: "demo-client",
      } as unknown as NodeJS.ProcessEnv,
    )

    expect(session).toBeNull()
  })

  it("allows demo credentials only when enabled and fully configured", () => {
    const session = authenticateDemoPortal(
      { email: "demo@example.com", password: "demo-password" },
      {
        DEMO_PORTAL_ENABLED: "true",
        DEMO_PORTAL_EMAIL: "demo@example.com",
        DEMO_PORTAL_PASSWORD: "demo-password",
        DEMO_PORTAL_CLIENT_ID: "demo-client",
      } as unknown as NodeJS.ProcessEnv,
    )

    expect(session).toEqual({ clientId: "demo-client" })
  })

  it("creates verifiable JWT session tokens", async () => {
    const token = await createPortalSessionToken("client-one", "test-secret-with-enough-entropy")
    const session = await verifyPortalSessionToken(token, "test-secret-with-enough-entropy")

    expect(session).toEqual({ clientId: "client-one" })
  })

  it("sets secure cookie options for production", () => {
    const options = portalSessionCookieOptions({ NODE_ENV: "production" } as NodeJS.ProcessEnv)

    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 60 * 60 * 8,
      path: "/",
    })
  })

  it("clears portal cookies with maxAge zero", () => {
    const options = portalLogoutCookieOptions({ NODE_ENV: "production" } as NodeJS.ProcessEnv)

    expect(options.maxAge).toBe(0)
    expect(options.httpOnly).toBe(true)
    expect(options.secure).toBe(true)
    expect(options.path).toBe("/")
  })
})
