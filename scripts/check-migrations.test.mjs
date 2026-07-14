import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { verifyMigrationDirectory } from "./check-migrations.mjs"

test("accepts a sequential journal with matching SQL files", async (context) => {
  const directory = await fixture(context, ["0000_initial", "0001_forward_only"], ["0000_initial.sql", "0001_forward_only.sql"])
  assert.deepEqual((await verifyMigrationDirectory(directory, "fixture")).failures, [])
})

test("reports missing, untracked and out-of-sequence migrations", async (context) => {
  const directory = await fixture(context, ["0000_initial", "0002_missing"], ["0000_initial.sql", "0001_untracked.sql"])
  const { failures } = await verifyMigrationDirectory(directory, "fixture")
  assert(failures.some((failure) => failure.includes("journal migration is missing SQL: 0002_missing.sql")))
  assert(failures.some((failure) => failure.includes("SQL migration is missing from journal: 0001_untracked.sql")))
  assert(failures.some((failure) => failure.includes("out of sequence; expected 1")))
})

async function fixture(context, tags, sqlFiles) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "scalesmiths-migrations-"))
  context.after(() => rm(directory, { recursive: true, force: true }))
  await mkdir(path.join(directory, "meta"))
  await writeFile(path.join(directory, "meta", "_journal.json"), JSON.stringify({ entries: tags.map((tag, idx) => ({ idx: tag.startsWith("0002") ? 2 : idx, tag })) }))
  await Promise.all(sqlFiles.map((file) => writeFile(path.join(directory, file), "-- fixture")))
  return directory
}
