import "server-only"
import { randomUUID } from "node:crypto"
import { and, desc, eq, isNull } from "drizzle-orm"
import {
  FORGE_COMMAND_CHAT_MEMORY_KEY,
  appendForgeCommandMessages,
  forgeCommandLabel,
  forgeCommandSuggestions,
  readForgeCommandChatMemory,
  validateForgeCommandPlan,
  type ForgeCommandChatMessage,
  type ForgeCommandChatState,
  type ForgeCommandPlan,
  type ForgeCommandPlannerContext,
} from "@/lib/forge-command-chat"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeArtifacts, forgeDeploymentCandidates, forgeIntegrationConfigs, forgeMemories, forgeProjects } from "@/lib/schema"
import { enqueueForgeJob, processForgeJob } from "./forge-job-runner"
import { planCommand, routeCommandToForgeJob } from "./forge-command-router"
import {
  continueForgeRun,
  createForgeRun,
  getCurrentForgeRun,
  invalidateForgeRunStages,
  recordForgeRunCommandEvent,
  resumeForgeRun,
  retryForgeRunStep,
  startForgeRun,
} from "./forge-run-orchestrator"
import { loadForgeAiUsageBudgetSnapshot } from "./forge-ai-usage"
import { createProjectEstimateSnapshot } from "./project-estimator"
import { runForgeDeployAgent } from "./forge-deploy-agent"
import type { ForgeRunStatus, ForgeRunStepStatus } from "@/lib/forge-run-stages"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export class ForgeCommandChatError extends Error {
  constructor(public safeMessage: string, public status = 500) {
    super(safeMessage)
    this.name = "ForgeCommandChatError"
  }
}

export async function getForgeCommandChatState(projectId: number) {
  const [memory] = await db.select({ value: forgeMemories.value }).from(forgeMemories)
    .where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_COMMAND_CHAT_MEMORY_KEY)))
    .orderBy(desc(forgeMemories.updatedAt)).limit(1)
  return readForgeCommandChatMemory(memory?.value)
}

export async function getForgeCommandSuggestions(projectId: number, actor: string) {
  const { context } = await loadPlannerContext(projectId, actor)
  return forgeCommandSuggestions(context)
}

export async function runForgeCommandChat(projectId: number, actor: string, message: string, confirmed = false) {
  const cleaned = message.trim().slice(0, 1200)
  if (!cleaned) throw new ForgeCommandChatError("Enter a Forge command first.", 400)
  const [{ project, context }, state] = await Promise.all([loadPlannerContext(projectId, actor), getForgeCommandChatState(projectId)])
  const plan = await planCommand({ project, projectId, message: cleaned, state, context })
  const validation = validateForgeCommandPlan(plan, context)
  const now = new Date()
  const userMessage = buildMessage("user", cleaned, now.toISOString(), plan, "classified", context.run?.id ?? null)

  if (context.run) await recordForgeRunCommandEvent(context.run.id, actor, "command_plan_proposed", plan.summary, { plan, validation, confirmed })

  if (plan.confidence < .55) {
    return finish({
      projectId, actor, state, userMessage, plan, runId: context.run?.id ?? null, status: "needs_clarification",
      assistantContent: clarificationFor(plan), validation, activityAction: "command_plan_clarification_required",
    })
  }
  if (!validation.legal) {
    return finish({
      projectId, actor, state, userMessage, plan, runId: context.run?.id ?? null, status: "failed",
      assistantContent: `I cannot run this plan: ${validation.errors.join(" ")}`, validation, activityAction: "command_plan_rejected",
    })
  }
  if (validation.requiresConfirmation && !confirmed) {
    return finish({
      projectId, actor, state, userMessage, plan, runId: context.run?.id ?? null, status: "needs_confirmation",
      assistantContent: `${plan.summary} Review the affected stages, estimated cost and stop conditions, then confirm to run. No production action has started.`,
      validation, activityAction: "command_plan_confirmation_required", requiresConfirmation: true,
    })
  }

  if (context.run) await recordForgeRunCommandEvent(context.run.id, actor, "command_plan_confirmed", plan.summary, { plan, validation })
  try {
    const outcome = await executePlan(projectId, actor, plan, context)
    if (outcome.jobId) {
      const queued = await finish({
        projectId, actor, state, userMessage, plan, runId: outcome.runId, jobId: outcome.jobId, status: "queued",
        assistantContent: outcome.message, validation, activityAction: "command_plan_queued",
      })
      void processForgeJob(outcome.jobId, { propagate: false }).catch(() => undefined)
      return { ...queued, queued: true, jobId: outcome.jobId, runId: outcome.runId }
    }
    if (outcome.runId) await recordForgeRunCommandEvent(outcome.runId, actor, "command_plan_outcome", outcome.message, { plan })
    return finish({
      projectId, actor, state, userMessage, plan, runId: outcome.runId, status: "completed",
      assistantContent: outcome.message, validation, activityAction: "command_plan_completed",
    })
  } catch (error) {
    const safeMessage = error instanceof Error && "safeMessage" in error && typeof error.safeMessage === "string" ? error.safeMessage : error instanceof Error ? error.message : "Forge could not execute the validated plan."
    if (context.run) await recordForgeRunCommandEvent(context.run.id, actor, "command_plan_failed", safeMessage, { plan })
    return finish({
      projectId, actor, state, userMessage, plan, runId: context.run?.id ?? null, status: "failed",
      assistantContent: `The plan was valid, but execution stopped safely: ${safeMessage}`, validation, activityAction: "command_plan_failed",
    })
  }
}

