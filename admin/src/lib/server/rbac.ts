import "server-only"

import { redirect } from "next/navigation"
import { AdminIdentityError } from "@/lib/admin-users"
import { databaseQueryScope, hasCapability, type Capability } from "@/lib/rbac"
import { requireCurrentAdminUser } from "./admin-session"
import { requiresMfaEnrolment } from "./mfa"

// Defence in depth behind middleware: a privileged user who has not enrolled MFA reaches no capability-guarded page or API.
export async function requireCapability(capability: Capability) {
  const user = await requireCurrentAdminUser()
  if (requiresMfaEnrolment(user)) throw new AdminIdentityError("Set up multi-factor authentication to continue.", 403, "mfa_enrolment_required")
  if (!hasCapability(user.role, capability)) throw new AdminIdentityError("You do not have permission to perform this action.", 403, "rbac_denied")
  return user
}
/** `allowMfaEnrolment` is for the account security page only, where an enrolment-only session sets up MFA. */
export async function guardPageCapability(capability: Capability, fallback = "/dashboard", options: { allowMfaEnrolment?: boolean } = {}) {
  const user = await requireCurrentAdminUser().catch(() => null)
  if (!user) redirect("/login")
  if (requiresMfaEnrolment(user) && !options.allowMfaEnrolment) redirect("/security?reason=mfa_enrolment")
  if (!hasCapability(user.role, capability)) redirect(fallback)
  return user
}
export async function guardApiCapability(capability: Capability) { return requireCapability(capability) }
export async function guardServerActionCapability(capability: Capability) { return requireCapability(capability) }
export async function requireQueryScope(capability: Capability) {
  const user = await requireCapability(capability)
  const scope = databaseQueryScope(user.role, capability)
  if (scope === "none") throw new AdminIdentityError("Query scope denied.", 403, "rbac_scope_denied")
  return { user, scope }
}
