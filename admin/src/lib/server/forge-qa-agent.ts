import "server-only"
import { spawn } from "node:child_process"
import { and, desc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { buildForgeTaskOutputMetadata, ForgeAiError, runForgeAiJson } from "@/lib/server/forge-ai"
import { buildForgeDockerRunArgs, resolveForgeSandboxConfig, type ForgeSandboxNetworkMode } from "@/lib/forge-sandbox"
import { buildForgeGeneratedProcessEnv } from "@/lib/forge-process-env"
import {
  FORGE_QA_ARTIFACT_KIND,
  FORGE_QA_ARTIFACT_TITLE,
  FORGE_REPAIR_PATCH_SCHEMA,
  buildForgeQaArtifactContent,
  buildQaReport,
  buildRepairPrompt,
  buildReducedMotionQaResult,
  buildResendFormQaResult,
  buildSeoScoreQaResult,
  buildWhatsAppLinkQaResult,
  canAttemptForgeRepair,
  extractLikelyRelevantFiles,
  getForgeQaCommands,
  readForgeQaArtifact,
  resolveForgeMaxRepairAttempts,
  truncateForgeQaLog,
  validateForgeRepairPatches,
  type ForgeQaCommandName,
  type ForgeQaCommandResult,
  type ForgeQaReport,
  type ForgeRepairAttempt,
  type ForgeRepairPatchResponse,
} from "@/lib/forge-qa"
import { FORGE_GENERATED_CODE_ARTIFACT_TITLE } from "@/lib/forge-frontend-code"
import { FORGE_SEO_ARTIFACT_TITLE, readForgeSeoArtifact, type ForgeSeoPack } from "@/lib/forge-seo"
import { FORGE_RESEND_PROVIDER, readForgeResendConfig, type ForgeResendConfig } from "@/lib/forge-resend"
import { FORGE_WHATSAPP_PROVIDER, readForgeWhatsAppConfig, type ForgeWhatsAppConfig } from "@/lib/forge-whatsapp"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory, type ForgeWorkspaceMetadata } from "@/lib/forge-workspace"
import { forgeActivityLogs, forgeArtifacts, forgeIntegrationConfigs, forgeMemories, forgeProjects, forgeTasks } from "@/lib/schema"
import { saveVersionedForgeArtifact } from "./forge-artifacts"
import { cleanupForgeWorkspaceTransientOutput, readForgeWorkspaceFile, resolveWorkspaceRoot, writeForgeWorkspaceFile } from "./forge-workspace"

export class ForgeQaAgentError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeQaAgentError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

const COMMAND_TIMEOUT_MS = 180_000

