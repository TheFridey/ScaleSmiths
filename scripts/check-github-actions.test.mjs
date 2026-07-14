import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { loadWorkflowSet, validateWorkflowSet } from "./check-github-actions.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("accepts the repository GitHub Actions policy", async () => {
  const workflows = await loadWorkflowSet(root)
  assert.deepEqual(validateWorkflowSet(workflows, root), [])
})

test("rejects a root lockfile cache and silent required-gate skips", async () => {
  const workflows = await loadWorkflowSet(root)
  const mutated = workflows.map((workflow) => workflow.name === "ci.yml" ? {
    ...workflow,
    content: `${workflow.content}\ncache-dependency-path: package-lock.json\n# Skipping admin lint`,
  } : workflow)
  const failures = validateWorkflowSet(mutated, root)
  assert(failures.some((failure) => failure.startsWith("[root-lockfile]")))
  assert(failures.some((failure) => failure.startsWith("[silent-skip]")))
})

test("rejects required jobs without explicit timeouts", async () => {
  const workflows = await loadWorkflowSet(root)
  const mutated = workflows.map((workflow) => workflow.name === "codeql.yml" ? {
    ...workflow,
    content: workflow.content.replace(/^    timeout-minutes:.*\n/m, ""),
  } : workflow)
  assert(validateWorkflowSet(mutated, root).some((failure) => failure === "[timeout] codeql.yml job analyze has no timeout-minutes"))
})

test("rejects performance budgets after the Playwright development server", async () => {
  const workflows = await loadWorkflowSet(root)
  const mutated = workflows.map((workflow) => workflow.name === "ci.yml" ? {
    ...workflow,
    content: workflow.content
      .replace("      - name: Public performance budgets\n        run: npm run check:performance-budgets\n\n", "")
      .replace("      - name: Chromium journeys and visual regression", "      - name: Public performance budgets\n        run: npm run check:performance-budgets\n\n      - name: Chromium journeys and visual regression"),
  } : workflow)
  assert(validateWorkflowSet(mutated, root).some((failure) => failure.startsWith("[build-artifact-order]")))
})
