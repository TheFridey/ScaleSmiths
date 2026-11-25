import "server-only"

import { createHash, randomBytes, randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { adminSecurityAudit, adminUsers } from "@/lib/schema"
import { AdminIdentityError } from "@/lib/admin-users"
import { notifyPartner, partnerPortalOrigin } from "./partner-notifications"

/*
 * Operation EMPOWER B2.10: partner self-service password recovery and applicant self-withdrawal.
 *
 * Identity is proven by control of the email address on record: both flows send a one-time link, and nothing changes until that
 * link is used. Requests always receive the same answer whether or not the address is known, so neither endpoint reveals who is a
 * partner or an applicant. Only SHA-256 digests of tokens are stored. Route-level login rate limiting precedes these services, and
 * each service also caps outstanding links per account.
 *
 * Recovery is for activated independent partners only. Founder and staff accounts keep their MFA-protected, administrator-led
 * credential reset: a reset request for any other role is answered identically and does nothing.
 */
const RESET_TTL_MS = 60 * 60 * 1000
const WITHDRAWAL_TTL_MS = 24 * 60 * 60 * 1000
const MAX_OUTSTANDING = 3
/** Applications an applicant may withdraw. Activated partners are partners, not applicants; terminal states have nothing to withdraw. */
export const WITHDRAWABLE_STATUSES = ["submitted", "under_review", "information_requested", "conversation_arranged", "assessment_in_progress", "approved_in_principle", "agreement_pending", "onboarding"] as const
export const GENERIC_RESET_REPLY = "If that email address belongs to an active ScaleSmiths partner account, we have sent a link to reset the password. It expires in one hour."
export const GENERIC_WITHDRAWAL_REPLY = "If that email address has an open partner application, we have sent a link to confirm the withdrawal. It expires in 24 hours."

export const tokenDigest = (token: string) => createHash("sha256").update(token).digest("hex")
const TOKEN = /^[A-Za-z0-9_-]{43}$/
const newToken = () => randomBytes(32).toString("base64url")

export function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null
  const email = value.trim().toLowerCase()
  return email.length >= 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}
export function validateNewPassword(value: unknown): string {
  if (typeof value !== "string" || value.length < 12 || Buffer.byteLength(value, "utf8") > 72) throw new AdminIdentityError("Use a password of at least 12 characters and at most 72 UTF-8 bytes.", 400, "password_invalid")
  return value
}
const tokenOrThrow = (value: unknown, message: string, code: string) => { if (typeof value !== "string" || !TOKEN.test(value)) throw new AdminIdentityError(message, 400, code); return value }

/** Sends a reset link to an activated partner. Always resolves to the same generic reply. */
export async function requestPasswordReset(emailInput: unknown, now = new Date()): Promise<{ message: string }> {
  const email = normaliseEmail(emailInput)
  if (!email) throw new AdminIdentityError("Enter a valid email address.", 400, "email_invalid")
  const issued = await db.transaction(async (tx) => {
    const [user] = (await tx.execute(sql`select u.id, u.display_name, p.id partner_id from admin_users u join expansion_partners p on p.user_id = u.id
      where lower(u.email) = ${email} and u.active = true and u.role = 'independent_partner' and p.activated_at is not null for update of u`)).rows as { id: string; display_name: string; partner_id: string }[]
    if (!user) return null
    const outstanding = Number(((await tx.execute(sql`select count(*)::int n from partner_password_resets where user_id = ${user.id} and used_at is null and expires_at > ${now.toISOString()}`)).rows[0] as { n: number }).n)
    if (outstanding >= MAX_OUTSTANDING) return null
    const token = newToken(), expiresAt = new Date(now.getTime() + RESET_TTL_MS)
    await tx.execute(sql`insert into partner_password_resets (id, user_id, token_sha256, created_at, expires_at) values (${randomUUID()}, ${user.id}, ${tokenDigest(token)}, ${now.toISOString()}, ${expiresAt.toISOString()})`)
    await tx.insert(adminSecurityAudit).values({ actorUserId: null, targetUserId: user.id, action: "partner_password_reset_requested", success: true, metadataJson: { partnerId: user.partner_id } })
    return { token, expiresAt, user }
  })
  if (issued) {
    try {
      await db.transaction((tx) => notifyPartner(tx, { to: email, partnerId: issued.user.partner_id, idempotencyKey: `password-reset-${tokenDigest(issued.token).slice(0, 32)}`,
        email: { kind: "password_reset", name: issued.user.display_name, link: `${partnerPortalOrigin()}/partner/reset#token=${issued.token}`, expiresAt: issued.expiresAt.toISOString() } }))
    } catch { /* the notifier records failures; the reply must not reveal whether an email was attempted */ }
  }
  return { message: GENERIC_RESET_REPLY }
}

/** Uses a reset link once: sets the new password, ends every existing session and voids any other outstanding links. */
export async function resetPartnerPassword(tokenInput: unknown, passwordInput: unknown, now = new Date()): Promise<void> {
  const token = tokenOrThrow(tokenInput, "This reset link is invalid or has expired. Request a new one.", "reset_invalid")
  const password = validateNewPassword(passwordInput)
  const passwordHash = await bcrypt.hash(password, 12)
  await db.transaction(async (tx) => {
    const [reset] = (await tx.execute(sql`select r.id, r.user_id from partner_password_resets r join admin_users u on u.id = r.user_id join expansion_partners p on p.user_id = u.id
      where r.token_sha256 = ${tokenDigest(token)} and r.used_at is null and r.expires_at > ${now.toISOString()} and u.active = true and u.role = 'independent_partner' and p.activated_at is not null
      for update of r`)).rows as { id: string; user_id: string }[]
    if (!reset) throw new AdminIdentityError("This reset link is invalid or has expired. Request a new one.", 400, "reset_invalid")
    await tx.update(adminUsers).set({ passwordHash, passwordChangedAt: now, sessionVersion: sql`${adminUsers.sessionVersion} + 1`, updatedAt: now }).where(eq(adminUsers.id, reset.user_id))
    await tx.execute(sql`update partner_password_resets set used_at = ${now.toISOString()} where user_id = ${reset.user_id} and used_at is null`)
    await tx.insert(adminSecurityAudit).values({ actorUserId: reset.user_id, targetUserId: reset.user_id, action: "partner_password_reset", success: true, metadataJson: { resetId: reset.id } })
  })
}