async function executePlan(projectId: number, actor: string, plan: ForgeCommandPlan, context: ForgeCommandPlannerContext) {
  if (plan.intent === "explain_current_state") return { runId: context.run?.id ?? null, jobId: null, message: explainState(context) }
  if (plan.intent === "build_complete_draft") {
    let run = context.run ?? await createForgeRun({ projectId, actor })
    if (!run) throw new ForgeCommandChatError("Forge could not create the production run.")
    if (run.status === "draft") run = await startForgeRun(run.id, actor)
    else if (run.status === "paused") run = await resumeForgeRun(run.id, actor)
    else if (run.status === "failed") {
      const failed = run.steps.find((step) => step.status === "failed")
      if (!failed) throw new ForgeCommandChatError("The run is failed but no failed stage is available to retry.", 409)
      run = await retryForgeRunStep(run.id, failed.stage as Parameters<typeof retryForgeRunStep>[1], actor)
    }
    else if (run.status === "running") await continueForgeRun(run.id, actor)
    if (!run) throw new ForgeCommandChatError("Forge could not start the production run.")
    return { runId: run.id, jobId: null, message: `The first-draft pipeline is active at ${run.currentStage?.replaceAll("_", " ") ?? "the next ready stage"}. Forge will stop at missing prerequisites, budget limits, failures and human approval gates.` }
  }
  if (plan.intent === "continue_current_run") {
    if (!context.run) throw new ForgeCommandChatError("There is no current run to continue.", 409)
    if (context.run.status === "paused") await resumeForgeRun(context.run.id, actor)
    else if (context.run.status === "failed") {
      const failed = context.run.steps.find((step) => step.status === "failed")
      if (!failed) throw new ForgeCommandChatError("The run is marked failed but no failed stage was found.", 409)
      await retryForgeRunStep(context.run.id, failed.stage as Parameters<typeof retryForgeRunStep>[1], actor)
    } else await continueForgeRun(context.run.id, actor)
    return { runId: context.run.id, jobId: null, message: `Forge resumed the current run from ${context.run.currentStage?.replaceAll("_", " ") ?? "its next ready stage"} without duplicating completed work.` }
  }
  if (plan.intent === "resolve_current_failure" || plan.intent === "retry_failed_stage") {
    if (!context.run) throw new ForgeCommandChatError("There is no current run.", 409)
    const failed = context.run.steps.find((step) => step.status === "failed")
    if (!failed) throw new ForgeCommandChatError("No failed stage is available to retry.", 409)
    await retryForgeRunStep(context.run.id, failed.stage as Parameters<typeof retryForgeRunStep>[1], actor)
    return { runId: context.run.id, jobId: null, message: `${failed.stage.replaceAll("_", " ")} was reset for a policy-limited retry. The run will continue only if the retry validates.` }
  }
  if (plan.intent === "apply_feedback") {
    if (!context.run) throw new ForgeCommandChatError("Create a Forge Run before applying stage-scoped feedback.", 409)
    await invalidateForgeRunStages(context.run.id, plan.affectedStages, actor, plan.steps[0]?.summary ?? plan.summary)
    return { runId: context.run.id, jobId: null, message: `Applied the feedback scope and invalidated ${plan.affectedStages.length} affected stage${plan.affectedStages.length === 1 ? "" : "s"}. Unaffected approved artifacts remain intact.` }
  }
  if (plan.intent === "estimate_generate") {
    const estimate = await createProjectEstimateSnapshot(projectId)
    if (!estimate) throw new ForgeCommandChatError("Project context is incomplete for an estimate.", 409)
    return { runId: context.run?.id ?? null, jobId: null, message: `Created a fresh project estimate: ${estimate.estimatedHours} hours and £${Number(estimate.suggestedBuildPrice).toFixed(2)} suggested build value.` }
  }
  if (plan.intent === "deploy_execute") {
    await runForgeDeployAgent(projectId, actor, { action: "mark_deployed" })
    return { runId: context.run?.id ?? null, jobId: null, message: "Deployment policy checks passed and the project was marked deployed. The deployment record contains the authoritative method and timestamps." }
  }
  if (plan.intent === "deploy_prepare") {
    await runForgeDeployAgent(projectId, actor, { action: "prepare", method: "manual" })
    return { runId: context.run?.id ?? null, jobId: null, message: "Prepared the deployment checklist and notes. Forge has not deployed or bypassed any release gate." }
  }

  const classification = { action: plan.intent, confidence: plan.confidence, projectId, params: plan.steps[0]?.params ?? {}, summary: plan.summary, target: String(plan.steps[0]?.params.target ?? "project"), requiresConfirmation: false, reason: plan.stopConditions.join(" ") }
  const route = routeCommandToForgeJob(classification)
  const outcome = await enqueueForgeJob({
    projectId, kind: route.kind, actor,
    payload: { ...route.payload, commandPlan: plan, forgeRunId: context.run?.id ?? null },
    mode: "background", autoStart: false,
  })
  return { runId: context.run?.id ?? null, jobId: outcome.jobId, message: `${plan.userVisibleOutcome} Forge queued the validated ${forgeCommandLabel(plan.intent).toLowerCase()} action and will report its meaningful result when complete.` }
}

