import test from "node:test"
import assert from "node:assert/strict"
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { parseArguments, resolveDatabaseUrl, validateTarget } from "./verify-production-backup-migrations.mjs"

test("requires an explicit URL rather than reading an environment fallback", () => {
  assert.throws(
    () => validateTarget({ report: "report.json", "confirm-isolated-backup": true }),
    /--database-url is required/,
  )
})

test("accepts a specifically confirmed remote isolated restore", () => {
  const options = parseArguments([
    "--database-url",
    "postgresql://operator:secret@db.internal/scalesmiths_backup_restore",
    "--confirm-isolated-backup",
    "--confirm-target",
    "db.internal/scalesmiths_backup_restore",
    "--report",
    "artifacts/backup-report.json",
  ])
  const target = validateTarget(options)
  assert.equal(target.host, "db.internal")
  assert.equal(target.database, "scalesmiths_backup_restore")
})

test("refuses a normal database name even with confirmation flags", () => {
  assert.throws(
    () =>
      validateTarget({
        "database-url": "postgresql://operator:secret@db.internal/scalesmiths",
        "confirm-isolated-backup": true,
        "confirm-target": "db.internal/scalesmiths",
        report: "report.json",
      }),
    /database name must explicitly identify an isolated backup/,
  )
})

test("requires an additional acknowledgement for localhost", () => {
  const base = {
    "database-url": "postgresql://operator:secret@localhost/scalesmiths_backup_restore",
    "confirm-isolated-backup": true,
    "confirm-target": "localhost/scalesmiths_backup_restore",
    report: "report.json",
  }
  assert.throws(() => validateTarget(base), /--confirm-localhost-isolated is required/)
  assert.equal(validateTarget({ ...base, "confirm-localhost-isolated": true }).target, "localhost/scalesmiths_backup_restore")
})

test("requires the operator to repeat the exact host and database", () => {
  assert.throws(
    () =>
      validateTarget({
        "database-url": "postgresql://operator:secret@db.internal/scalesmiths_backup_restore",
        "confirm-isolated-backup": true,
        "confirm-target": "db.internal/wrong_restore",
        report: "report.json",
      }),
    /--confirm-target must exactly equal db.internal\/scalesmiths_backup_restore/,
  )
})

test("loads a database URL from an explicit restricted file", async (context) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "scalesmiths-backup-url-"))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const urlFile = path.join(directory, "database-url")
  await writeFile(urlFile, "postgresql://operator:secret@db.internal/scalesmiths_backup_restore\n", { mode: 0o600 })
  await chmod(urlFile, 0o600)

  const options = await resolveDatabaseUrl(parseArguments(["--database-url-file", urlFile]))
  assert.equal(options["database-url"], "postgresql://operator:secret@db.internal/scalesmiths_backup_restore")
})

test("rejects ambiguous URL inputs", async () => {
  await assert.rejects(
    resolveDatabaseUrl({ "database-url": "postgresql://one/db", "database-url-file": "database-url" }),
    /Use only one/,
  )
})
