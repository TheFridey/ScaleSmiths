import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { compareWithBaseManifest, validateMigrationHistory } from "./check-migration-history.mjs"

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "scripts", "migration-checksums.json"), "utf8"))

test("accepts the locked repository migration history", async () => {
  assert.deepEqual(await validateMigrationHistory({ repositoryRoot, manifest }), [])
})

test("detects migration checksum mutation", async () => {
  const mutated = structuredClone(manifest)
  mutated.historicalMigrations[0].sha256 = "0".repeat(64)
  const failures = await validateMigrationHistory({ repositoryRoot, manifest: mutated })
  assert(failures.some((failure) => failure.startsWith("Migration checksum mismatch:")))
  assert(failures.some((failure) => failure.startsWith("Historical provenance mismatch:")))
})

test("prevents later changes to an already locked forward migration", () => {
  const current = structuredClone(manifest)
  current.forwardMigrations[0].sha256 = "f".repeat(64)
  assert(compareWithBaseManifest(manifest, current).some((failure) => failure.includes("Previously locked migration metadata changed")))
})

test("prevents historical journal-prefix changes", () => {
  const current = structuredClone(manifest)
  current.journals.admin.baselineEntryCount -= 1
  assert(compareWithBaseManifest(manifest, current).some((failure) => failure === "Historical journal baseline changed: admin"))
})
