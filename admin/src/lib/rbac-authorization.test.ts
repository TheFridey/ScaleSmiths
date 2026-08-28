import { describe, expect, it } from "vitest"
import { ADMIN_ROLES, type AdminRole } from "./admin-users"
import {
  authorizeRequest,
  requiredCapabilityForRequest,
} from "./rbac"

const leadsReadRoles: AdminRole[] = ["owner", "administrator", "sales", "project_manager", "finance", "viewer"]
const financeReadRoles: AdminRole[] = ["owner", "administrator", "sales", "project_manager", "finance", "viewer"]
const projectManagerRoles: AdminRole[] = ["owner", "administrator", "project_manager"]
const ownerAdminSales: AdminRole[] = ["owner", "administrator", "sales"]
const ownerAdmin: AdminRole[] = ["owner", "administrator"]
const ownerAdminFinance: AdminRole[] = ["owner", "administrator", "finance"]
const ownerAdminPMDev: AdminRole[] = ["owner", "administrator", "project_manager", "developer"]
const ownerAdminDev: AdminRole[] = ["owner", "administrator", "developer"]
const forgeReadRoles: AdminRole[] = ["owner", "administrator", "project_manager", "developer", "viewer"]
const auditReadRoles: AdminRole[] = ["owner", "administrator", "project_manager", "developer", "finance"]

describe("RBAC — bypass paths (no capability required)", () => {
  const bypassPaths = [
    "/api/auth/callback/credentials",
    "/api/auth/signin",
    "/api/auth/session",
    "/api/auth/csrf",
    "/api/health",
    "/api/monitoring/self-test",
    "/login",
    "/login?error=test",
  ]

  it("Auth.js, health, monitoring, and login have null capability", () => {
    for (const pathname of bypassPaths) {
      expect(requiredCapabilityForRequest({ pathname, method: "GET" })).toBeNull()
    }
  })

  it("all roles are allowed on bypass paths", () => {
    for (const pathname of bypassPaths) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(true)
        expect(result.capability).toBeNull()
      }
    }
  })
})

describe("RBAC — logout", () => {
  it("logout is allowed for any authenticated role", () => {
    for (const role of ADMIN_ROLES) {
      expect(authorizeRequest(role, { pathname: "/api/security/logout", method: "POST" }).allowed).toBe(true)
    }
  })
})

describe("RBAC — dashboard and root", () => {
  it("dashboard and / are readable by every role", () => {
    for (const pathname of ["/dashboard", "/"]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(true)
        expect(result.capability).toBe("projects.read")
      }
    }
  })
})

describe("RBAC — admin user management", () => {
  const routes = [
    { pathname: "/users", method: "GET" },
    { pathname: "/users/new", method: "GET" },
    { pathname: "/api/admin-users", method: "POST" },
    { pathname: "/api/admin-users/abc", method: "PATCH" },
  ]

  it("restricted to owner and administrator", () => {
    for (const route of routes) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, route)
        if (role === "owner" || role === "administrator") {
          expect(result.allowed).toBe(true)
        } else {
          expect(result.allowed).toBe(false)
        }
        expect(result.capability).toBe(route.method === "GET" ? "admin_users.read" : "admin_users.manage")
      }
    }
  })
})

describe("RBAC — portal user management", () => {
  it("is separate from internal admin identity authority", () => {
    for (const role of ADMIN_ROLES) {
      const portalRead = authorizeRequest(role, { pathname: "/portal-users", method: "GET" })
      const portalWrite = authorizeRequest(role, { pathname: "/api/portal-users/12", method: "PATCH" })
      const adminRead = authorizeRequest(role, { pathname: "/api/admin-users", method: "GET" })
      const portalRole = role === "owner" || role === "administrator" || role === "project_manager"
      expect(portalRead.allowed).toBe(portalRole)
      expect(portalRead.capability).toBe("portal_users.read")
      expect(portalWrite.allowed).toBe(portalRole)
      expect(portalWrite.capability).toBe("portal_users.manage")
      expect(adminRead.allowed).toBe(role === "owner" || role === "administrator")
      expect(adminRead.capability).toBe("admin_users.read")
    }
  })
})

