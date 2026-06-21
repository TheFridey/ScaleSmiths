import "server-only"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import net from "node:net"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  FORGE_GENERATED_CODE_ARTIFACT_TITLE,
} from "@/lib/forge-frontend-code"
import { buildForgeGeneratedProcessEnv } from "@/lib/forge-process-env"
import {
  buildForgeDockerRunArgs,
  buildForgeDockerStopArgs,
  resolveForgeSandboxConfig,
  type ForgeSandboxNetworkMode,
} from "@/lib/forge-sandbox"
import {
  FORGE_PREVIEW_MEMORY_KEY,
  buildForgePreviewUrl,
  canExposeForgePreviewHost,
  defaultForgePreviewState,
  readForgePreviewMemory,
  resolveForgePreviewHost,
  resolveForgePreviewPortBase,
  type ForgePreviewEnv,
  type ForgePreviewState,
} from "@/lib/forge-preview"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory, type ForgeWorkspaceMetadata } from "@/lib/forge-workspace"
import { forgeActivityLogs, forgeArtifacts, forgeMemories, forgeProjects } from "@/lib/schema"
import { readForgeWorkspaceFile, resolveWorkspaceRoot } from "./forge-workspace"

export class ForgePreviewError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgePreviewError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

interface RunningPreview {
  projectId: number
  process?: ChildProcessWithoutNullStreams
  containerId?: string
  state: ForgePreviewState
  logs: string[]
}

const PREVIEW_INSTALL_TIMEOUT_MS = 180_000
const PREVIEW_READY_TIMEOUT_MS = 45_000
const PREVIEW_LOG_LIMIT = 60

declare global {
  var __forgePreviewProcesses: Map<number, RunningPreview> | undefined
}

const previewProcesses = globalThis.__forgePreviewProcesses ?? new Map<number, RunningPreview>()
globalThis.__forgePreviewProcesses = previewProcesses

export async function getForgePreviewState(projectId: number) {
  const { previewState, workspace } = await loadPreviewContext(projectId)
  const running = previewProcesses.get(projectId)

  if (running && isRunningPreviewAttached(running)) {
    return { ...running.state, status: "running" as const }
  }

  if (previewState?.status === "running" || previewState?.status === "starting") {
    const stopped = {
      ...previewState,
      status: "stopped" as const,
      pid: null,
      stoppedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: "Preview process is no longer attached to this admin runtime.",
    }
    await savePreviewState(projectId, stopped)
    return stopped
  }

  return previewState ?? defaultForgePreviewState(projectId, workspace?.relativePath ?? null)
}

