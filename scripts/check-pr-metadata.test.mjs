import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  checkedOptions,
  classify,
  fencedBlockAfter,
  parseSections,
  stripComments,
  titleFailures,
  validatePullRequestMetadata,
} from "./check-pr-metadata.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const REQUIRED_SECTIONS = [
  "summary",
  "type",
  "scope",
  "validation",
  "migrations",
  "environment",
  "security and privacy",
  "evidence",
  "residual risk and follow-up",
  "rollback",
]

function body(overrides = {}) {
  const parts = {
    summary: "Corrects the Forge V2 release ledger and adds a deterministic pull request metadata check.",
    type: "- [ ] `feat`\n- [x] `chore`",
    scope: "- [x] CI/tooling\n- [ ] Admin",
    commandsRun: "npm run check:github-actions - passed\nnpm run test:pr-metadata - passed",
    commandsSkipped: "",
    migrations: "- [x] No database migration.\n- [ ] Migration included and documented below.",
    environment: "- [x] No environment-variable change.\n- [ ] Environment variables added.",
    security: "- [x] No secrets are included.\n- [x] Access control is preserved.\n- [x] Analytics remains minimised.",
    evidence: "CI run 30588532289 and Security run 30588532278.",
    residual: "None.",
    rollback: "Revert the commit; no runtime behaviour changes.",
    ...overrides,
  }

  return [
    `## Summary\n\n${parts.summary}`,
    `## Type\n\n${parts.type}`,
    `## Scope\n\n${parts.scope}`,
    `## Validation\n\nCommands run, with results:\n\n\`\`\`text\n${parts.commandsRun}\n\`\`\`\n\nCommands not run, and why:\n\n\`\`\`text\n${parts.commandsSkipped}\n\`\`\``,
    `## Migrations\n\n${parts.migrations}`,
    `## Environment\n\n${parts.environment}`,
    `## Security and Privacy\n\n${parts.security}`,
    `## Evidence\n\n${parts.evidence}`,
    `## Residual Risk and Follow-up\n\n${parts.residual}`,
    `## Rollback\n\n${parts.rollback}`,
  ].join("\n\n")
}

function pullRequest(overrides = {}) {
  return {
    number: 36,
    title: "chore(release): close Forge V2 governance gaps",
    body: body(),
    author: "TheFridey",
    headRef: "chore/forge-v2-release-closure",
    baseRef: "master",
    labels: [],
    ...overrides,
  }
}

test("accepts a fully completed pull request", () => {
  assert.deepEqual(validatePullRequestMetadata(pullRequest()), [])
})

test("the repository template still provides every section the check requires", async () => {
  const template = await readFile(path.join(root, ".github", "PULL_REQUEST_TEMPLATE.md"), "utf8")
  const sections = parseSections(template)
  for (const heading of REQUIRED_SECTIONS) {
    assert(sections.has(heading), `PULL_REQUEST_TEMPLATE.md is missing the "## ${heading}" section`)
  }
})

test("an unmodified template is rejected, so the check cannot pass on boilerplate", async () => {
  const template = await readFile(path.join(root, ".github", "PULL_REQUEST_TEMPLATE.md"), "utf8")
  const failures = validatePullRequestMetadata(pullRequest({ body: template }))
  assert(failures.some((failure) => failure.startsWith("[summary]")))
  assert(failures.some((failure) => failure.startsWith("[type]")))
  assert(failures.some((failure) => failure.startsWith("[scope]")))
  assert(failures.some((failure) => failure.startsWith("[validation]")))
})

test("rejects GitHub's default branch-name title", () => {
  const failures = validatePullRequestMetadata(pullRequest({ title: "Release/forge v2 rc", headRef: "release/forge-v2-rc" }))
  assert(failures.some((failure) => failure.startsWith("[title] title is GitHub's default branch-name title")))
})

