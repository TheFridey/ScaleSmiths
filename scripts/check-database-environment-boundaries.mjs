#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PRODUCTION_COMPOSE_FILES = ["docker-compose.yml", "docker-compose.host-nginx.yml", "docker-compose.release.yml"]
const DATABASE_VARIABLES = ["WEB_DATABASE_URL", "ADMIN_DATABASE_URL", "MIGRATION_DATABASE_URL", "POSTGRES_PROVISIONING_DATABASE_URL", "READONLY_DATABASE_URL", "BACKUP_DATABASE_URL", "DATABASE_URL"]

export function validateDatabaseEnvironmentBoundaries(files) {
  const failures = []
  for (const filename of PRODUCTION_COMPOSE_FILES) {
    const content = files[filename]
    if (!content) { failures.push(`${filename}: missing`); continue }
    for (const service of ["web", "admin"]) {
      const block = serviceBlock(content, service)
      if (!block) { failures.push(`${filename}: missing ${service} service`); continue }
      const owned = service === "web" ? "WEB_DATABASE_URL" : "ADMIN_DATABASE_URL"
      for (const variable of DATABASE_VARIABLES) {
        const value = environmentValue(block, variable)
        if (variable === owned) {
          if (!value || value === '""' || value === "''") failures.push(`${filename}: ${service} must receive ${owned}`)
        } else if (value !== '""' && value !== "''") {
          failures.push(`${filename}: ${service} must explicitly blank ${variable}`)
        }
      }
    }
  }

  const host = files["docker-compose.host-nginx.yml"] ?? ""
  for (const service of ["web-migrate", "admin-migrate"]) {
    const block = serviceBlock(host, service)
    if (!block) { failures.push(`docker-compose.host-nginx.yml: missing ${service} service`); continue }
    if (/^\s+env_file:/m.test(block)) failures.push(`docker-compose.host-nginx.yml: ${service} must not inherit the root env file`)
    if (!environmentValue(block, "MIGRATION_DATABASE_URL")?.includes("MIGRATION_DATABASE_URL is required")) failures.push(`docker-compose.host-nginx.yml: ${service} must receive only the required migration URL`)
  }
  for (const service of ["postgres-provision", "postgres-verify"]) {
    const block = serviceBlock(host, service)
    if (!block) { failures.push(`docker-compose.host-nginx.yml: missing ${service} service`); continue }
    if (/^\s+env_file:/m.test(block)) failures.push(`docker-compose.host-nginx.yml: ${service} must not inherit the root env file`)
    for (const variable of ["POSTGRES_PROVISIONING_DATABASE_URL", "WEB_DATABASE_URL", "ADMIN_DATABASE_URL", "MIGRATION_DATABASE_URL"]) {
      if (!environmentValue(block, variable)) failures.push(`docker-compose.host-nginx.yml: ${service} is missing ${variable}`)
    }
  }
  return failures
}

function serviceBlock(content, service) {
  const escaped = service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return content.match(new RegExp(`^  ${escaped}:\\r?\\n([\\s\\S]*?)(?=^  [a-zA-Z0-9_-]+:|^volumes:|^networks:|\\Z)`, "m"))?.[0] ?? null
}

function environmentValue(block, variable) {
  return block.match(new RegExp(`^      ${variable}:\\s*(.+?)\\s*$`, "m"))?.[1] ?? null
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const files = Object.fromEntries(await Promise.all(PRODUCTION_COMPOSE_FILES.map(async (name) => [name, await readFile(path.join(root, name), "utf8")])))
  const failures = validateDatabaseEnvironmentBoundaries(files)
  if (failures.length) {
    console.error(`Database environment boundary check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`)
    process.exit(1)
  }
  console.log("Database environment boundary check passed: production runtimes and tools receive only their declared PostgreSQL identities.")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode=1 })
