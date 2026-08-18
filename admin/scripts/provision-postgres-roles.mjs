import process from "node:process"
import { Client } from "pg"

if (!process.argv.includes("--confirm-provision")) {
  throw new Error("Refusing to change PostgreSQL roles without --confirm-provision.")
}

const WEB_TABLE_GRANTS = new Map([
  ["quote_requests", ["SELECT", "INSERT", "UPDATE"]],
  ["quote_rate_limits", ["SELECT", "INSERT", "UPDATE"]],
  ["login_rate_limits", ["SELECT", "INSERT", "UPDATE"]],
  ["portal_client_accounts", ["SELECT"]],
  ["client_requests", ["SELECT", "INSERT", "UPDATE"]],
  ["client_request_messages", ["SELECT", "INSERT"]],
  ["client_timeline_events", ["SELECT", "INSERT"]],
  ["monthly_reports", ["SELECT"]],
  ["experience_events", ["INSERT"]],
  ["public_verified_claims", ["SELECT"]],
  ["clients", ["SELECT"]],
  ["invoices", ["SELECT"]],
  ["invoice_items", ["SELECT"]],
  ["invoice_portal_access_events", ["INSERT"]],
])

const provisioningUrl = requiredUrl("POSTGRES_PROVISIONING_DATABASE_URL")
const web = roleFromUrl("WEB_DATABASE_URL")
const admin = roleFromUrl("ADMIN_DATABASE_URL")
const migration = roleFromUrl("MIGRATION_DATABASE_URL")
const readonly = optionalRoleFromUrl("READONLY_DATABASE_URL")
const backup = optionalRoleFromUrl("BACKUP_DATABASE_URL")
const principals = [web, admin, migration, readonly, backup].filter(Boolean)
const provisioningRoleName = decodeURIComponent(provisioningUrl.username)

assertDistinctRoles(principals)
if (!provisioningRoleName || principals.some((principal) => principal.name === provisioningRoleName)) {
  throw new Error("POSTGRES_PROVISIONING_DATABASE_URL must use a dedicated operator role, not a runtime, migration, read-only or backup role.")
}
assertSameDatabase([provisioningUrl, ...principals.map((principal) => principal.url)])

