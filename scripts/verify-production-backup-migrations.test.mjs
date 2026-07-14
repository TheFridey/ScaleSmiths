import test from "node:test"
import assert from "node:assert/strict"
import { parseArguments, validateTarget } from "./verify-production-backup-migrations.mjs"

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
