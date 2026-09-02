#!/usr/bin/env node
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadSharedMigrationPlan } from "./shared-migrator.mjs"

export async function validateSharedMigrationPlan(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")) {
  const plan = await loadSharedMigrationPlan(root)
  const failures = []
  const positions = new Map(plan.ordered.map((migration, index) => [`${migration.owner}/${migration.entry.tag}`, index]))
  const tableCreators = new Map()
  for (const [position, migration] of plan.ordered.entries()) {
    for (const table of createdTables(migration.sql)) if (!tableCreators.has(table)) tableCreators.set(table, { position, migration: `${migration.owner}/${migration.entry.tag}` })
  }
  for (const [position, migration] of plan.ordered.entries()) {
    for (const table of referencedTables(migration.sql)) {
      const creator = tableCreators.get(table)
      if (creator && creator.position > position) failures.push(`${migration.owner}/${migration.entry.tag} references missing object ${table}; required owner/history migration ${creator.migration} is later in the global plan.`)
    }
  }
  for (const dependency of plan.crossHistoryDependencies) {
    const migration = positions.get(dependency.migration)
    const prerequisite = positions.get(dependency.requires)
    if (migration == null) failures.push(`Dependency names unknown migration ${dependency.migration}.`)
    if (prerequisite == null) failures.push(`Dependency names unknown prerequisite ${dependency.requires}.`)
    if (migration != null && prerequisite != null && prerequisite >= migration) failures.push(`${dependency.migration} is ordered before required ${dependency.requires} (${dependency.objects.join(", ")}).`)
  }
  for (const [owner, migrations] of Object.entries(plan.histories)) {
    const orderedIndexes = plan.ordered.filter((migration) => migration.owner === owner).map((migration) => migration.entry.idx)
    for (let index = 0; index < migrations.length; index += 1) if (orderedIndexes[index] !== index) failures.push(`${owner} internal history is not ordered at index ${index}.`)
    for (const migration of migrations) if (/\b(?:CREATE\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY|VACUUM|ALTER\s+SYSTEM)\b/i.test(migration.sql)) failures.push(`${owner}/${migration.entry.tag} contains SQL that cannot use the per-migration transaction policy.`)
  }
  for (const [migration, rule] of Object.entries(plan.equivalentMigrations)) {
    if (!positions.has(migration) || !positions.has(rule.satisfiedBy)) failures.push(`Equivalence rule ${migration} names an unknown migration.`)
    if ((positions.get(rule.satisfiedBy) ?? Infinity) >= (positions.get(migration) ?? -1)) failures.push(`${migration} equivalence prerequisite ${rule.satisfiedBy} is not earlier in the global plan.`)
    if (!Array.isArray(rule.columns) || rule.columns.length === 0) failures.push(`${migration} equivalence rule must verify concrete columns.`)
  }
  for (const [migration, hashes] of Object.entries(plan.acceptedHistoricalHashes ?? {})) {
    if (!positions.has(migration)) failures.push(`Accepted historical hashes name unknown migration ${migration}.`)
    for (const hash of hashes) if (!/^[a-f0-9]{64}$/.test(hash)) failures.push(`${migration} has an invalid accepted historical SHA-256.`)
  }
  return { plan, failures }
}

function createdTables(sql) {
  return matches(sql, /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"public"\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi)
}

function referencedTables(sql) {
  return matches(sql, /\b(?:ALTER\s+TABLE|UPDATE|INSERT\s+INTO|DELETE\s+FROM|FROM|JOIN|REFERENCES)\s+(?:"public"\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi)
}

function matches(sql, expression) {
  return new Set([...sql.matchAll(expression)].map((match) => match[1]))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { plan, failures } = await validateSharedMigrationPlan()
  if (failures.length) {
    console.error(`Shared migration order check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`)
    process.exitCode = 1
  } else console.log(`Shared migration order passed: ${plan.ordered.length} migrations, ${plan.crossHistoryDependencies.length} cross-history dependencies.`)
}
