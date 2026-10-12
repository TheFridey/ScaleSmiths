import { isAdminRole } from "./admin-users"
import { hasCapability } from "./rbac"

/** Choose an existing authorised landing page without granting any new capability. */
export function adminHomeForRole(role: unknown): string {
  if (!isAdminRole(role)) return "/login"
  if (role === "venture_controller") return "/venture-lab"
  if (hasCapability(role, "leads.read")) return "/command-centre"
  if (hasCapability(role, "projects.read")) return "/dashboard"
  return "/login"
}

export function isPublicAdminBrandAsset(pathname: string): boolean {
  return pathname === "/brand/favicon.png"
}
