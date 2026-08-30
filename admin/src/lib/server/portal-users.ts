import "server-only"

import { randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { asc, eq } from "drizzle-orm"
import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core"
import { db, type AdminDatabaseTransaction } from "@/lib/db"
import { clients } from "@/lib/schema"
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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
})

export async function listPortalUsers() {
  return db.select({
    id: portalClientAccounts.id,
    email: portalClientAccounts.email,
    active: portalClientAccounts.active,
    portalClientId: portalClientAccounts.clientId,
    clientId: clients.id,
    clientName: clients.name,
    createdAt: portalClientAccounts.createdAt,
    updatedAt: portalClientAccounts.updatedAt,
  }).from(portalClientAccounts)
    .leftJoin(clients, eq(clients.portalClientId, portalClientAccounts.clientId))
    .orderBy(asc(portalClientAccounts.email))
}

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

export async function updatePortalUser(idValue: unknown, input: Record<string, unknown>) {
  const id = Number(idValue)
  if (!Number.isInteger(id) || id <= 0) throw new PortalUserError("Invalid portal user.")
  const updates: { email?: string; active?: boolean; passwordHash?: string; updatedAt: Date } = { updatedAt: new Date() }
  if (input.email !== undefined) updates.email = validatePortalEmail(input.email)
  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") throw new PortalUserError("Portal status must be active or disabled.")
    updates.active = input.active
  }
  let generatedPassword: string | undefined
  if (input.resetPassword === true) {
    generatedPassword = generatePortalPassword()
    updates.passwordHash = await bcrypt.hash(generatedPassword, PASSWORD_ROUNDS)
  } else if (input.password !== undefined) {
    updates.passwordHash = await bcrypt.hash(validatePortalPassword(input.password), PASSWORD_ROUNDS)
  }
  try {
    const [updated] = await db.update(portalClientAccounts).set(updates).where(eq(portalClientAccounts.id, id)).returning({ id: portalClientAccounts.id })
    if (!updated) throw new PortalUserError("Portal user not found.", 404, "not_found")
    return { id: updated.id, password: generatedPassword }
  } catch (error) {
    if (error instanceof PortalUserError) throw error
    if (isUniqueViolation(error)) throw new PortalUserError("That portal email is already in use.", 409, "duplicate_email")
    throw error
  }
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
