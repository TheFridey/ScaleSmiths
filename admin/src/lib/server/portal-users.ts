import "server-only"

import { createHash, randomBytes, randomUUID } from "node:crypto"
import bcrypt from "bcryptjs"
import { Resend } from "resend"
import { and, asc, desc, eq, isNull } from "drizzle-orm"
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { adminSecurityAudit, clients } from "@/lib/schema"
import { PortalUserError, validateClientId, validatePortalEmail, validatePortalPassword } from "@/lib/portal-users"

const PASSWORD_ROUNDS = 12

// Query projection only. Web owns this table and every migration for it; keeping
// it outside admin/src/lib/schema.ts prevents admin migration generation claiming it.
const portalClientAccounts = pgTable("portal_client_accounts", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").default(true).notNull(),
  status: text("status").$type<"invited" | "active" | "disabled" | "reset_required">().default("active").notNull(),
  invitedAt: timestamp("invited_at", { withTimezone: true }), activatedAt: timestamp("activated_at", { withTimezone: true }), disabledAt: timestamp("disabled_at", { withTimezone: true }), lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})
const portalAccountTokens = pgTable("portal_account_tokens", { id: serial("id").primaryKey(), accountId: integer("account_id").notNull(), purpose: text("purpose").$type<"activation" | "reset">().notNull(), tokenHash: text("token_hash").notNull(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), usedAt: timestamp("used_at", { withTimezone: true }), revokedAt: timestamp("revoked_at", { withTimezone: true }), createdBy: text("created_by"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull() })
const portalAccountNotifications = pgTable("portal_account_notifications", { id: serial("id").primaryKey(), accountId: integer("account_id").notNull(), tokenId: integer("token_id"), operationKey: text("operation_key").notNull(), recipient: text("recipient").notNull(), status: text("status").$type<"not_requested" | "pending" | "sent" | "failed">().notNull(), providerMessageId: text("provider_message_id"), failureMessage: text("failure_message"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), sentAt: timestamp("sent_at", { withTimezone: true }), failedAt: timestamp("failed_at", { withTimezone: true }) })

export async function listPortalUsers() {
  const users = await db.select({
    id: portalClientAccounts.id,
    email: portalClientAccounts.email,
    active: portalClientAccounts.active,
    status: portalClientAccounts.status,
    portalClientId: portalClientAccounts.clientId,
    clientId: clients.id,
    clientName: clients.name,
    createdAt: portalClientAccounts.createdAt,
    updatedAt: portalClientAccounts.updatedAt,
    invitedAt: portalClientAccounts.invitedAt, activatedAt: portalClientAccounts.activatedAt, disabledAt: portalClientAccounts.disabledAt, lastLoginAt: portalClientAccounts.lastLoginAt,
  }).from(portalClientAccounts)
    .leftJoin(clients, eq(clients.portalClientId, portalClientAccounts.clientId))
    .orderBy(asc(portalClientAccounts.email))
  const notifications = await db.select().from(portalAccountNotifications).orderBy(desc(portalAccountNotifications.createdAt))
  const latest = new Map<number, typeof notifications[number]>()
  for (const notification of notifications) if (!latest.has(notification.accountId)) latest.set(notification.accountId, notification)
  return users.map((user) => ({ ...user, notificationStatus: latest.get(user.id)?.status ?? null, notificationFailure: latest.get(user.id)?.failureMessage ?? null }))
}

export async function provisionPortalAccount(input: Record<string, unknown>, actor: { id: string; email?: string | null; name?: string | null }) {
  const clientId = validateClientId(input.clientId), email = validatePortalEmail(input.email)
  const sendWelcome = input.sendWelcome === true, operationKey = typeof input.operationKey === "string" && input.operationKey.trim() ? input.operationKey.trim().slice(0, 180) : randomUUID()
  const purpose = input.purpose === "reset" ? "reset" as const : "activation" as const
  const result = await db.transaction(async (tx) => {
    const [priorDelivery] = await tx.select().from(portalAccountNotifications).where(eq(portalAccountNotifications.operationKey, operationKey)).limit(1)
    if (priorDelivery) { const [account] = await tx.select().from(portalClientAccounts).where(eq(portalClientAccounts.id, priorDelivery.accountId)).limit(1); return { account, token: null as string | null, notification: priorDelivery, replayed: true } }
    const [client] = await tx.select({ id: clients.id, portalClientId: clients.portalClientId }).from(clients).where(eq(clients.id, clientId)).for("update").limit(1)
    if (!client) throw new PortalUserError("The selected client no longer exists.", 404, "client_not_found")
    const portalClientId = client.portalClientId ?? `portal-client-${client.id}`
    if (!client.portalClientId) await tx.update(clients).set({ portalClientId, updatedAt: new Date() }).where(eq(clients.id, client.id))
    const [byClient] = await tx.select().from(portalClientAccounts).where(eq(portalClientAccounts.clientId, portalClientId)).limit(1)
    const [byEmail] = await tx.select().from(portalClientAccounts).where(eq(portalClientAccounts.email, email)).limit(1)
    if (byEmail && byEmail.clientId !== portalClientId) throw new PortalUserError("That email is already linked to another client workspace.", 409, "duplicate_email")
    if (byClient && byClient.email !== email) throw new PortalUserError("This client already has a portal identity. Update it deliberately before provisioning again.", 409, "client_already_provisioned")
    const now = new Date(), placeholderHash = await bcrypt.hash(randomBytes(32).toString("base64url"), PASSWORD_ROUNDS)
    const account = byClient ?? (await tx.insert(portalClientAccounts).values({ clientId: portalClientId, email, passwordHash: placeholderHash, active: false, status: "invited", invitedAt: now, updatedAt: now }).returning())[0]
    await tx.update(portalAccountTokens).set({ revokedAt: now }).where(and(eq(portalAccountTokens.accountId, account.id), isNull(portalAccountTokens.usedAt), isNull(portalAccountTokens.revokedAt)))
    const rawToken = randomBytes(32).toString("base64url"), expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    const [token] = await tx.insert(portalAccountTokens).values({ accountId: account.id, purpose, tokenHash: hashToken(rawToken), expiresAt, createdBy: actor.id }).returning()
    const status = purpose === "reset" ? "reset_required" as const : "invited" as const
    await tx.update(portalClientAccounts).set({ active: false, status, invitedAt: purpose === "activation" ? now : account.invitedAt, updatedAt: now }).where(eq(portalClientAccounts.id, account.id))
    const [notification] = await tx.insert(portalAccountNotifications).values({ accountId: account.id, tokenId: token.id, operationKey, recipient: email, status: sendWelcome ? "pending" : "not_requested" }).returning()
    await tx.insert(adminSecurityAudit).values({ actorUserId: actor.id, action: purpose === "reset" ? "portal_reset_issued" : "portal_provisioned", success: true, metadataJson: { clientId, accountId: account.id, sendWelcome, operationKey } })
    return { account: { ...account, status }, token: rawToken, notification, replayed: false }
  })
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://scalesmiths.co.uk").replace(/\/$/, "")
  const activationUrl = result.token ? `${baseUrl}/portal/activate?token=${encodeURIComponent(result.token)}` : null
  const delivered = sendWelcome && result.notification && activationUrl ? await deliverPortalInvite(result.notification.id, result.notification.operationKey, email, activationUrl, purpose) : null
  return { accountId: result.account?.id, portalClientId: result.account?.clientId, email: result.account?.email, status: result.account?.status, activationUrl: sendWelcome ? null : activationUrl, notificationStatus: delivered ?? result.notification?.status ?? null, replayed: result.replayed }
}

async function deliverPortalInvite(notificationId: number, operationKey: string, recipient: string, activationUrl: string, purpose: "activation" | "reset") {
  const now = new Date(), key = process.env.RESEND_API_KEY?.trim(), from = process.env.RESEND_FROM?.trim()
  if (!key || !from) { await db.update(portalAccountNotifications).set({ status: "failed", failedAt: now, failureMessage: "Email delivery is not configured." }).where(eq(portalAccountNotifications.id, notificationId)); return "failed" as const }
  try { const sent = await new Resend(key).emails.send({ from, to: recipient, subject: purpose === "reset" ? "Reset your ScaleSmiths portal access" : "Activate your ScaleSmiths client portal", text: `Use this secure link within 48 hours: ${activationUrl}`, html: `<p>Use this secure link within 48 hours:</p><p><a href="${activationUrl}">Set your portal password</a></p>` }, { idempotencyKey: operationKey }); if (sent.error || !sent.data?.id) throw new Error("provider_rejected"); await db.update(portalAccountNotifications).set({ status: "sent", sentAt: now, providerMessageId: sent.data.id }).where(eq(portalAccountNotifications.id, notificationId)); return "sent" as const }
  catch { await db.update(portalAccountNotifications).set({ status: "failed", failedAt: now, failureMessage: "Welcome email delivery failed; issue a new invitation from admin." }).where(eq(portalAccountNotifications.id, notificationId)); return "failed" as const }
}

function hashToken(token: string) { return createHash("sha256").update(token).digest("hex") }

export async function listPortalEligibleClients() {
  return db.select({ id: clients.id, name: clients.name, portalClientId: clients.portalClientId })
    .from(clients).orderBy(asc(clients.name))
}

export function generatePortalPassword() {
  return `${randomBytes(15).toString("base64url")}!7a`
}

export async function createPortalUser(input: Record<string, unknown>, testAccount = false) {
  const clientId = validateClientId(input.clientId)
  const generatedPassword = testAccount || input.generatePassword === true
  const password = generatedPassword ? generatePortalPassword() : validatePortalPassword(input.password)
  const email = testAccount && !input.email
    ? `portal-test+${Date.now()}@scalesmiths.co.uk`
    : validatePortalEmail(input.email)

  try {
    const created = await db.transaction(async (tx) => {
      const [client] = await tx.select({ id: clients.id, portalClientId: clients.portalClientId })
        .from(clients).where(eq(clients.id, clientId)).for("update").limit(1)
      if (!client) throw new PortalUserError("The selected client no longer exists.", 404, "client_not_found")
      const portalClientId = client.portalClientId ?? `portal-client-${client.id}`
      if (!client.portalClientId) await tx.update(clients).set({ portalClientId, updatedAt: new Date() }).where(eq(clients.id, client.id))
      const [account] = await tx.insert(portalClientAccounts).values({
        clientId: portalClientId,
        email,
        passwordHash: await bcrypt.hash(password, PASSWORD_ROUNDS),
        active: true,
      }).returning({ id: portalClientAccounts.id })
      return account
    })
    return { id: created.id, email, password: generatedPassword || testAccount ? password : undefined }
  } catch (error) {
    if (error instanceof PortalUserError) throw error
    if (isUniqueViolation(error)) throw new PortalUserError("That portal email is already in use.", 409, "duplicate_email")
    throw error
  }
}

export async function updatePortalUser(idValue: unknown, input: Record<string, unknown>, actor?: { id: string }) {
  const id = Number(idValue)
  if (!Number.isInteger(id) || id <= 0) throw new PortalUserError("Invalid portal user.")
  const updates: { email?: string; active?: boolean; passwordHash?: string; updatedAt: Date } = { updatedAt: new Date() }
  if (input.email !== undefined) updates.email = validatePortalEmail(input.email)
  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") throw new PortalUserError("Portal status must be active or disabled.")
    if (input.active) throw new PortalUserError("Issue an activation invitation instead of enabling an account without a password.")
    updates.active = input.active
  }
  if (input.resetPassword === true || input.password !== undefined) throw new PortalUserError("Use a secure activation or reset invitation; plaintext credential resets are disabled.")
  const lifecycle = input.active === false ? { active: false, status: "disabled" as const, disabledAt: new Date() } : {}
  try {
    const [updated] = await db.update(portalClientAccounts).set({ ...updates, ...lifecycle }).where(eq(portalClientAccounts.id, id)).returning({ id: portalClientAccounts.id })
    if (!updated) throw new PortalUserError("Portal user not found.", 404, "not_found")
    if (actor) await db.insert(adminSecurityAudit).values({ actorUserId: actor.id, action: input.active === false ? "portal_account_disabled" : "portal_account_updated", success: true, metadataJson: { accountId: id, emailChanged: input.email !== undefined } })
    return { id: updated.id }
  } catch (error) {
    if (error instanceof PortalUserError) throw error
    if (isUniqueViolation(error)) throw new PortalUserError("That portal email is already in use.", 409, "duplicate_email")
    throw error
  }
}

