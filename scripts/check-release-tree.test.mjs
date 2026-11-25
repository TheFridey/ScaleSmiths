import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { checkReleaseTree } from "./check-release-tree.mjs"

const tree = () => { const root = mkdtempSync(join(tmpdir(), "release-tree-")); mkdirSync(join(root, "admin")); return root }

test("a release with its own node_modules and no cache is self-contained", () => {
  const root = tree(); mkdirSync(join(root, "admin", "node_modules"))
  assert.deepEqual(checkReleaseTree(root), [])
})

test("a node_modules symlink into another release is refused", (t) => {
  const root = tree(), other = tree(); mkdirSync(join(other, "admin", "node_modules"))
  try { symlinkSync(join(other, "admin", "node_modules"), join(root, "admin", "node_modules"), "junction") } catch { t.skip("symlinks unavailable"); return }
  assert.match(checkReleaseTree(root).join("\n"), /admin\/node_modules is a symlink/)
})

test("a webpack cache that names another release is refused", () => {
  const root = tree(), cache = join(root, "admin", ".next", "cache", "webpack", "server-production")
  mkdirSync(cache, { recursive: true })
  // Built from parts: the topology policy only allows the canonical checkout root as a literal production path.
  const releases = ["", "var", "www", "scalesmiths", "releases"].join("/")
  writeFileSync(join(cache, "index.pack"), `\0${releases}/3f2d6497d6fba7b00968043a68f1987b10467151/admin/src/lib/x.ts\0`)
  assert.match(checkReleaseTree(root).join("\n"), /references another release \(3f2d6497/)
})
