import process from "node:process"
import bcrypt from "bcryptjs"
import { Client } from "pg"
import { decideBootstrapAction, prepareBootstrapPasswordHash } from "./bootstrap-admin-logic.mjs"
import { adminDatabaseUrl } from "./database-url.mjs"

const recovery = process.argv.includes("--recover-owner")
const email = String(recovery ? process.env.ADMIN_RECOVERY_EMAIL : process.env.ADMIN_EMAIL || "").trim().toLowerCase()
const password = String(recovery ? process.env.ADMIN_RECOVERY_PASSWORD : process.env.ADMIN_PASSWORD || "")
const displayName = String(recovery ? process.env.ADMIN_RECOVERY_NAME : process.env.ADMIN_DISPLAY_NAME || "ScaleSmiths Owner").trim()

const databaseUrl = adminDatabaseUrl()
if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error(`${recovery ? "ADMIN_RECOVERY_EMAIL" : "ADMIN_EMAIL"} must be a valid email.`)
if (displayName.length < 2) throw new Error("Admin display name is required.")

const preparedPassword = await prepareBootstrapPasswordHash(password, recovery, bcrypt)
const passwordHash = preparedPassword.hash
if (preparedPassword.legacyWarning) console.warn("Bootstrap is preserving the existing configured password, but it is shorter than the 12-character policy. Reset it immediately after first login.")
const client = new Client({ connectionString: databaseUrl })
await client.connect()

try {
  await client.query("BEGIN")
  const existing = await client.query("SELECT id, role, active FROM admin_users WHERE lower(email) = $1 FOR UPDATE", [email])
  const action = decideBootstrapAction(Boolean(existing.rowCount), recovery)
  if (action === "unchanged") {
    await client.query("COMMIT")
    console.log(`Admin bootstrap unchanged: ${email} already exists.`)
  } else if (action === "recover") {
    await client.query("UPDATE admin_users SET display_name=$2, password_hash=$3, role='owner', active=true, password_changed_at=now(), session_version=session_version+1, updated_at=now() WHERE id=$1", [existing.rows[0].id, displayName, passwordHash])
    await client.query("COMMIT")
    console.log(`Owner recovery completed: ${email}.`)
  } else {
    await client.query("INSERT INTO admin_users (email, display_name, password_hash, role, active) VALUES ($1,$2,$3,'owner',true)", [email, displayName, passwordHash])
    await client.query("COMMIT")
    console.log(`${recovery ? "Owner recovery completed" : "Owner bootstrap completed"}: ${email}.`)
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined)
  throw error
} finally {
  await client.end()
}