const client = new Client({ connectionString: provisioningUrl.toString(), application_name: "scalesmiths-role-provisioner" })
await client.connect()
try {
  const authority = await client.query("SELECT rolsuper FROM pg_roles WHERE rolname=current_user")
  if (authority.rows[0]?.rolsuper !== true) throw new Error("POSTGRES_PROVISIONING_DATABASE_URL must use a PostgreSQL superuser for role attributes and ownership transfer.")
  await client.query("BEGIN")
  for (const principal of principals) await ensureLoginRole(principal)
  await client.query(`ALTER DATABASE ${identifier(databaseName(provisioningUrl))} OWNER TO ${identifier(migration.name)}`)
  await client.query(`REVOKE ALL ON DATABASE ${identifier(databaseName(provisioningUrl))} FROM PUBLIC`)
  for (const principal of principals) await client.query(`GRANT CONNECT ON DATABASE ${identifier(databaseName(provisioningUrl))} TO ${identifier(principal.name)}`)
  await client.query(`GRANT CREATE, TEMPORARY ON DATABASE ${identifier(databaseName(provisioningUrl))} TO ${identifier(migration.name)}`)

  await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION ${identifier(migration.name)}`)
  await transferSchemaObjects("public", migration.name)
  await transferSchemaObjects("drizzle", migration.name)
  await client.query(`ALTER SCHEMA public OWNER TO ${identifier(migration.name)}`)
  await client.query(`ALTER SCHEMA drizzle OWNER TO ${identifier(migration.name)}`)
  await client.query("REVOKE ALL ON SCHEMA public, drizzle FROM PUBLIC")
  await client.query(`GRANT USAGE, CREATE ON SCHEMA public, drizzle TO ${identifier(migration.name)}`)
  await client.query(`GRANT USAGE ON SCHEMA public TO ${identifier(web.name)}, ${identifier(admin.name)}`)
  await client.query(`GRANT USAGE ON SCHEMA drizzle TO ${identifier(admin.name)}`)
  if (readonly) await client.query(`GRANT USAGE ON SCHEMA public, drizzle TO ${identifier(readonly.name)}`)
  if (backup) await client.query(`GRANT USAGE ON SCHEMA public, drizzle TO ${identifier(backup.name)}`)

  const revocationTargets = [web, admin, readonly, backup].filter(Boolean).map((principal) => identifier(principal.name)).join(", ")
  if (revocationTargets) {
    await client.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public, drizzle FROM ${revocationTargets}`)
    await client.query(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public, drizzle FROM ${revocationTargets}`)
    await client.query(`REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public, drizzle FROM ${revocationTargets}`)
  }
  await client.query("REVOKE ALL ON ALL TABLES IN SCHEMA public, drizzle FROM PUBLIC")
  await client.query("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public, drizzle FROM PUBLIC")
  await client.query("REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public, drizzle FROM PUBLIC")

  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${identifier(admin.name)}`)
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${identifier(admin.name)}`)
  await grantFunctionIfPresent("public", "digest", "bytea, text", admin.name)
  await grantFunctionIfPresent("public", "digest", "text, text", admin.name)
  await grantFunctionIfPresent("public", "gen_random_uuid", "", admin.name)
  for (const [table, operations] of WEB_TABLE_GRANTS) {
    if (await tableExists("public", table)) await client.query(`GRANT ${operations.join(", ")} ON TABLE public.${identifier(table)} TO ${identifier(web.name)}`)
  }
  const webSequences = await sequencesForTables("public", [...WEB_TABLE_GRANTS.keys()])
  for (const sequence of webSequences) await client.query(`GRANT USAGE, SELECT ON SEQUENCE public.${identifier(sequence)} TO ${identifier(web.name)}`)

  if (readonly) {
    await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO ${identifier(readonly.name)}`)
    await client.query(`GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, drizzle TO ${identifier(readonly.name)}`)
  }
  if (backup) {
    await client.query(`GRANT SELECT ON ALL TABLES IN SCHEMA public, drizzle TO ${identifier(backup.name)}`)
    await client.query(`GRANT SELECT ON ALL SEQUENCES IN SCHEMA public, drizzle TO ${identifier(backup.name)}`)
  }

  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(migration.name)} IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC`)
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(migration.name)} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC`)
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(migration.name)} IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`)
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(migration.name)} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${identifier(admin.name)}`)
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(migration.name)} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${identifier(admin.name)}`)
  if (readonly) await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(migration.name)} IN SCHEMA public GRANT SELECT ON TABLES TO ${identifier(readonly.name)}`)
  if (backup) await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(migration.name)} IN SCHEMA public GRANT SELECT ON TABLES TO ${identifier(backup.name)}`)

  await client.query("COMMIT")
  console.log(`PostgreSQL least-privilege roles provisioned for ${provisioningUrl.hostname}/${databaseName(provisioningUrl)}.`)
  console.log(`Principals: web=${web.name}, admin=${admin.name}, migration=${migration.name}${readonly ? `, readonly=${readonly.name}` : ""}${backup ? `, backup=${backup.name}` : ""}.`)
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined)
  throw error
} finally {
  await client.end()
}

async function ensureLoginRole(principal) {
  const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [principal.name])
  if (!exists.rowCount) await client.query(`CREATE ROLE ${identifier(principal.name)} LOGIN`)
  const bypassRls = principal === backup ? "BYPASSRLS" : "NOBYPASSRLS"
  await client.query(`ALTER ROLE ${identifier(principal.name)} WITH LOGIN PASSWORD ${literal(principal.password)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT ${bypassRls}`)
  await client.query(`ALTER ROLE ${identifier(principal.name)} SET search_path TO public`)
  await client.query(`ALTER ROLE ${identifier(principal.name)} SET row_security TO on`)
}

async function transferSchemaObjects(schema, owner) {
  const relations = await client.query("SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind IN ('r','p','S','v','m')", [schema])
  for (const row of relations.rows) {
    const kind = row.relkind === "S" ? "SEQUENCE" : row.relkind === "v" ? "VIEW" : row.relkind === "m" ? "MATERIALIZED VIEW" : "TABLE"
    await client.query(`ALTER ${kind} ${identifier(schema)}.${identifier(row.relname)} OWNER TO ${identifier(owner)}`)
  }
  const types = await client.query("SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname=$1 AND t.typtype IN ('e','d')", [schema])
  for (const row of types.rows) await client.query(`ALTER TYPE ${identifier(schema)}.${identifier(row.typname)} OWNER TO ${identifier(owner)}`)
  const functions = await client.query("SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1", [schema])
  for (const row of functions.rows) await client.query(`ALTER FUNCTION ${identifier(schema)}.${identifier(row.proname)}(${row.args}) OWNER TO ${identifier(owner)}`)
}

async function tableExists(schema, table) {
  const result = await client.query("SELECT to_regclass($1) IS NOT NULL AS present", [`${schema}.${table}`])
  return result.rows[0]?.present === true
}

async function grantFunctionIfPresent(schema, name, argumentsList, role) {
  const signature = `${schema}.${name}(${argumentsList})`
  const result = await client.query("SELECT to_regprocedure($1) IS NOT NULL AS present", [signature])
  if (result.rows[0]?.present) await client.query(`GRANT EXECUTE ON FUNCTION ${identifier(schema)}.${identifier(name)}(${argumentsList}) TO ${identifier(role)}`)
}

async function sequencesForTables(schema, tables) {
  const result = await client.query("SELECT DISTINCT seq.relname FROM pg_class seq JOIN pg_namespace n ON n.oid=seq.relnamespace JOIN pg_depend d ON d.objid=seq.oid JOIN pg_class tbl ON tbl.oid=d.refobjid WHERE n.nspname=$1 AND seq.relkind='S' AND tbl.relname=ANY($2::text[])", [schema, tables])
  return result.rows.map((row) => row.relname)
}

function requiredUrl(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required.`)
  return parsePostgresUrl(name, value)
}

