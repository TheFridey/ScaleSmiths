import { describe, expect, it } from "vitest"
import { ADMIN_ROLES, assertPartnerIdentityMutation, validateNewAdminUser } from "./admin-users"
import { adminHomeForRole } from "./admin-home"
import { authorizeRequest, databaseQueryScope, hasCapability } from "./rbac"

describe("external independent partner boundary", () => {
  it("grants no internal capability and no global query scope", () => {
    expect(hasCapability("independent_partner", "expansion.partner")).toBe(true)
    for (const capability of ["leads.read", "clients.read", "finance.read", "forge.read", "admin_users.manage", "expansion.manage"] as const) {
      expect(hasCapability("independent_partner", capability)).toBe(false)
      expect(databaseQueryScope("independent_partner", capability)).toBe("none")
    }
    expect(databaseQueryScope("independent_partner", "expansion.partner")).toBe("partner")
    expect(adminHomeForRole("independent_partner")).toBe("/partner")
  })

  it("denies known and unknown internal pages and direct API calls", () => {
    for (const pathname of ["/", "/dashboard", "/command-centre", "/users", "/clients/1", "/prospects", "/finance", "/forge", "/venture-lab", "/expansion", "/unmapped-private-page", "/partnerish", "/partner/unmapped", "/api/forge/projects", "/api/prospects", "/api/invoices", "/api/admin-users", "/api/expansion", "/api/partnerish", "/api/partner/unknown"]) {
      for (const method of ["GET", "POST", "PATCH", "DELETE"]) expect(authorizeRequest("independent_partner", { pathname, method }).allowed, `${method} ${pathname}`).toBe(false)
    }
  })

  it("allows only admitted partner operations and explicit self logout", () => {
    for (const [pathname, method] of [["/partner", "GET"], ["/partner", "HEAD"], ["/api/partner", "GET"], ["/api/partner", "POST"], ["/api/security/logout", "POST"]]) expect(authorizeRequest("independent_partner", { pathname, method }).allowed).toBe(true)
    expect(authorizeRequest("independent_partner", { pathname: "/api/security/logout", method: "GET" }).allowed).toBe(false)
    expect(authorizeRequest("independent_partner", { pathname: "/api/partner", method: "DELETE" }).allowed).toBe(false)
  })

  it("admits founder commands only for reviewed founder roles", () => {
    for (const role of ADMIN_ROLES) expect(authorizeRequest(role, { pathname: "/api/expansion", method: "POST" }).allowed).toBe(role === "owner" || role === "administrator")
  })

  it("rejects direct partner creation through generic internal identity validation", () => {
    expect(() => validateNewAdminUser({ email: "partner@example.test", displayName: "Partner", password: "a-long-test-password", role: "independent_partner" })).toThrow("invitation workflow")
  })

  it("blocks promotion and premature activation while preserving emergency disable/revoke", () => {
    for (const role of ADMIN_ROLES.filter((value) => value !== "independent_partner")) {
      expect(() => assertPartnerIdentityMutation(role, { role: "independent_partner" })).toThrow("invitation workflow")
      expect(() => assertPartnerIdentityMutation("independent_partner", { role })).toThrow("partner workflow")
    }
    expect(() => assertPartnerIdentityMutation("independent_partner", { active: true })).toThrow("partner workflow")
    expect(() => assertPartnerIdentityMutation("independent_partner", { active: false, revokeSessions: true })).not.toThrow()
  })
})
