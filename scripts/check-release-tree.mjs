#!/usr/bin/env node
// B2.11 release-tree preflight. Run from (or point at) a release directory BEFORE `npm ci` / `next build`:
//
//   node scripts/check-release-tree.mjs [releaseDir]
//
// The 25 November 2026 hotfix tree failed "Collecting page data" (TypeError in Object.values for
// /api/ascend/v1/operations/[id]/cancel) because admin/node_modules was a symlink into the live release and
// admin/.next/cache held that release's webpack cache. Webpack resolved Next and React through the other
// tree's real paths, the root-owned domain/ re-exports came out empty, and page-data collection crashed.
// A release must be self-contained: its own installed dependencies and no build cache from another tree.
import { lstatSync, existsSync, readdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

export function checkReleaseTree(root) {
  const problems = []
  for (const app of ["admin", "web"]) {
    const dir = join(root, app)
    if (!existsSync(dir)) continue
    const modules = join(dir, "node_modules")
    if (existsSync(modules) || isLink(modules)) {
      if (lstatSync(modules).isSymbolicLink()) problems.push(`${app}/node_modules is a symlink; install with npm ci inside this release.`)
    }
    const cache = join(dir, ".next", "cache", "webpack")
    if (existsSync(cache)) {
      for (const bundle of readdirSync(cache)) {
        const index = join(cache, bundle, "index.pack")
        if (!existsSync(index)) continue
        const text = readFileSync(index).toString("latin1")
        const foreign = [...text.matchAll(/\/var\/www\/scalesmiths\/releases\/([A-Za-z0-9._-]+)\//g)].map((m) => m[1]).filter((id) => !resolve(root).endsWith(`/${id}`))
        if (foreign.length) problems.push(`${app}/.next/cache/webpack/${bundle} references another release (${[...new Set(foreign)].join(", ")}); delete ${app}/.next before building.`)
      }
    }
  }
  return problems
}

function isLink(path) { try { return lstatSync(path).isSymbolicLink() } catch { return false } }

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("check-release-tree.mjs")) {
  const root = resolve(process.argv[2] ?? process.cwd())
  const problems = checkReleaseTree(root)
  if (problems.length) { for (const p of problems) console.error(`release-tree: ${p}`); process.exit(1) }
  console.log(`release-tree: ${root} is self-contained.`)
}
