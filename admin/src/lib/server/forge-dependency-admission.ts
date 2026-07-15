import "server-only"
import { spawn } from "node:child_process"
import { buildForgeDependencyEvidence } from "@/lib/forge-dependency-admission"
import type { ForgeWorkspaceMetadata } from "@/lib/forge-workspace"
import { appendBoundedSandboxLog, buildForgeDockerRunArgs, resolveForgeSandboxConfig } from "@/lib/forge-sandbox"
import { buildForgeGeneratedProcessEnv } from "@/lib/forge-process-env"
import { assertForgeWorkspaceExecutionSafe, listForgeWorkspaceFiles, readForgeWorkspaceFile } from "./forge-workspace"

const AUDIT_TIMEOUT_MS = 120_000
const AUDIT_LOG_LIMIT_BYTES = 2_000_000
const AUDIT_COMMAND = "npm audit --package-lock-only --ignore-scripts --json"

export class ForgeDependencyAdmissionError extends Error {
  constructor(public safeMessage: string, public status = 400) { super(safeMessage); this.name = "ForgeDependencyAdmissionError" }
}

export async function collectForgeDependencyEvidence(workspace: ForgeWorkspaceMetadata, workspaceHash: string) {
  const files = await listForgeWorkspaceFiles(workspace)
  const manifests = files.filter((file) => /(?:^|\/)package\.json$/i.test(file))
  const lockfiles = files.filter((file) => /(?:^|\/)package-lock\.json$/i.test(file))
  if (!manifests.includes("package.json")) throw new ForgeDependencyAdmissionError("Generated workspace is missing package.json.")
  if (!lockfiles.includes("package-lock.json")) throw new ForgeDependencyAdmissionError("Generated workspace is missing package-lock.json. Run the controlled install and QA workflow before creating a candidate.")
  if (manifests.length !== 1 || lockfiles.length !== 1) throw new ForgeDependencyAdmissionError("Generated sites must contain exactly one root package.json and package-lock.json; nested dependency manifests are not admitted.")

  const [packageJson, packageLock] = await Promise.all([
    readForgeWorkspaceFile(workspace, "package.json"),
    readForgeWorkspaceFile(workspace, "package-lock.json"),
  ])
  const workspaceRoot = await assertForgeWorkspaceExecutionSafe(workspace)
  const auditReport = await runGeneratedSiteAudit(workspaceRoot)
  try {
    return buildForgeDependencyEvidence({ packageJson, packageLock, auditReport, workspaceHash })
  } catch (error) {
    throw new ForgeDependencyAdmissionError(error instanceof Error ? error.message : "Unable to generate dependency-admission evidence.")
  }
}

async function runGeneratedSiteAudit(workspaceRoot: string) {
  const sandbox = resolveForgeSandboxConfig()
  const isWindowsNpm = process.platform === "win32"
  const executable = sandbox.runner === "docker" ? "docker" : isWindowsNpm ? (process.env.ComSpec ?? "cmd.exe") : "npm"
  const args = sandbox.runner === "docker"
    ? buildForgeDockerRunArgs({ workspaceRoot, command: AUDIT_COMMAND, config: sandbox, network: sandbox.installNetwork })
    : isWindowsNpm
      ? ["/d", "/s", "/c", "npm", "audit", "--package-lock-only", "--ignore-scripts", "--json"]
      : ["audit", "--package-lock-only", "--ignore-scripts", "--json"]

  return new Promise<unknown>((resolve) => {
    const child = spawn(executable, args, { cwd: workspaceRoot, env: buildForgeGeneratedProcessEnv(), windowsHide: true, stdio: "pipe" })
    let stdout = ""
    let stderr = ""
    let finished = false
    const finish = (value: unknown) => { if (finished) return; finished = true; clearTimeout(timer); resolve(value) }
    const timer = setTimeout(() => { child.kill(); finish({ error: { summary: "Generated-site vulnerability audit timed out." } }) }, AUDIT_TIMEOUT_MS)
    child.stdout.on("data", (chunk: Buffer) => { stdout = appendBoundedSandboxLog(stdout, chunk.toString("utf8"), AUDIT_LOG_LIMIT_BYTES).value })
    child.stderr.on("data", (chunk: Buffer) => { stderr = appendBoundedSandboxLog(stderr, chunk.toString("utf8"), 32_000).value })
    child.once("error", () => finish({ error: { summary: "Generated-site vulnerability audit could not start." } }))
    child.once("exit", () => {
      try { finish(JSON.parse(stdout)) }
      catch { finish({ error: { summary: stderr.includes("network") ? "Generated-site vulnerability audit could not reach the approved registry." : "Generated-site vulnerability audit returned invalid evidence." } }) }
    })
  })
}
