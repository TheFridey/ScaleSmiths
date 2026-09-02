#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const adminDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "admin")
const docker = process.platform === "win32" ? "docker.exe" : "docker"
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error("Run this harness through npm so npm_execpath identifies the pinned npm CLI.")
const suffix = `${process.pid}-${Date.now()}`
const containerName = `scalesmiths-privileges-${suffix}`
const database = "scalesmiths_privilege_test"
const passwords = {
  provisioning: "test_provisioning_only_2026",
  migration: "test_migration_only_2026",
  web: "test_web_only_2026",
  admin: "test_admin_only_2026",
  readonly: "test_readonly_only_2026",
  backup: "test_backup_only_2026",
}

let containerId = ""
try {
  containerId = run(docker, ["run", "--detach", "--rm", "--name", containerName, "--publish", "127.0.0.1::5432", "--env", `POSTGRES_DB=${database}`, "--env", "POSTGRES_USER=scalesmiths_provision", "--env", `POSTGRES_PASSWORD=${passwords.provisioning}`, "postgres:16-alpine"], { quiet: true }).trim()
  if (!/^[a-f0-9]{12,64}$/.test(containerId)) throw new Error("Docker did not return a valid disposable PostgreSQL container ID.")
  waitForPostgres()
  const portOutput = run(docker, ["port", containerId, "5432/tcp"], { quiet: true }).trim()
  const port = portOutput.match(/:(\d+)$/)?.[1]
  if (!port) throw new Error("Unable to resolve the disposable PostgreSQL port.")
  const url = (role, password) => `postgresql://${role}:${encodeURIComponent(password)}@127.0.0.1:${port}/${database}`
  const env = {
    ...process.env,
    POSTGRES_PROVISIONING_DATABASE_URL: url("scalesmiths_provision", passwords.provisioning),
    MIGRATION_DATABASE_URL: url("scalesmiths_migration", passwords.migration),
    WEB_DATABASE_URL: url("scalesmiths_web", passwords.web),
    ADMIN_DATABASE_URL: url("scalesmiths_admin", passwords.admin),
    READONLY_DATABASE_URL: url("scalesmiths_readonly", passwords.readonly),
    BACKUP_DATABASE_URL: url("scalesmiths_backup", passwords.backup),
    DATABASE_URL: "",
    NODE_ENV: "production",
  }

  waitForHostConnection(env.POSTGRES_PROVISIONING_DATABASE_URL)
  run(process.execPath, ["admin/scripts/provision-postgres-roles.mjs", "--confirm-provision"], { env })
  run(process.execPath, [npmCli, "run", "db:migrate"], { env })
  run(process.execPath, ["admin/scripts/provision-postgres-roles.mjs", "--confirm-provision"], { env })
  run(process.execPath, ["admin/scripts/verify-postgres-privileges.mjs"], { env })

  // Each case injects a real grant, proves the verifier rejects it, then proves reprovisioning
  // repairs it. DDL and destructive drift are covered separately because they are revoked by
  // different provisioning statements.
  assertDriftDetectedAndRepaired(env, "GRANT CREATE ON SCHEMA public TO scalesmiths_admin;", "admin: public CREATE", "admin schema CREATE")
  assertDriftDetectedAndRepaired(env, "GRANT DELETE ON TABLE public.clients TO scalesmiths_admin;", "admin: public.clients DELETE", "admin DELETE outside the declared lifecycle tables")
  assertDriftDetectedAndRepaired(env, "GRANT INSERT ON TABLE public.clients TO scalesmiths_web;", "web: public.clients INSERT", "web write access to a read-only table")
  console.log("Real PostgreSQL privilege test passed, including injected-drift rejection and repair.")

  function assertDriftDetectedAndRepaired(environment, sql, expectedFailure, description) {
    run(docker, ["exec", containerId, "psql", "--username", "scalesmiths_provision", "--dbname", database, "--set", "ON_ERROR_STOP=1", "--command", sql], { quiet: true })
    const drift = execute(process.execPath, ["admin/scripts/verify-postgres-privileges.mjs"], { env: environment, quiet: true })
    const output = `${drift.stdout}\n${drift.stderr}`
    if (drift.status === 0) throw new Error(`Privilege verifier accepted injected drift: ${description}.`)
    if (!output.includes(expectedFailure)) throw new Error(`Privilege verifier rejected injected drift (${description}) without reporting "${expectedFailure}".`)
    run(process.execPath, ["admin/scripts/provision-postgres-roles.mjs", "--confirm-provision"], { env: environment, quiet: true })
    run(process.execPath, ["admin/scripts/verify-postgres-privileges.mjs"], { env: environment, quiet: true })
    console.log(`Drift detected and repaired: ${description}.`)
  }
} finally {
  if (/^[a-f0-9]{12,64}$/.test(containerId)) execute(docker, ["rm", "--force", containerId], { quiet: true })
}

function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = execute(docker, ["exec", containerId, "pg_isready", "--username", "scalesmiths_provision", "--dbname", database], { quiet: true })
    if (result.status === 0) return
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
  }
  throw new Error("Disposable PostgreSQL did not become ready.")
}

// Container-local pg_isready answers over the Unix socket while the official image is still in its
// init phase, before PostgreSQL restarts listening on TCP. Readiness must therefore be proven by a
// real authenticated connection from the host, through the published port the tests actually use.
function waitForHostConnection(connectionString) {
  const probe = "const {Client}=require('pg');const c=new Client({connectionString:process.argv[1],connectionTimeoutMillis:2000});c.connect().then(()=>c.query('select 1')).then(()=>c.end()).then(()=>process.exit(0)).catch((error)=>{console.error(error.message);process.exit(1)})"
  let diagnostic = "no attempt recorded"
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = execute(process.execPath, ["-e", probe, connectionString], { quiet: true, cwd: adminDirectory })
    if (result.status === 0) return
    diagnostic = `${result.stdout}${result.stderr}`.trim() || `exit code ${result.status ?? "signal"}`
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
  }
  throw new Error(`Disposable PostgreSQL host port did not become ready within 60s. Last error: ${diagnostic}`)
}

function run(command, args, options = {}) {
  const result = execute(command, args, options)
  if (result.status !== 0) {
    const diagnostic = options.quiet ? ` ${`${result.stdout}${result.stderr}`.trim()}` : ""
    throw new Error(`${command} ${args[0] ?? ""} failed with exit code ${result.status ?? "signal"}.${diagnostic}`)
  }
  return result.stdout
}

function execute(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: options.cwd ?? process.cwd(), env: options.env ?? process.env, encoding: "utf8", windowsHide: true })
  if (!options.quiet) {
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
  }
  if (result.error) throw result.error
  return result
}
