import "server-only"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  summarizeForgeGeneratedSiteDiff,
  validateForgeGeneratedSiteAgentRequest,
  type ForgeGeneratedSiteAgentCommand,
  type ForgeGeneratedSiteAgentRequest,
} from "@/lib/forge-generated-site-agent"
import { buildForgeDockerRunArgs, resolveForgeSandboxConfig, appendBoundedSandboxLog } from "@/lib/forge-sandbox"
import { buildForgeGeneratedProcessEnv } from "@/lib/forge-process-env"
import { classifyForgeRepairFailure, createForgeRepairLoop, evaluateForgeRepairAttempt, hashForgeRepairSnapshot } from "@/lib/forge-repair-loop"
import { FORGE_WORKSPACE_MEMORY_KEY, readForgeWorkspaceMemory } from "@/lib/forge-workspace"
import { forgeActivityLogs, forgeMemories, forgeProjects, forgeTasks } from "@/lib/schema"
import { assertForgeWorkspaceExecutionSafe, listForgeWorkspaceFiles, readForgeWorkspaceFile, writeForgeWorkspaceFile } from "./forge-workspace"
import { saveVersionedForgeArtifact } from "./forge-artifacts"

const COMMAND_TIMEOUT_MS = Math.min(Number.parseInt(process.env.FORGE_CODING_AGENT_COMMAND_TIMEOUT_MS ?? "180000", 10), 300_000)
interface AgentCommandResult extends Record<string, unknown> { command: ForgeGeneratedSiteAgentCommand; status: "passed" | "failed"; exitCode: number | null; durationMs: number; stdout: string; stderr: string; timedOut: boolean }

export class ForgeGeneratedSiteAgentError extends Error {
  constructor(public safeMessage: string, public status = 400) { super(safeMessage); this.name = "ForgeGeneratedSiteAgentError" }
}