async function loadPlannerContext(projectId: number, actor: string) {
  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeCommandChatError("Forge project not found.", 404)
  const [run, artifacts, integrations, budget, approvedDeployment] = await Promise.all([
    getCurrentForgeRun(projectId),
    db.select({ type: forgeArtifacts.type, qualityState: forgeArtifacts.qualityState, approvalState: forgeArtifacts.approvalState }).from(forgeArtifacts).where(and(eq(forgeArtifacts.projectId, projectId), isNull(forgeArtifacts.supersededAt))),
    db.select({ provider: forgeIntegrationConfigs.provider }).from(forgeIntegrationConfigs).where(and(eq(forgeIntegrationConfigs.projectId, projectId), eq(forgeIntegrationConfigs.enabled, true))),
    loadForgeAiUsageBudgetSnapshot(projectId),
    db.select({ id: forgeDeploymentCandidates.id }).from(forgeDeploymentCandidates).where(and(eq(forgeDeploymentCandidates.projectId, projectId), eq(forgeDeploymentCandidates.state, "approved"))).limit(1),
  ])
  const context: ForgeCommandPlannerContext = {
    projectId,
    projectOwned: true,
    archived: project.status === "archived",
    run: run ? {
      id: run.id,
      status: run.status as ForgeRunStatus,
      currentStage: run.currentStage,
      steps: run.steps.map((step) => ({
        stage: step.stage,
        status: step.status as ForgeRunStepStatus,
        approvalRequired: step.approvalRequired,
      })),
    } : null,
    artifacts: new Set(artifacts.filter((artifact) => artifact.qualityState === "validated" || artifact.approvalState === "approved").map((artifact) => artifact.type)),
    integrations: new Set(integrations.map((integration) => integration.provider)),
    budgetBlocked: budget.project.blocked || budget.monthly.blocked,
    deploymentApproved: approvedDeployment.length > 0,
  }
  void actor
  return { project, context }
}