/** Sends a withdrawal confirmation link for the applicant's most recent open application. Always resolves to the same reply. */
export async function requestApplicationWithdrawal(emailInput: unknown, now = new Date()): Promise<{ message: string }> {
  const email = normaliseEmail(emailInput)
  if (!email) throw new AdminIdentityError("Enter a valid email address.", 400, "email_invalid")
  const statuses = sql.join(WITHDRAWABLE_STATUSES.map((s) => sql`${s}`), sql`,`)
  const issued = await db.transaction(async (tx) => {
    const [application] = (await tx.execute(sql`select id, name from partner_applications where lower(email) = ${email} and status in (${statuses}) order by submitted_at desc, id desc limit 1 for update`)).rows as { id: number; name: string }[]
    if (!application) return null
    const outstanding = Number(((await tx.execute(sql`select count(*)::int n from partner_application_withdrawals where application_id = ${application.id} and used_at is null and expires_at > ${now.toISOString()}`)).rows[0] as { n: number }).n)
    if (outstanding >= MAX_OUTSTANDING) return null
    const token = newToken(), expiresAt = new Date(now.getTime() + WITHDRAWAL_TTL_MS)
    await tx.execute(sql`insert into partner_application_withdrawals (id, application_id, token_sha256, created_at, expires_at) values (${randomUUID()}, ${application.id}, ${tokenDigest(token)}, ${now.toISOString()}, ${expiresAt.toISOString()})`)
    return { token, expiresAt, application }
  })
  if (issued) {
    try {
      await db.transaction((tx) => notifyPartner(tx, { to: email, applicationId: issued.application.id, idempotencyKey: `withdrawal-${tokenDigest(issued.token).slice(0, 32)}`,
        email: { kind: "withdrawal_confirmation", name: issued.application.name, link: `${partnerPortalOrigin()}/partner/withdraw#token=${issued.token}`, expiresAt: issued.expiresAt.toISOString() } }))
    } catch { /* as above */ }
  }
  return { message: GENERIC_WITHDRAWAL_REPLY }
}

/** What the confirmation page shows before the applicant confirms: no personal data beyond the submission date. */
export async function previewApplicationWithdrawal(tokenInput: unknown, now = new Date()): Promise<{ submittedOn: string }> {
  const token = tokenOrThrow(tokenInput, "This withdrawal link is invalid or has expired.", "withdrawal_invalid")
  const statuses = sql.join(WITHDRAWABLE_STATUSES.map((s) => sql`${s}`), sql`,`)
  const [row] = (await db.execute(sql`select a.submitted_at from partner_application_withdrawals w join partner_applications a on a.id = w.application_id
    where w.token_sha256 = ${tokenDigest(token)} and w.used_at is null and w.expires_at > ${now.toISOString()} and a.status in (${statuses})`)).rows as { submitted_at: string }[]
  if (!row) throw new AdminIdentityError("This withdrawal link is invalid or has expired.", 400, "withdrawal_invalid")
  return { submittedOn: new Date(row.submitted_at).toISOString().slice(0, 10) }
}

/**
 * Withdraws the application through the existing lifecycle guard. Any outstanding invitation is revoked (activation already
 * requires 'onboarding', so this is defence in depth). The record is kept for its original retention period; the founder-run
 * retention workflow deletes it afterwards. Founders can still reopen a withdrawn application ('withdrawn' -> 'under_review').
 */
export async function confirmApplicationWithdrawal(tokenInput: unknown, now = new Date()): Promise<void> {
  const token = tokenOrThrow(tokenInput, "This withdrawal link is invalid or has expired.", "withdrawal_invalid")
  const statuses = sql.join(WITHDRAWABLE_STATUSES.map((s) => sql`${s}`), sql`,`)
  await db.transaction(async (tx) => {
    const [row] = (await tx.execute(sql`select w.id, a.id application_id, a.status from partner_application_withdrawals w join partner_applications a on a.id = w.application_id
      where w.token_sha256 = ${tokenDigest(token)} and w.used_at is null and w.expires_at > ${now.toISOString()} and a.status in (${statuses}) for update of w, a`)).rows as { id: string; application_id: number; status: string }[]
    if (!row) throw new AdminIdentityError("This withdrawal link is invalid or has expired.", 400, "withdrawal_invalid")
    await tx.execute(sql`update partner_applications set status = 'withdrawn' where id = ${row.application_id}`)
    await tx.execute(sql`update expansion_partners set invitation_hash = null, invitation_expires_at = null where application_id = ${row.application_id} and activated_at is null`)
    await tx.execute(sql`update partner_application_withdrawals set used_at = ${now.toISOString()} where application_id = ${row.application_id} and used_at is null`)
    await tx.insert(adminSecurityAudit).values({ actorUserId: null, targetUserId: null, action: "partner_application_withdrawn", success: true, metadataJson: { applicationId: row.application_id, from: row.status, by: "applicant" } })
  })
}