export async function runForgeGeneratedSiteAgent(projectId: number, actor: string, input: ForgeGeneratedSiteAgentRequest) {
  const validated = validateForgeGeneratedSiteAgentRequest(input)
  if (!validated.ok) throw new ForgeGeneratedSiteAgentError(validated.error)
  const sandbox = resolveForgeSandboxConfig()
  if (sandbox.runner !== "docker") throw new ForgeGeneratedSiteAgentError("Generated-site coding agent commands require the Docker sandbox.", 503)

  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeGeneratedSiteAgentError("Forge project not found.", 404)
  if (project.status === "archived") throw new ForgeGeneratedSiteAgentError("Archived Forge projects cannot be modified.")
  const [memory] = await db.select().from(forgeMemories).where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_WORKSPACE_MEMORY_KEY))).limit(1)
  const workspace = readForgeWorkspaceMemory(memory?.value)
  if (!workspace) throw new ForgeGeneratedSiteAgentError("Create a generated-site workspace before running the coding agent.")
  const canonicalRoot = await assertForgeWorkspaceExecutionSafe(workspace)
  const inspectedFiles = await listForgeWorkspaceFiles(workspace)

  const now = new Date()
  const [task] = await db.insert(forgeTasks).values({
    projectId, title: "Generated-site implementation", description: validated.request.issue,
    agentType: "repair", status: "running", resultQuality: "requires_review",
    downstreamAllowed: false, humanApprovalRequired: true, publicationBlocked: true,
    inputJson: { issue: validated.request.issue, plan: validated.request.plan, affectedFiles: validated.request.affectedFiles, commands: validated.request.commands, workspace: workspace.relativePath },
    startedAt: now, updatedAt: now,
  }).returning()
  await audit(projectId, actor, "generated_site_agent_started", "Generated-site implementation agent started.", { taskId: task.id, workspace: workspace.relativePath, inspectedFiles, plan: validated.request.plan })

  const modifications: Array<Record<string, unknown>> = []
  const validationResults: Array<Record<string, unknown>> = []
  try {
    for (const change of validated.request.changes) {
      const before = await readForgeWorkspaceFile(workspace, change.path).catch(() => "")
      await writeForgeWorkspaceFile(workspace, change.path, change.content, { overwrite: true })
      const record = { path: change.path, reason: change.reason, beforeHash: hash(before), afterHash: hash(change.content), bytesWritten: Buffer.byteLength(change.content, "utf8") }
      modifications.push(record)
      await audit(projectId, actor, "generated_site_agent_file_modified", `Modified generated workspace file ${change.path}.`, { taskId: task.id, ...record })
    }

    let repairAttemptsUsed = 0
    let passed = await runValidationBatch(validated.request.commands, canonicalRoot, validationResults, projectId, actor, task.id)
    const originalFailureIds = failedCommandIds(validationResults)
    let repairLoop = originalFailureIds.length ? createForgeRepairLoop({
      originalFailureIds,
      allowedFiles: validated.request.affectedFiles,
      limits: { maximumAttempts: validated.request.maxRepairAttempts, maximumCost: validated.request.maximumCost!, maximumRuntimeMs: validated.request.maximumRuntimeMs!, minimumConfidence: validated.request.minimumConfidence! },
      escalationRule: validated.request.escalationRule!,
    }) : null
    for (const repair of validated.request.repairAttempts ?? []) {
      if (passed || !repairLoop || repairLoop.status !== "running") break
      repairAttemptsUsed += 1
      const beforeEvidence = evidenceFromResults(validationResults, canonicalRoot)
      const startedRepair = Date.now()
      for (const change of repair.changes) {
        const before = await readForgeWorkspaceFile(workspace, change.path).catch(() => "")
        await writeForgeWorkspaceFile(workspace, change.path, change.content, { overwrite: true })
        const record = { path: change.path, reason: change.reason, repairAttempt: repairAttemptsUsed, beforeHash: hash(before), afterHash: hash(change.content), bytesWritten: Buffer.byteLength(change.content, "utf8") }
        modifications.push(record)
        await audit(projectId, actor, "generated_site_agent_repair_modified", `Applied bounded repair to ${change.path}.`, { taskId: task.id, ...record })
      }
      await audit(projectId, actor, "generated_site_agent_repair_started", repair.summary, { taskId: task.id, repairAttempt: repairAttemptsUsed })
      passed = await runValidationBatch(validated.request.commands, canonicalRoot, validationResults, projectId, actor, task.id, repairAttemptsUsed)
      const afterEvidence = evidenceFromResults(validationResults, canonicalRoot)
      repairLoop = evaluateForgeRepairAttempt(repairLoop, {
        attempt: repairAttemptsUsed,
        category: classifyForgeRepairFailure(originalFailureIds[0] ?? "build"),
        failureClassification: originalFailureIds.join(","), before: beforeEvidence, after: afterEvidence,
        changedFiles: repair.changes.map((change) => change.path), validationOutput: afterEvidence.output,
        confidence: repair.confidence, cost: repair.cost, durationMs: Date.now() - startedRepair, status: passed ? "applied" : "failed",
      })
      passed = repairLoop.status === "succeeded"
      await audit(projectId, actor, "generated_site_agent_repair_evaluated", `Repair attempt ${repairAttemptsUsed} ${repairLoop.status}.`, { taskId: task.id, repairAttempt: repairAttemptsUsed, stopReason: repairLoop.stopReason, confidence: repair.confidence, cost: repair.cost, snapshotHash: afterEvidence.snapshotHash })
    }
    const completedAt = new Date()
    const output = { status: passed ? "awaiting_approval" : "validation_failed", plan: validated.request.plan, diff: summarizeForgeGeneratedSiteDiff(validated.request.changes), modifications, validationResults, repairLoop, inspectedFileCount: inspectedFiles.length, risks: passed ? ["Changes remain blocked from publication until explicit human approval."] : [repairLoop?.escalationRule ?? "One or more required validation commands failed."], repairAttemptsUsed, maxRepairAttempts: validated.request.maxRepairAttempts }
    await db.update(forgeTasks).set({ status: passed ? "completed" : "failed", resultQuality: passed ? "requires_review" : "failed", validationResult: { passed, commands: validationResults }, outputJson: output, error: passed ? null : "Generated-site validation failed.", completedAt, updatedAt: completedAt }).where(eq(forgeTasks.id, task.id))
    await saveVersionedForgeArtifact({
      projectId, type: "qa_report", title: "Generated-site repair loop", content: JSON.stringify(output, null, 2),
      metadataJson: { kind: "forge_repair_loop", repairLoop, taskId: task.id }, actor,
      action: "repair_loop_artifact_saved", message: `Saved repair-loop evidence for task ${task.id}.`, retentionPolicy: "qa-log",
      provenance: {
        sourceTaskId: task.id, provider: "deterministic", model: "forge-repair-loop-2026-07-12.1",
        promptIdentifier: "forge.repair-loop", promptVersion: "1.0.0", schemaIdentifier: "forge.repair-loop-report", schemaVersion: "1.0.0",
        inputContext: { issue: validated.request.issue, affectedFiles: validated.request.affectedFiles, originalFailureIds }, actor,
        validationResult: { valid: passed, originalFailureRevalidated: passed && (repairLoop ? repairLoop.status === "succeeded" : true), stopReason: repairLoop?.stopReason ?? null },
        qualityState: passed ? "requires_review" : "failed", approvalState: "unapproved",
      },
    })
    await audit(projectId, actor, passed ? "generated_site_agent_awaiting_approval" : "generated_site_agent_failed", passed ? "Generated-site changes passed validation and await human approval." : "Generated-site changes failed validation.", { taskId: task.id, passed, publicationBlocked: true })
    return { ok: passed, taskId: task.id, workspace: workspace.relativePath, ...output }
  } catch (error) {
    const completedAt = new Date()
    await db.update(forgeTasks).set({ status: "failed", resultQuality: "failed", error: "Generated-site implementation failed.", outputJson: { modifications, validationResults }, completedAt, updatedAt: completedAt }).where(eq(forgeTasks.id, task.id))
    await audit(projectId, actor, "generated_site_agent_failed", "Generated-site implementation agent failed safely.", { taskId: task.id, errorCategory: error instanceof ForgeGeneratedSiteAgentError ? "policy" : "execution" })
    throw error instanceof ForgeGeneratedSiteAgentError ? error : new ForgeGeneratedSiteAgentError("Generated-site implementation failed.", 500)
  }
}

