#!/usr/bin/env node
import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const REQUIRED_WORKFLOWS = ["ci.yml", "security.yml", "codeql.yml"]

const REQUIRED_ACTION_RELEASES = new Map([
  ["actions/checkout", "d23441a48e516b6c34aea4fa41551a30e30af803"], // v6.1.0, Node 24
  ["actions/setup-node", "249970729cb0ef3589644e2896645e5dc5ba9c38"], // v6.5.0, Node 24
  ["actions/upload-artifact", "330a01c490aca151604b8cf639adc76d48f6c5d4"], // v5.0.0, Node 24
  ["actions/dependency-review-action", "a1d282b36b6f3519aa1f3fc636f609c47dddb294"], // v5.0.0, Node 24
  ["anchore/sbom-action", "e22c389904149dbc22b58101806040fa8d37a610"], // v0.24.0, Node 24
  ["github/codeql-action/init", "a2983b8bed1923f44751c5c43237f479442827b3"], // v3.37.4, current stable
  ["github/codeql-action/analyze", "a2983b8bed1923f44751c5c43237f479442827b3"], // v3.37.4, current stable
])

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
    "npm run check:forge-v2-release-docs",
    "npm run test:forge-v2-release-docs",
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
    "npm run check:pr-metadata",
    "npm run test:pr-metadata",
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

  if (existsSync(path.join(repositoryRoot, "package-lock.json"))) {
    failures.push("[root-lockfile] the repository must not contain a root package-lock.json")
  }

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
      failures.push(...validateSetupNodeCaching(job.content, repositoryRoot, `${name} job ${job.name}`))
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
      const requiredReference = REQUIRED_ACTION_RELEASES.get(action)
      if (requiredReference && reference !== requiredReference) {
        failures.push(`[action-runtime] ${workflow.name} must use the approved current release of ${action}`)
      }
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

  // The PR metadata gate must exist, must be pull-request scoped, and must never reach
  // for the GitHub API, which would require a token broader than the read-only default.
  if (!/^ {2}pr-metadata:\s*$/m.test(ci)) {
    failures.push("[pr-metadata] ci.yml must define the pr-metadata job")
  } else if (!/^ {2}pr-metadata:\s*\n(?: {4}[^\n]*\n)*? {4}if:\s*github\.event_name == 'pull_request'\s*$/m.test(ci)) {
    failures.push("[pr-metadata] ci.yml pr-metadata job must run only for pull_request events")
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

export function validateSetupNodeCaching(jobContent, repositoryRoot, label = "workflow job") {
  const failures = []
  const setupBlocks = jobContent
    .split(/(?=^\s*- name:)/m)
    .filter((step) => step.includes("actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38"))
  if (!setupBlocks.length) return failures

  const needsWeb = /working-directory:[ \t]*web[ \t]*$/m.test(jobContent) || /npm\s+--prefix\s+web\s+(?:ci|install)\b/.test(jobContent)
  const needsAdmin = /working-directory:[ \t]*admin[ \t]*$/m.test(jobContent) || /npm\s+--prefix\s+admin\s+(?:ci|install)\b/.test(jobContent)
  const matrixApps = /app:\s*\[\s*web\s*,\s*admin\s*\]/.test(jobContent)

  for (const block of setupBlocks) {
    const disabled = /^\s*package-manager-cache:\s*false\s*$/m.test(block)
    const npmCache = /^\s*cache:\s*["']?npm["']?\s*$/m.test(block)
    const paths = cacheDependencyPaths(block)
    if (disabled) {
      if (npmCache || paths.length) failures.push(`[setup-node-cache] ${label} mixes disabled and enabled caching`)
      if (needsWeb || needsAdmin || matrixApps) failures.push(`[setup-node-cache] ${label} disables caching for an application dependency install`)
      continue
    }
    if (!npmCache) failures.push(`[setup-node-cache] ${label} relies on setup-node automatic package-manager caching`)
    if (!paths.length) failures.push(`[setup-node-cache-path] ${label} enables npm caching without an explicit cache-dependency-path`)
    const hasWeb = paths.includes("web/package-lock.json")
    const hasAdmin = paths.includes("admin/package-lock.json")
    const hasMatrix = paths.includes("${{ matrix.app }}/package-lock.json")
    if ((needsWeb || matrixApps) && !hasWeb && !hasMatrix) failures.push(`[setup-node-cache-path] ${label} must cache web/package-lock.json`)
    if ((needsAdmin || matrixApps) && !hasAdmin && !hasMatrix) failures.push(`[setup-node-cache-path] ${label} must cache admin/package-lock.json`)
    for (const cachePath of paths) {
      if (cachePath === "${{ matrix.app }}/package-lock.json") continue
      ensurePath(failures, repositoryRoot, cachePath, label)
      if (!/^(web|admin)\/package-lock\.json$/.test(cachePath)) failures.push(`[cache-isolation] ${label} uses unsupported cache path ${cachePath}`)
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
    name: match[1],
    content: jobsContent.slice(match.index, matches[index + 1]?.index ?? jobsContent.length),
  }))
}

function cacheDependencyPaths(content) {
  const paths = []
  for (const match of content.matchAll(/^(\s*)cache-dependency-path:\s*([^\n#]*)\s*$/gm)) {
    const indent = match[1].length
    const value = match[2].trim()
    if (value && value !== "|") paths.push(value.replace(/^['"]|['"]$/g, ""))
    if (value === "|") {
      const tail = content.slice((match.index ?? 0) + match[0].length)
      for (const line of tail.split("\n").slice(1)) {
        const item = line.match(/^(\s+)(\S.*)$/)
        if (!item || item[1].length <= indent) break
        paths.push(item[2].trim())
      }
    }
  }
  return paths
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
  // Normalise line endings so the policy rules and their tests behave identically on a
  // CRLF Windows checkout and an LF Linux runner.
  return Promise.all(REQUIRED_WORKFLOWS.map(async (name) => ({
    name,
    content: (await readFile(path.join(workflowRoot, name), "utf8")).replace(/\r\n/g, "\n"),
  })))
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
