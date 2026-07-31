#!/usr/bin/env node
// Deterministic pull-request metadata check.
//
// Reads the local GitHub event payload through GITHUB_EVENT_PATH. It never calls the
// GitHub API, so it runs safely under the ordinary `pull_request` trigger with
// read-only permissions and no access to untrusted code.
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

// Automated dependency pull requests are opened by bots that cannot fill in a template.
const AUTOMATED_AUTHORS = new Set([
  "dependabot[bot]",
  "dependabot-preview[bot]",
  "renovate[bot]",
  "renovatebot",
])

const EMERGENCY_LABELS = new Set(["emergency-rollback", "emergency", "incident"])

// Text that is present but says nothing.
const PLACEHOLDERS = new Set([
  "-", "--", "*", ".", "...", "…", "n/a", "na", "tbd", "tba", "todo", "wip", "xxx",
  "none yet", "fill me in", "replace me", "describe the change", "your summary here",
])

const GENERIC_TITLES = new Set([
  "update", "updates", "updated", "fix", "fixes", "fixed", "change", "changes", "changed",
  "wip", "test", "tests", "testing", "patch", "misc", "cleanup", "clean up", "stuff",
  "new", "final", "temp", "tmp", "draft", "asdf", "foo", "bar", "work", "commit",
])

const CONVENTIONAL_PREFIX = /^(feat|fix|test|docs|refactor|security|perf|chore|revert|build|ci|style)(\([^)]*\))?!?:\s*/i

export function stripComments(text) {
  return String(text ?? "").replace(/<!--[\s\S]*?-->/g, "")
}

// Splits a markdown body into `## Heading` sections, ignoring headings inside fences.
export function parseSections(body) {
  const sections = new Map()
  let heading = null
  let buffer = []
  let inFence = false

  for (const line of String(body ?? "").split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    const match = inFence ? null : /^##\s+(.+?)\s*$/.exec(line)
    if (match) {
      if (heading !== null) sections.set(heading, buffer.join("\n"))
      heading = match[1].trim().toLowerCase()
      buffer = []
      continue
    }
    if (heading !== null) buffer.push(line)
  }
  if (heading !== null) sections.set(heading, buffer.join("\n"))
  return sections
}

export function checkedOptions(section) {
  return [...stripComments(section).matchAll(/^\s*[-*]\s*\[[xX]\]\s*(.+?)\s*$/gm)].map((match) => match[1].trim())
}

// Prose remaining once comments, checkbox options and fenced blocks are removed.
export function proseOf(section) {
  const withoutFences = stripComments(section).replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "")
  return withoutFences
    .split(/\r?\n/)
    .filter((line) => !/^\s*[-*]\s*\[[ xX]\]/.test(line))
    .join("\n")
    .trim()
}

export function isPlaceholder(text, minimumLength = 1) {
  const normalised = String(text ?? "").trim().toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ")
  if (!normalised) return true
  if (PLACEHOLDERS.has(normalised)) return true
  return normalised.replace(/[^a-z0-9]/g, "").length < minimumLength
}

// Content of the first fenced block following `label` within a section.
export function fencedBlockAfter(section, label) {
  const text = stripComments(section)
  const index = text.toLowerCase().indexOf(label.toLowerCase())
  const scope = index === -1 ? text : text.slice(index)
  const match = /(?:```|~~~)[^\n]*\n([\s\S]*?)(?:```|~~~)/.exec(scope)
  return match ? match[1].trim() : ""
}