test("rejects generic and too-short titles", () => {
  assert(titleFailures("Update", "feature/x").some((failure) => failure.startsWith("[title]")))
  assert(titleFailures("fix: wip", "feature/x").some((failure) => failure.startsWith("[title]")))
  assert(titleFailures("", "feature/x").some((failure) => failure.startsWith("[title]")))
  assert.deepEqual(titleFailures("fix(web): prevent homepage preference flash", "fix/web-flash"), [])
})

test("rejects placeholder summary text", () => {
  for (const summary of ["", "-", "TBD", "TODO"]) {
    const failures = validatePullRequestMetadata(pullRequest({ body: body({ summary }) }))
    assert(failures.some((failure) => failure.startsWith("[summary]")), `expected "${summary}" to be rejected`)
  }
})

test("requires a Type and a Scope selection", () => {
  const noType = validatePullRequestMetadata(pullRequest({ body: body({ type: "- [ ] `feat`\n- [ ] `chore`" }) }))
  assert(noType.some((failure) => failure.startsWith("[type]")))

  const noScope = validatePullRequestMetadata(pullRequest({ body: body({ scope: "- [ ] Admin\n- [ ] Forge" }) }))
  assert(noScope.some((failure) => failure.startsWith("[scope]")))
})

test("requires validation commands to be recorded", () => {
  const failures = validatePullRequestMetadata(pullRequest({ body: body({ commandsRun: "" }) }))
  assert(failures.some((failure) => failure.startsWith("[validation]")))
})

test("requires a migration and an environment declaration", () => {
  const noMigration = validatePullRequestMetadata(pullRequest({ body: body({ migrations: "- [ ] No database migration." }) }))
  assert(noMigration.some((failure) => failure.startsWith("[migrations]")))

  const noEnvironment = validatePullRequestMetadata(pullRequest({ body: body({ environment: "- [ ] No environment-variable change." }) }))
  assert(noEnvironment.some((failure) => failure.startsWith("[environment]")))
})

test("requires every security declaration to be completed", () => {
  const partial = "- [x] No secrets are included.\n- [ ] Access control is preserved.\n- [x] Analytics remains minimised."
  const failures = validatePullRequestMetadata(pullRequest({ body: body({ security: partial }) }))
  assert(failures.some((failure) => failure.startsWith("[security]")))
})

test("requires residual risk to be explicit but accepts None", () => {
  const empty = validatePullRequestMetadata(pullRequest({ body: body({ residual: "" }) }))
  assert(empty.some((failure) => failure.startsWith("[residual-risk]")))
  assert.deepEqual(validatePullRequestMetadata(pullRequest({ body: body({ residual: "None" }) })), [])
})

test("requires evidence and rollback for a non-documentation change", () => {
  const failures = validatePullRequestMetadata(pullRequest({ body: body({ evidence: "", rollback: "" }) }))
  assert(failures.some((failure) => failure.startsWith("[evidence]")))
  assert(failures.some((failure) => failure.startsWith("[rollback]")))
})

test("rejects a body that does not use the template at all", () => {
  const failures = validatePullRequestMetadata(pullRequest({ body: "Fixed some things." }))
  for (const heading of REQUIRED_SECTIONS) {
    assert(failures.some((failure) => failure === `[section] body is missing the "## ${heading}" section from the pull request template`))
  }
})

test("exempts automated dependency pull requests", () => {
  for (const author of ["dependabot[bot]", "renovate[bot]"]) {
    const automated = pullRequest({ author, title: "Bump eslint from 10.6.0 to 10.7.0", body: "Bumps eslint.", headRef: "dependabot/npm_and_yarn/admin/eslint-10.7.0" })
    assert.equal(classify(automated).exemption, "automated-dependency")
    assert.deepEqual(validatePullRequestMetadata(automated), [])
  }
})

