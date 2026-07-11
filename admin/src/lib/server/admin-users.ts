import "server-only"

import bcrypt from "bcryptjs"
import { and, asc, count, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { adminSecurityAudit, adminUsers } from "@/lib/schema"
import { AdminIdentityError, normalizeAdminEmail, resolveAdminUserMutation, validateNewAdminUser, type AdminRole } from "@/lib/admin-users"
import { hasCapability, isPrivilegeReduction } from "@/lib/rbac"
import { consumeRecoveryCode, decryptMfaSecret, generateMfaSetup, isMfaRequired, readStoredMfaState, verifyTotp } from "./mfa"

const PASSWORD_ROUNDS = 12

export async function findAdminUserByEmail(email: string) {
  const [user] = await db.select().from(adminUsers).where(sql`lower(${adminUsers.email}) = ${normalizeAdminEmail(email)}`).limit(1)
  return user ?? null
}

export async function findAdminUserById(id: string) {
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1)
  return user ?? null
}

export async function authenticateAdminUser(email: string, password: string) {
  const user = await findAdminUserByEmail(email)
  if (!user?.active || !password) return null
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return null
  return user
}

export async function recordSuccessfulAdminLogin(userId: string) {
  const now = new Date()
  await db.update(adminUsers).set({ lastLoginAt: now, updatedAt: now }).where(eq(adminUsers.id, userId))
}

export async function listAdminUsers() {
  return db.select({ id: adminUsers.id, email: adminUsers.email, displayName: adminUsers.displayName, role: adminUsers.role, active: adminUsers.active, mfaEnabled: adminUsers.mfaEnabled, sessionVersion: adminUsers.sessionVersion, lastLoginAt: adminUsers.lastLoginAt, passwordChangedAt: adminUsers.passwordChangedAt, createdAt: adminUsers.createdAt, updatedAt: adminUsers.updatedAt }).from(adminUsers).orderBy(asc(adminUsers.displayName))
}

export async function createAdminUser(input: Record<string, unknown>) {
  const parsed = validateNewAdminUser(input)
  const now = new Date()
  try {
    const [created] = await db.insert(adminUsers).values({ email: parsed.email, displayName: parsed.displayName, passwordHash: await bcrypt.hash(parsed.password, PASSWORD_ROUNDS), role: parsed.role, active: true, passwordChangedAt: now, updatedAt: now }).returning({ id: adminUsers.id })
    return created
  } catch (error) {
    if (isUniqueViolation(error)) throw new AdminIdentityError("An admin user with that email already exists.", 409, "duplicate_email")
    throw error
  }
}

export async function updateAdminUser(targetId: string, input: Record<string, unknown>, actor: { id: string; role: AdminRole }) {
  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(adminUsers).where(eq(adminUsers.id, targetId)).limit(1)
    if (!target) throw new AdminIdentityError("Admin user not found.", 404, "not_found")
    const [ownerCount] = await tx.select({ value: count() }).from(adminUsers).where(and(eq(adminUsers.role, "owner"), eq(adminUsers.active, true)))
    const nextRole = input.role === undefined ? target.role : input.role
    const nextActive = input.active === undefined ? target.active : input.active
    if (typeof nextActive !== "boolean" || !isRole(nextRole)) throw new AdminIdentityError("Invalid role or active state.")
    if (nextRole === "owner" && !hasCapability(actor.role, "users.assign_owner")) throw new AdminIdentityError("Only an owner can grant the owner role.", 403, "owner_required")
    const privilegeReduced = isPrivilegeReduction(target.role, nextRole)
    const mutation = resolveAdminUserMutation({ targetId: target.id, actorId: actor.id, targetRole: target.role, targetActive: target.active, targetSessionVersion: target.sessionVersion, requestedRole: nextRole, requestedActive: nextActive, revokeSessions: input.revokeSessions === true || privilegeReduced, activeOwnerCount: Number(ownerCount.value) })
    const now = new Date()
    const [updated] = await tx.update(adminUsers).set({ ...mutation, updatedAt: now }).where(eq(adminUsers.id, targetId)).returning({ id: adminUsers.id, role: adminUsers.role, active: adminUsers.active, sessionVersion: adminUsers.sessionVersion })
    return updated
  })
}

export async function resetAdminUserPassword(targetId: string, password: string, actor: { role: AdminRole }) {
  if (!hasCapability(actor.role, "users.reset_password")) throw new AdminIdentityError("Only an owner can reset admin passwords.", 403, "owner_required")
  if (password.length < 12) throw new AdminIdentityError("Password must be at least 12 characters.")
  const now = new Date()
  const [updated] = await db.update(adminUsers).set({ passwordHash: await bcrypt.hash(password, PASSWORD_ROUNDS), passwordChangedAt: now, sessionVersion: sql`${adminUsers.sessionVersion} + 1`, updatedAt: now }).where(eq(adminUsers.id, targetId)).returning({ id: adminUsers.id })
  if (!updated) throw new AdminIdentityError("Admin user not found.", 404, "not_found")
  return updated
}

export async function beginAdminMfaSetup(userId: string) {
  const user = await findAdminUserById(userId)
  if (!user?.active) throw new AdminIdentityError("Admin user not found.", 404, "not_found")
  if (user.mfaEnabled) throw new AdminIdentityError("MFA is already active. An owner must invalidate it before re-enrolment.", 409, "mfa_already_active")
  const setup = generateMfaSetup({ email: user.email })
  await db.transaction(async (tx) => {
    await tx.update(adminUsers).set({ mfaEnabled: false, mfaState: setup.state, updatedAt: new Date() }).where(eq(adminUsers.id, userId))
    await tx.insert(adminSecurityAudit).values({ actorUserId: userId, targetUserId: userId, action: "mfa_setup_started", success: true, metadataJson: { recoveryCodeCount: setup.recoveryCodes.length } })
  })
  return { secret: setup.secret, recoveryCodes: setup.recoveryCodes, otpauthUri: setup.otpauthUri }
}

