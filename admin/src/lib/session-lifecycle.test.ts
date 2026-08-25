import { describe, expect, it } from "vitest"
import {
  ADMIN_ROLES,
  AdminIdentityError,
  assertFinalOwnerProtected,
  bootstrapAction,
  isAdminRole,
  isAdminSessionCurrent,
  normalizeAdminEmail,
  resolveAdminUserMutation,
  validateNewAdminUser,
  type AdminRole,
} from "./admin-users"
import { isPrivilegeReduction } from "./rbac"

describe("session lifecycle — version matching", () => {
  it("detects a valid session with matching version", () => {
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 3 }, 3)).toBe(true)
  })

  it("detects session revocation via version increment", () => {
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 3 }, 2)).toBe(false)
  })

  it("detects session revocation via version increment after logout", () => {
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 4 }, 3)).toBe(false)
  })

  it("detects disabled account as invalid", () => {
    expect(isAdminSessionCurrent({ active: false, sessionVersion: 3 }, 3)).toBe(false)
  })

  it("detects disabled account with matching version as invalid", () => {
    expect(isAdminSessionCurrent({ active: false, sessionVersion: 7 }, 7)).toBe(false)
  })

  it("rejects non-integer token versions", () => {
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 1 }, "1")).toBe(false)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 1 }, null)).toBe(false)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 1 }, undefined)).toBe(false)
    expect(isAdminSessionCurrent({ active: true, sessionVersion: 1 }, 1.1)).toBe(false)
  })
})

describe("privilege reduction detection", () => {
  it("detects privilege reduction across all downgrade paths", () => {
    expect(isPrivilegeReduction("owner", "administrator")).toBe(true)
    expect(isPrivilegeReduction("owner", "viewer")).toBe(true)
    expect(isPrivilegeReduction("administrator", "viewer")).toBe(true)
    expect(isPrivilegeReduction("project_manager", "sales")).toBe(true)
    expect(isPrivilegeReduction("developer", "viewer")).toBe(true)
    expect(isPrivilegeReduction("finance", "viewer")).toBe(true)
  })

  it("does not detect privilege reduction for pure upgrades (no capability loss)", () => {
    expect(isPrivilegeReduction("viewer", "owner")).toBe(false)
    expect(isPrivilegeReduction("viewer", "administrator")).toBe(false)
    expect(isPrivilegeReduction("finance", "owner")).toBe(false)
    expect(isPrivilegeReduction("developer", "owner")).toBe(false)
  })

  it("detects privilege reduction for changes that lose any capability", () => {
    expect(isPrivilegeReduction("sales", "project_manager")).toBe(true)
    expect(isPrivilegeReduction("sales", "finance")).toBe(true)
    expect(isPrivilegeReduction("developer", "project_manager")).toBe(true)
  })

  it("returns false for same role (no change)", () => {
    expect(isPrivilegeReduction("owner", "owner")).toBe(false)
    expect(isPrivilegeReduction("viewer", "viewer")).toBe(false)
  })
})

describe("role validation", () => {
  it("validates all seven defined roles", () => {
    for (const role of ADMIN_ROLES) {
      expect(isAdminRole(role)).toBe(true)
    }
  })

  it("rejects undefined and null", () => {
    expect(isAdminRole(undefined)).toBe(false)
    expect(isAdminRole(null)).toBe(false)
  })

  it("rejects non-string types", () => {
    expect(isAdminRole(42)).toBe(false)
    expect(isAdminRole({})).toBe(false)
    expect(isAdminRole(true)).toBe(false)
  })

  it("rejects strings that are not valid roles", () => {
    expect(isAdminRole("superadmin")).toBe(false)
    expect(isAdminRole("")).toBe(false)
    expect(isAdminRole("admin")).toBe(false)
    expect(isAdminRole("Owner")).toBe(false)
  })
})

describe("email normalization", () => {
  it("lowercases and trims email", () => {
    expect(normalizeAdminEmail("  Admin@Example.Com  ")).toBe("admin@example.com")
  })

  it("returns empty string for non-string inputs", () => {
    expect(normalizeAdminEmail(undefined)).toBe("")
    expect(normalizeAdminEmail(null)).toBe("")
    expect(normalizeAdminEmail(42)).toBe("")
  })
})