export async function runForgeQaAgent(projectId: number, actor: string) {
  const { project, workspace, hasGeneratedCode, qaState, resendConfig, whatsappConfig, seoPack } = await loadQaContext(projectId)

  if (project.status === "archived") throw new ForgeQaAgentError("Archived Forge projects cannot run QA.", 400)
  if (!workspace) throw new ForgeQaAgentError("Create a generated-site workspace before running QA.", 400)
  if (!hasGeneratedCode) throw new ForgeQaAgentError("Generate site code before running QA.", 400)

  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(forgeTasks).values({
      projectId,
      title: "Run generated-site QA",
      description: "Install dependencies, run typecheck/lint when available, and build the generated workspace.",
      agentType: "qa",
      status: "queued",
      inputJson: {
        projectId,
        projectName: project.name,
        workspace: workspace.relativePath,
      },
      updatedAt: now,
    }).returning()

    await tx.update(forgeProjects).set({ status: "qa", updatedAt: now }).where(eq(forgeProjects.id, projectId))
    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "qa_queued",
      message: `Queued generated-site QA for ${project.name}.`,
      metadataJson: { taskId: created.id, workspace: workspace.relativePath },
    })

    return [created]
  })

  const startedAt = new Date()
  await markTaskRunning(projectId, task.id, actor, "qa_running", `Generated-site QA started for ${project.name}.`, startedAt)

  try {
    const report = await runWorkspaceQa(workspace, qaState.report?.repairHistory ?? [], resendConfig, whatsappConfig, seoPack)
    const completedAt = new Date()
    const artifact = await saveQaReport(projectId, report, task.id, completedAt)

    await db.transaction(async (tx) => {
      await tx.update(forgeProjects).set({
        status: report.status === "passed" ? "ready_to_deploy" : "qa",
        updatedAt: completedAt,
      }).where(eq(forgeProjects.id, projectId))

      await tx.update(forgeTasks).set({
        status: report.status === "passed" ? "completed" : "failed",
        error: report.failureSummary,
        outputJson: {
          status: report.status,
          summary: report.summary,
          failureSummary: report.failureSummary,
          commandStatuses: report.commands.map((command) => ({ name: command.name, status: command.status, exitCode: command.exitCode })),
        },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: report.status === "passed" ? "qa_passed" : "qa_failed",
        message: report.status === "passed"
          ? `Generated-site QA passed for ${project.name}.`
          : `Generated-site QA failed for ${project.name}.`,
        metadataJson: {
          taskId: task.id,
          artifactId: artifact.id,
          status: report.status,
          failureSummary: report.failureSummary,
        },
      })
    })

    return { ok: true as const, taskId: task.id, artifactId: artifact.id, report }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof Error ? error.message : "Generated-site QA failed."
    await markTaskFailed(projectId, task.id, actor, "qa_failed", `Generated-site QA failed for ${project.name}.`, safeMessage, completedAt)
    throw error instanceof ForgeQaAgentError ? error : new ForgeQaAgentError("Generated-site QA failed.", 500)
  }
}

