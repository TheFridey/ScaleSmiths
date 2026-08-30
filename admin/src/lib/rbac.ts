import type { AdminRole } from "./admin-users"
import { authorizationExpectation } from "./authorization-policy"

export const CAPABILITIES = [
  "admin_users.read", "admin_users.manage", "admin_users.credentials.reset", "admin_users.owner.assign",
  "portal_users.read", "portal_users.manage", "portal_users.credentials.reset",
  "leads.read", "leads.write", "prospects.convert", "clients.read", "clients.write",
  "projects.read", "projects.write", "forge.read", "forge.execute", "forge.approve",
  "forge.configure", "finance.read", "finance.write", "settings.manage", "audit.read",
  "deployments.execute", "analytics.read", "analytics.write", "claims.read", "claims.manage",
] as const
export type Capability = (typeof CAPABILITIES)[number]

export const ROLE_CAPABILITIES: Readonly<Record<AdminRole, readonly Capability[]>> = {
  owner: CAPABILITIES,
  administrator: CAPABILITIES.filter((capability) => capability !== "admin_users.credentials.reset" && capability !== "admin_users.owner.assign"),
  sales: ["leads.read", "leads.write", "prospects.convert", "clients.read", "projects.read", "finance.read", "analytics.read"],
  project_manager: ["portal_users.read", "portal_users.manage", "leads.read", "prospects.convert", "clients.read", "clients.write", "projects.read", "projects.write", "forge.read", "forge.execute", "forge.approve", "forge.configure", "finance.read", "audit.read", "analytics.read", "analytics.write"],
  developer: ["clients.read", "projects.read", "projects.write", "forge.read", "forge.execute", "forge.approve", "forge.configure", "audit.read", "deployments.execute", "analytics.read"],
  finance: ["leads.read", "clients.read", "projects.read", "finance.read", "finance.write", "audit.read", "analytics.read"],
  viewer: ["leads.read", "clients.read", "projects.read", "forge.read", "finance.read", "analytics.read"],
}

export function hasCapability(role: AdminRole, capability: Capability) {
  return ROLE_CAPABILITIES[role].includes(capability)
}
export function requireRoleCapability(role: AdminRole, capability: Capability) {
  return hasCapability(role, capability) ? { allowed: true as const } : { allowed: false as const, capability, role }
}
export function isNavigationVisible(role: AdminRole, capability: Capability) { return hasCapability(role, capability) }
export function canUseControl(role: AdminRole, capability: Capability) { return hasCapability(role, capability) }
export function isPrivilegeReduction(currentRole: AdminRole, nextRole: AdminRole) {
  return ROLE_CAPABILITIES[currentRole].some((capability) => !ROLE_CAPABILITIES[nextRole].includes(capability))
}

