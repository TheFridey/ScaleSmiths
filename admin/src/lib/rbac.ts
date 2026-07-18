import type { AdminRole } from "./admin-users"

export const CAPABILITIES = [
  "users.manage", "users.reset_password", "users.assign_owner", "leads.read", "leads.write", "clients.read", "clients.write",
  "projects.read", "projects.write", "forge.read", "forge.execute", "forge.approve",
  "forge.configure", "finance.read", "finance.write", "settings.manage", "audit.read",
  "deployments.execute", "analytics.read", "analytics.write", "claims.read", "claims.manage",
] as const
export type Capability = (typeof CAPABILITIES)[number]

export const ROLE_CAPABILITIES: Readonly<Record<AdminRole, readonly Capability[]>> = {
  owner: CAPABILITIES,
  administrator: CAPABILITIES.filter((capability) => capability !== "users.reset_password" && capability !== "users.assign_owner"),
  sales: ["leads.read", "leads.write", "clients.read", "projects.read", "finance.read", "analytics.read"],
  project_manager: ["leads.read", "clients.read", "clients.write", "projects.read", "projects.write", "forge.read", "forge.execute", "forge.approve", "forge.configure", "finance.read", "audit.read", "analytics.read", "analytics.write"],
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
  const write = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/login")) return null
  if (pathname === "/security" || pathname.startsWith("/security/") || pathname.startsWith("/api/security")) return "settings.manage"
  if (pathname === "/users" || pathname.startsWith("/users/") || pathname.startsWith("/api/admin-users")) return "users.manage"
  if (pathname === "/claims" || pathname.startsWith("/claims/") || pathname.startsWith("/api/claims")) return write ? "claims.manage" : "claims.read"
  if (pathname === "/prospects" || pathname.startsWith("/prospects/") || pathname.startsWith("/api/prospects")) return write ? "leads.write" : "leads.read"
  if (pathname === "/clients/new") return "clients.write"
  if (/^\/clients\/[^/]+\/analytics/.test(pathname) || /^\/api\/clients\/[^/]+\/analytics/.test(pathname)) return write ? "analytics.write" : "analytics.read"
  if (pathname === "/clients" || pathname.startsWith("/clients/") || pathname.startsWith("/api/clients")) return write ? "clients.write" : "clients.read"
  if (pathname === "/requests" || pathname.startsWith("/requests/") || pathname.startsWith("/api/client-requests")) return write ? "clients.write" : "clients.read"
  if (pathname === "/messages" || pathname.startsWith("/messages/")) return "clients.read"
  if (pathname.startsWith("/api/forge/ai-usage")) return "audit.read"
  if (/^\/api\/forge\/projects\/[^/]+\/deploy/.test(pathname)) return "deployments.execute"
  if (/^\/api\/forge\/projects\/[^/]+\/integrations/.test(pathname)) return "forge.configure"
  if (/^\/api\/forge\/projects\/[^/]+\/(?:sitemap|copy|design|component-spec|visual-critique)/.test(pathname) && method.toUpperCase() === "PATCH") return "forge.approve"
  if (pathname.startsWith("/api/forge/projects") && /^\/api\/forge\/projects(?:\/[^/]+)?\/?$/.test(pathname)) return write ? "projects.write" : "projects.read"
  if (pathname === "/forge/new") return "projects.write"
  if (pathname.startsWith("/api/forge") || pathname === "/forge" || pathname.startsWith("/forge/")) return write ? "forge.execute" : "forge.read"
  if (pathname.startsWith("/api/proposals")) return write ? "leads.write" : "leads.read"
  if (pathname.startsWith("/api/monthly-reports")) return write ? "finance.write" : "finance.read"
  if (pathname.startsWith("/operations/") || pathname.startsWith("/api/operations/")) return write ? "projects.write" : "projects.read"
  if (pathname.startsWith("/api/kanban") || pathname === "/roadmap" || pathname.startsWith("/roadmap/")) return write ? "projects.write" : "projects.read"
  if (pathname === "/dashboard" || pathname === "/") return "projects.read"
  return null
}

export function authorizeRequest(role: AdminRole, request: RbacRequest) {
  const capability = requiredCapabilityForRequest(request)
  return capability ? { ...requireRoleCapability(role, capability), capability } : { allowed: true as const, capability: null }
}

export type QueryScope = "global" | "none"
export function databaseQueryScope(role: AdminRole, capability: Capability): QueryScope {
  return hasCapability(role, capability) ? "global" : "none"
}