describe("RBAC — security settings", () => {
  const routes = [
    { pathname: "/security", method: "GET" },
    { pathname: "/security/mfa", method: "POST" },
    { pathname: "/api/security/mfa", method: "POST" },
  ]

  it("restricted to owner and administrator", () => {
    for (const route of routes) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, route)
        if (role === "owner" || role === "administrator") {
          expect(result.allowed).toBe(true)
        } else {
          expect(result.allowed).toBe(false)
        }
        expect(result.capability).toBe("settings.manage")
      }
    }
  })
})

describe("RBAC — prospects (leads)", () => {
  it("leads read is available to owner, admin, sales, PM, finance, viewer (developer excluded)", () => {
    for (const pathname of ["/prospects", "/api/prospects"]) {
      for (const role of leadsReadRoles) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(true)
        expect(result.capability).toBe("leads.read")
      }
    }
    for (const route of [{ pathname: "/prospects", method: "GET" }, { pathname: "/api/prospects", method: "GET" }]) {
      expect(authorizeRequest("developer", route).allowed).toBe(false)
    }
  })

  it("leads write is owner, administrator, sales", () => {
    const writeRoutes = [
      { pathname: "/api/prospects", method: "POST" },
      { pathname: "/api/prospects/1", method: "PATCH" },
      { pathname: "/api/prospects/1/lead-score", method: "POST" },
    ]
    for (const route of writeRoutes) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, route)
        if (ownerAdminSales.includes(role)) {
          expect(result.allowed).toBe(true)
        } else {
          expect(result.allowed).toBe(false)
        }
        expect(result.capability).toBe("leads.write")
      }
    }
  })
})

describe("RBAC — clients", () => {
  it("clients read is accessible by all roles", () => {
    for (const pathname of ["/clients", "/clients/1", "/api/clients", "/api/clients/1"]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(true)
        expect(result.capability).toBe("clients.read")
      }
    }
  })

  it("clients write is owner, administrator, project_manager", () => {
    const writeRoutes = [
      { pathname: "/clients/new", method: "GET" },
      { pathname: "/clients/1/edit", method: "GET" },
      { pathname: "/api/clients", method: "POST" },
      { pathname: "/api/clients/1", method: "PATCH" },
    ]
    for (const route of writeRoutes) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, route)
        if (projectManagerRoles.includes(role)) {
          expect(result.allowed).toBe(true)
        } else {
          expect(result.allowed).toBe(false)
        }
        expect(result.capability).toBe("clients.write")
      }
    }
  })
})

describe("RBAC — client requests", () => {
  it("client requests read is all roles", () => {
    for (const pathname of ["/requests", "/requests/1", "/api/client-requests"]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(true)
        expect(result.capability).toBe("clients.read")
      }
    }
  })

  it("client requests write is owner, administrator, project_manager", () => {
    for (const route of [{ pathname: "/api/client-requests", method: "POST" }, { pathname: "/api/client-requests/1", method: "PATCH" }]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, route)
        if (projectManagerRoles.includes(role)) {
          expect(result.allowed).toBe(true)
        } else {
          expect(result.allowed).toBe(false)
        }
        expect(result.capability).toBe("clients.write")
      }
    }
  })
})

describe("RBAC — messages", () => {
  it("messages are readable by all roles", () => {
    for (const pathname of ["/messages", "/messages/1"]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(true)
        expect(result.capability).toBe("clients.read")
      }
    }
  })
})