function runApprovedDockerCommand(command: ForgeGeneratedSiteAgentCommand, workspaceRoot: string) {
  const config = resolveForgeSandboxConfig()
  const args = buildForgeDockerRunArgs({ workspaceRoot, command, config, network: "none" })
  const started = Date.now()
  return new Promise<AgentCommandResult>((resolve) => {
    const child = spawn("docker", args, { cwd: workspaceRoot, env: buildForgeGeneratedProcessEnv(), windowsHide: true, stdio: "pipe" })
    let stdout = "", stderr = "", timedOut = false
    const timer = setTimeout(() => { timedOut = true; child.kill(); stderr = appendBoundedSandboxLog(stderr, "\nCommand timed out.").value }, COMMAND_TIMEOUT_MS)
    child.stdout.on("data", (chunk: Buffer) => { stdout = appendBoundedSandboxLog(stdout, chunk.toString("utf8")).value })
    child.stderr.on("data", (chunk: Buffer) => { stderr = appendBoundedSandboxLog(stderr, chunk.toString("utf8")).value })
    child.once("error", (error) => { clearTimeout(timer); resolve({ command, status: "failed", exitCode: null, durationMs: Date.now() - started, stdout, stderr: appendBoundedSandboxLog(stderr, error.message).value, timedOut }) })
    child.once("exit", (code) => { clearTimeout(timer); resolve({ command, status: code === 0 && !timedOut ? "passed" : "failed", exitCode: code, durationMs: Date.now() - started, stdout, stderr, timedOut }) })
  })
}

async function runValidationBatch(commands: ForgeGeneratedSiteAgentCommand[], root: string, results: Array<Record<string, unknown>>, projectId: number, actor: string, taskId: number, repairAttempt = 0) {
  let passed = true
  for (const command of commands) {
    const result = { ...await runApprovedDockerCommand(command, root), repairAttempt }
    results.push(result)
    await audit(projectId, actor, "generated_site_agent_command_completed", `Generated-site validation ${result.status}: ${command}.`, { taskId, ...result })
    if (result.status === "failed") { passed = false; break }
  }
  return passed && results.slice(-commands.length).length === commands.length
}

function failedCommandIds(results: Array<Record<string, unknown>>) { return results.filter((result) => result.status === "failed").map((result) => String(result.command)) }
function evidenceFromResults(results: Array<Record<string, unknown>>, workspaceRoot: string) {
  const attempt = Number(results.at(-1)?.repairAttempt ?? 0)
  const batch = results.filter((result) => Number(result.repairAttempt ?? 0) === attempt)
  const failureIds = failedCommandIds(batch)
  const output = batch.map((result) => `${result.command}: ${result.status}\n${String(result.stderr ?? result.stdout ?? "")}`).join("\n")
  return { failureIds, summary: failureIds.length ? `Failed: ${failureIds.join(", ")}` : "Original failure revalidation passed.", output, snapshotHash: hashForgeRepairSnapshot({ workspaceRoot: workspaceRoot.replace(/.*generated-sites[\\/]/, "generated-sites/"), batch: batch.map(({ command, status, exitCode }) => ({ command, status, exitCode })) }) }
}

function hash(value: string) { return createHash("sha256").update(value).digest("hex") }
async function audit(projectId: number, actor: string, action: string, message: string, metadataJson: Record<string, unknown>) { await db.insert(forgeActivityLogs).values({ projectId, actor, action, message, metadataJson }) }
