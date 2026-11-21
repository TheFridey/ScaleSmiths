import "server-only"

import { createHash, randomBytes, randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { eq, sql } from "drizzle-orm"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { adminSecurityAudit, adminUsers } from "@/lib/schema"
import { AdminIdentityError } from "@/lib/admin-users"
import { hasCapability } from "@/lib/rbac"
import { marketGate } from "@/lib/expansion-gates"
import { acceptOnActivation, agreementForInvitation, assertIssuableAgreement } from "./partner-agreements-core"

export function requirePartnerActivationEnabled() {
  if (process.env.PARTNER_ACTIVATION_ENABLED !== "true") {
    throw new AdminIdentityError("Partner activation is currently closed.", 403, "partner_activation_closed")
  }
}

export function invitationHash(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function validateActivationCredential(token: unknown, password: unknown) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new AdminIdentityError("Invitation is invalid or unavailable.", 400, "invitation_invalid")
  if (typeof password !== "string" || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) throw new AdminIdentityError("Use a password of at least 12 characters and at most 72 UTF-8 bytes.", 400, "password_invalid")
  return { token, password }
}

/** Caller owns the transaction; applicant lock prevents two founders issuing twice. */
/** Fails closed: an unknown or unapproved operating market can never be invited or activated. Shared with market administration via advisory lock 7102. */
async function assertOperatingMarketApproved(tx: AdminDatabaseTransaction, country: string, code: string, message: string) {
  await tx.execute(sql`select pg_advisory_xact_lock_shared(7102)`)
  const market = (await tx.execute(sql`select status,plan_keys from expansion_markets where country_code=${country} for share`)).rows[0] as { status: string; plan_keys: string[] } | undefined
  if (marketGate(country, market, "*") !== "approved") throw new AdminIdentityError(message, 409, code)
}
/** Issues one published agreement version with the invitation; the partner must accept exactly that version to activate. */
export async function issueInvitation(tx: AdminDatabaseTransaction, applicationId: number, founderId: string, agreementVersionId: unknown, operatingCountry = "GB") {
  requirePartnerActivationEnabled()
  const [founder] = await tx.select().from(adminUsers).where(eq(adminUsers.id, founderId)).for("share").limit(1)
  if (!founder?.active || !hasCapability(founder.role, "expansion.manage")) throw new AdminIdentityError("Founder authority is required.", 403, "forbidden")
  if (!Number.isSafeInteger(applicationId) || applicationId < 1) throw new AdminIdentityError("Application is required.")
  const { versionId, label: agreementVersion } = await assertIssuableAgreement(tx, agreementVersionId)
  const result = await tx.execute(sql`select id, name, email, status, onboarding_confirmations as confirmations from partner_applications where id = ${applicationId} for update`)
  const applicant = result.rows[0] as { id: number; name: string; email: string; status: string; confirmations: Record<string, unknown> } | undefined
  const prerequisites = applicant?.confirmations
  if (!applicant || applicant.status !== "onboarding" || !prerequisites || !["agreement", "legal", "independentStatus", "operations"].every((key) => prerequisites[key] === true)) throw new AdminIdentityError("Record every onboarding confirmation before inviting a partner.", 409, "onboarding_incomplete")
  if (!/^[A-Z]{2}$/.test(operatingCountry)) throw new AdminIdentityError("Use a two-letter ISO country code for the operating market.")
  // International applicants can be reviewed and progressed to onboarding, but are not invited until a founder has approved their operating market.
  await assertOperatingMarketApproved(tx, operatingCountry, "operating_market_not_approved", "This partner's operating market is not approved, so an invitation cannot be issued. The application can still be reviewed.")
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const token = randomBytes(32).toString("base64url")
  const existing = await tx.execute(sql`select p.id,p.user_id,p.invitation_hash,p.activated_at,u.active,u.role,p.invitation_expires_at <= now() as invitation_expired from expansion_partners p join admin_users u on u.id=p.user_id where p.application_id = ${applicationId} for update of p,u`)
  const pending = existing.rows[0]
  if (pending) {
    // Revocation clears the hash. An expired invitation can be renewed, but a
    // revoked or activated identity cannot be silently revived by this command.
    if (pending.active !== false || pending.role !== "independent_partner" || pending.activated_at !== null || !pending.invitation_hash || pending.invitation_expired !== true) throw new AdminIdentityError("An invitation already exists or this partner requires explicit founder review.", 409, "invitation_exists")
    const partnerId = String(pending.id)
    await tx.execute(sql`update expansion_partners set invitation_hash=${invitationHash(token)}, invitation_expires_at=${expiresAt}, agreement_version=${agreementVersion}, agreement_content_version_id=${versionId}, confirmed_at=${now}, operating_country=${operatingCountry} where id=${partnerId}`)
    await tx.insert(adminSecurityAudit).values({ actorUserId: founder.id, targetUserId: String(pending.user_id), action: "partner_invitation_reissued", success: true, metadataJson: { partnerId, applicationId, agreementVersion, agreementVersionId: versionId, expiresAt: expiresAt.toISOString() } })
    return { partnerId, invitationToken: token, expiresAt: expiresAt.toISOString() }
  }
  const email = applicant.email.trim().toLowerCase()
  const collision = await tx.execute(sql`select id from admin_users where lower(email) = ${email}`)
  if (collision.rows.length) throw new AdminIdentityError("An identity already exists for this email; founder review is required.", 409, "identity_exists")
  const partnerId = randomUUID()
  const [identity] = await tx.insert(adminUsers).values({ email, displayName: applicant.name, role: "independent_partner", active: false, passwordHash: await bcrypt.hash(randomBytes(48).toString("base64url"), 12) }).returning({ id: adminUsers.id })
  await tx.execute(sql`insert into expansion_partners (id, user_id, application_id, agreement_version, agreement_content_version_id, confirmed_at, invitation_hash, invitation_expires_at, operating_country, created_at) values (${partnerId}, ${identity.id}, ${applicationId}, ${agreementVersion}, ${versionId}, ${now}, ${invitationHash(token)}, ${expiresAt}, ${operatingCountry}, ${now})`)
  await tx.insert(adminSecurityAudit).values({ actorUserId: founder.id, targetUserId: identity.id, action: "partner_invitation_issued", success: true, metadataJson: { partnerId, applicationId, agreementVersion, agreementVersionId: versionId, expiresAt: expiresAt.toISOString() } })
  return { partnerId, invitationToken: token, expiresAt: expiresAt.toISOString() }
}

/** The agreement an invitation holder must read and accept. Read-only: the invitation is not consumed. */
export async function previewInvitationAgreement(tokenInput: unknown) {
  requirePartnerActivationEnabled()
  if (typeof tokenInput !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(tokenInput)) throw new AdminIdentityError("Invitation is invalid or unavailable.", 400, "invitation_invalid")
  return db.transaction((tx) => agreementForInvitation(tx, invitationHash(tokenInput)))
}

/** Token is consumed, the issued agreement accepted and the password committed atomically; never creates a session. */
export async function activatePartnerInvitation(tokenInput: unknown, passwordInput: unknown, acceptanceInput?: unknown): Promise<void> {
  requirePartnerActivationEnabled()
  const credential = validateActivationCredential(tokenInput, passwordInput)
  // Hash before locking to bound lock duration. Rate limiting precedes this service.
  const passwordHash = await bcrypt.hash(credential.password, 12)
  await db.transaction(async (tx) => {
    const result = await tx.execute(sql`select p.id, p.user_id, p.application_id, p.operating_country from expansion_partners p join admin_users u on u.id = p.user_id join partner_applications a on a.id = p.application_id where p.invitation_hash = ${invitationHash(credential.token)} and p.invitation_expires_at > now() and p.activated_at is null and u.active = false and u.role = 'independent_partner' and a.status = 'onboarding' and a.onboarding_confirmations @> '{"agreement":true,"legal":true,"independentStatus":true,"operations":true}'::jsonb for update of p, u, a`)
    const invitation = result.rows[0] as { id: string; user_id: string; application_id: number; operating_country: string } | undefined
    if (!invitation) throw new AdminIdentityError("Invitation is invalid or unavailable.", 400, "invitation_invalid")
    // Re-checked at the moment of activation: a market suspended after the invitation was issued stops the activation, and nothing is consumed.
    await assertOperatingMarketApproved(tx, invitation.operating_country, "operating_market_not_approved", "Activation is not available for this market yet. Contact ScaleSmiths.")
    // The partner accepts the exact issued version while still inactive; the database refuses activation without it.
    const { acceptanceId, agreement } = await acceptOnActivation(tx, invitation.id, invitation.user_id, acceptanceInput)
    const now = new Date()
    await tx.update(adminUsers).set({ passwordHash, active: true, passwordChangedAt: now, sessionVersion: sql`${adminUsers.sessionVersion} + 1`, updatedAt: now }).where(eq(adminUsers.id, invitation.user_id))
    await tx.execute(sql`update expansion_partners set invitation_hash = null, invitation_expires_at = null, activated_at = ${now} where id = ${invitation.id}`)
    await tx.execute(sql`update partner_applications set status = 'activated' where id = ${invitation.application_id}`)
    await tx.insert(adminSecurityAudit).values({ actorUserId: invitation.user_id, targetUserId: invitation.user_id, action: "partner_activated", success: true, metadataJson: { partnerId: invitation.id, applicationId: invitation.application_id, acceptanceId, agreementVersionId: agreement.versionId, agreementVersion: agreement.version, sha256: agreement.sha256 } })
  })
}