export async function startForgePreview(projectId: number, actor: string) {
  const { project, workspace, hasGeneratedCode } = await loadPreviewContext(projectId)

  if (project.status === "archived") {
    throw new ForgePreviewError("Archived Forge projects cannot start previews.", 400)
  }
  if (!workspace) throw new ForgePreviewError("Create a generated-site workspace before starting a preview.", 400)
  if (!hasGeneratedCode) throw new ForgePreviewError("Generate site code before starting a preview.", 400)

  const existing = previewProcesses.get(projectId)
  if (existing && isRunningPreviewAttached(existing)) {
    await logPreviewActivity(projectId, actor, "preview_reused", `Reused running preview for ${project.name}.`, existing.state)
    return existing.state
  }

  await ensureWorkspaceCanPreview(workspace)

  const env = previewEnv()
  const host = resolveForgePreviewHost(env)
  if (!canExposeForgePreviewHost(host, env)) {
    throw new ForgePreviewError("Preview host is not allowed. Use 127.0.0.1/localhost or explicitly enable public previews.", 400)
  }

  const port = await findAvailablePort(resolveForgePreviewPortBase(env), host)
  const url = buildForgePreviewUrl(host, port)
  const now = new Date().toISOString()
  const sandbox = resolveForgeSandboxConfig()
  const method = sandbox.runner === "docker" ? "docker-next-dev" : "local-next-dev"
  const startingState: ForgePreviewState = {
    projectId,
    status: "starting",
    method,
    url,
    host,
    port,
    pid: null,
    workspacePath: workspace.relativePath,
    startedAt: now,
    stoppedAt: null,
    updatedAt: now,
    error: null,
  }

  await savePreviewState(projectId, startingState)
  await logPreviewActivity(projectId, actor, "preview_starting", `Starting local preview for ${project.name}.`, startingState)

  try {
    const workspaceRoot = resolveWorkspaceRoot(workspace)
    if (sandbox.runner === "docker") {
      await runDockerCommand("npm install --no-audit --no-fund", workspaceRoot, PREVIEW_INSTALL_TIMEOUT_MS, sandbox.installNetwork)
      const containerName = `forge-preview-${projectId}-${Date.now()}`
      const containerId = await startDockerPreview({
        workspaceRoot,
        host,
        port,
        internalPort: sandbox.previewInternalPort,
        containerName,
        network: sandbox.previewNetwork,
      })
      const logs: string[] = [`Docker preview container ${containerId.slice(0, 12)} started.`]
      const runningState: ForgePreviewState = {
        ...startingState,
        status: "running",
        pid: null,
        updatedAt: new Date().toISOString(),
      }

      previewProcesses.set(projectId, { projectId, containerId, state: runningState, logs })
      await waitForPreview(url, logs)
      await savePreviewState(projectId, runningState)
      await logPreviewActivity(projectId, actor, "preview_started", `Started Docker preview for ${project.name}.`, runningState)
      return runningState
    }

    await runNpm(["install", "--no-audit", "--no-fund"], workspaceRoot, PREVIEW_INSTALL_TIMEOUT_MS)
    const child = spawn(npmCommand(), ["run", "dev", "--", "--hostname", host, "-p", String(port)], {
      cwd: workspaceRoot,
      env: buildForgeGeneratedProcessEnv(),
      windowsHide: true,
      stdio: "pipe",
    })
    const logs: string[] = []
    const runningState: ForgePreviewState = {
      ...startingState,
      status: "running",
      pid: child.pid ?? null,
      updatedAt: new Date().toISOString(),
    }

    attachProcessLogging(child, logs)
    previewProcesses.set(projectId, { projectId, process: child, state: runningState, logs })

    child.once("exit", async (code) => {
      previewProcesses.delete(projectId)
      const stoppedAt = new Date().toISOString()
      const state: ForgePreviewState = {
        ...runningState,
        status: code === 0 ? "stopped" : "failed",
        pid: null,
        stoppedAt,
        updatedAt: stoppedAt,
        error: code === 0 ? null : `Preview process exited with code ${code ?? "unknown"}.`,
      }
      await savePreviewState(projectId, state).catch(() => undefined)
    })

    await waitForPreview(url, logs)
    await savePreviewState(projectId, runningState)
    await logPreviewActivity(projectId, actor, "preview_started", `Started local preview for ${project.name}.`, runningState)
    return runningState
  } catch (error) {
    const running = previewProcesses.get(projectId)
    if (running && isRunningPreviewAttached(running)) {
      await stopRunningPreview(running)
      previewProcesses.delete(projectId)
    }

    const failedAt = new Date().toISOString()
    const safeMessage = error instanceof Error ? error.message : "Preview failed to start."
    const failedState: ForgePreviewState = {
      ...startingState,
      status: "failed",
      pid: null,
      stoppedAt: failedAt,
      updatedAt: failedAt,
      error: safeMessage,
    }
    await savePreviewState(projectId, failedState)
    await logPreviewActivity(projectId, actor, "preview_failed", `Preview failed for ${project.name}.`, failedState)
    throw new ForgePreviewError(safeMessage, 500)
  }
}

export async function stopForgePreview(projectId: number, actor: string) {
  const { project, previewState, workspace } = await loadPreviewContext(projectId)
  const running = previewProcesses.get(projectId)

  if (running && isRunningPreviewAttached(running)) {
    await stopRunningPreview(running)
    previewProcesses.delete(projectId)
  }

  const now = new Date().toISOString()
  const stoppedState: ForgePreviewState = {
    ...(previewState ?? defaultForgePreviewState(projectId, workspace?.relativePath ?? null)),
    status: "stopped",
    pid: null,
    stoppedAt: now,
    updatedAt: now,
    error: null,
  }

  await savePreviewState(projectId, stoppedState)
  await logPreviewActivity(projectId, actor, "preview_stopped", `Stopped local preview for ${project.name}.`, stoppedState)
  return stoppedState
}