export async function revokePortalTokens(idValue: unknown, actor: { id: string }) {
  const id = Number(idValue)
  if (!Number.isInteger(id) || id <= 0) throw new PortalUserError("Invalid portal user.")
  const now = new Date()
  const [account] = await db.select({ id: portalClientAccounts.id }).from(portalClientAccounts).where(eq(portalClientAccounts.id, id)).limit(1)
  if (!account) throw new PortalUserError("Portal user not found.", 404, "not_found")
  await db.transaction(async (tx) => {
    await tx.update(portalAccountTokens).set({ revokedAt: now }).where(and(eq(portalAccountTokens.accountId, id), isNull(portalAccountTokens.usedAt), isNull(portalAccountTokens.revokedAt)))
    await tx.insert(adminSecurityAudit).values({ actorUserId: actor.id, action: "portal_tokens_revoked", success: true, metadataJson: { accountId: id } })
  })
  return { id }
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && (("code" in error && error.code === "23505") || ("cause" in error && error.cause && typeof error.cause === "object" && "code" in error.cause && error.cause.code === "23505")))
}

export async function prepareDisabledPortalAccountWithTx(tx: AdminDatabaseTransaction, clientId: number) {
  if (!Number.isInteger(clientId) || clientId <= 0) throw new PortalUserError("A valid client is required.")
  const [client] = await tx.select({ id: clients.id, portalClientId: clients.portalClientId })
    .from(clients).where(eq(clients.id, clientId)).for("update").limit(1)
  if (!client) throw new PortalUserError("The selected client no longer exists.", 404, "client_not_found")
  const portalClientId = client.portalClientId ?? `portal-client-${client.id}`
  if (!client.portalClientId) await tx.update(clients).set({ portalClientId, updatedAt: new Date() }).where(eq(clients.id, client.id))
  try {
    const [account] = await tx.insert(portalClientAccounts).values({
      clientId: portalClientId,
      email: `portal-disabled+${client.id}@scalesmiths.co.uk`,
      passwordHash: await bcrypt.hash(randomBytes(32).toString("base64url"), PASSWORD_ROUNDS),
      active: false,
      status: "disabled",
      disabledAt: new Date(),
    }).returning({ id: portalClientAccounts.id })
    return { portalAccountId: account.id, portalClientId }
  } catch (error) {
    if (isUniqueViolation(error)) throw new PortalUserError("A portal account already exists for this client.", 409, "duplicate_account")
    throw error
  }
}

export async function prepareDisabledPortalAccount(clientId: number) {
  return db.transaction((tx) => prepareDisabledPortalAccountWithTx(tx, clientId))
}
