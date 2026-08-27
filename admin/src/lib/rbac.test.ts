import { describe, expect, it } from "vitest"
import { readdirSync } from "node:fs"
import path from "node:path"
import { ADMIN_ROLES } from "./admin-users"
import { CAPABILITIES, ROLE_CAPABILITIES, authorizeRequest, databaseQueryScope, hasCapability, isPrivilegeReduction, requiredCapabilityForRequest, type Capability } from "./rbac"

const expected: Record<(typeof ADMIN_ROLES)[number], Capability[]> = {
  owner: [...CAPABILITIES],
  administrator: CAPABILITIES.filter((capability) => capability !== "users.reset_password" && capability !== "users.assign_owner"),
  sales: ["leads.read", "leads.write", "clients.read", "projects.read", "finance.read", "analytics.read"],
  project_manager: ["leads.read", "clients.read", "clients.write", "projects.read", "projects.write", "forge.read", "forge.execute", "forge.approve", "forge.configure", "finance.read", "audit.read", "analytics.read", "analytics.write"],
  developer: ["clients.read", "projects.read", "projects.write", "forge.read", "forge.execute", "forge.approve", "forge.configure", "audit.read", "deployments.execute", "analytics.read"],
  finance: ["leads.read", "clients.read", "projects.read", "finance.read", "finance.write", "audit.read", "analytics.read"],
  viewer: ["leads.read", "clients.read", "projects.read", "forge.read", "finance.read", "analytics.read"],
}

describe("RBAC role/capability matrix", () => {
  for (const role of ADMIN_ROLES) {
    it(`${role} has exactly its reviewed capabilities`, () => {
      expect([...ROLE_CAPABILITIES[role]].sort()).toEqual([...expected[role]].sort())
      for (const capability of CAPABILITIES) expect(hasCapability(role, capability)).toBe(expected[role].includes(capability))
    })
  }

  it("defines a decision for every capability and role", () => {
    expect(Object.keys(ROLE_CAPABILITIES).sort()).toEqual([...ADMIN_ROLES].sort())
    expect(new Set(Object.values(ROLE_CAPABILITIES).flat())).toEqual(new Set(CAPABILITIES))
  })

  it("detects privilege reductions for session revocation", () => {
    expect(isPrivilegeReduction("owner", "administrator")).toBe(true)
    expect(isPrivilegeReduction("administrator", "viewer")).toBe(true)
    expect(isPrivilegeReduction("viewer", "owner")).toBe(false)
  })
})

describe("server request enforcement", () => {
  it("allows every authenticated role to revoke its own session", () => {
    expect(authorizeRequest("viewer", { pathname: "/api/security/logout", method: "POST" }).allowed).toBe(true)
  })

  it("prevents viewer and sales roles bypassing UI with direct write calls", () => {
    expect(authorizeRequest("viewer", { pathname: "/api/prospects", method: "POST" })).toMatchObject({ allowed: false, capability: "leads.write" })
    expect(authorizeRequest("sales", { pathname: "/api/forge/projects/12/research", method: "POST" })).toMatchObject({ allowed: false, capability: "forge.execute" })
    expect(authorizeRequest("viewer", { pathname: "/api/admin-users/user-id", method: "PATCH" })).toMatchObject({ allowed: false, capability: "users.manage" })
    expect(authorizeRequest("viewer", { pathname: "/api/portal-users/12", method: "PATCH" })).toMatchObject({ allowed: false, capability: "users.manage" })
    expect(authorizeRequest("viewer", { pathname: "/api/claims/testimonial.glow-tanning.tom", method: "PATCH" })).toMatchObject({ allowed: false, capability: "claims.manage" })
    expect(authorizeRequest("viewer", { pathname: "/api/invoices", method: "POST" })).toMatchObject({ allowed: false, capability: "finance.write" })
  })

  it("allows reviewed direct route operations", () => {
    expect(authorizeRequest("sales", { pathname: "/api/prospects", method: "POST" }).allowed).toBe(true)
    expect(authorizeRequest("developer", { pathname: "/api/forge/projects/9/deploy", method: "POST" }).allowed).toBe(true)
    expect(authorizeRequest("sales", { pathname: "/api/proposals", method: "POST" }).allowed).toBe(true)
    expect(authorizeRequest("project_manager", { pathname: "/api/forge/projects/9/design", method: "PATCH" }).allowed).toBe(true)
  })

  it("maps sensitive routes before generic Forge execution", () => {
    expect(requiredCapabilityForRequest({ pathname: "/api/forge/ai-usage/export", method: "GET" })).toBe("audit.read")
    expect(requiredCapabilityForRequest({ pathname: "/api/forge/projects/1/integrations/resend", method: "PATCH" })).toBe("forge.configure")
    expect(requiredCapabilityForRequest({ pathname: "/api/forge/projects/1/deploy", method: "POST" })).toBe("deployments.execute")
    expect(requiredCapabilityForRequest({ pathname: "/api/forge/projects/1/sitemap", method: "PATCH" })).toBe("forge.approve")
    expect(requiredCapabilityForRequest({ pathname: "/claims", method: "GET" })).toBe("claims.read")
    expect(requiredCapabilityForRequest({ pathname: "/api/claims/hero.revenue-generated", method: "PATCH" })).toBe("claims.manage")
    expect(requiredCapabilityForRequest({ pathname: "/finance/invoices", method: "GET" })).toBe("finance.read")
    expect(requiredCapabilityForRequest({ pathname: "/api/invoices/1/pdf", method: "GET" })).toBe("finance.read")
    expect(requiredCapabilityForRequest({ pathname: "/api/invoice-settings", method: "PUT" })).toBe("finance.write")
    expect(requiredCapabilityForRequest({ pathname: "/api/invoice-catalogue/1", method: "PATCH" })).toBe("finance.write")
    expect(requiredCapabilityForRequest({ pathname: "/api/clients/1/invoice-code", method: "PATCH" })).toBe("finance.write")
    expect(requiredCapabilityForRequest({ pathname: "/api/clients/1/billing", method: "PATCH" })).toBe("finance.write")
  })

  it("fails database query scoping closed without the read capability", () => {
    expect(databaseQueryScope("sales", "leads.read")).toBe("global")
    expect(databaseQueryScope("sales", "forge.read")).toBe("none")
  })

  it("maps every non-auth API route to a server-side capability", () => {
    const apiRoot = path.resolve("src", "app", "api")
    const routeFiles = walk(apiRoot).filter((file) => file.endsWith("route.ts"))
    const unmapped = routeFiles.map((file) => `/${path.relative(path.resolve("src", "app"), path.dirname(file)).replaceAll("\\", "/").replace(/\[[^/]+\]/g, "resource")}`)
      // Auth, self-service logout, health and monitoring self-test authenticate with dedicated protocol-specific controls.
      .filter((pathname) => !pathname.startsWith("/api/auth") && pathname !== "/api/security/logout" && pathname !== "/api/health" && pathname !== "/api/monitoring/self-test" && requiredCapabilityForRequest({ pathname, method: "GET" }) === null && requiredCapabilityForRequest({ pathname, method: "POST" }) === null)
    expect(unmapped).toEqual([])
  })
})

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(directory, entry.name)) : [path.join(directory, entry.name)])
}
