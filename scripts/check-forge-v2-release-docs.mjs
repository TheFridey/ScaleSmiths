#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const REQUIRED = {
  "docs/release-readiness/forge-v2.md": ["Final master SHA", "Formal release verdict", "Production-derived restore status", "Human release approval"],
  "docs/operations/forge-v2-production-restore-drill.md": ["Mandatory isolation controls", "Failure handling", "Cleanup and secure deletion", "Evidence and sign-off"],
  "docs/operations/forge-v2-production-restore-evidence-template.md": ["Backup identifier", "Encryption/checksum verification result", "migration journal state", "Cleanup, defects, and approval"],
  "docs/operations/forge-v2-production-validation.md": ["Pre-deployment", "Deployment", "Post-deployment", "Rollback triggers and execution"],
}

export function validateForgeReleaseDocs(files) {
  const failures = []
  for (const [name, markers] of Object.entries(REQUIRED)) {
    const content = files.get(name)
    if (!content) {
      failures.push(`[missing] ${name}`)
      continue
    }
    for (const marker of markers) if (!content.includes(marker)) failures.push(`[structure] ${name} is missing ${marker}`)
    if (/\b(?:TODO|TBD|FIXME)\b/i.test(content)) failures.push(`[placeholder] ${name} contains an unresolved placeholder`)
    if (/authenticated journeys unavailable|dirty checkout/i.test(content)) failures.push(`[stale-status] ${name} contains superseded release language`)
  }

  const ledger = files.get("docs/release-readiness/forge-v2.md") ?? ""
  const master = ledger.match(/Final master SHA:\s*`([0-9a-f]{40})`/i)?.[1]
  if (!master) failures.push("[master-sha] release ledger must contain one full final master SHA")
  for (const line of ledger.split(/\r?\n/)) {
    if (!/(?:final|current|authoritative) master/i.test(line)) continue
    const shas = line.match(/[0-9a-f]{40}/gi) ?? []
    if (shas.length && master && shas.some((sha) => sha.toLowerCase() !== master.toLowerCase())) {
      failures.push("[stale-sha] a master-status statement references a different SHA")
      break
    }
  }

  const releaseDocs = [...files].filter(([name]) => name.startsWith("docs/release-readiness/"))
  const verdicts = new Set()
  for (const [, content] of releaseDocs) {
    for (const match of content.matchAll(/\b(BLOCKED\s*[—-]\s*DO NOT DEPLOY|APPROVED\s+FOR\s+DEPLOYMENT|READY\s+FOR\s+DEPLOYMENT)\b/gi)) {
      verdicts.add(match[1].toUpperCase().replace(/\s+/g, " ").replace("-", "—"))
    }
  }
  if (verdicts.size > 1) failures.push(`[verdict-conflict] conflicting final verdicts: ${[...verdicts].join(", ")}`)
  if (!/Formal release verdict:\s*\*\*BLOCKED\s*[—-]\s*DO NOT DEPLOY\*\*/i.test(ledger)) failures.push("[verdict] ledger must state the current formal verdict")
  return failures
}

export async function loadForgeReleaseDocs(root) {
  const files = new Map()
  for (const name of Object.keys(REQUIRED)) files.set(name, await readFile(path.join(root, name), "utf8").catch(() => ""))
  const readinessRoot = path.join(root, "docs/release-readiness")
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(absolute)
      else if (entry.name.endsWith(".md")) {
        const name = path.relative(root, absolute).replaceAll(path.sep, "/")
        if (!files.has(name)) files.set(name, await readFile(absolute, "utf8"))
      }
    }
  }
  await visit(readinessRoot)
  return files
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)))
  const failures = validateForgeReleaseDocs(await loadForgeReleaseDocs(root))
  if (failures.length) {
    console.error(failures.join("\n"))
    process.exitCode = 1
  } else console.log("Forge V2 release documentation is structurally consistent.")
}
