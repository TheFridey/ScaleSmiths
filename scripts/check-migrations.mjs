import { readFile, readdir } from "node:fs/promises"
import path from "node:path"

const root = path.basename(process.cwd()) === "admin" ? path.resolve(process.cwd(), "..") : process.cwd()
const drizzle = path.join(root, "admin", "drizzle")
const journal = JSON.parse(await readFile(path.join(drizzle, "meta", "_journal.json"), "utf8"))
const entries = journal.entries ?? []
const sqlFiles = (await readdir(drizzle)).filter((file) => /^\d{4}_.+\.sql$/.test(file)).sort()
const failures = []
const seenIndexes = new Set(), seenTags = new Set()
for (const entry of entries) {
  if (!Number.isInteger(entry.idx) || seenIndexes.has(entry.idx)) failures.push(`Duplicate/invalid journal index: ${entry.idx}`)
  if (typeof entry.tag !== "string" || seenTags.has(entry.tag)) failures.push(`Duplicate/invalid journal tag: ${entry.tag}`)
  seenIndexes.add(entry.idx); seenTags.add(entry.tag)
  const filename = `${entry.tag}.sql`
  if (!sqlFiles.includes(filename)) failures.push(`Journal migration is missing SQL: ${filename}`)
}
for (const file of sqlFiles) if (!seenTags.has(file.slice(0, -4))) failures.push(`SQL migration is missing from journal: ${file}`)
for (let index = 0; index < entries.length; index += 1) if (entries[index].idx !== index) failures.push(`Journal index ${entries[index].idx} is out of sequence; expected ${index}`)
if (failures.length) { console.error(failures.join("\n")); process.exit(1) }
console.log(`Migration verification passed: ${entries.length} journal entries and ${sqlFiles.length} SQL files.`)
