import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { gitSurfaceFiles, validateLocalStateFiles } from "./check-local-state-hygiene.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("accepts the repository Git surface", () => {
  assert.deepEqual(validateLocalStateFiles(gitSurfaceFiles(root)), [])
})

test("rejects local tool-state directories and SQLite state", () => {
  const failures = validateLocalStateFiles([
    ".freebuff/desktop-v2.db",
    ".claude/settings.local.json",
    "tmp/session.sqlite",
    "tmp/session.sqlite-wal",
    "tmp/session.sqlite-shm",
  ])
  assert.equal(failures.length, 5)
  assert(failures.some((failure) => failure.startsWith("[tool-state] .freebuff/")))
  assert(failures.some((failure) => failure.startsWith("[tool-state] .claude/")))
  assert(failures.some((failure) => failure.startsWith("[sqlite-state] tmp/session.sqlite")))
})

test("allows only documented, exact SQLite fixtures and never WAL or SHM files", () => {
  const allowlist = {
    sqliteFixtures: [
      { path: "tests/fixtures/intentional.sqlite", purpose: "Deterministic migration compatibility fixture" },
      { path: "tests/fixtures/intentional.sqlite-wal", purpose: "Must remain prohibited" },
    ],
  }
  const failures = validateLocalStateFiles(["tests/fixtures/intentional.sqlite", "tests/fixtures/other.sqlite"], allowlist)
  assert(!failures.some((failure) => failure.includes("intentional.sqlite is a SQLite")))
  assert(failures.some((failure) => failure.includes("transient SQLite companion files cannot be allowlisted")))
  assert(failures.some((failure) => failure.includes("tests/fixtures/other.sqlite is a SQLite")))
})

test("rejects undocumented and stale fixture allowlist entries", () => {
  const failures = validateLocalStateFiles([], {
    sqliteFixtures: [
      { path: "tests/fixtures/missing.sqlite", purpose: "" },
      { path: "tests/fixtures/stale.sqlite", purpose: "Historical compatibility fixture" },
    ],
  })
  assert(failures.some((failure) => failure.includes("requires an exact path and non-empty purpose")))
  assert(failures.some((failure) => failure.includes("fixture is not present on the Git surface")))
})
