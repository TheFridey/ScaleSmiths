import { spawn } from "node:child_process"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const admin = path.join(root, "admin")
const compose = ["compose", "-p", "scalesmiths-forge-e2e", "-f", "docker-compose.integration-test.yml"]
const databaseUrl = process.env.TEST_DATABASE_URL ?? "postgresql://scalesmiths_test:scalesmiths_test_only@127.0.0.1:55432/scalesmiths_integration_test"
assertSafeTestDatabase(databaseUrl)
const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
  NODE_ENV: "development",
  AUTH_SECRET: "forge-e2e-auth-secret-at-least-32-characters",
  AUTH_TRUST_HOST: "true",
  ADMIN_EMAIL: "forge-e2e@scalesmiths.test",
  ADMIN_PASSWORD: "Forge-E2E-owner-2026!",
  ADMIN_DISPLAY_NAME: "Forge E2E Owner",
  FORGE_ENABLE_AI: "false",
  FORGE_DEFAULT_AI_PROVIDER: "mock",
  FORGE_JOB_MODE: "inline",
  FORGE_SANDBOX_RUNNER: "local",
  FORGE_MAX_REPAIR_ATTEMPTS: "10",
  FORGE_E2E_CONTROLLED_QA: "true",
  FORGE_DISABLE_AUTO_REPAIR: "true",
  FORGE_QA_COMMAND_TIMEOUT_MS: "300000",
  FORGE_E2E_BASE_URL: "http://127.0.0.1:3301",
}
let server
try {
  await command("docker", [...compose, "up", "-d", "--wait"], root, env)
  await npm(["run", "db:migrate"], admin, env)
  await npm(["run", "admin:bootstrap"], admin, env)
  server = spawn(node(), ["./node_modules/next/dist/bin/next", "dev", "-p", "3301"], { cwd: admin, env, stdio: "inherit", windowsHide: true })
  await waitForServer(env.FORGE_E2E_BASE_URL)
  await command(node(), ["scripts/forge-workflow-e2e.mjs"], admin, env)
} finally {
  if (server && !server.killed) server.kill("SIGTERM")
  await command("docker", [...compose, "down", "--volumes"], root, env).catch((error) => console.error(`Forge E2E cleanup failed: ${error.message}`))
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (server?.exitCode != null) throw new Error(`Admin test server exited with ${server.exitCode}.`)
    try { const response = await fetch(`${url}/api/auth/csrf`); if (response.ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error("Admin test server did not become ready within 90 seconds.")
}
function node() { return process.execPath }
function npm(args, cwd, childEnv) { return command(process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm", process.platform === "win32" ? ["/d", "/s", "/c", `npm ${args.join(" ")}`] : args, cwd, childEnv) }
function command(executable, args, cwd, childEnv) { return new Promise((resolve, reject) => { const child = spawn(executable, args, { cwd, env: childEnv, stdio: "inherit", windowsHide: true }); child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${executable} exited with ${code}`))) }) }
function assertSafeTestDatabase(value) { const url = new URL(value); if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") throw new Error("Forge E2E requires PostgreSQL."); if (!["127.0.0.1", "localhost", "::1", "postgres-integration"].includes(url.hostname)) throw new Error("Forge E2E database must be loopback or the integration Compose service."); if (!/(test|integration)/i.test(url.pathname)) throw new Error("Forge E2E database name must contain test or integration.") }