test("exempts emergency rollbacks from the full template but still requires a summary", () => {
  const rollback = pullRequest({
    title: "revert: restore previous admin release after auth regression",
    body: "## Summary\n\nReverts the admin release because logout stopped invalidating sessions in production.",
    labels: ["emergency-rollback"],
  })
  assert.equal(classify(rollback).exemption, "emergency-rollback")
  assert.deepEqual(validatePullRequestMetadata(rollback), [])

  const empty = { ...rollback, body: "## Summary\n\n-" }
  assert(validatePullRequestMetadata(empty).some((failure) => failure.startsWith("[summary]")))
})

test("waives evidence and rollback for a declared documentation-only change", () => {
  const docs = pullRequest({
    title: "docs(release): record Dependency Review verification",
    body: body({ scope: "- [x] Documentation only", evidence: "", rollback: "", commandsRun: "", commandsSkipped: "No executable files changed." }),
  })
  assert.equal(classify(docs).documentationOnly, true)
  assert.deepEqual(validatePullRequestMetadata(docs), [])
})

test("a documentation-only change must still account for validation", () => {
  const docs = pullRequest({
    title: "docs(release): record Dependency Review verification",
    body: body({ scope: "- [x] Documentation only", evidence: "", rollback: "", commandsRun: "", commandsSkipped: "" }),
  })
  assert(validatePullRequestMetadata(docs).some((failure) => failure.startsWith("[validation]")))
})

test("a mixed documentation and code change is not treated as documentation-only", () => {
  const mixed = pullRequest({ body: body({ scope: "- [x] Documentation only\n- [x] CI/tooling", evidence: "", rollback: "" }) })
  assert.equal(classify(mixed).documentationOnly, false)
  const failures = validatePullRequestMetadata(mixed)
  assert(failures.some((failure) => failure.startsWith("[evidence]")))
})

test("section parsing ignores markdown headings inside fenced blocks", () => {
  const sections = parseSections("## Summary\n\nReal summary text.\n\n```text\n## Type\nnot a heading\n```\n\n## Rollback\n\nRevert.")
  assert.deepEqual([...sections.keys()], ["summary", "rollback"])
})

test("checkbox and fenced-block helpers ignore commented-out template guidance", () => {
  assert.deepEqual(checkedOptions("<!-- - [x] commented -->\n- [x] Real option\n- [ ] Unselected"), ["Real option"])
  assert.equal(fencedBlockAfter("Commands run:\n\n```text\nnpm test\n```", "Commands run"), "npm test")
})

test("comment stripping leaves no comment marker behind", () => {
  // A single replace pass splices the text on either side of a removed comment, which
  // can produce a brand new "<!--" that then survives the strip.
  for (const input of [
    "<!--<!-- - [x] hidden -->-->",
    "<!<!-- x -->!-- - [x] visible -->",
    "before <!-- unterminated - [x] hidden",
    "<!-- a --><!-- b -->visible",
    "<!--<!--<!-- deep -->-->-->",
  ]) {
    assert(!stripComments(input).includes("<!--"), `"${input}" left a comment marker`)
  }
})

test("comment stripping removes genuinely hidden content but keeps rendered text", () => {
  // Nested and unterminated comments hide their content when the body is rendered.
  assert(!/hidden/.test(stripComments("<!--<!-- - [x] hidden -->-->")))
  assert(!/hidden/.test(stripComments("before <!-- unterminated - [x] hidden")))
  assert.equal(stripComments("before <!-- unterminated"), "before ")

  // This one renders as visible text, so it must not be silently discarded.
  assert(/visible/.test(stripComments("<!<!-- x -->!-- - [x] visible -->")))

  assert.equal(stripComments("<!-- a --><!-- b -->visible"), "visible")
  assert.equal(stripComments("plain text"), "plain text")
})

test("a summary made only of commented-out guidance is rejected", () => {
  const hidden = validatePullRequestMetadata(pullRequest({ body: body({ summary: "<!--<!-- Describe the change here -->-->" }) }))
  assert(hidden.some((failure) => failure.startsWith("[summary]")))
})