function optionalRoleFromUrl(name) {
  return process.env[name] ? roleFromUrl(name) : null
}

function roleFromUrl(name) {
  const url = requiredUrl(name)
  const roleName = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(roleName)) throw new Error(`${name} must use a lowercase PostgreSQL role name containing only letters, digits and underscores.`)
  if (!password) throw new Error(`${name} must include a password; credentials are never stored in migrations or scripts.`)
  return { envName: name, url, name: roleName, password }
}

function parsePostgresUrl(name, value) {
  let url
  try { url = new URL(value) } catch { throw new Error(`${name} must be a valid PostgreSQL URL.`) }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error(`${name} must use the postgresql protocol.`)
  if (!url.hostname || !databaseName(url)) throw new Error(`${name} must identify a host and database.`)
  return url
}

function assertDistinctRoles(principals) {
  const names = principals.map((principal) => principal.name)
  if (new Set(names).size !== names.length) throw new Error("Runtime, migration and optional operator URLs must use distinct PostgreSQL roles.")
}

function assertSameDatabase(urls) {
  const targets = urls.map((url) => `${url.hostname.toLowerCase()}:${url.port || "5432"}/${databaseName(url)}`)
  if (new Set(targets).size !== 1) throw new Error("All provisioning URLs must target the same PostgreSQL host, port and database.")
}

function databaseName(url) {
  return decodeURIComponent(url.pathname.replace(/^\//, ""))
}

function identifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`
}

function literal(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}
