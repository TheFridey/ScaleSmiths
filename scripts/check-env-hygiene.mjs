import { execFileSync } from "node:child_process"
import { readdirSync } from "node:fs"
import path from "node:path"
import process from "node:process"

/*
 * Env hygiene check.
 *
 * Real env files (.env, .env.local, .env.production, ...) must never enter the repository
 * or any archive/export surface — only *.env.example may be committed. A developer's local,
 * git-ignored .env is fine and must NOT fail the check.
 *
 * Default mode (no args): inspect the git "surface" of the current repo — every tracked file
 * plus every untracked file that is not git-ignored. Those are exactly the files that would be
 * committed, `git archive`d, or copied into a Docker/zip export. A real env file there fails.
 *
 * Directory mode (`node check-env-hygiene.mjs <dir>`): recursively scan an arbitrary directory
 * (e.g. the extracted contents of an export ZIP) and fail on any real env file found.
 */

const IGNORED_WALK_DIRS = new Set([".git", ".next", ".turbo", "dist", "node_modules", "coverage"])

function isRealEnvFile(name) {
  if (name === ".env.example" || name.endsWith(".env.example")) return false
  return name === ".env" || name.startsWith(".env.")
}

function basename(filePath) {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

function gitSurfaceFiles(cwd) {
  const run = (args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 })
      .split("\0")
      .map((entry) => entry.trim())
      .filter(Boolean)

  // Tracked files + untracked-but-not-ignored files = the committable / archivable surface.
  const tracked = run(["ls-files", "-z"])
  const untracked = run(["ls-files", "--others", "--exclude-standard", "-z"])
  return [...new Set([...tracked, ...untracked])]
}

function walkAllFiles(dir, root, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!IGNORED_WALK_DIRS.has(entry.name)) walkAllFiles(full, root, out)
      continue
    }
    if (entry.isFile()) out.push(path.relative(root, full))
  }
}

function collectFiles() {
  const targetArg = process.argv[2]
  if (targetArg) {
    const root = path.resolve(targetArg)
    const files = []
    walkAllFiles(root, root, files)
    return { mode: `directory ${path.relative(process.cwd(), root) || "."}`, files }
  }

  try {
    return { mode: "git surface", files: gitSurfaceFiles(process.cwd()) }
  } catch {
    // Not a git repo (or git unavailable): fall back to a strict tree walk.
    const root = process.cwd()
    const files = []
    walkAllFiles(root, root, files)
    return { mode: "tree walk (git unavailable)", files }
  }
}

const { mode, files } = collectFiles()
const violations = files.filter((file) => isRealEnvFile(basename(file))).sort()

if (violations.length) {
  console.error(`Env hygiene check FAILED (${mode}). Real env files must not be in the repo/archive surface:`)
  for (const file of violations) console.error(`  - ${file}`)
  console.error("Keep only *.env.example in source control, and ensure real env files are git-ignored.")
  process.exit(1)
}

console.log(`Env hygiene check passed (${mode}): no real .env files in the surface.`)
