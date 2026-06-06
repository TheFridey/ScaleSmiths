import { readdirSync, statSync } from "node:fs"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const ignoredDirs = new Set([".git", ".next", ".turbo", "dist", "node_modules"])
const violations = []

function isRealEnvFile(name) {
  if (name === ".env.example" || name.endsWith(".env.example")) return false
  return name === ".env" || name.startsWith(".env.")
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) {
        walk(path.join(dir, entry.name))
      }
      continue
    }

    if (entry.isFile() && isRealEnvFile(entry.name)) {
      violations.push(path.relative(root, path.join(dir, entry.name)))
    }
  }
}

walk(root)

if (violations.length) {
  console.error("Real env files must not live in the repo tree:")
  for (const file of violations) console.error(`- ${file}`)
  console.error("Keep only .env.example files in source control.")
  process.exit(1)
}

console.log("Env hygiene check passed: no real .env files found.")
