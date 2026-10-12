import { describe, expect, it } from "vitest"
import { ADMIN_ROLES } from "./admin-users"
import { authorizeRequest } from "./rbac"
import { adminHomeForRole, isPublicAdminBrandAsset } from "./admin-home"

describe("admin presentation entry points", () => {
  it.each(ADMIN_ROLES)("routes %s to a page permitted by production RBAC", (role) => {
    expect(authorizeRequest(role, { pathname: adminHomeForRole(role), method: "GET" }).allowed).toBe(true)
  })
  it("routes developers to delivery and keeps unknown identities at login", () => {
    expect(adminHomeForRole("developer")).toBe("/dashboard")
    expect(adminHomeForRole("venture_controller")).toBe("/venture-lab")
    for (const role of [null, undefined, "super_admin", {}]) expect(adminHomeForRole(role)).toBe("/login")
  })
  it("allows only the named non-sensitive brand asset", () => {
    expect(isPublicAdminBrandAsset("/brand/favicon.png")).toBe(true)
    for (const path of ["/brand/secret", "/brand/favicon.png/private", "/brand/../forge", "/brand/%2e%2e/users", "/forge", "/api/forge/health", "/users"]) expect(isPublicAdminBrandAsset(path)).toBe(false)
  })
})