export async function runForgeRepairAgent(projectId: number, actor: string) {
  const { project, workspace, qaState, resendConfig, whatsappConfig, seoPack } = await loadQaContext(projectId)

  if (project.status === "archived") throw new ForgeQaAgentError("Archived Forge projects cannot run repairs.", 400)
  if (!workspace) throw new ForgeQaAgentError("Create a generated-site workspace before attempting repair.", 400)

  const maxAttempts = resolveForgeMaxRepairAttempts(process.env)
  const allowed = canAttemptForgeRepair(qaState.report, maxAttempts)
  if (!allowed.ok) throw new ForgeQaAgentError(allowed.error, 400)

  const now = new Date()
  const [task] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(forgeTasks).values({
      projectId,
      title: `Repair generated site attempt ${allowed.nextAttempt}`,
      description: "Use the repair agent to patch generated workspace files, then rerun QA.",
      agentType: "repair",
      status: "queued",
      inputJson: {
        projectId,
        projectName: project.name,
        workspace: workspace.relativePath,
        attempt: allowed.nextAttempt,
        failureSummary: qaState.report?.failureSummary,
      },
      updatedAt: now,
    }).returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "repair_queued",
      message: `Queued repair attempt ${allowed.nextAttempt} for ${project.name}.`,
      metadataJson: { taskId: created.id, attempt: allowed.nextAttempt },
    })

    return [created]
  })

  const startedAt = new Date()
  await markTaskRunning(projectId, task.id, actor, "repair_running", `Repair attempt ${allowed.nextAttempt} started for ${project.name}.`, startedAt)

  const attempt: ForgeRepairAttempt = {
    attempt: allowed.nextAttempt,
    taskId: task.id,
    status: "failed",
    summary: "Repair attempt started.",
    patches: [],
    startedAt: startedAt.toISOString(),
    completedAt: null,
    error: null,
  }

  try {
    if (!qaState.report) throw new ForgeQaAgentError("Run QA before attempting repair.", 400)
    const relevantFiles = await readRelevantFiles(workspace, extractLikelyRelevantFiles(qaState.report))
    const result = await runForgeAiJson<ForgeRepairPatchResponse>({
      taskType: "repair",
      schemaName: "forge_repair_patches",
      schema: FORGE_REPAIR_PATCH_SCHEMA,
      systemPrompt: [
        "You are the ScaleSmiths Forge Repair Agent.",
        "Return full replacement file contents for generated workspace files only.",
        "Never target core ScaleSmiths app files or absolute paths.",
      ].join(" "),
      prompt: buildRepairPrompt({ report: qaState.report, files: relevantFiles }),
      maxTokens: 5000,
      timeoutMs: 45_000,
      maxRetries: 1,
      projectId,
      taskId: task.id,
      mockData: {
        summary: "Mock repair provider did not apply file changes. Enable AI or inspect the QA logs.",
        patches: [],
      },
    })
    const patches = result.data.patches
    const validated = validateForgeRepairPatches(patches)
    if (!validated.ok) throw new ForgeQaAgentError(validated.error, 400)

    for (const patch of patches) {
      await writeForgeWorkspaceFile(workspace, patch.path, patch.content, {
        allowExecutableScripts: true,
        overwrite: true,
      })
    }

    const completedAt = new Date()
    attempt.status = patches.length ? "applied" : "no_patch"
    attempt.summary = result.data.summary
    attempt.patches = patches
    attempt.completedAt = completedAt.toISOString()

    const repairHistory = [...(qaState.report.repairHistory ?? []), attempt]
    const report = patches.length
      ? await runWorkspaceQa(workspace, repairHistory, resendConfig, whatsappConfig, seoPack)
      : { ...qaState.report, repairHistory, completedAt: completedAt.toISOString(), generatedAt: completedAt.toISOString() }
    const artifact = await saveQaReport(projectId, report, task.id, completedAt)
    const aiMetadata = buildForgeTaskOutputMetadata({ ...result, data: result.data })

    await db.transaction(async (tx) => {
      await tx.update(forgeProjects).set({
        status: report.status === "passed" ? "ready_to_deploy" : "qa",
        updatedAt: completedAt,
      }).where(eq(forgeProjects.id, projectId))

      await tx.update(forgeTasks).set({
        status: report.status === "passed" || attempt.status !== "failed" ? "completed" : "failed",
        error: report.status === "failed" ? report.failureSummary : null,
        outputJson: {
          ...aiMetadata,
          repairAttempt: attempt,
          qaStatus: report.status,
          reranChecks: patches.length > 0,
        },
        completedAt,
        updatedAt: completedAt,
      }).where(eq(forgeTasks.id, task.id))

      await tx.insert(forgeActivityLogs).values({
        projectId,
        actor,
        action: "repair_completed",
        message: `Repair attempt ${allowed.nextAttempt} completed for ${project.name}.`,
        metadataJson: {
          taskId: task.id,
          artifactId: artifact.id,
          attempt,
          qaStatus: report.status,
          patches: patches.map((patch) => patch.path),
        },
      })
    })

    return { ok: true as const, taskId: task.id, artifactId: artifact.id, attempt, report }
  } catch (error) {
    const completedAt = new Date()
    const safeMessage = error instanceof ForgeAiError
      ? error.safeMessage
      : error instanceof Error
        ? error.message
        : "Repair attempt failed."
    attempt.status = "failed"
    attempt.completedAt = completedAt.toISOString()
    attempt.error = safeMessage
    attempt.summary = "Repair attempt failed before QA could pass."

    const report = qaState.report
      ? { ...qaState.report, repairHistory: [...qaState.report.repairHistory, attempt], completedAt: completedAt.toISOString() }
      : null
    if (report) await saveQaReport(projectId, report, task.id, completedAt)
    await markTaskFailed(projectId, task.id, actor, "repair_failed", `Repair attempt ${allowed.nextAttempt} failed for ${project.name}.`, safeMessage, completedAt)

    if (error instanceof ForgeAiError) throw new ForgeQaAgentError(error.safeMessage, 502)
    if (error instanceof ForgeQaAgentError) throw error
    throw new ForgeQaAgentError("Repair attempt failed.", 500)
  }
}

