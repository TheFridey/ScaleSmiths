#!/usr/bin/env node
import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const MIGRATION_MANIFEST_PATH = "scripts/migration-checksums.json"
const APPS = ["web", "admin"]

export async function validateMigrationHistory({ repositoryRoot, manifest, readGitBlob = gitBlobReader(repositoryRoot), baseManifest = null }) {
  const failures = []
  const lockedMigrations = [...manifest.historicalMigrations, ...manifest.forwardMigrations]
  const byPath = new Map()

  if (manifest.version !== 1 || manifest.algorithm !== "sha256") failures.push("Manifest must use version 1 and sha256.")
  for (const migration of lockedMigrations) {
    if (byPath.has(migration.path)) failures.push(`Duplicate manifest path: ${migration.path}`)
    byPath.set(migration.path, migration)
    if (!/^[a-f0-9]{64}$/.test(migration.sha256)) failures.push(`Invalid SHA-256 for ${migration.path}`)
  }

  const diskPaths = []
  for (const app of APPS) {
    const migrationRoot = path.join(repositoryRoot, app, "drizzle")
    const files = (await readdir(migrationRoot)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort()
    for (const file of files) diskPaths.push(`${app}/drizzle/${file}`)
  }

  for (const diskPath of diskPaths) if (!byPath.has(diskPath)) failures.push(`Unregistered migration: ${diskPath}`)
  for (const migration of lockedMigrations) {
    let content
    try {
      content = await readFile(path.join(repositoryRoot, migration.path))
    } catch {
      failures.push(`Manifest migration is missing: ${migration.path}`)
      continue
    }
    const actualHash = sha256(content)
    if (actualHash !== migration.sha256) failures.push(`Migration checksum mismatch: ${migration.path}; expected ${migration.sha256}, got ${actualHash}`)

    if (migration.lifecycle === "historical-baseline") {
      const sourceCommit = migration.sourceCommit ?? manifest.baselineSourceCommit
      try {
        const sourceHash = sha256(await readGitBlob(sourceCommit, migration.path))
        if (sourceHash !== migration.sha256) failures.push(`Historical provenance mismatch: ${migration.path} does not match ${sourceCommit}`)
      } catch (error) {
        failures.push(`Unable to verify historical provenance for ${migration.path} at ${sourceCommit}: ${errorMessage(error)}`)
      }
    } else if (migration.lifecycle !== "forward-correction" && migration.lifecycle !== "forward") {
      failures.push(`Unknown migration lifecycle for ${migration.path}: ${migration.lifecycle}`)
    }
  }

  for (const [app, journalPolicy] of Object.entries(manifest.journals)) {
    const currentJournal = JSON.parse(await readFile(path.join(repositoryRoot, journalPolicy.path), "utf8"))
    const currentEntries = currentJournal.entries ?? []
    for (let index = 0; index < currentEntries.length; index += 1) {
      const entry = currentEntries[index]
      if (entry.idx !== index) failures.push(`${app} journal index ${entry.idx} is out of sequence; expected ${index}`)
      const migrationPath = `${app}/drizzle/${entry.tag}.sql`
      if (!byPath.has(migrationPath)) failures.push(`${app} journal entry is not locked in the manifest: ${entry.tag}`)
    }

    try {
      const historicalJournal = JSON.parse((await readGitBlob(journalPolicy.baselineSourceCommit, journalPolicy.path)).toString("utf8"))
      const historicalEntries = historicalJournal.entries ?? []
      if (historicalEntries.length !== journalPolicy.baselineEntryCount) failures.push(`${app} baseline journal count no longer matches ${journalPolicy.baselineSourceCommit}`)
      const currentBaseline = currentEntries.slice(0, journalPolicy.baselineEntryCount)
      if (stableJson(currentBaseline) !== stableJson(historicalEntries)) failures.push(`${app} historical journal entries differ from ${journalPolicy.baselineSourceCommit}`)
    } catch (error) {
      failures.push(`Unable to verify ${app} journal baseline: ${errorMessage(error)}`)
    }

    const appendedEntries = currentEntries.slice(journalPolicy.baselineEntryCount)
    if (stableJson(appendedEntries) !== stableJson(journalPolicy.appendedEntries)) failures.push(`${app} forward journal entries do not match the manifest`)
  }

  for (const variant of manifest.knownHistoricalVariants) {
    try {
      const actual = sha256(await readGitBlob(variant.commit, variant.path))
      if (actual !== variant.sha256) failures.push(`Known historical variant mismatch: ${variant.path} at ${variant.commit}`)
    } catch (error) {
      failures.push(`Unable to verify known historical variant ${variant.path} at ${variant.commit}: ${errorMessage(error)}`)
    }
  }

  if (baseManifest) failures.push(...compareWithBaseManifest(baseManifest, manifest))
  return failures
}

export function compareWithBaseManifest(baseManifest, currentManifest) {
  const failures = []
  const currentByPath = new Map([...currentManifest.historicalMigrations, ...currentManifest.forwardMigrations].map((item) => [item.path, item]))
  for (const previous of [...baseManifest.historicalMigrations, ...baseManifest.forwardMigrations]) {
    const current = currentByPath.get(previous.path)
    if (!current) failures.push(`Previously locked migration was removed: ${previous.path}`)
    else if (current.sha256 !== previous.sha256 || current.lifecycle !== previous.lifecycle) failures.push(`Previously locked migration metadata changed: ${previous.path}`)
  }
  for (const app of Object.keys(baseManifest.journals)) {
    const previous = baseManifest.journals[app]
    const current = currentManifest.journals[app]
    if (!current || current.path !== previous.path || current.baselineSourceCommit !== previous.baselineSourceCommit || current.baselineEntryCount !== previous.baselineEntryCount) {
      failures.push(`Historical journal baseline changed: ${app}`)
    }
    const currentPrefix = current?.appendedEntries?.slice(0, previous.appendedEntries.length) ?? []
    if (stableJson(currentPrefix) !== stableJson(previous.appendedEntries)) failures.push(`Previously locked forward journal entries changed: ${app}`)
  }
  if (stableJson(baseManifest.knownHistoricalVariants) !== stableJson(currentManifest.knownHistoricalVariants)) failures.push("Known historical migration variants changed")
  return failures
}

function gitBlobReader(repositoryRoot) {
  return async (commit, relativePath) => {
    const result = spawnSync("git", ["show", `${commit}:${relativePath}`], { cwd: repositoryRoot, encoding: "buffer", maxBuffer: 10 * 1024 * 1024 })
    if (result.status !== 0) throw new Error(result.stderr.toString("utf8").trim() || `git show exited ${result.status}`)
    return result.stdout
  }
}

async function loadBaseManifest(repositoryRoot, baseRef) {
  if (!baseRef) return null
  const result = spawnSync("git", ["show", `${baseRef}:${MIGRATION_MANIFEST_PATH}`], { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 5 * 1024 * 1024 })
  if (result.status !== 0) {
    if (/does not exist|exists on disk, but not in/.test(result.stderr)) return null
    throw new Error(`Unable to read base migration manifest from ${baseRef}: ${result.stderr.trim()}`)
  }
  return JSON.parse(result.stdout)
}

function sha256(content) {
  const canonical = Buffer.isBuffer(content) ? content.toString("utf8") : String(content)
  return createHash("sha256").update(canonical.replace(/\r\n/g, "\n")).digest("hex")
}

function stableJson(value) {
  return JSON.stringify(value)
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const baseArgument = process.argv.indexOf("--base-ref")
  const requestedBase = baseArgument >= 0 ? process.argv[baseArgument + 1] : null
  if (baseArgument >= 0 && !requestedBase) throw new Error("--base-ref requires a Git ref")
  const baseRef = requestedBase ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null)
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, MIGRATION_MANIFEST_PATH), "utf8"))
  const failures = await validateMigrationHistory({ repositoryRoot, manifest, baseManifest: await loadBaseManifest(repositoryRoot, baseRef) })
  if (failures.length) {
    console.error(`Migration history integrity check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`)
    process.exitCode = 1
    return
  }
  console.log(`Migration history integrity passed: ${manifest.historicalMigrations.length} historical and ${manifest.forwardMigrations.length} forward migrations are locked${baseRef ? ` against ${baseRef}` : ""}.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(errorMessage(error))
    process.exitCode = 1
  })
}
