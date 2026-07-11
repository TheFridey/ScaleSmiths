export const ADMIN_ROLES = ["owner", "administrator", "sales", "project_manager", "developer", "finance", "viewer"] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export class AdminIdentityError extends Error {
  constructor(public safeMessage: string, public status = 400, public code = "admin_identity") {
    super(safeMessage)
    this.name = "AdminIdentityError"
  }
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.includes(value as AdminRole)
}
export function normalizeAdminEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}
export function isAdminSessionCurrent(user: { active: boolean; sessionVersion: number }, tokenVersion: unknown) {
  return user.active && Number.isInteger(tokenVersion) && tokenVersion === user.sessionVersion
}
export function assertFinalOwnerProtected(input: { targetRole: AdminRole; targetActive: boolean; nextRole?: AdminRole; nextActive?: boolean; activeOwnerCount: number }) {
  const remainsOwner = (input.nextRole ?? input.targetRole) === "owner" && (input.nextActive ?? input.targetActive)
  const removesActiveOwner = input.targetRole === "owner" && input.targetActive && !remainsOwner
  if (removesActiveOwner && input.activeOwnerCount <= 1) throw new AdminIdentityError("The final active owner cannot be disabled or demoted.", 409, "final_owner")
}
export function validateNewAdminUser(input: Record<string, unknown>) {
  const email = normalizeAdminEmail(input.email)
  const displayName = typeof input.displayName === "string" ? input.displayName.trim() : ""
  const password = typeof input.password === "string" ? input.password : ""
  const role = isAdminRole(input.role) ? input.role : null
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new AdminIdentityError("A valid email is required.")
  if (displayName.length < 2 || displayName.length > 120) throw new AdminIdentityError("Display name must be between 2 and 120 characters.")
  if (password.length < 12) throw new AdminIdentityError("Password must be at least 12 characters.")
  if (!role) throw new AdminIdentityError("A valid role is required.")
  return { email, displayName, password, role }
}
export function bootstrapAction(existing: { id: string } | null) { return existing ? "unchanged" as const : "create" as const }
export function resolveAdminUserMutation(input: { targetId: string; actorId: string; targetRole: AdminRole; targetActive: boolean; targetSessionVersion: number; requestedRole?: AdminRole; requestedActive?: boolean; revokeSessions?: boolean; activeOwnerCount: number }) {
  const role = input.requestedRole ?? input.targetRole
  const active = input.requestedActive ?? input.targetActive
  assertFinalOwnerProtected({ targetRole: input.targetRole, targetActive: input.targetActive, nextRole: role, nextActive: active, activeOwnerCount: input.activeOwnerCount })
  if (input.targetId === input.actorId && !active) throw new AdminIdentityError("You cannot disable your own account.", 409, "self_disable")
  return { role, active, sessionVersion: input.revokeSessions || !active ? input.targetSessionVersion + 1 : input.targetSessionVersion }
}