async function runWorkspaceQa(
  workspace: ForgeWorkspaceMetadata,
  repairHistory: ForgeRepairAttempt[],
  resendConfig: ForgeResendConfig,
  whatsappConfig: ForgeWhatsAppConfig,
  seoPack: ForgeSeoPack | null,
) {
  const packageJson = await readForgeWorkspaceFile(workspace, "package.json").catch(() => null)
  if (!packageJson) throw new ForgeQaAgentError("Generated workspace is missing package.json.", 400)

  const commands = getForgeQaCommands(packageJson)
  const results: ForgeQaCommandResult[] = []
  const cwd = resolveWorkspaceRoot(workspace)
  const sandbox = resolveForgeSandboxConfig()
  const resendCheck = await runResendFormCheck(workspace, resendConfig)
  results.push(resendCheck)
  if (resendCheck.status === "failed") return buildQaReport({ workspacePath: workspace.relativePath, commands: results, repairHistory })

  const whatsappCheck = await runWhatsAppLinkCheck(workspace, whatsappConfig)
  results.push(whatsappCheck)
  if (whatsappCheck.status === "failed") return buildQaReport({ workspacePath: workspace.relativePath, commands: results, repairHistory })

  const reducedMotionCheck = await runReducedMotionCheck(workspace)
  results.push(reducedMotionCheck)
  if (reducedMotionCheck.status === "failed") return buildQaReport({ workspacePath: workspace.relativePath, commands: results, repairHistory })

  const seoCheck = await runSeoCheck(workspace, seoPack)
  results.push(seoCheck)
  if (seoCheck.status === "failed") return buildQaReport({ workspacePath: workspace.relativePath, commands: results, repairHistory })

  for (const command of commands) {
    if (!command.shouldRun) {
      results.push({
        name: command.name,
        command: command.command,
        status: "skipped",
        exitCode: null,
        durationMs: 0,
        stdout: "",
        stderr: "",
        skippedReason: command.skippedReason,
      })
      continue
    }

    const network = command.name === "install" ? sandbox.installNetwork : sandbox.network
    const result = sandbox.runner === "docker"
      ? await runDockerWorkspaceCommand(command.name, command.command, cwd, network)
      : await runWorkspaceCommand(command.name, command.command, cwd)
    results.push(result)
    if (result.status === "failed") break
  }

  await cleanupForgeWorkspaceTransientOutput(workspace)
  return buildQaReport({ workspacePath: workspace.relativePath, commands: results, repairHistory })
}

function runWorkspaceCommand(name: ForgeQaCommandName, command: string, cwd: string) {
  const [bin, ...args] = command.split(" ")
  const executable = bin === "npm" ? npmCommand() : bin
  const started = Date.now()

  return new Promise<ForgeQaCommandResult>((resolve) => {
    const child = spawn(executable, args, {
      cwd,
      env: buildForgeGeneratedProcessEnv(),
      windowsHide: true,
      stdio: "pipe",
    })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill()
      stderr += "\nCommand timed out."
    }, COMMAND_TIMEOUT_MS)

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8") })
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8") })
    child.once("error", (error) => {
      clearTimeout(timer)
      resolve({
        name,
        command,
        status: "failed",
        exitCode: null,
        durationMs: Date.now() - started,
        stdout: truncateForgeQaLog(stdout),
        stderr: truncateForgeQaLog(`${stderr}\n${error.message}`),
        skippedReason: null,
      })
    })
    child.once("exit", (code) => {
      clearTimeout(timer)
      resolve({
        name,
        command,
        status: code === 0 ? "passed" : "failed",
        exitCode: code,
        durationMs: Date.now() - started,
        stdout: truncateForgeQaLog(stdout),
        stderr: truncateForgeQaLog(stderr),
        skippedReason: null,
      })
    })
  })
}

