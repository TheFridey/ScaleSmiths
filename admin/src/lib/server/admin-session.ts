import "server-only"

import { auth } from "../../../auth"
import { AdminIdentityError } from "@/lib/admin-users"
import { hasCapability } from "@/lib/rbac"
import { findAdminUserById } from "./admin-users"

export async function requireCurrentAdminUser() {
  const session = await auth()
  if (!session?.user?.id || !session.user.active) throw new AdminIdentityError("Unauthorized.", 401, "unauthorized")
  const user = await findAdminUserById(session.user.id)
  if (!user?.active || user.sessionVersion !== session.user.sessionVersion) throw new AdminIdentityError("Your session is no longer valid.", 401, "session_revoked")
  return user
}

export async function requireAdminUserManager() {
  const user = await requireCurrentAdminUser()
  if (!hasCapability(user.role, "admin_users.manage")) throw new AdminIdentityError("You do not have permission to manage admin users.", 403, "forbidden")
  return user
}
