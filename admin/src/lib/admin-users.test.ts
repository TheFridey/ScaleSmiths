import { describe, expect, it } from "vitest"
import { AdminIdentityError, bootstrapAction, isAdminSessionCurrent, normalizeAdminEmail, resolveAdminUserMutation, validateNewAdminUser } from "./admin-users"
import bcrypt from "bcryptjs"
import { decideBootstrapAction, prepareBootstrapPasswordHash } from "../../scripts/bootstrap-admin-logic.mjs"

describe("admin identity model", () => {
  it("keeps bootstrap idempotent when the configured email already exists", () => {
    expect(bootstrapAction(null)).toBe("create")
    expect(bootstrapAction({ id: "existing" })).toBe("unchanged")
    expect(decideBootstrapAction(true, false)).toBe("unchanged")
    expect(decideBootstrapAction(true, true)).toBe("recover")
  })

  it("hashes bootstrap passwords and never returns plaintext", async () => {
    const prepared = await prepareBootstrapPasswordHash("existing-legacy-password", false, bcrypt)
    expect(prepared.hash).not.toBe("existing-legacy-password")
    expect(prepared.hash.startsWith("$2")).toBe(true)
    expect(await bcrypt.compare("existing-legacy-password", prepared.hash)).toBe(true)
  })

  it("treats duplicate emails case-insensitively", () => {
    expect(normalizeAdminEmail(" Owner@ScaleSmiths.co.uk ")).toBe(normalizeAdminEmail("owner@scalesmiths.co.uk"))
    expect(validateNewAdminUser({ email: "OWNER@scalesmiths.co.uk", displayName: "Owner", password: "long-secure-password", role: "owner" }).email).toBe("owner@scalesmiths.co.uk")
  })

  it("rejects disabled and revoked sessions", () => {
    expect(isAdminSessionCurrent({ active: false, sessionVersion: 2 }, 2)).toBe(false)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 2 }, 1)).toBe(false)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 2 }, 2)).toBe(true)
  })

  it("protects the final active owner", () => {
    expect(() => resolveAdminUserMutation({ targetId: "owner", actorId: "other", targetRole: "owner", targetActive: true, targetSessionVersion: 1, requestedActive: false, activeOwnerCount: 1 })).toThrowError(AdminIdentityError)
    expect(() => resolveAdminUserMutation({ targetId: "owner", actorId: "other", targetRole: "owner", targetActive: true, targetSessionVersion: 1, requestedRole: "administrator", activeOwnerCount: 1 })).toThrow("final active owner")
  })

  it("persists role changes and increments revocation versions", () => {
    expect(resolveAdminUserMutation({ targetId: "user", actorId: "owner", targetRole: "viewer", targetActive: true, targetSessionVersion: 4, requestedRole: "developer", revokeSessions: true, activeOwnerCount: 1 })).toEqual({ role: "developer", active: true, sessionVersion: 5 })
  })
})