function runDockerWorkspaceCommand(name: ForgeQaCommandName, command: string, cwd: string, network: ForgeSandboxNetworkMode) {
  const sandbox = resolveForgeSandboxConfig()
  const args = buildForgeDockerRunArgs({
    workspaceRoot: cwd,
    command,
    config: sandbox,
    network,
  })
  const started = Date.now()

  return new Promise<ForgeQaCommandResult>((resolve) => {
    const child = spawn("docker", args, {
      cwd,
      env: buildForgeGeneratedProcessEnv(),
      windowsHide: true,
      stdio: "pipe",
    })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill()
      stderr += "\nDocker sandbox command timed out."
    }, COMMAND_TIMEOUT_MS)

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8") })
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8") })
    child.once("error", (error) => {
      clearTimeout(timer)
      resolve({
        name,
        command: `docker ${args.join(" ")}`,
        status: "failed",
        exitCode: null,
        durationMs: Date.now() - started,
        stdout: truncateForgeQaLog(stdout),
        stderr: truncateForgeQaLog(`${stderr}\n${error.message}`),
        skippedReason: null,
      })
    })
    child.once("exit", (code) => {
      clearTimeout(timer)
      resolve({
        name,
        command: `docker ${args.join(" ")}`,
        status: code === 0 ? "passed" : "failed",
        exitCode: code,
        durationMs: Date.now() - started,
        stdout: truncateForgeQaLog(stdout),
        stderr: truncateForgeQaLog(stderr),
        skippedReason: null,
      })
    })
  })
}

async function saveQaReport(projectId: number, report: ForgeQaReport, taskId: number, now: Date) {
  const content = buildForgeQaArtifactContent(report)
  const [existing] = await db.select().from(forgeArtifacts).where(and(
    eq(forgeArtifacts.projectId, projectId),
    eq(forgeArtifacts.type, "qa_report"),
    eq(forgeArtifacts.title, FORGE_QA_ARTIFACT_TITLE),
  )).orderBy(desc(forgeArtifacts.version), desc(forgeArtifacts.updatedAt)).limit(1)

  const metadataJson = {
    ...(existing?.metadataJson ?? {}),
    kind: FORGE_QA_ARTIFACT_KIND,
    status: report.status,
    report,
    taskId,
  }

  return saveVersionedForgeArtifact({
    projectId,
    type: "qa_report",
    title: FORGE_QA_ARTIFACT_TITLE,
    content,
    metadataJson,
    action: "qa_report_version_saved",
    message: `Saved QA report artifact version for project ${projectId}.`,
    retentionPolicy: "qa-log",
    now,
  })
}

async function loadQaContext(projectId: number) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeQaAgentError("Forge project not found.", 404)

  const [workspaceMemories, generatedCodeArtifacts, qaArtifacts, seoArtifacts, resendIntegrations, whatsappIntegrations] = await Promise.all([
    db.select({ value: forgeMemories.value }).from(forgeMemories).where(and(
      eq(forgeMemories.projectId, projectId),
      eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY),
    )).limit(1),
    db.select({ id: forgeArtifacts.id }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "generated_code"),
      eq(forgeArtifacts.title, FORGE_GENERATED_CODE_ARTIFACT_TITLE),
    )).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "qa_report"),
      eq(forgeArtifacts.title, FORGE_QA_ARTIFACT_TITLE),
    )).orderBy(desc(forgeArtifacts.updatedAt)).limit(1),
    db.select({ metadataJson: forgeArtifacts.metadataJson }).from(forgeArtifacts).where(and(
      eq(forgeArtifacts.projectId, projectId),
      eq(forgeArtifacts.type, "seo_pack"),
      eq(forgeArtifacts.title, FORGE_SEO_ARTIFACT_TITLE),
    )).orderBy(desc(forgeArtifacts.updatedAt)).limit(1),
    db.select({
      configJson: forgeIntegrationConfigs.configJson,
      enabled: forgeIntegrationConfigs.enabled,
    }).from(forgeIntegrationConfigs).where(and(
      eq(forgeIntegrationConfigs.projectId, projectId),
      eq(forgeIntegrationConfigs.provider, FORGE_RESEND_PROVIDER),
    )).limit(1),
    db.select({
      configJson: forgeIntegrationConfigs.configJson,
      enabled: forgeIntegrationConfigs.enabled,
    }).from(forgeIntegrationConfigs).where(and(
      eq(forgeIntegrationConfigs.projectId, projectId),
      eq(forgeIntegrationConfigs.provider, FORGE_WHATSAPP_PROVIDER),
    )).limit(1),
  ])

  return {
    project,
    workspace: readForgeWorkspaceMemory(workspaceMemories[0]?.value),
    hasGeneratedCode: generatedCodeArtifacts.length > 0,
    qaState: readForgeQaArtifact(qaArtifacts[0]?.metadataJson),
    seoPack: readForgeSeoArtifact(seoArtifacts[0]?.metadataJson).pack,
    resendConfig: readForgeResendConfig(resendIntegrations[0]?.configJson, resendIntegrations[0]?.enabled),
    whatsappConfig: readForgeWhatsAppConfig(whatsappIntegrations[0]?.configJson, whatsappIntegrations[0]?.enabled),
  }
}