describe("new admin user validation", () => {
  const validInput = {
    email: "test@example.com",
    displayName: "Test User",
    password: "minimum-twelve-chars",
    role: "viewer" as AdminRole,
  }

  it("accepts valid input", () => {
    const result = validateNewAdminUser(validInput)
    expect(result.email).toBe("test@example.com")
    expect(result.displayName).toBe("Test User")
    expect(result.password).toBe("minimum-twelve-chars")
    expect(result.role).toBe("viewer")
  })

  it("rejects missing email", () => {
    expect(() => validateNewAdminUser({ ...validInput, email: "" })).toThrow(AdminIdentityError)
  })

  it("rejects invalid email format", () => {
    expect(() => validateNewAdminUser({ ...validInput, email: "not-an-email" })).toThrow(AdminIdentityError)
  })

  it("rejects display name that is too short", () => {
    expect(() => validateNewAdminUser({ ...validInput, displayName: "A" })).toThrow(AdminIdentityError)
  })

  it("rejects display name that exceeds maximum length", () => {
    expect(() => validateNewAdminUser({ ...validInput, displayName: "A".repeat(121) })).toThrow(AdminIdentityError)
  })

  it("rejects password shorter than 12 characters", () => {
    expect(() => validateNewAdminUser({ ...validInput, password: "short" })).toThrow(AdminIdentityError)
  })

  it("rejects invalid role", () => {
    expect(() => validateNewAdminUser({ ...validInput, role: "invalid" })).toThrow(AdminIdentityError)
  })

  it("rejects missing role", () => {
    expect(() => validateNewAdminUser({ ...validInput, role: undefined })).toThrow(AdminIdentityError)
  })

  it("normalizes email to lowercase trimmed", () => {
    const result = validateNewAdminUser({ ...validInput, email: "  User@Example.COM  " })
    expect(result.email).toBe("user@example.com")
  })

  it("rejects password that is whitespace-padded but too few chars (passwords not trimmed)", () => {
    expect(() => validateNewAdminUser({ ...validInput, password: "  1234567  " })).toThrow(AdminIdentityError)
  })

  it("rejects password of exactly 11 chars", () => {
    expect(() => validateNewAdminUser({ ...validInput, password: "12345678901" })).toThrow(AdminIdentityError)
  })

  it("accepts password of exactly 12 chars", () => {
    const result = validateNewAdminUser({ ...validInput, password: "123456789012" })
    expect(result.password).toBe("123456789012")
  })
})

describe("bootstrap action detection", () => {
  it("returns 'create' when no existing user", () => {
    expect(bootstrapAction(null)).toBe("create")
  })

  it("returns 'unchanged' when user already exists", () => {
    expect(bootstrapAction({ id: "existing-id" })).toBe("unchanged")
  })
})

describe("admin user mutation — session revocation and role changes", () => {
  const baseInput = {
    targetId: "user-123",
    actorId: "admin-456",
    targetRole: "viewer" as AdminRole,
    targetActive: true,
    targetSessionVersion: 5,
    activeOwnerCount: 2,
  }

  it("preserves session version when role-only change without revocation", () => {
    const result = resolveAdminUserMutation({
      ...baseInput,
      requestedRole: "sales",
    })
    expect(result.role).toBe("sales")
    expect(result.active).toBe(true)
    expect(result.sessionVersion).toBe(5)
  })

  it("increments session version when revokeSessions is true", () => {
    const result = resolveAdminUserMutation({
      ...baseInput,
      revokeSessions: true,
    })
    expect(result.sessionVersion).toBe(6)
  })

  it("increments session version when deactivating a user", () => {
    const result = resolveAdminUserMutation({
      ...baseInput,
      requestedActive: false,
    })
    expect(result.active).toBe(false)
    expect(result.sessionVersion).toBe(6)
  })

  it("prevents self-deactivation", () => {
    expect(() =>
      resolveAdminUserMutation({
        ...baseInput,
        targetId: "admin-456",
        actorId: "admin-456",
        requestedActive: false,
      })
    ).toThrow(AdminIdentityError)
  })

  it("throws when self-deactivation is attempted with matching IDs", () => {
    expect(() => {
      resolveAdminUserMutation({ ...baseInput, targetId: "same", actorId: "same", requestedActive: false })
    }).toThrow(AdminIdentityError)
  })

  it("does not prevent self-deactivation in request body (role change without disabling)", () => {
    const result = resolveAdminUserMutation({
      ...baseInput,
      targetId: "same",
      actorId: "same",
      requestedRole: "sales",
    })
    expect(result.role).toBe("sales")
    expect(result.active).toBe(true)
  })
})

