#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const CANONICAL_ROOT = "/var/www/scalesmiths/ScaleSmiths"
const CANONICAL_ADMIN_ORIGIN = "https://admin.scalesmiths.co.uk"
const STALE_ROOT = ["/srv", "/scalesmiths"].join("")
const DEPRECATED_ADMIN_ROUTE = ["scalesmiths.co.uk", "/admin"].join("")
const PLACEHOLDER_OWNER = ["@TheFridey", "/scalesmiths-maintainers"].join("")
const SELF = "scripts/check-production-topology.mjs"
const ALLOWLIST_PATH = "scripts/production-topology-allowlist.json"

export const TOPOLOGY_RULES = [
  {
    id: "stale-production-root",
    description: `Use ${CANONICAL_ROOT}, not the retired production checkout root.`,
    find(content) {
      return literalMatches(content, STALE_ROOT)
    },
  },
  {
    id: "incomplete-production-root",
    description: `Production paths must include the complete ${CANONICAL_ROOT} checkout root.`,
    find(content) {
      const rootPrefix = "/var/www/scalesmiths"
      return regexMatches(content, new RegExp(`${escapeRegex(rootPrefix)}(?!/ScaleSmiths(?:[/\\\\\\s\"'\\x60.,:;)]|$))`, "g"))
    },
  },
  {
    id: "deprecated-admin-route",
    description: `Use ${CANONICAL_ADMIN_ORIGIN}; the public website has no production admin route.`,
    find(content) {
      return literalMatches(content, DEPRECATED_ADMIN_ROUTE)
    },
  },
  {
    id: "placeholder-codeowner",
    description: "CODEOWNERS must refer to a proven repository owner or team.",
    find(content) {
      return literalMatches(content, PLACEHOLDER_OWNER)
    },
  },
  {
    id: "noncanonical-admin-environment",
    description: `Production admin URL examples must use ${CANONICAL_ADMIN_ORIGIN}; localhost remains valid for development.`,
    find(content) {
      const matches = []
      const expression = /^(?:NEXT_PUBLIC_ADMIN_URL|ADMIN_PORTAL_URL|AUTH_URL)\s*=\s*([^\s#]+)\s*$/gm
      for (const match of content.matchAll(expression)) {
        const value = match[1].replace(/\/$/, "")
        if (value !== CANONICAL_ADMIN_ORIGIN && !/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(value)) {
          matches.push(match.index ?? 0)
        }
      }
      return matches
    },
  },
]

export function findTopologyViolations(files, allowlist = { exceptions: {} }) {
  validateAllowlist(allowlist)
  const violations = []
  for (const file of files) {
    const allowedRules = new Set(allowlist.exceptions?.[file.path] ?? [])
    for (const rule of TOPOLOGY_RULES) {
      if (allowedRules.has(rule.id)) continue
      for (const index of rule.find(file.content)) {
        violations.push({ path: file.path, line: lineNumber(file.content, index), rule: rule.id, description: rule.description })
      }
    }
  }
  return violations
}

function validateAllowlist(allowlist) {
  const knownRules = new Set(TOPOLOGY_RULES.map((rule) => rule.id))
  for (const [file, rules] of Object.entries(allowlist.exceptions ?? {})) {
    const isHistorical = file.startsWith("docs/audits/") || file.startsWith("docs/releases/")
    const isFixture = file === "scripts/check-production-topology.test.mjs"
    if (!isHistorical && !isFixture) throw new Error(`Topology allowlist may cover only historical evidence or the test fixture: ${file}`)
    if (!Array.isArray(rules) || rules.length === 0) throw new Error(`Topology allowlist entry must name at least one rule: ${file}`)
    for (const rule of rules) if (!knownRules.has(rule)) throw new Error(`Unknown topology allowlist rule ${rule} for ${file}`)
  }
}

async function trackedTextFiles(repositoryRoot) {
  const result = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: repositoryRoot, encoding: "buffer" })
  if (result.status !== 0) throw new Error(`git ls-files failed: ${result.stderr.toString("utf8").trim()}`)
  const names = result.stdout.toString("utf8").split("\0").filter(Boolean).map((name) => name.replaceAll("\\", "/"))
  const files = []
  for (const name of names) {
    if (name === SELF || name === ALLOWLIST_PATH) continue
    const data = await readFile(path.join(repositoryRoot, name))
    if (data.includes(0)) continue
    files.push({ path: name, content: data.toString("utf8") })
  }
  return files
}

function literalMatches(content, value) {
  const matches = []
  for (let index = content.indexOf(value); index !== -1; index = content.indexOf(value, index + value.length)) matches.push(index)
  return matches
}

function regexMatches(content, expression) {
  return [...content.matchAll(expression)].map((match) => match.index ?? 0)
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function lineNumber(content, index) {
  return content.slice(0, index).split("\n").length
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const allowlist = JSON.parse(await readFile(path.join(repositoryRoot, ALLOWLIST_PATH), "utf8"))
  const violations = findTopologyViolations(await trackedTextFiles(repositoryRoot), allowlist)
  if (violations.length) {
    console.error("Production topology consistency check failed:")
    for (const violation of violations) console.error(`- ${violation.path}:${violation.line} [${violation.rule}] ${violation.description}`)
    process.exitCode = 1
    return
  }
  console.log(`Production topology consistency check passed. Root: ${CANONICAL_ROOT}; admin: ${CANONICAL_ADMIN_ORIGIN}.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
