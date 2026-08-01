import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import { loadWorkflowSet, validateSetupNodeCaching, validateWorkflowSet } from "./check-github-actions.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

test("accepts the repository GitHub Actions policy", async () => {
  const workflows = await loadWorkflowSet(root)
  assert.deepEqual(validateWorkflowSet(workflows, root), [])
})

const setupNode = (configuration, context = "") => `${context}
    steps:
      - name: Setup Node
        uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0
        with:
          node-version: 22
${configuration}
      - name: Next step
        run: node --version
`

test("accepts explicit web, admin, two-lockfile and cache-disabled setup-node configurations", () => {
  const cases = [
    setupNode("          cache: npm\n          cache-dependency-path: web/package-lock.json", "    defaults:\n      run:\n        working-directory: web"),
    setupNode("          cache: npm\n          cache-dependency-path: admin/package-lock.json", "    defaults:\n      run:\n        working-directory: admin"),
    setupNode("          cache: npm\n          cache-dependency-path: |\n            web/package-lock.json\n            admin/package-lock.json", "    run: npm --prefix web ci && npm --prefix admin ci"),
    setupNode("          package-manager-cache: false"),
  ]
  for (const fixture of cases) assert.deepEqual(validateSetupNodeCaching(fixture, root, "fixture"), [])
})

test("rejects setup-node automatic root caching and enabled caching without a lockfile path", () => {
  const automatic = validateSetupNodeCaching(setupNode(""), root, "automatic")
  assert(automatic.some((failure) => failure.startsWith("[setup-node-cache]")))
  assert(automatic.some((failure) => failure.startsWith("[setup-node-cache-path]")))
  const missing = validateSetupNodeCaching(setupNode("          cache: npm"), root, "missing path")
  assert(missing.some((failure) => failure.startsWith("[setup-node-cache-path]")))
})

test("rejects an application cache pointed at the wrong lockfile", () => {
  const fixture = setupNode("          cache: npm\n          cache-dependency-path: admin/package-lock.json", "    defaults:\n      run:\n        working-directory: web")
  assert(validateSetupNodeCaching(fixture, root, "web fixture").some((failure) => failure.includes("must cache web/package-lock.json")))
})

test("rejects introducing a root package-lock.json", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "scalesmiths-actions-policy-"))
  try {
    await writeFile(path.join(temporaryRoot, "package-lock.json"), "{}\n")
    const workflows = await loadWorkflowSet(root)
    assert(validateWorkflowSet(workflows, temporaryRoot).some((failure) => failure === "[root-lockfile] the repository must not contain a root package-lock.json"))
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
  }
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
    content: workflow.content.replace(/^ {4}timeout-minutes:[^\r\n]*(?:\r?\n)?/m, ""),
  } : workflow)
  assert(validateWorkflowSet(mutated, root).some((failure) => failure === "[timeout] codeql.yml job analyze has no timeout-minutes"))
})

test("rejects missing release triggers, mutable actions and unpinned npm", async () => {
  const workflows = await loadWorkflowSet(root)
  const mutated = workflows.map((workflow) => workflow.name === "ci.yml" ? {
    ...workflow,
    content: workflow.content
      .replace("branches: [master, release/forge-v2-rc]", "branches: [master]")
      .replace(/actions\/checkout@[0-9a-f]{40}/, "actions/checkout@v4")
      .replace("npm install --global npm@10.9.2", "npm --version"),
  } : workflow)
  const failures = validateWorkflowSet(mutated, root)
  assert(failures.some((failure) => failure.startsWith("[release-trigger] ci.yml")))
  assert(failures.some((failure) => failure.startsWith("[action-pin] ci.yml")))
  assert(failures.some((failure) => failure.startsWith("[npm-version] ci.yml")))
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

test("rejects mutable security action references and duplicate TruffleHog failure flags", async () => {
  const workflows = await loadWorkflowSet(root)
  const mutated = workflows.map((workflow) => workflow.name === "security.yml" ? {
    ...workflow,
    content: workflow.content
      .replace(/actions\/checkout@[0-9a-f]{40}/, "actions/checkout@v4")
      .replace("extra_args: --results=verified", "extra_args: --results=verified --fail"),
  } : workflow)
  const failures = validateWorkflowSet(mutated, root)
  assert(failures.some((failure) => failure.startsWith("[action-pin]")))
  assert(failures.some((failure) => failure.startsWith("[trufflehog-arguments]")))
})

test("rejects immutable but deprecated JavaScript action runtimes", async () => {
  const workflows = await loadWorkflowSet(root)
  const mutated = workflows.map((workflow) => workflow.name === "ci.yml" ? {
    ...workflow,
    content: workflow.content.replace(
      "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803",
      "actions/checkout@11d5960a326750d5838078e36cf38b85af677262",
    ),
  } : workflow)
  assert(validateWorkflowSet(mutated, root).some((failure) => failure.startsWith("[action-runtime]")))
})

test("rejects removing the pull request metadata gate", async () => {
  const workflows = await loadWorkflowSet(root)
  const mutated = workflows.map((workflow) => workflow.name === "ci.yml" ? {
    ...workflow,
    content: workflow.content
      .replace(/^ {2}pr-metadata:\s*$/m, "  pr-metadata-disabled:")
      .replace("      - name: Check pull request metadata\n        run: npm run check:pr-metadata\n", "")
      .replace("      - name: Test pull request metadata rules\n        run: npm run test:pr-metadata\n", ""),
  } : workflow)
  const failures = validateWorkflowSet(mutated, root)
  assert(failures.some((failure) => failure === "[pr-metadata] ci.yml must define the pr-metadata job"))
  assert(failures.some((failure) => failure === "[required-gate] ci.yml is missing npm run check:pr-metadata"))
  assert(failures.some((failure) => failure === "[required-gate] ci.yml is missing npm run test:pr-metadata"))
})

test("rejects widening the pull request metadata gate beyond pull_request events", async () => {
  const workflows = await loadWorkflowSet(root)
  const mutated = workflows.map((workflow) => workflow.name === "ci.yml" ? {
    ...workflow,
    content: workflow.content.replace("    if: github.event_name == 'pull_request'\n", ""),
  } : workflow)
  assert(validateWorkflowSet(mutated, root).some((failure) => failure === "[pr-metadata] ci.yml pr-metadata job must run only for pull_request events"))
})

test("rejects Trivy enforcement before evidence upload", async () => {
  const workflows = await loadWorkflowSet(root)
  const mutated = workflows.map((workflow) => workflow.name === "security.yml" ? {
    ...workflow,
    content: workflow.content.replace("- name: Enforce HIGH and CRITICAL image vulnerability threshold", "- name: Upload container scan and SBOM duplicate marker"),
  } : workflow)
  assert(validateWorkflowSet(mutated, root).some((failure) => failure.startsWith("[trivy-evidence-order]")))
})
