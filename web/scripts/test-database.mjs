import process from "node:process"
import { Client } from "pg"
import { assertIsolatedTestDatabase } from "./test-database-guard.mjs"

const REQUIRED_MARKER = "scalesmiths-forge-v2-isolated-test-v1"

const command = process.argv[2]
const databaseUrl = process.env.WEB_DATABASE_URL ?? process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL

if (!["prepare", "assert", "seed", "reset", "cleanup"].includes(command ?? "")) {
  throw new Error("Usage: node scripts/test-database.mjs prepare|assert|seed|reset|cleanup")
}
const { databaseName, host } = assertIsolatedTestDatabase(databaseUrl, process.env.SCALESMITHS_TEST_ENVIRONMENT)

const client = new Client({ connectionString: databaseUrl })
await client.connect()
try {
  const connected = await client.query("select current_database() as database, current_user as username")
  if (connected.rows[0]?.database !== databaseName) throw new Error("Connected database differs from the guarded target.")

  if (command !== "prepare") await assertMarker(client)

  if (command === "prepare" || command === "reset" || command === "cleanup") {
    await client.query("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public")
    if (command !== "cleanup") await createMarker(client)
  }
  if (command === "seed") await seed(client)
  if (command === "assert") {
    const journals = await client.query(`
      select
        to_regclass('drizzle.__drizzle_web_migrations')::text as journal,
        (select count(*)::int from drizzle.__drizzle_web_migrations) as migration_count
    `)
    if (journals.rows[0]?.journal !== "drizzle.__drizzle_web_migrations" || journals.rows[0]?.migration_count < 1) {
      throw new Error("Web migration journal is missing or empty.")
    }
  }
  console.log(`Web test database ${command} passed for ${host}/${databaseName}.`)
} finally {
  await client.end()
}

async function createMarker(db) {
  await db.query(`
    create table public.scalesmiths_test_environment (
      marker text primary key,
      created_at timestamptz not null default now()
    )
  `)
  await db.query("insert into public.scalesmiths_test_environment(marker) values ($1)", [REQUIRED_MARKER])
}

async function assertMarker(db) {
  const marker = await db.query(`
    select marker
    from public.scalesmiths_test_environment
    where marker = $1
  `, [REQUIRED_MARKER]).catch(() => ({ rowCount: 0 }))
  if (marker.rowCount !== 1) throw new Error("Isolated test database marker is missing.")
}

async function seed(db) {
  await db.query("begin")
  try {
    await db.query(`
      insert into public_claim_evidence (
        claim_id,
        evidence_description,
        evidence_reference
      ) values (
        'hero.projects-delivered',
        'Deterministic release-candidate browser fixture.',
        'fixture://forge-v2/web/public-claim'
      )
      on conflict (claim_id) do update set
        evidence_description = excluded.evidence_description,
        evidence_reference = excluded.evidence_reference,
        updated_at = now()
    `)
    await db.query(`
      update public_claims set
        status = 'verified',
        client_approval_status = 'not_required',
        verified_by = 'forge-v2-release-fixture',
        verified_at = timestamp with time zone '2026-01-01 00:00:00+00',
        review_expires_at = timestamp with time zone '2030-01-01 00:00:00+00',
        updated_at = now()
      where id = 'hero.projects-delivered'
    `)
    await db.query("commit")
  } catch (error) {
    await db.query("rollback")
    throw error
  }
}