async function runResendFormCheck(workspace: ForgeWorkspaceMetadata, resendConfig: ForgeResendConfig) {
  const [contactRoute, config, validation, template] = await Promise.all([
    fileExists(workspace, "src/app/api/contact/route.ts"),
    fileExists(workspace, "src/lib/resend-config.ts"),
    fileExists(workspace, "src/lib/contact-validation.ts"),
    fileExists(workspace, "src/lib/email-template.ts"),
  ])

  return buildResendFormQaResult({ contactRoute, config, validation, template }, resendConfig.enabled)
}

async function runWhatsAppLinkCheck(workspace: ForgeWorkspaceMetadata, whatsappConfig: ForgeWhatsAppConfig) {
  const [config, cta, sticky] = await Promise.all([
    fileExists(workspace, "src/lib/whatsapp-config.ts"),
    fileExists(workspace, "src/components/WhatsAppCTA.tsx"),
    fileExists(workspace, "src/components/StickyWhatsAppButton.tsx"),
  ])

  return buildWhatsAppLinkQaResult({ config, cta, sticky }, whatsappConfig)
}

async function runSeoCheck(workspace: ForgeWorkspaceMetadata, seoPack: ForgeSeoPack | null) {
  const [sitemap, robots, seoLib] = await Promise.all([
    fileExists(workspace, "src/app/sitemap.ts"),
    fileExists(workspace, "src/app/robots.ts"),
    fileExists(workspace, "src/lib/seo.ts"),
  ])

  return buildSeoScoreQaResult(seoPack, { sitemap, robots, seoLib })
}

async function runReducedMotionCheck(workspace: ForgeWorkspaceMetadata) {
  const [globalsCss, motionSection, animationConfig] = await Promise.all([
    readForgeWorkspaceFile(workspace, "src/app/globals.css").catch(() => null),
    readForgeWorkspaceFile(workspace, "src/components/MotionSection.tsx").catch(() => null),
    fileExists(workspace, "src/lib/animation-config.ts"),
  ])

  return buildReducedMotionQaResult({ globalsCss, motionSection, animationConfig })
}

async function fileExists(workspace: ForgeWorkspaceMetadata, path: string) {
  return readForgeWorkspaceFile(workspace, path).then(() => true).catch(() => false)
}

async function readRelevantFiles(workspace: ForgeWorkspaceMetadata, paths: string[]) {
  const files: { path: string; content: string }[] = []
  for (const path of paths) {
    const content = await readForgeWorkspaceFile(workspace, path).catch(() => null)
    if (content !== null) files.push({ path, content: content.slice(0, 30_000) })
  }
  return files
}

async function markTaskRunning(projectId: number, taskId: number, actor: string, action: string, message: string, now: Date) {
  await db.transaction(async (tx) => {
    await tx.update(forgeTasks).set({ status: "running", startedAt: now, updatedAt: now }).where(eq(forgeTasks.id, taskId))
    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action,
      message,
      metadataJson: { taskId },
    })
  })
}

async function markTaskFailed(projectId: number, taskId: number, actor: string, action: string, message: string, error: string, now: Date) {
  await db.transaction(async (tx) => {
    await tx.update(forgeTasks).set({
      status: "failed",
      error,
      outputJson: { error },
      completedAt: now,
      updatedAt: now,
    }).where(eq(forgeTasks.id, taskId))
    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action,
      message,
      metadataJson: { taskId, error },
    })
  })
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm"
}
