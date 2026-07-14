#!/usr/bin/env node
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const REQUIRED_WORKFLOWS = ["ci.yml", "security.yml", "codeql.yml"]

const REQUIRED_CONTENT = {
  "ci.yml": [
    "web/package-lock.json",
    "admin/package-lock.json",
    "npm run lint",
    "npm run test",
    "npm run build",
    "npm run test:e2e:chromium",
    "npm run test:e2e:cross-browser",
    "node scripts/check-migrations.mjs",
    "npm run test:integration",
    "npm run test:forge-benchmark",
    "npm run check:env-hygiene",
    "npm run check:architecture-docs",
    "npm run test:release-simulation",
    "database-migration-logs",
    "web-playwright-artifacts",
    "web-performance-reports",
    "forge-benchmark-report",
  ],
  "security.yml": [
    "actions/dependency-review-action@",
    "trufflesecurity/trufflehog@",
    "npm audit --omit=dev --audit-level=high --json",
    "hadolint/hadolint-action@",
    "aquasecurity/trivy-action@",
    "anchore/sbom-action@",
    "src/lib/forge-sandbox-security.test.ts",
  ],
  "codeql.yml": ["github/codeql-action/init@", "github/codeql-action/analyze@", "security-events: write"],
}

export function validateWorkflowSet(workflows, repositoryRoot) {
  const failures = []
  const byName = new Map(workflows.map((workflow) => [workflow.name, workflow.content]))

  for (const name of REQUIRED_WORKFLOWS) {
    const content = byName.get(name)
    if (!content) {
      failures.push(`[missing-workflow] .github/workflows/${name}`)
      continue
    }

    if (!/^concurrency:\s*$/m.test(content) || !/^\s+cancel-in-progress:\s*true\s*$/m.test(content)) {
      failures.push(`[concurrency] ${name} must cancel superseded runs`)
    }
    if (!/^permissions:\s*\n\s+contents:\s*read\s*$/m.test(content)) {
      failures.push(`[permissions] ${name} must default to contents: read`)
    }
    if (/pull_request_target:|permissions:\s*write-all/.test(content)) {
      failures.push(`[permissions] ${name} uses an unsafe broad or privileged trigger`)
    }

    for (const required of REQUIRED_CONTENT[name]) {
      if (!content.includes(required)) failures.push(`[required-gate] ${name} is missing ${required}`)
    }

    for (const job of workflowJobs(content)) {
      if (!/^\s{4}timeout-minutes:\s*\d+\s*$/m.test(job.content)) {
        failures.push(`[timeout] ${name} job ${job.name} has no timeout-minutes`)
      }
    }
  }

  for (const workflow of workflows) {
    if (/cache-dependency-path:\s*["']?package-lock\.json["']?\s*$/m.test(workflow.content)) {
      failures.push(`[root-lockfile] ${workflow.name} references the nonexistent root package-lock.json`)
    }
    if (/Skipping (?:admin )?(?:lint|tests|root npm ci)|if\s+\[\s+-f\s+package-lock\.json|if npm pkg get/.test(workflow.content)) {
      failures.push(`[silent-skip] ${workflow.name} can silently skip a required gate`)
    }
    for (const cachePath of cacheDependencyPaths(workflow.content)) {
      if (cachePath === "${{ matrix.app }}/package-lock.json") {
        for (const app of ["web", "admin"]) ensurePath(failures, repositoryRoot, `${app}/package-lock.json`, workflow.name)
      } else {
        ensurePath(failures, repositoryRoot, cachePath, workflow.name)
        if (!/^(web|admin)\/package-lock\.json$/.test(cachePath)) failures.push(`[cache-isolation] ${workflow.name} uses unsupported cache path ${cachePath}`)
      }
    }
  }

  const ci = byName.get("ci.yml") ?? ""
  const buildIndex = ci.indexOf("- name: Production build")
  const performanceIndex = ci.indexOf("- name: Public performance budgets")
  const browserIndex = ci.indexOf("- name: Install Playwright Chromium")
  if (!(buildIndex >= 0 && performanceIndex > buildIndex && browserIndex > performanceIndex)) {
    failures.push("[build-artifact-order] ci.yml must measure the production build before Playwright's dev server can replace .next output")
  }

  return failures
}

function workflowJobs(content) {
  const jobsIndex = content.search(/^jobs:\s*$/m)
  if (jobsIndex === -1) return []
  const jobsContent = content.slice(jobsIndex)
  const matches = [...jobsContent.matchAll(/^  ([a-zA-Z0-9_-]+):\s*$/gm)]
  return matches.map((match, index) => ({
    name: match[1],
    content: jobsContent.slice(match.index, matches[index + 1]?.index ?? jobsContent.length),
  }))
}

function cacheDependencyPaths(content) {
  return [...content.matchAll(/^\s+cache-dependency-path:\s*([^\s#]+)\s*$/gm)].map((match) => match[1].replace(/^['"]|['"]$/g, ""))
}

function ensurePath(failures, repositoryRoot, relativePath, workflow) {
  try {
    const fullPath = path.resolve(repositoryRoot, relativePath)
    if (!fullPath.startsWith(`${path.resolve(repositoryRoot)}${path.sep}`)) throw new Error("outside repository")
    if (!existsSync(fullPath)) failures.push(`[cache-path] ${workflow} references missing ${relativePath}`)
  } catch {
    failures.push(`[cache-path] ${workflow} references invalid ${relativePath}`)
  }
}

export async function loadWorkflowSet(repositoryRoot) {
  const workflowRoot = path.join(repositoryRoot, ".github", "workflows")
  return Promise.all(REQUIRED_WORKFLOWS.map(async (name) => ({ name, content: await readFile(path.join(workflowRoot, name), "utf8") })))
}

async function main() {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const failures = validateWorkflowSet(await loadWorkflowSet(repositoryRoot), repositoryRoot)
  if (failures.length) {
    console.error(`GitHub Actions policy check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`)
    process.exitCode = 1
    return
  }
  console.log("GitHub Actions policy check passed: required gates, isolated lockfile caches, timeouts, permissions and artifacts are present.")
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
