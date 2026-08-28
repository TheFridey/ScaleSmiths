import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { validateDatabaseEnvironmentBoundaries } from "./check-database-environment-boundaries.mjs"

const names = ["docker-compose.yml", "docker-compose.host-nginx.yml", "docker-compose.release.yml"]
const repositoryFiles = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await readFile(new URL(`../${name}`, import.meta.url), "utf8")])))

test("accepts the repository production database environment boundaries", () => {
  assert.deepEqual(validateDatabaseEnvironmentBoundaries(repositoryFiles), [])
})

test("rejects a runtime receiving migration credentials", () => {
  const files = { ...repositoryFiles, "docker-compose.release.yml": repositoryFiles["docker-compose.release.yml"].replace('MIGRATION_DATABASE_URL: ""', "MIGRATION_DATABASE_URL: ${MIGRATION_DATABASE_URL}") }
  assert(validateDatabaseEnvironmentBoundaries(files).some((failure) => failure.includes("web must explicitly blank MIGRATION_DATABASE_URL")))
})

test("rejects a privileged tool inheriting the complete root environment", () => {
  const files = { ...repositoryFiles, "docker-compose.host-nginx.yml": repositoryFiles["docker-compose.host-nginx.yml"].replace("  postgres-verify:\n", "  postgres-verify:\n    env_file: .env\n") }
  assert(validateDatabaseEnvironmentBoundaries(files).some((failure) => failure.includes("postgres-verify must not inherit")))
})