export async function activateAdminMfa(userId: string, code: string) {
  const user = await findAdminUserById(userId)
  const state = readStoredMfaState(user?.mfaState)
  if (!user || !state || state.status !== "pending") throw new AdminIdentityError("Start MFA setup before verification.", 409, "mfa_setup_required")
  let valid = false
  try { valid = verifyTotp(decryptMfaSecret(state.encryptedSecret), code) } catch { valid = false }
  if (!valid) {
    await writeAdminSecurityAudit({ actorUserId: userId, targetUserId: userId, action: "mfa_setup_verification_failed", success: false })
    throw new AdminIdentityError("Invalid authenticator code.", 400, "mfa_invalid")
  }
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(adminUsers).set({ mfaEnabled: true, mfaState: { ...state, status: "active", verifiedAt: now.toISOString() }, sessionVersion: user.sessionVersion + 1, updatedAt: now }).where(eq(adminUsers.id, userId))
    await tx.insert(adminSecurityAudit).values({ actorUserId: userId, targetUserId: userId, action: "mfa_enabled", success: true, metadataJson: { recoveryCodeCount: state.recoveryCodeHashes.length } })
  })
}

export async function verifyAdminMfaChallenge(user: Awaited<ReturnType<typeof findAdminUserByEmail>>, input: { totp?: string; recoveryCode?: string }) {
  if (!user) return false
  const required = isMfaRequired(user.role)
  if (!user.mfaEnabled) {
    if (required) await writeAdminSecurityAudit({ actorUserId: user.id, targetUserId: user.id, action: "mfa_challenge_failed", success: false, metadataJson: { reason: "mfa_required_not_configured" } })
    return !required
  }
  const state = readStoredMfaState(user.mfaState)
  if (!state || state.status !== "active") {
    await writeAdminSecurityAudit({ actorUserId: user.id, targetUserId: user.id, action: "mfa_challenge_failed", success: false, metadataJson: { reason: "invalid_mfa_state" } })
    return false
  }
  let valid = false
  let method: "totp" | "recovery" = "totp"
  if (input.recoveryCode) {
    method = "recovery"
    return db.transaction(async (tx) => {
      const [locked] = await tx.select().from(adminUsers).where(eq(adminUsers.id, user.id)).for("update").limit(1)
      const lockedState = readStoredMfaState(locked?.mfaState)
      const consumed = lockedState ? consumeRecoveryCode(input.recoveryCode!, lockedState.recoveryCodeHashes) : { valid: false as const, remaining: [] }
      if (consumed.valid && lockedState) await tx.update(adminUsers).set({ mfaState: { ...lockedState, recoveryCodeHashes: consumed.remaining }, updatedAt: new Date() }).where(eq(adminUsers.id, user.id))
      await tx.insert(adminSecurityAudit).values({ actorUserId: user.id, targetUserId: user.id, action: consumed.valid ? "mfa_challenge_succeeded" : "mfa_challenge_failed", success: consumed.valid, metadataJson: { method } })
      return consumed.valid
    })
  } else if (input.totp) {
    try { valid = verifyTotp(decryptMfaSecret(state.encryptedSecret), input.totp) } catch { valid = false }
  }
  await writeAdminSecurityAudit({ actorUserId: user.id, targetUserId: user.id, action: valid ? "mfa_challenge_succeeded" : "mfa_challenge_failed", success: valid, metadataJson: { method } })
  return valid
}

export async function invalidateAdminMfa(targetId: string, actor: { id: string; role: AdminRole }, actorPassword: string) {
  if (!hasCapability(actor.role, "users.reset_password")) throw new AdminIdentityError("Only an owner can invalidate MFA.", 403, "owner_required")
  const actorUser = await findAdminUserById(actor.id)
  if (!actorUser || !await bcrypt.compare(actorPassword, actorUser.passwordHash)) {
    await writeAdminSecurityAudit({ actorUserId: actor.id, targetUserId: targetId, action: "mfa_disabled", success: false, metadataJson: { reason: "identity_verification_failed" } })
    throw new AdminIdentityError("Owner identity verification failed.", 403, "identity_verification_failed")
  }
  const [target] = await db.update(adminUsers).set({ mfaEnabled: false, mfaState: null, sessionVersion: sql`${adminUsers.sessionVersion} + 1`, updatedAt: new Date() }).where(eq(adminUsers.id, targetId)).returning({ id: adminUsers.id })
  if (!target) throw new AdminIdentityError("Admin user not found.", 404, "not_found")
  await writeAdminSecurityAudit({ actorUserId: actor.id, targetUserId: targetId, action: "mfa_disabled", success: true })
}

export async function writeAdminSecurityAudit(input: { actorUserId?: string | null; targetUserId?: string | null; action: string; success: boolean; metadataJson?: Record<string, unknown> }) {
  await db.insert(adminSecurityAudit).values({ actorUserId: input.actorUserId ?? null, targetUserId: input.targetUserId ?? null, action: input.action, success: input.success, metadataJson: input.metadataJson })
}

function isRole(value: unknown): value is AdminRole { return typeof value === "string" && ["owner", "administrator", "sales", "project_manager", "developer", "finance", "viewer"].includes(value) }
function isUniqueViolation(error: unknown) { return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505") }
