import process from "node:process"
import { Client } from "pg"
import { ADMIN_DELETE_TABLES, ADMIN_FUNCTION_GRANTS, APPLICATION_SCHEMAS, RUNTIME_FORBIDDEN_TABLE_PRIVILEGES, WEB_INSERT_TABLES, WEB_TABLE_GRANTS } from "./postgres-privilege-policy.mjs"

const provisioning = requiredPrincipal("POSTGRES_PROVISIONING_DATABASE_URL")
const roles = {
  web: requiredPrincipal("WEB_DATABASE_URL"),
  admin: requiredPrincipal("ADMIN_DATABASE_URL"),
  migration: requiredPrincipal("MIGRATION_DATABASE_URL"),
  readonly: optionalPrincipal("READONLY_DATABASE_URL"),
  backup: optionalPrincipal("BACKUP_DATABASE_URL"),
}
const managed = Object.values(roles).filter(Boolean)
assertDistinct([provisioning, ...managed])
assertSameDatabase([provisioning, ...managed])

const client = new Client({ connectionString: provisioning.url.toString(), application_name: "scalesmiths-privilege-verifier" })
const failures = []
await client.connect()
try {
  await verifyRoleAttributes()
  await verifyMemberships()
  await verifyDatabasePrivileges()
  await verifySchemasAndOwnership()
  await verifyRelations()
  await verifySequences()
  await verifyFunctions()
  await verifyDefaultPrivileges()
} finally {
  await client.end()
}

