#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export async function verifyMigrationDirectory(drizzle, label = path.basename(path.dirname(drizzle))) {
  const journal = JSON.parse(await readFile(path.join(drizzle, "meta", "_journal.json"), "utf8"))
  const entries = journal.entries ?? []
  const sqlFiles = (await readdir(drizzle)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort()
  const failures = []
  const seenIndexes = new Set()
  const seenTags = new Set()

  for (const entry of entries) {
    if (!Number.isInteger(entry.idx) || seenIndexes.has(entry.idx)) failures.push(`${label}: duplicate/invalid journal index: ${entry.idx}`)
    if (typeof entry.tag !== "string" || seenTags.has(entry.tag)) failures.push(`${label}: duplicate/invalid journal tag: ${entry.tag}`)
    seenIndexes.add(entry.idx)
    seenTags.add(entry.tag)
    const filename = `${entry.tag}.sql`
    if (!sqlFiles.includes(filename)) failures.push(`${label}: journal migration is missing SQL: ${filename}`)
  }

  for (const file of sqlFiles) if (!seenTags.has(file.slice(0, -4))) failures.push(`${label}: SQL migration is missing from journal: ${file}`)
  for (let index = 0; index < entries.length; index += 1) {
    if (entries[index].idx !== index) failures.push(`${label}: journal index ${entries[index].idx} is out of sequence; expected ${index}`)
  }

  return { label, entries: entries.length, sqlFiles: sqlFiles.length, failures }
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const results = await Promise.all([
    verifyMigrationDirectory(path.join(repositoryRoot, "web", "drizzle"), "web"),
    verifyMigrationDirectory(path.join(repositoryRoot, "admin", "drizzle"), "admin"),
  ])
  const failures = results.flatMap((result) => result.failures)
  if (failures.length) {
    console.error(failures.join("\n"))
    process.exitCode = 1
    return
  }
  console.log(`Migration verification passed: ${results.map((result) => `${result.label} ${result.entries} journal entries/${result.sqlFiles} SQL files`).join("; ")}.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
