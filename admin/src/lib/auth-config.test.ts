import { describe, expect, it } from "vitest"
import { authConfig } from "../../auth.config"

describe("Auth.js configuration contract", () => {
  it("retains the reviewed JWT session and cookie security settings", () => {
    expect(authConfig.pages).toEqual({ signIn: "/login" })
    expect(authConfig.session).toEqual({ strategy: "jwt", maxAge: 8 * 60 * 60 })
    expect(authConfig.jwt).toEqual({ maxAge: 8 * 60 * 60 })
    expect(authConfig.cookies.sessionToken.options).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 8 * 60 * 60,
    })
  })

  it("copies the persisted authorization state into JWTs and sessions", async () => {
    const jwt = authConfig.callbacks.jwt
    const session = authConfig.callbacks.session
    const token = await jwt({
      token: { sub: "admin-1" },
      user: { role: "developer", sessionVersion: 7, active: true },
    } as Parameters<typeof jwt>[0])

    expect(token).toMatchObject({ role: "developer", sessionVersion: 7, active: true })
    expect(await session({ session: { user: {} }, token } as Parameters<typeof session>[0])).toMatchObject({
      user: { id: "admin-1", role: "developer", sessionVersion: 7, active: true },
    })
  })

  it("marks a session inactive when the refreshed token revokes access", async () => {
    const session = authConfig.callbacks.session
    expect(await session({
      session: { user: {} },
      token: { sub: "admin-1", role: "owner", sessionVersion: 2, active: true, accessRevoked: true },
    } as Parameters<typeof session>[0])).toMatchObject({ user: { active: false } })
  })
})