export interface RbacRequest { pathname: string; method: string }
export function requiredCapabilityForRequest({ pathname, method }: RbacRequest): Capability | null {
  const apiExpectation = authorizationExpectation(pathname, method)
  if (apiExpectation) return apiExpectation.capability
  const write = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/login")) return null
  if (pathname === "/api/security/logout") return null
  if (pathname === "/security" || pathname.startsWith("/security/") || pathname.startsWith("/api/security")) return "settings.manage"
  if (pathname === "/users" || pathname.startsWith("/users/") || pathname.startsWith("/api/admin-users")) return write ? "admin_users.manage" : "admin_users.read"
  if (pathname === "/portal-users" || pathname.startsWith("/portal-users/") || pathname.startsWith("/api/portal-users")) return write ? "portal_users.manage" : "portal_users.read"
  if (pathname === "/claims" || pathname.startsWith("/claims/") || pathname.startsWith("/api/claims")) return write ? "claims.manage" : "claims.read"
  if (/^\/api\/prospects\/[^/]+\/conversion$/.test(pathname)) return method.toUpperCase() === "GET" ? "leads.read" : "prospects.convert"
  if (pathname === "/prospects" || pathname.startsWith("/prospects/") || pathname.startsWith("/api/prospects")) return write ? "leads.write" : "leads.read"
  if (pathname === "/clients/new" || /^\/clients\/[^/]+\/edit$/.test(pathname)) return "clients.write"
  if (/^\/api\/clients\/[^/]+\/(?:invoice-code|billing)/.test(pathname)) return write ? "finance.write" : "finance.read"
  if (/^\/clients\/[^/]+\/analytics/.test(pathname) || /^\/api\/clients\/[^/]+\/analytics/.test(pathname)) return write ? "analytics.write" : "analytics.read"
  if (pathname === "/clients" || pathname.startsWith("/clients/") || pathname.startsWith("/api/clients")) return write ? "clients.write" : "clients.read"
  if (pathname === "/requests" || pathname.startsWith("/requests/") || pathname.startsWith("/api/client-requests")) return write ? "clients.write" : "clients.read"
  if (pathname === "/messages" || pathname.startsWith("/messages/")) return "clients.read"
  if (pathname.startsWith("/api/forge/ai-usage")) return "audit.read"
  if (pathname === "/api/forge/reconciliation") return write ? "forge.configure" : "audit.read"
  if (/^\/api\/forge\/projects\/[^/]+\/deploy/.test(pathname)) return "deployments.execute"
  if (/^\/api\/forge\/projects\/[^/]+\/integrations/.test(pathname)) return "forge.configure"
  if (/^\/api\/forge\/projects\/[^/]+\/(?:sitemap|copy|design|component-spec|visual-critique)/.test(pathname) && method.toUpperCase() === "PATCH") return "forge.approve"
  if (pathname.startsWith("/api/forge/projects") && /^\/api\/forge\/projects(?:\/[^/]+)?\/?$/.test(pathname)) return write ? "projects.write" : "projects.read"
  if (pathname === "/forge/new") return "projects.write"
  if (pathname.startsWith("/api/forge") || pathname === "/forge" || pathname.startsWith("/forge/")) return write ? "forge.execute" : "forge.read"
  if (pathname.startsWith("/api/proposals")) return write ? "leads.write" : "leads.read"
  if (pathname.startsWith("/api/monthly-reports")) return write ? "finance.write" : "finance.read"
  if (pathname === "/projects" || pathname.startsWith("/projects/") || pathname === "/api/projects" || pathname.startsWith("/api/projects/")) return write ? "projects.write" : "projects.read"
  if (pathname === "/finance" || pathname.startsWith("/finance/") || pathname.startsWith("/api/invoices") || pathname.startsWith("/api/invoice-catalogue") || pathname.startsWith("/api/invoice-settings")) return write ? "finance.write" : "finance.read"
  if (pathname.startsWith("/operations/") || pathname.startsWith("/api/operations/")) return write ? "projects.write" : "projects.read"
  if (pathname.startsWith("/api/kanban") || pathname === "/roadmap" || pathname.startsWith("/roadmap/")) return write ? "projects.write" : "projects.read"
  if (pathname === "/dashboard" || pathname === "/") return "projects.read"
  return null
}

export function authorizeRequest(role: AdminRole, request: RbacRequest) {
  const capability = requiredCapabilityForRequest(request)
  const protocolException = request.pathname.startsWith("/api/auth") || request.pathname === "/api/security/logout" || request.pathname === "/api/health" || request.pathname === "/api/monitoring/self-test"
  if (request.pathname.startsWith("/api/") && !authorizationExpectation(request.pathname, request.method) && capability === null && !protocolException) {
    return { allowed: false as const, capability: null, reason: "unmapped_api_operation" as const }
  }
  return capability ? { ...requireRoleCapability(role, capability), capability } : { allowed: true as const, capability: null }
}

export type QueryScope = "global" | "none"
export function databaseQueryScope(role: AdminRole, capability: Capability): QueryScope {
  return hasCapability(role, capability) ? "global" : "none"
}
