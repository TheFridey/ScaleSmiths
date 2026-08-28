#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const MATRIX_VALUES = {
  "security.yml:npm-audit": ["web", "admin"],
  "security.yml:dockerfile-lint": ["web", "admin"],
  "security.yml:images": ["web", "admin"],
}

export async function validateBranchProtectionContract(repositoryRoot) {
  const failures = []
  const policy = JSON.parse(await readFile(path.join(repositoryRoot, "scripts", "branch-protection-policy.json"), "utf8"))
  const codeowners = await readFile(path.join(repositoryRoot, ".github", "CODEOWNERS"), "utf8")
  const docs = await readFile(path.join(repositoryRoot, "docs", "operations", "protected-areas-and-branch-protection.md"), "utf8")
  const workflowNames = new Map()
  const actualChecks = []

  for (const file of ["ci.yml", "security.yml", "codeql.yml"]) {
    const content = (await readFile(path.join(repositoryRoot, ".github", "workflows", file), "utf8")).replace(/\r\n/g, "\n")
    const workflowName = content.match(/^name:\s*(.+)$/m)?.[1]?.trim()
    if (!workflowName) {
      failures.push(`[workflow-name] ${file} must have a stable top-level name`)
      continue
    }
    if (workflowNames.has(workflowName)) failures.push(`[workflow-name] duplicate workflow name ${workflowName}`)
    workflowNames.set(workflowName, file)
    const jobs = workflowJobs(content)
    for (const job of jobs) {
      const jobName = job.content.match(/^ {4}name:\s*(.+)$/m)?.[1]?.trim()
      if (!jobName) {
        failures.push(`[job-name] ${file} job ${job.id} must have a stable explicit name`)
        continue
      }
      const matrix = MATRIX_VALUES[`${file}:${job.id}`]
      if (matrix) {
        for (const value of matrix) actualChecks.push(jobName.replace("${{ matrix.app }}", value))
      } else {
        if (jobName.includes("${{")) failures.push(`[job-name] ${file} job ${job.id} has an untracked dynamic name`)
        actualChecks.push(jobName)
      }
    }
  }

  if (policy.branch !== "master") failures.push("[branch] policy must protect master")
  for (const setting of ["dismissStaleReviews", "requireCodeOwnerReviews", "requireLastPushApproval", "requireConversationResolution", "requireUpToDateBranch"]) {
    if (policy[setting] !== true) failures.push(`[setting] ${setting} must be true`)
  }
  if (policy.requiredApprovingReviewCount < 1) failures.push("[setting] at least one approving review is required")
  if (policy.enforceForAdministrators !== false) failures.push("[setting] administrator bypass must remain available only for the documented emergency process")
  if (policy.allowForcePushes !== false) failures.push("[setting] force pushes must be prohibited")
  if (policy.allowDeletions !== false) failures.push("[setting] branch deletion must be prohibited")

  const required = policy.requiredStatusChecks ?? []
  if (new Set(actualChecks).size !== actualChecks.length) failures.push("[status-check] workflow job names must be globally unique")
  if (new Set(required).size !== required.length) failures.push("[status-check] required status checks must be unique")
  for (const check of actualChecks) if (!required.includes(check)) failures.push(`[status-check] policy is missing ${check}`)
  for (const check of required) {
    if (!actualChecks.includes(check)) failures.push(`[status-check] policy references missing workflow check ${check}`)
    if (!docs.includes(`\`${check}\``)) failures.push(`[documentation] required check is not documented: ${check}`)
  }

  for (const pattern of [
    "/.github/", "/CONTRIBUTING.md", "/SECURITY.md", "/scripts/branch-protection-policy.json",
    "/scripts/check-branch-protection-policy.mjs", "/scripts/check-github-actions.mjs", "/scripts/backup/",
    "/web/drizzle/", "/admin/drizzle/", "/admin/src/app/api/auth/", "/admin/src/app/api/forge/",
    "/admin/src/app/api/invoices/", "/admin/src/app/(protected)/finance/",
  ]) {
    if (!codeowners.split(/\r?\n/).some((line) => line.trim().startsWith(`${pattern} `))) {
      failures.push(`[codeowners] missing explicit sensitive-path coverage for ${pattern}`)
    }
  }
  return failures
}

function workflowJobs(content) {
  const jobsIndex = content.search(/^jobs:\s*$/m)
  if (jobsIndex === -1) return []
  const jobsContent = content.slice(jobsIndex)
  const matches = [...jobsContent.matchAll(/^  ([a-zA-Z0-9_-]+):\s*$/gm)]
  return matches.map((match, index) => ({
    id: match[1],
    content: jobsContent.slice(match.index, matches[index + 1]?.index ?? jobsContent.length),
  }))
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const failures = await validateBranchProtectionContract(repositoryRoot)
  if (failures.length) {
    console.error(`Branch-protection policy check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`)
    process.exitCode = 1
    return
  }
  console.log("Branch-protection policy check passed: master settings, required status names, documentation and CODEOWNERS coverage agree.")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