describe("RBAC — Forge projects (base CRUD)", () => {
  it("Forge project list and details use projects.read/write", () => {
    expect(requiredCapabilityForRequest({ pathname: "/api/forge/projects", method: "GET" })).toBe("projects.read")
    expect(requiredCapabilityForRequest({ pathname: "/api/forge/projects/1", method: "GET" })).toBe("projects.read")
    expect(requiredCapabilityForRequest({ pathname: "/api/forge/projects", method: "POST" })).toBe("projects.write")
    expect(requiredCapabilityForRequest({ pathname: "/api/forge/projects/1", method: "PATCH" })).toBe("projects.write")
  })

  it("projects.read is available to all roles", () => {
    for (const pathname of ["/api/forge/projects", "/api/forge/projects/1"]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(true)
        expect(result.capability).toBe("projects.read")
      }
    }
  })

  it("projects.write is owner, admin, project_manager, developer", () => {
    for (const route of [{ pathname: "/api/forge/projects", method: "POST" }, { pathname: "/api/forge/projects/1", method: "PATCH" }]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, route)
        if (ownerAdminPMDev.includes(role)) {
          expect(result.allowed).toBe(true)
        } else {
          expect(result.allowed).toBe(false)
        }
        expect(result.capability).toBe("projects.write")
      }
    }
  })
})

describe("RBAC — Forge task execution (generic)", () => {
  const taskRoutes = [
    { pathname: "/api/forge/projects/1/research", method: "POST" },
    { pathname: "/api/forge/projects/1/generate-site", method: "POST" },
    { pathname: "/api/forge/projects/1/qa", method: "POST" },
    { pathname: "/api/forge/projects/1/proposal", method: "POST" },
  ]

  it("maps to forge.execute (not projects.write)", () => {
    for (const route of taskRoutes) {
      expect(requiredCapabilityForRequest(route)).toBe("forge.execute")
    }
  })

  it("forge.execute is owner, admin, project_manager, developer", () => {
    for (const route of taskRoutes) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, route)
        if (ownerAdminPMDev.includes(role)) {
          expect(result.allowed).toBe(true)
        } else {
          expect(result.allowed).toBe(false)
        }
        expect(result.capability).toBe("forge.execute")
      }
    }
  })
})

describe("RBAC — Forge read-only views", () => {
  it("forge.read is owner, admin, PM, developer, viewer", () => {
    for (const pathname of ["/forge", "/forge/projects/1"]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        if (forgeReadRoles.includes(role)) {
          expect(result.allowed).toBe(true)
        } else {
          expect(result.allowed).toBe(false)
        }
        expect(result.capability).toBe("forge.read")
      }
    }
  })
})

describe("RBAC — Forge specific sensitive routes", () => {
  it("Forge approve is owner, admin, PM, developer", () => {
    const approveRoutes = ["sitemap", "copy", "design", "component-spec", "visual-critique"]
    for (const action of approveRoutes) {
      const route = { pathname: `/api/forge/projects/1/${action}`, method: "PATCH" as const }
      expect(requiredCapabilityForRequest(route)).toBe("forge.approve")
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, route)
        expect(result.allowed).toBe(ownerAdminPMDev.includes(role))
        expect(result.capability).toBe("forge.approve")
      }
    }
  })

  it("Forge configure is owner, admin, PM, developer", () => {
    for (const pathname of ["/api/forge/projects/1/integrations/resend", "/api/forge/projects/1/integrations/stripe"]) {
      expect(requiredCapabilityForRequest({ pathname, method: "PATCH" })).toBe("forge.configure")
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "PATCH" })
        expect(result.allowed).toBe(ownerAdminPMDev.includes(role))
        expect(result.capability).toBe("forge.configure")
      }
    }
  })

  it("Forge deploy is owner, admin, developer only", () => {
    const route = { pathname: "/api/forge/projects/1/deploy", method: "POST" as const }
    expect(requiredCapabilityForRequest(route)).toBe("deployments.execute")
    for (const role of ADMIN_ROLES) {
      const result = authorizeRequest(role, route)
      expect(result.allowed).toBe(ownerAdminDev.includes(role))
      expect(result.capability).toBe("deployments.execute")
    }
  })

  it("Forge AI usage audit is mapped before generic Forge", () => {
    for (const pathname of ["/api/forge/ai-usage", "/api/forge/ai-usage/export"]) {
      expect(requiredCapabilityForRequest({ pathname, method: "GET" })).toBe("audit.read")
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(auditReadRoles.includes(role))
        expect(result.capability).toBe("audit.read")
      }
    }
  })
})