describe("final owner protection", () => {
  it("allows demotion when there are other active owners", () => {
    expect(() =>
      assertFinalOwnerProtected({
        targetRole: "owner",
        targetActive: true,
        nextRole: "viewer",
        nextActive: true,
        activeOwnerCount: 2,
      })
    ).not.toThrow()
  })

  it("prevents demotion of the final active owner", () => {
    expect(() =>
      assertFinalOwnerProtected({
        targetRole: "owner",
        targetActive: true,
        nextRole: "viewer",
        nextActive: true,
        activeOwnerCount: 1,
      })
    ).toThrow(AdminIdentityError)
  })

  it("prevents disabling the final active owner", () => {
    expect(() =>
      assertFinalOwnerProtected({
        targetRole: "owner",
        targetActive: true,
        nextRole: "owner",
        nextActive: false,
        activeOwnerCount: 1,
      })
    ).toThrow(AdminIdentityError)
  })

  it("allows disabling a non-final owner", () => {
    expect(() =>
      assertFinalOwnerProtected({
        targetRole: "owner",
        targetActive: true,
        nextRole: "owner",
        nextActive: false,
        activeOwnerCount: 3,
      })
    ).not.toThrow()
  })

  it("allows changing the role of a non-owner freely", () => {
    expect(() =>
      assertFinalOwnerProtected({
        targetRole: "viewer",
        targetActive: true,
        nextRole: "sales",
        nextActive: false,
        activeOwnerCount: 1,
      })
    ).not.toThrow()
  })

  it("allows demoting an owner who is already inactive", () => {
    expect(() =>
      assertFinalOwnerProtected({
        targetRole: "owner",
        targetActive: false,
        nextRole: "viewer",
        nextActive: false,
        activeOwnerCount: 1,
      })
    ).not.toThrow()
  })
})

describe("AdminIdentityError", () => {
  it("carries safeMessage, status, and code", () => {
    const error = new AdminIdentityError("Access denied", 403, "forbidden")
    expect(error.safeMessage).toBe("Access denied")
    expect(error.status).toBe(403)
    expect(error.code).toBe("forbidden")
    expect(error.name).toBe("AdminIdentityError")
    expect(error).toBeInstanceOf(Error)
  })

  it("has default status 400 and default code admin_identity", () => {
    const error = new AdminIdentityError("Generic error")
    expect(error.status).toBe(400)
    expect(error.code).toBe("admin_identity")
  })
})

describe("session lifecycle — multi-step scenarios", () => {
  it("simulates login -> revoke -> detect-revocation cycle", () => {
    const originalVersion = 1
    const user = { active: true, sessionVersion: originalVersion }

    expect(isAdminSessionCurrent(user, originalVersion)).toBe(true)

    const revokedVersion = originalVersion + 1
    user.sessionVersion = revokedVersion
    expect(isAdminSessionCurrent(user, originalVersion)).toBe(false)

    expect(isAdminSessionCurrent(user, revokedVersion)).toBe(true)
  })

  it("simulates login -> disable -> detect-disabled cycle", () => {
    const user = { active: true, sessionVersion: 3 }

    expect(isAdminSessionCurrent(user, 3)).toBe(true)

    user.active = false
    expect(isAdminSessionCurrent(user, 3)).toBe(false)
  })

  it("session version 0 is valid only when matching", () => {
    const user = { active: true, sessionVersion: 0 }
    expect(isAdminSessionCurrent(user, 0)).toBe(true)
    expect(isAdminSessionCurrent(user, 1)).toBe(false)
  })
})