if (failures.length) {
  console.error(`PostgreSQL privilege verification failed (${failures.length}):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`PostgreSQL privilege verification passed for ${provisioning.url.hostname}/${databaseName(provisioning.url)}.`)
console.log(`Verified principals: migration=${roles.migration.name}, web=${roles.web.name}, admin=${roles.admin.name}${roles.readonly ? `, readonly=${roles.readonly.name}` : ""}${roles.backup ? `, backup=${roles.backup.name}` : ""}.`)

async function verifyRoleAttributes() {
  const result = await client.query("SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname=ANY($1::text[])", [managed.map((role) => role.name)])
  const rows = new Map(result.rows.map((row) => [row.rolname, row]))
  for (const [kind, role] of presentRoles()) {
    const row = rows.get(role.name)
    if (!row) { failures.push(`${kind}: role ${role.name} does not exist`); continue }
    for (const attribute of ["rolsuper", "rolcreatedb", "rolcreaterole", "rolreplication"]) if (row[attribute]) failures.push(`${kind}: ${role.name} unexpectedly has ${attribute}`)
    if (!row.rolcanlogin) failures.push(`${kind}: ${role.name} is not a login role`)
    if (row.rolbypassrls !== (kind === "backup")) failures.push(`${kind}: ${role.name} BYPASSRLS must be ${kind === "backup"}`)
  }
}

async function verifyMemberships() {
  const result = await client.query("SELECT member_role.rolname AS member, granted_role.rolname AS granted FROM pg_auth_members m JOIN pg_roles member_role ON member_role.oid=m.member JOIN pg_roles granted_role ON granted_role.oid=m.roleid WHERE member_role.rolname=ANY($1::text[]) OR granted_role.rolname=ANY($1::text[])", [managed.map((role) => role.name)])
  for (const row of result.rows) failures.push(`role-membership: ${row.member} unexpectedly inherits ${row.granted}`)
}

async function verifyDatabasePrivileges() {
  const database = databaseName(provisioning.url)
  const owner = await client.query("SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=$1", [database])
  if (owner.rows[0]?.owner !== roles.migration.name) failures.push(`database-owner: expected ${roles.migration.name}, found ${owner.rows[0]?.owner ?? "missing"}`)
  for (const [kind, role] of presentRoles()) {
    for (const privilege of ["CONNECT", "CREATE", "TEMPORARY"]) {
      const expected = privilege === "CONNECT" || (kind === "migration" && privilege !== "CONNECT")
      const actual = await scalar("SELECT has_database_privilege($1,$2,$3)", [role.name, database, privilege])
      compare(`${kind}: database ${privilege}`, actual, expected)
    }
  }
}

async function verifySchemasAndOwnership() {
  const schemas = await client.query("SELECT nspname, pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname=ANY($1::text[])", [APPLICATION_SCHEMAS])
  for (const schema of APPLICATION_SCHEMAS) {
    const row = schemas.rows.find((item) => item.nspname === schema)
    if (row?.owner !== roles.migration.name) failures.push(`schema-owner: ${schema} expected ${roles.migration.name}, found ${row?.owner ?? "missing"}`)
    for (const [kind, role] of presentRoles()) {
      const usage = kind === "migration" || schema === "public" || kind === "readonly" || kind === "backup"
      compare(`${kind}: ${schema} USAGE`, await scalar("SELECT has_schema_privilege($1,$2,'USAGE')", [role.name, schema]), usage)
      compare(`${kind}: ${schema} CREATE`, await scalar("SELECT has_schema_privilege($1,$2,'CREATE')", [role.name, schema]), kind === "migration")
    }
  }

  const objects = await client.query("SELECT n.nspname AS schema, c.relname AS name, c.relkind, pg_get_userbyid(c.relowner) AS owner FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p','S','v','m')", [APPLICATION_SCHEMAS])
  for (const row of objects.rows) if (row.owner !== roles.migration.name) failures.push(`object-owner: ${row.schema}.${row.name} (${row.relkind}) is owned by ${row.owner}, expected ${roles.migration.name}`)
}

async function verifyRelations() {
  const result = await client.query("SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p','v','m') ORDER BY 1,2", [APPLICATION_SCHEMAS])
  const privileges = ["SELECT", "INSERT", "UPDATE", "DELETE", ...RUNTIME_FORBIDDEN_TABLE_PRIVILEGES]
  for (const relation of result.rows) {
    for (const [kind, role] of presentRoles().filter(([name]) => name !== "migration")) {
      for (const privilege of privileges) {
        let expected = false
        if (kind === "admin" && relation.schema === "public") expected = ["SELECT", "INSERT", "UPDATE"].includes(privilege) || (privilege === "DELETE" && ADMIN_DELETE_TABLES.includes(relation.name))
        if ((kind === "readonly" || kind === "backup") && privilege === "SELECT") expected = true
        if (kind === "web" && relation.schema === "public") expected = WEB_TABLE_GRANTS.get(relation.name)?.includes(privilege) ?? false
        const actual = await scalar("SELECT has_table_privilege($1,$2,$3)", [role.name, `${relation.schema}.${relation.name}`, privilege])
        compare(`${kind}: ${relation.schema}.${relation.name} ${privilege}`, actual, expected)
      }
    }
  }
}

async function verifySequences() {
  const result = await client.query("SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=ANY($1::text[]) AND c.relkind='S' ORDER BY 1,2", [APPLICATION_SCHEMAS])
  const webSequences = new Set(await sequencesForTables("public", WEB_INSERT_TABLES))
  for (const sequence of result.rows) {
    for (const [kind, role] of presentRoles().filter(([name]) => name !== "migration")) {
      for (const privilege of ["SELECT", "USAGE", "UPDATE"]) {
        let expected = false
        if (kind === "admin" && sequence.schema === "public") expected = privilege === "SELECT" || privilege === "USAGE"
        if (kind === "backup") expected = privilege === "SELECT"
        if (kind === "web" && sequence.schema === "public" && webSequences.has(sequence.name)) expected = privilege === "SELECT" || privilege === "USAGE"
        const actual = await scalar("SELECT has_sequence_privilege($1,$2,$3)", [role.name, `${sequence.schema}.${sequence.name}`, privilege])
        compare(`${kind}: ${sequence.schema}.${sequence.name} ${privilege}`, actual, expected)
      }
    }
  }
}

async function verifyFunctions() {
  const result = await client.query("SELECT n.nspname AS schema, p.proname AS name, pg_get_function_identity_arguments(p.oid) AS arguments, p.oid::regprocedure::text AS signature, pg_get_userbyid(p.proowner) AS owner FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=ANY($1::text[]) ORDER BY 1,2,3", [APPLICATION_SCHEMAS])
  for (const fn of result.rows) {
    if (fn.owner !== roles.migration.name) failures.push(`function-owner: ${fn.signature} is owned by ${fn.owner}, expected ${roles.migration.name}`)
    for (const [kind, role] of presentRoles().filter(([name]) => name !== "migration")) {
      const expected = kind === "admin" && ADMIN_FUNCTION_GRANTS.some((grant) => grant.schema === fn.schema && grant.name === fn.name && normalizeArguments(grant.arguments) === normalizeArguments(fn.arguments))
      compare(`${kind}: ${fn.signature} EXECUTE`, await scalar("SELECT has_function_privilege($1,$2::regprocedure,'EXECUTE')", [role.name, fn.signature]), expected)
    }
  }
}

async function verifyDefaultPrivileges() {
  const result = await client.query(`
    SELECT n.nspname AS schema, d.defaclobjtype AS object_type,
      CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee,
      x.privilege_type AS privilege, x.is_grantable
    FROM pg_default_acl d
    JOIN pg_roles owner ON owner.oid=d.defaclrole
    JOIN pg_namespace n ON n.oid=d.defaclnamespace
    CROSS JOIN LATERAL aclexplode(COALESCE(d.defaclacl, acldefault(d.defaclobjtype,d.defaclrole))) x
    LEFT JOIN pg_roles grantee ON grantee.oid=x.grantee
    WHERE owner.rolname=$1 AND n.nspname=ANY($2::text[])
  `, [roles.migration.name, APPLICATION_SCHEMAS])
  const actual = new Set(result.rows.filter((row) => row.grantee !== roles.migration.name).map(defaultKey))
  const expected = new Set()
  for (const privilege of ["SELECT", "INSERT", "UPDATE"]) expected.add(defaultKey({ schema: "public", object_type: "r", grantee: roles.admin.name, privilege, is_grantable: false }))
  for (const privilege of ["SELECT", "USAGE"]) expected.add(defaultKey({ schema: "public", object_type: "S", grantee: roles.admin.name, privilege, is_grantable: false }))
  if (roles.readonly) for (const schema of APPLICATION_SCHEMAS) expected.add(defaultKey({ schema, object_type: "r", grantee: roles.readonly.name, privilege: "SELECT", is_grantable: false }))
  if (roles.backup) for (const schema of APPLICATION_SCHEMAS) {
    expected.add(defaultKey({ schema, object_type: "r", grantee: roles.backup.name, privilege: "SELECT", is_grantable: false }))
    expected.add(defaultKey({ schema, object_type: "S", grantee: roles.backup.name, privilege: "SELECT", is_grantable: false }))
  }
  for (const key of expected) if (!actual.has(key)) failures.push(`default-privilege: missing ${key}`)
  for (const key of actual) if (!expected.has(key)) failures.push(`default-privilege: unexpected ${key}`)
}

async function sequencesForTables(schema, tables) {
  const result = await client.query("SELECT DISTINCT seq.relname FROM pg_class seq JOIN pg_namespace n ON n.oid=seq.relnamespace JOIN pg_depend d ON d.objid=seq.oid JOIN pg_class tbl ON tbl.oid=d.refobjid WHERE n.nspname=$1 AND seq.relkind='S' AND tbl.relname=ANY($2::text[])", [schema, tables])
  return result.rows.map((row) => row.relname)
}

async function scalar(query, params) { const row=(await client.query(query, params)).rows[0]; return row ? Object.values(row)[0] : undefined }

function compare(label, actual, expected) { if (actual !== expected) failures.push(`${label}: expected ${expected}, found ${actual}`) }
function defaultKey(row) { return `${row.schema}:${row.object_type}:${row.grantee}:${row.privilege}:${row.is_grantable}` }
function normalizeArguments(value) { return String(value).replaceAll(/\s+/g, "").toLowerCase() }
function presentRoles() { return Object.entries(roles).filter(([, role]) => Boolean(role)) }

function requiredPrincipal(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required.`)
  return principal(name, value)
}
function optionalPrincipal(name) { return process.env[name] ? principal(name, process.env[name]) : null }
function principal(envName, value) {
  let url
  try { url = new URL(value) } catch { throw new Error(`${envName} must be a valid PostgreSQL URL.`) }
  if (!/^postgres(?:ql)?:$/.test(url.protocol) || !url.hostname || !databaseName(url)) throw new Error(`${envName} must identify a PostgreSQL host and database.`)
  const name = decodeURIComponent(url.username)
  if (!name) throw new Error(`${envName} must include a role name.`)
  return { envName, url, name }
}
function assertDistinct(principals) { const names=principals.map((role)=>role.name); if(new Set(names).size!==names.length)throw new Error("All PostgreSQL principals must use distinct role names.") }
function assertSameDatabase(principals) { const targets=principals.map((role)=>`${role.url.hostname.toLowerCase()}:${role.url.port||"5432"}/${databaseName(role.url)}`); if(new Set(targets).size!==1)throw new Error("All PostgreSQL principals must target the same database.") }
function databaseName(url) { return decodeURIComponent(url.pathname.replace(/^\//, "")) }