async function loadPreviewContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgePreviewError("Forge project not found.", 404)

  const [workspaceMemories, previewMemories, generatedCodeArtifacts] = await Promise.all([
    db.select({ value: forgeMemories.value }).from(forgeMemories).where(and(
      eq(forgeMemories.projectId, projectId),
      eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY),
    )).limit(1),
    db.select({ value: forgeMemories.value }).from(forgeMemories).where(and(
      eq(forgeMemories.projectId, projectId),
      eq(forgeMemories.key, FORGE_PREVIEW_MEMORY_KEY),
    )).limit(1),
    db.select({ id: forgeArtifacts.id }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "generated_code"),
      eq(forgeArtifacts.title, FORGE_GENERATED_CODE_ARTIFACT_TITLE),
    )).limit(1),
  ])

  return {
    project,
    workspace: readForgeWorkspaceMemory(workspaceMemories[0]?.value),
    previewState: readForgePreviewMemory(previewMemories[0]?.value),
    hasGeneratedCode: generatedCodeArtifacts.length > 0,
  }
}

async function savePreviewState(projectId: number, state: ForgePreviewState) {
  const now = new Date()
  const existing = await db
    .select({ id: forgeMemories.id })
    .from(forgeMemories)
    .where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_PREVIEW_MEMORY_KEY)))
    .limit(1)

  if (existing[0]) {
    await db
      .update(forgeMemories)
      .set({
        value: JSON.stringify(state),
        source: "forge_preview",
        updatedAt: now,
      })
      .where(eq(forgeMemories.id, existing[0].id))
  } else {
    await db.insert(forgeMemories).values({
      projectId,
      key: FORGE_PREVIEW_MEMORY_KEY,
      value: JSON.stringify(state),
      source: "forge_preview",
      updatedAt: now,
    })
  }
}

async function logPreviewActivity(projectId: number, actor: string, action: string, message: string, state: ForgePreviewState) {
  await db.insert(forgeActivityLogs).values({
    projectId,
    actor,
    action,
    message,
    metadataJson: {
      status: state.status,
      method: state.method,
      url: state.url,
      host: state.host,
      port: state.port,
      workspacePath: state.workspacePath,
      error: state.error,
    },
  })
}

async function ensureWorkspaceCanPreview(workspace: ForgeWorkspaceMetadata) {
  try {
    await readForgeWorkspaceFile(workspace, "package.json")
  } catch {
    throw new ForgePreviewError("Generated workspace is missing package.json. Regenerate the site before previewing.", 400)
  }
}

async function findAvailablePort(basePort: number, host: string) {
  for (let offset = 0; offset < 50; offset += 1) {
    const port = basePort + offset
    if (await isPortAvailable(port, host)) return port
  }

  throw new ForgePreviewError("No available local preview ports were found.", 500)
}

function isPortAvailable(port: number, host: string) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer()
    server.once("error", () => resolve(false))
    server.once("listening", () => {
      server.close(() => resolve(true))
    })
    server.listen(port, host)
  })
}

function runNpm(args: string[], cwd: string, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(npmCommand(), args, {
      cwd,
      env: buildForgeGeneratedProcessEnv(),
      windowsHide: true,
      stdio: "pipe",
    })
    const logs: string[] = []
    const timer = setTimeout(() => {
      void stopProcess(child)
      reject(new Error("Preview dependency install timed out. Run npm install in the generated workspace and try again."))
    }, timeoutMs)

    attachProcessLogging(child, logs)
    child.once("error", (error) => {
      clearTimeout(timer)
      reject(new Error(`Unable to run npm: ${error.message}`))
    })
    child.once("exit", (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Preview dependency install failed. ${tailLogs(logs)}`.trim()))
      }
    })
  })
}

function runDockerCommand(command: string, cwd: string, timeoutMs: number, network: ForgeSandboxNetworkMode) {
  const sandbox = resolveForgeSandboxConfig()
  const args = buildForgeDockerRunArgs({
    workspaceRoot: cwd,
    command,
    config: sandbox,
    network,
  })

  return new Promise<void>((resolve, reject) => {
    const child = spawn("docker", args, {
      cwd,
      env: buildForgeGeneratedProcessEnv(),
      windowsHide: true,
      stdio: "pipe",
    })
    const logs: string[] = []
    const timer = setTimeout(() => {
      void stopProcess(child)
      reject(new Error("Docker preview setup timed out. Check Docker and generated workspace dependencies."))
    }, timeoutMs)

    attachProcessLogging(child, logs)
    child.once("error", (error) => {
      clearTimeout(timer)
      reject(new Error(`Unable to run Docker sandbox: ${error.message}`))
    })
    child.once("exit", (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Docker preview setup failed. ${tailLogs(logs)}`.trim()))
      }
    })
  })
}

