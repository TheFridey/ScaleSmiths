import bcrypt from "bcryptjs"
import pg from "pg"

const { Pool } = pg

const databaseUrl = process.env.MIGRATION_DATABASE_URL ?? (process.env.NODE_ENV === "production" ? "" : process.env.DATABASE_URL)
const required = ["DEMO_PORTAL_EMAIL", "DEMO_PORTAL_PASSWORD", "DEMO_PORTAL_CLIENT_ID"]
const missing = required.filter((key) => !process.env[key]?.trim())
if (!databaseUrl) missing.unshift(process.env.NODE_ENV === "production" ? "MIGRATION_DATABASE_URL" : "MIGRATION_DATABASE_URL or DATABASE_URL")

if (missing.length) {
  console.error(`Missing required env: ${missing.join(", ")}`)
  process.exit(1)
}

const email = process.env.DEMO_PORTAL_EMAIL.trim().toLowerCase()
const password = process.env.DEMO_PORTAL_PASSWORD
const clientId = process.env.DEMO_PORTAL_CLIENT_ID.trim()
const passwordHash = await bcrypt.hash(password, 12)

const pool = new Pool({ connectionString: databaseUrl })

try {
  await pool.query(
    `
      insert into portal_client_accounts (client_id, email, password_hash, active, updated_at)
      values ($1, $2, $3, true, now())
      on conflict (email) do update set
        client_id = excluded.client_id,
        password_hash = excluded.password_hash,
        active = true,
        updated_at = now()
    `,
    [clientId, email, passwordHash],
  )

  console.log(`Seeded portal account for ${email} (${clientId})`)
} finally {
  await pool.end()
}