async function finish({
  projectId, actor, state, userMessage, plan, runId, status, assistantContent, validation, activityAction, requiresConfirmation = false, jobId = null,
}: {
  projectId: number; actor: string; state: ForgeCommandChatState; userMessage: ForgeCommandChatMessage; plan: ForgeCommandPlan; runId: number | null
  status: ForgeCommandChatMessage["status"]; assistantContent: string; validation: ReturnType<typeof validateForgeCommandPlan>
  activityAction: string; requiresConfirmation?: boolean; jobId?: number | null
}) {
  const now = new Date()
  const assistant = buildMessage("assistant", assistantContent, now.toISOString(), plan, status, runId, requiresConfirmation, jobId)
  const nextState = appendForgeCommandMessages(state, [{ ...userMessage, requiresConfirmation }, assistant], now.toISOString())
  await db.transaction(async (tx) => {
    await upsertCommandMemory(tx, projectId, nextState, now)
    await tx.insert(forgeActivityLogs).values({
      projectId, actor, action: activityAction, message: assistantContent,
      metadataJson: { runId, jobId, plan, validation, requiresConfirmation },
    })
  })
  return { ok: status !== "failed", requiresConfirmation, requiresClarification: status === "needs_clarification", plan, validation, runId, jobId, chat: nextState, message: assistant }
}

function buildMessage(role: "user" | "assistant", content: string, createdAt: string, plan: ForgeCommandPlan, status: ForgeCommandChatMessage["status"], runId: number | null, requiresConfirmation = false, jobId: number | null = null): ForgeCommandChatMessage {
  return { id: randomUUID(), role, content, createdAt, action: plan.intent, intent: plan.intent, status, taskId: null, jobId, runId, requiresConfirmation, plan }
}

async function upsertCommandMemory(tx: DbTransaction, projectId: number, state: ForgeCommandChatState, updatedAt: Date) {
  const [existing] = await tx.select({ id: forgeMemories.id }).from(forgeMemories)
    .where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_COMMAND_CHAT_MEMORY_KEY))).orderBy(desc(forgeMemories.updatedAt)).limit(1)
  const values = { value: JSON.stringify(state), source: "forge_command_chat", updatedAt }
  if (existing) await tx.update(forgeMemories).set(values).where(eq(forgeMemories.id, existing.id))
  else await tx.insert(forgeMemories).values({ projectId, key: FORGE_COMMAND_CHAT_MEMORY_KEY, ...values })
}

function explainState(context: ForgeCommandPlannerContext) {
  if (!context.run) return "This project has no current Forge Run. Approve a brief and start a first draft to begin production."
  const failed = context.run.steps.find((step) => step.status === "failed")
  const approval = context.run.steps.find((step) => step.status === "awaiting_approval")
  if (failed) return `The run failed at ${failed.stage.replaceAll("_", " ")}. No later stage has been claimed complete. Use “Fix the failed step and resume” to propose a guarded retry.`
  if (approval) return `The run is waiting for human approval at ${approval.stage.replaceAll("_", " ")}. Forge will not bypass that gate.`
  return `The run is ${context.run.status} at ${context.run.currentStage?.replaceAll("_", " ") ?? "its terminal state"}. ${context.budgetBlocked ? "The project budget is currently blocking paid execution." : "No budget block is recorded."}`
}

function clarificationFor(plan: ForgeCommandPlan) {
  if (plan.intent === "apply_feedback") return "Which page or element should change, and is this copy, design, functionality, or a combination? I will preserve unaffected approved work."
  return `I am not confident enough to run this safely. Please clarify the desired outcome and scope for “${plan.summary}”.`
}