describe("RBAC — sales proposals", () => {
  it("sales proposals use leads.read/write", () => {
    expect(requiredCapabilityForRequest({ pathname: "/api/proposals", method: "GET" })).toBe("leads.read")
    expect(requiredCapabilityForRequest({ pathname: "/api/proposals", method: "POST" })).toBe("leads.write")
  })

  it("leads.read on proposals excludes developer", () => {
    for (const role of leadsReadRoles) {
      expect(authorizeRequest(role, { pathname: "/api/proposals", method: "GET" }).allowed).toBe(true)
    }
    expect(authorizeRequest("developer", { pathname: "/api/proposals", method: "GET" }).allowed).toBe(false)
  })
})

describe("RBAC — finance and invoices", () => {
  it("finance read excludes developer", () => {
    for (const pathname of ["/finance/invoices", "/api/invoices", "/api/invoices/1", "/api/invoice-catalogue", "/api/invoice-settings"]) {
      for (const role of financeReadRoles) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(true)
        expect(result.capability).toBe("finance.read")
      }
    }
    for (const route of [{ pathname: "/api/invoices", method: "GET" }, { pathname: "/finance/invoices", method: "GET" }]) {
      expect(authorizeRequest("developer", route).allowed).toBe(false)
    }
  })

  it("finance write is owner, administrator, finance only", () => {
    const writeRoutes = [
      { pathname: "/api/invoices", method: "POST" },
      { pathname: "/api/invoices/1", method: "PATCH" },
      { pathname: "/api/invoices/1/delivery", method: "POST" },
      { pathname: "/api/invoice-catalogue/1", method: "PATCH" },
      { pathname: "/api/invoice-settings", method: "PUT" },
    ]
    for (const route of writeRoutes) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, route)
        if (ownerAdminFinance.includes(role)) {
          expect(result.allowed).toBe(true)
        } else {
          expect(result.allowed).toBe(false)
        }
        expect(result.capability).toBe("finance.write")
      }
    }
  })

  it("client invoice-code and billing use finance permissions", () => {
    for (const pathname of ["/api/clients/1/invoice-code", "/api/clients/1/billing"]) {
      expect(requiredCapabilityForRequest({ pathname, method: "PATCH" })).toBe("finance.write")
      expect(requiredCapabilityForRequest({ pathname, method: "GET" })).toBe("finance.read")
    }
  })
})

describe("RBAC — monthly reports", () => {
  it("monthly reports read excludes developer", () => {
    for (const role of financeReadRoles) {
      const result = authorizeRequest(role, { pathname: "/api/monthly-reports", method: "GET" })
      expect(result.allowed).toBe(true)
      expect(result.capability).toBe("finance.read")
    }
    expect(authorizeRequest("developer", { pathname: "/api/monthly-reports", method: "GET" }).allowed).toBe(false)
  })

  it("monthly reports write is owner, administrator, finance", () => {
    for (const role of ADMIN_ROLES) {
      const result = authorizeRequest(role, { pathname: "/api/monthly-reports", method: "POST" })
      expect(result.allowed).toBe(ownerAdminFinance.includes(role))
      expect(result.capability).toBe("finance.write")
    }
  })
})

describe("RBAC — operations and kanban/roadmap", () => {
  it("operations read is all roles", () => {
    for (const pathname of ["/operations/daily-brief", "/api/operations/brief", "/roadmap", "/api/kanban"]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(true)
        expect(result.capability).toBe("projects.read")
      }
    }
  })

  it("operations write is owner, admin, PM, developer", () => {
    for (const route of [{ pathname: "/api/kanban", method: "POST" }, { pathname: "/api/kanban/1", method: "PATCH" }]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, route)
        expect(result.allowed).toBe(ownerAdminPMDev.includes(role))
        expect(result.capability).toBe("projects.write")
      }
    }
  })
})

describe("RBAC — analytics", () => {
  it("analytics read is all roles with analytics.read", () => {
    for (const pathname of ["/clients/1/analytics", "/api/clients/1/analytics"]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(true)
        expect(result.capability).toBe("analytics.read")
      }
    }
  })
})