function normaliseForComparison(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

export function titleFailures(title, headRef) {
  const failures = []
  const trimmed = String(title ?? "").trim()

  if (!trimmed) {
    failures.push("[title] pull request title is empty")
    return failures
  }

  const subject = trimmed.replace(CONVENTIONAL_PREFIX, "").trim()
  const normalisedSubject = normaliseForComparison(subject)
  const normalisedTitle = normaliseForComparison(trimmed)
  const normalisedBranch = normaliseForComparison(headRef)

  // GitHub's default title is the branch name in sentence case, e.g. "Release/forge v2 rc".
  if (normalisedBranch && (normalisedTitle === normalisedBranch || normalisedSubject === normalisedBranch)) {
    failures.push(`[title] title is GitHub's default branch-name title ("${trimmed}"); describe the change instead`)
  }
  if (GENERIC_TITLES.has(normalisedSubject)) {
    failures.push(`[title] title "${trimmed}" is too generic to review`)
  }
  if (normalisedSubject.replace(/\s/g, "").length < 12) {
    failures.push(`[title] title "${trimmed}" is too short to describe the change`)
  }
  if (normalisedSubject && normalisedSubject.split(" ").filter(Boolean).length < 3) {
    failures.push(`[title] title "${trimmed}" needs at least three words of description`)
  }

  return failures
}

export function classify(pullRequest) {
  const author = String(pullRequest.author ?? "").toLowerCase()
  const title = String(pullRequest.title ?? "")
  const labels = (pullRequest.labels ?? []).map((label) => String(label).toLowerCase())

  if (AUTOMATED_AUTHORS.has(author)) {
    return { exemption: "automated-dependency", reason: `automated dependency pull request opened by ${pullRequest.author}` }
  }
  if (labels.some((label) => EMERGENCY_LABELS.has(label)) || /^(revert|rollback)[:(\s]/i.test(title.trim())) {
    return { exemption: "emergency-rollback", reason: "emergency rollback or revert pull request" }
  }

  const scopes = checkedOptions(parseSections(pullRequest.body).get("scope") ?? "")
  const documentationOnly = scopes.length > 0 && scopes.every((scope) => /documentation only/i.test(scope))
  return { exemption: null, documentationOnly, reason: documentationOnly ? "documentation-only scope" : "" }
}

export function validatePullRequestMetadata(pullRequest) {
  const failures = []
  const { exemption, documentationOnly } = classify(pullRequest)

  // Bots cannot complete a human template; the dependency gates still apply to them.
  if (exemption === "automated-dependency") return failures

  failures.push(...titleFailures(pullRequest.title, pullRequest.headRef))

  const sections = parseSections(pullRequest.body)
  const section = (name) => sections.get(name) ?? null

  const require = (name) => {
    const value = section(name)
    if (value === null) {
      failures.push(`[section] body is missing the "## ${name}" section from the pull request template`)
      return null
    }
    return value
  }

  const summary = require("summary")
  if (summary !== null && isPlaceholder(proseOf(summary), 25)) {
    failures.push("[summary] Summary is empty or placeholder text; describe what changed and why")
  }

  // An emergency rollback needs to be identifiable and reviewable after the fact,
  // but must not be blocked on the full release template during an incident.
  if (exemption === "emergency-rollback") return failures

  const type = require("type")
  if (type !== null && checkedOptions(type).length === 0) {
    failures.push("[type] select at least one Type option")
  }

  const scope = require("scope")
  if (scope !== null && checkedOptions(scope).length === 0) {
    failures.push("[scope] select at least one Scope option")
  }

  const validation = require("validation")
  if (validation !== null) {
    const commandsRun = fencedBlockAfter(validation, "Commands run")
    const commandsSkipped = fencedBlockAfter(validation, "Commands not run")
    const hasRun = !isPlaceholder(commandsRun, 3)
    const hasSkipped = !isPlaceholder(commandsSkipped, 3)
    if (documentationOnly) {
      // A docs-only change may genuinely have no commands to run, but must say so.
      if (!hasRun && !hasSkipped) {
        failures.push("[validation] record the commands you ran, or state in \"Commands not run\" why none applied")
      }
    } else if (!hasRun) {
      failures.push("[validation] record the validation commands you actually ran and their results")
    }
  }

  const migrations = require("migrations")
  if (migrations !== null && checkedOptions(migrations).length === 0) {
    failures.push("[migrations] declare either no database migration or an included migration")
  }

  const environment = require("environment")
  if (environment !== null && checkedOptions(environment).length === 0) {
    failures.push("[environment] declare either no environment-variable change or the variables added")
  }

  const security = require("security and privacy")
  if (security !== null) {
    const total = [...stripComments(security).matchAll(/^\s*[-*]\s*\[[ xX]\]/gm)].length
    if (checkedOptions(security).length < total || total === 0) {
      failures.push("[security] complete every Security and Privacy declaration")
    }
  }

  // Evidence is waived only for a declared documentation-only change.
  if (!documentationOnly) {
    const evidence = require("evidence")
    if (evidence !== null && isPlaceholder(proseOf(evidence), 3)) {
      failures.push("[evidence] attach screenshots, run IDs, logs or artifact links, or state why evidence is not applicable")
    }
  }

  const residual = require("residual risk and follow-up")
  if (residual !== null && isPlaceholder(proseOf(residual), 3)) {
    failures.push("[residual-risk] state the residual risks and follow-up explicitly, or write \"None\"")
  }

  if (!documentationOnly) {
    const rollback = require("rollback")
    if (rollback !== null && isPlaceholder(proseOf(rollback), 3)) {
      failures.push("[rollback] describe how to undo this change, or state \"Not applicable\" and why")
    }
  }

  return failures
}

export function pullRequestFromEvent(event) {
  const pullRequest = event?.pull_request
  if (!pullRequest) return null
  return {
    number: pullRequest.number,
    title: pullRequest.title ?? "",
    body: pullRequest.body ?? "",
    author: pullRequest.user?.login ?? "",
    headRef: pullRequest.head?.ref ?? "",
    baseRef: pullRequest.base?.ref ?? "",
    labels: (pullRequest.labels ?? []).map((label) => label?.name ?? String(label)),
  }
}

export async function loadEvent(eventPath) {
  return JSON.parse(await readFile(eventPath, "utf8"))
}

async function main() {
  const explicit = process.argv.indexOf("--event")
  const eventPath = explicit !== -1 ? process.argv[explicit + 1] : process.env.GITHUB_EVENT_PATH

  if (!eventPath) {
    console.error(
      "Pull request metadata check requires a GitHub event payload.\n" +
        "In CI this is provided by GITHUB_EVENT_PATH on pull_request events.\n" +
        "Locally, run: node scripts/check-pr-metadata.mjs --event <path-to-event.json>",
    )
    process.exitCode = 1
    return
  }

  const event = await loadEvent(eventPath)
  const pullRequest = pullRequestFromEvent(event)
  if (!pullRequest) {
    console.error(`Pull request metadata check found no pull_request in the event payload at ${eventPath}.`)
    process.exitCode = 1
    return
  }

  const { exemption, reason } = classify(pullRequest)
  const failures = validatePullRequestMetadata(pullRequest)

  if (failures.length) {
    console.error(
      `Pull request metadata check failed for #${pullRequest.number}:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n\n` +
        "Update the pull request title or body to match .github/PULL_REQUEST_TEMPLATE.md, then push or re-run this check.",
    )
    process.exitCode = 1
    return
  }

  const note = exemption ? ` (documented exception: ${reason})` : reason ? ` (${reason})` : ""
  console.log(`Pull request metadata check passed for #${pullRequest.number}${note}.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
