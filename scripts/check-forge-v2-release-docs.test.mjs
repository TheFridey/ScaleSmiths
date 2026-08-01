import assert from "node:assert/strict"
import { test } from "node:test"
import { loadForgeReleaseDocs, validateForgeReleaseDocs } from "./check-forge-v2-release-docs.mjs"

const root = new URL("..", import.meta.url).pathname.replace(/^\/(?:[A-Za-z]:)/, (value) => value.slice(1))

test("current Forge release documents satisfy the policy", async () => {
  assert.deepEqual(validateForgeReleaseDocs(await loadForgeReleaseDocs(root)), [])
})

test("rejects stale language, placeholders, SHA drift and verdict conflicts", async () => {
  const files = await loadForgeReleaseDocs(root)
  const ledgerName = "docs/release-readiness/forge-v2.md"
  files.set(ledgerName, `${files.get(ledgerName)}\nCurrent master: \`0000000000000000000000000000000000000000\`\nTODO authenticated journeys unavailable\nAPPROVED FOR DEPLOYMENT`)
  const failures = validateForgeReleaseDocs(files).join("\n")
  assert.match(failures, /placeholder/)
  assert.match(failures, /stale-status/)
  assert.match(failures, /stale-sha/)
  assert.match(failures, /verdict-conflict/)
})