function startDockerPreview({
  workspaceRoot,
  host,
  port,
  internalPort,
  containerName,
  network,
}: {
  workspaceRoot: string
  host: string
  port: number
  internalPort: number
  containerName: string
  network: ForgeSandboxNetworkMode
}) {
  const sandbox = resolveForgeSandboxConfig()
  const args = buildForgeDockerRunArgs({
    workspaceRoot,
    command: `npm run dev -- --hostname 0.0.0.0 -p ${internalPort}`,
    config: sandbox,
    network,
    detached: true,
    name: containerName,
    publish: { host, hostPort: port, containerPort: internalPort },
  })

  return new Promise<string>((resolve, reject) => {
    const child = spawn("docker", args, {
      cwd: workspaceRoot,
      env: buildForgeGeneratedProcessEnv(),
      windowsHide: true,
      stdio: "pipe",
    })
    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8") })
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8") })
    child.once("error", (error) => reject(new Error(`Unable to start Docker preview: ${error.message}`)))
    child.once("exit", (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim())
      } else {
        reject(new Error(`Docker preview failed to start. ${stderr.trim()}`.trim()))
      }
    })
  })
}

async function waitForPreview(url: string, logs: string[]) {
  const started = Date.now()
  while (Date.now() - started < PREVIEW_READY_TIMEOUT_MS) {
    try {
      const response = await fetch(url, { method: "GET", cache: "no-store" })
      if (response.ok || response.status < 500) return
    } catch {
      // Keep polling until timeout.
    }
    await delay(1000)
  }

  throw new Error(`Preview server did not become ready. ${tailLogs(logs)}`.trim())
}

function attachProcessLogging(child: ChildProcessWithoutNullStreams, logs: string[]) {
  const push = (chunk: Buffer) => {
    logs.push(chunk.toString("utf8").trim())
    while (logs.length > PREVIEW_LOG_LIMIT) logs.shift()
  }
  child.stdout.on("data", push)
  child.stderr.on("data", push)
}

function tailLogs(logs: string[]) {
  return logs.filter(Boolean).slice(-8).join(" ").slice(0, 1000)
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm"
}

function previewEnv(): ForgePreviewEnv {
  return {
    FORGE_PREVIEW_HOST: process.env.FORGE_PREVIEW_HOST,
    FORGE_PREVIEW_PORT_BASE: process.env.FORGE_PREVIEW_PORT_BASE,
    FORGE_ALLOW_PUBLIC_PREVIEWS: process.env.FORGE_ALLOW_PUBLIC_PREVIEWS,
  }
}

function stopProcess(child: ChildProcessWithoutNullStreams) {
  return new Promise<void>((resolve) => {
    if (child.killed || !child.pid) {
      resolve()
      return
    }

    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      })
      killer.once("exit", () => resolve())
      killer.once("error", () => resolve())
      return
    }

    child.kill("SIGTERM")
    setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL")
      resolve()
    }, 1500)
  })
}

function isRunningPreviewAttached(running: RunningPreview) {
  return Boolean((running.process && !running.process.killed) || running.containerId)
}

async function stopRunningPreview(running: RunningPreview) {
  if (running.process && !running.process.killed) {
    await stopProcess(running.process)
    return
  }

  if (running.containerId) {
    await stopDockerContainer(running.containerId)
  }
}

function stopDockerContainer(containerId: string) {
  return new Promise<void>((resolve) => {
    const stopper = spawn("docker", buildForgeDockerStopArgs(containerId), {
      env: buildForgeGeneratedProcessEnv(),
      windowsHide: true,
      stdio: "ignore",
    })
    stopper.once("exit", () => resolve())
    stopper.once("error", () => resolve())
  })
}
