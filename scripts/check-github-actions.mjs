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
    "npm run check:migration-history",
    "npm run test:migration-history",
    "npm run test:integration",
    "npm run test:forge-benchmark",
    "npm run check:env-hygiene",
    "npm run check:architecture-docs",
    "npm run test:release-simulation",
    "npm run test:backup-migration-safety",
    "npm run test:backup-framework",
    "backup-framework-test-log",
    "database-migration-logs",
    "web-playwright-artifacts",
    "web-performance-reports",
    "forge-benchmark-report",
    "npm run test:forge-e2e",
    "forge-e2e-logs",
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
    if (!/push:\s*\n\s+branches:\s*\[[^\]]*\brelease\/forge-v2-rc\b[^\]]*\]/m.test(content)) {
      failures.push(`[release-trigger] ${name} must run for pushes to release/forge-v2-rc`)
    }
    if (!/pull_request:\s*\n\s+branches:\s*\[[^\]]*\bmaster\b[^\]]*\]/m.test(content) || !/workflow_dispatch:\s*$/m.test(content)) {
      failures.push(`[release-trigger] ${name} must run for pull requests to master and workflow_dispatch`)
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
    for (const match of workflow.content.matchAll(/^\s+uses:\s*([^@\s]+)@([^\s#]+)/gm)) {
      const [, action, reference] = match
      if (!/^[0-9a-f]{40}$/.test(reference)) failures.push(`[action-pin] ${workflow.name} must pin ${action} to an immutable commit SHA`)
    }
    const nodeSetups = [...workflow.content.matchAll(/actions\/setup-node@[0-9a-f]{40}/g)].length
    const npmPins = [...workflow.content.matchAll(/npm install --global npm@10\.9\.2/g)].length
    if (npmPins !== nodeSetups) failures.push(`[npm-version] ${workflow.name} must install npm 10.9.2 after every Node setup`)
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

  const security = byName.get("security.yml") ?? ""
  if (/extra_args:\s*[^\n]*--fail/.test(security)) failures.push("[trufflehog-arguments] TruffleHog must not receive a duplicate --fail argument")
  if (!security.includes("dependency-graph/sbom") || !security.includes("Enable Dependency Graph")) {
    failures.push("[dependency-review-availability] security.yml must fail clearly when GitHub Dependency Graph is unavailable")
  }
  const trivyIndex = security.indexOf("id: trivy")
  const securityUploadIndex = security.indexOf("- name: Upload container scan and SBOM")
  const trivyEnforcementIndex = security.indexOf("- name: Enforce HIGH and CRITICAL image vulnerability threshold")
  if (!(trivyIndex >= 0 && securityUploadIndex > trivyIndex && trivyEnforcementIndex > securityUploadIndex && security.includes("steps.trivy.outcome == 'failure'"))) {
    failures.push("[trivy-evidence-order] security.yml must upload Trivy/SBOM evidence before enforcing scan failure")
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
