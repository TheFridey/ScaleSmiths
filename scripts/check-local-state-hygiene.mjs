#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const TOOL_STATE_DIRECTORIES = new Set([".freebuff", ".claude", ".codex", ".cursor", ".windsurf", ".idea", ".playwright-mcp"])
const SQLITE_STATE_SUFFIXES = [".db", ".db-shm", ".db-wal", ".sqlite", ".sqlite3", ".sqlite-shm", ".sqlite-wal"]

export function validateLocalStateFiles(files, allowlist = { sqliteFixtures: [] }) {
  const failures = []
  const allowed = new Map()

  for (const entry of allowlist.sqliteFixtures ?? []) {
    const fixturePath = normalise(entry.path ?? "")
    if (!fixturePath || !entry.purpose?.trim()) {
      failures.push("[allowlist] every SQLite fixture requires an exact path and non-empty purpose")
      continue
    }
    if (isCompanionFile(fixturePath)) {
      failures.push(`[allowlist] transient SQLite companion files cannot be allowlisted: ${fixturePath}`)
      continue
    }
    allowed.set(fixturePath, entry.purpose.trim())
  }

  for (const input of files) {
    const file = normalise(input)
    const segments = file.split("/")
    const toolDirectory = segments.find((segment) => TOOL_STATE_DIRECTORIES.has(segment.toLowerCase()))
    if (toolDirectory) {
      failures.push(`[tool-state] ${file} is developer-machine state under ${toolDirectory}/`)
      continue
    }
    if (isSqliteFile(file) && !allowed.has(file)) {
      failures.push(`[sqlite-state] ${file} is a SQLite database/state file without an intentional-fixture allowlist entry`)
    }
  }

  for (const fixturePath of allowed.keys()) {
    if (!files.map(normalise).includes(fixturePath)) failures.push(`[allowlist] SQLite fixture is not present on the Git surface: ${fixturePath}`)
  }
  return failures
}

export function gitSurfaceFiles(repositoryRoot) {
  const run = (args) => execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).split("\0").map((entry) => entry.trim()).filter(Boolean)
  return [...new Set([...run(["ls-files", "-z"]), ...run(["ls-files", "--others", "--exclude-standard", "-z"])])]
}

function isSqliteFile(file) {
  const lower = file.toLowerCase()
  return SQLITE_STATE_SUFFIXES.some((suffix) => lower.endsWith(suffix))
}

function isCompanionFile(file) {
  const lower = file.toLowerCase()
  return lower.endsWith("-shm") || lower.endsWith("-wal")
}

function normalise(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//, "")
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const allowlist = JSON.parse(readFileSync(path.join(repositoryRoot, "scripts", "local-state-allowlist.json"), "utf8"))
  const failures = validateLocalStateFiles(gitSurfaceFiles(repositoryRoot), allowlist)
  if (failures.length) {
    console.error(`Local-state hygiene check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`)
    process.exitCode = 1
    return
  }
  console.log("Local-state hygiene check passed: no tool-state directories or unapproved SQLite state files are committable.")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