describe("RBAC — claims (restricted to owner/admin)", () => {
  it("claims read is owner/administrator only", () => {
    for (const pathname of ["/claims", "/api/claims"]) {
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, { pathname, method: "GET" })
        expect(result.allowed).toBe(ownerAdmin.includes(role))
        expect(result.capability).toBe("claims.read")
      }
    }
  })

  it("claims write/manage is owner/administrator only", () => {
    for (const pathname of ["/claims/testimonial.x.y", "/api/claims/testimonial.x.y"]) {
      const route = { pathname, method: "PATCH" as const }
      for (const role of ADMIN_ROLES) {
        const result = authorizeRequest(role, route)
        expect(result.allowed).toBe(ownerAdmin.includes(role))
        expect(result.capability).toBe("claims.manage")
      }
    }
  })
})

describe("RBAC — viewer restrictions", () => {
  it("viewer is denied all write operations", () => {
    const writePaths = [
      { pathname: "/api/prospects", method: "POST" },
      { pathname: "/api/clients", method: "POST" },
      { pathname: "/api/client-requests", method: "POST" },
      { pathname: "/api/invoices", method: "POST" },
      { pathname: "/api/admin-users", method: "POST" },
      { pathname: "/api/security/mfa", method: "POST" },
      { pathname: "/api/forge/projects", method: "POST" },
      { pathname: "/api/forge/projects/1/research", method: "POST" },
      { pathname: "/api/forge/projects/1/deploy", method: "POST" },
      { pathname: "/api/forge/projects/1/integrations/resend", method: "PATCH" },
      { pathname: "/api/forge/projects/1/sitemap", method: "PATCH" },
      { pathname: "/api/proposals", method: "POST" },
      { pathname: "/api/monthly-reports", method: "POST" },
      { pathname: "/api/kanban", method: "POST" },
      { pathname: "/clients/new", method: "GET" },
    ]
    for (const route of writePaths) {
      const result = authorizeRequest("viewer", route)
      expect(result.allowed).toBe(false)
    }
  })

  it("viewer cannot access admin user management or security settings", () => {
    for (const route of [{ pathname: "/api/admin-users", method: "GET" }, { pathname: "/api/security/mfa", method: "GET" }]) {
      expect(authorizeRequest("viewer", route).allowed).toBe(false)
    }
  })
})

describe("RBAC — unrecognised paths", () => {
  it("unrecognised paths return null capability (middleware allows by default)", () => {
    expect(requiredCapabilityForRequest({ pathname: "/some/unknown/path", method: "GET" })).toBeNull()
    expect(requiredCapabilityForRequest({ pathname: "/api/mysterious-endpoint", method: "POST" })).toBeNull()
  })

  it("null capability allows all roles", () => {
    for (const role of ADMIN_ROLES) {
      expect(authorizeRequest(role, { pathname: "/unknown/route", method: "GET" }).allowed).toBe(true)
    }
  })
})

describe("RBAC — no route mapping throws", () => {
  it("authorizeRequest never throws for any valid combination", () => {
    const testRoutes = [
      ...ADMIN_ROLES.map((role) => ({ role, pathname: "/dashboard", method: "GET" })),
      ...ADMIN_ROLES.map((role) => ({ role, pathname: "/api/prospects", method: "POST" })),
      ...ADMIN_ROLES.map((role) => ({ role, pathname: "/api/forge/projects/1/deploy", method: "POST" })),
      ...ADMIN_ROLES.map((role) => ({ role, pathname: "/api/invoices", method: "PATCH" })),
      ...ADMIN_ROLES.map((role) => ({ role, pathname: "/api/security/logout", method: "POST" })),
      ...ADMIN_ROLES.map((role) => ({ role, pathname: "/api/health", method: "GET" })),
      ...ADMIN_ROLES.map((role) => ({ role, pathname: "/api/auth/signin", method: "POST" })),
    ] as Array<{ role: AdminRole; pathname: string; method: string }>
    for (const { role, ...route } of testRoutes) {
      expect(() => authorizeRequest(role, route)).not.toThrow()
    }
  })
})
