import "server-only"
import { randomUUID } from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import {
  FORGE_COMMAND_CHAT_MEMORY_KEY,
  appendForgeCommandMessages,
  forgeCommandLabel,
  forgeCommandRequiresConfirmation,
  readForgeCommandChatMemory,
  type ForgeCommandChatMessage,
  type ForgeCommandChatState,
  type ForgeCommandClassification,
} from "@/lib/forge-command-chat"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeMemories, forgeProjects, forgeTasks } from "@/lib/schema"
import { enqueueForgeJob, processForgeJob } from "./forge-job-runner"
import { classifyCommand, commandRouteView, routeCommandToForgeJob } from "./forge-command-router"

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export class ForgeCommandChatError extends Error {
  safeMessage: string
  status: number

  constructor(safeMessage: string, status = 500) {
    super(safeMessage)
    this.name = "ForgeCommandChatError"
    this.safeMessage = safeMessage
    this.status = status
  }
}

export async function getForgeCommandChatState(projectId: number) {
  const [memory] = await db
    .select({ value: forgeMemories.value })
    .from(forgeMemories)
    .where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_COMMAND_CHAT_MEMORY_KEY)))
    .orderBy(desc(forgeMemories.updatedAt))
    .limit(1)

  return readForgeCommandChatMemory(memory?.value)
}

export async function runForgeCommandChat(projectId: number, actor: string, message: string, confirmed = false) {
  const cleaned = message.trim().slice(0, 1200)
  if (!cleaned) throw new ForgeCommandChatError("Enter a Forge command first.", 400)

  const [project] = await db.select().from(forgeProjects).where(eq(forgeProjects.id, projectId)).limit(1)
  if (!project) throw new ForgeCommandChatError("Forge project not found.", 404)

  const now = new Date()
  const startedAt = now.toISOString()
  const state = await getForgeCommandChatState(projectId)
  const userMessage = buildMessage("user", cleaned, startedAt)
  const classification = await classifyCommand({ projectId, project, message: cleaned, state })
  const requiresConfirmation = forgeCommandRequiresConfirmation(classification.action) || classification.requiresConfirmation

  const [routerTask] = await db.transaction(async (tx) => {
    const [task] = await tx.insert(forgeTasks).values({
      projectId,
      title: `Command chat: ${forgeCommandLabel(classification.action)}`,
      description: "Classify a project-level Forge command and create a queued Forge job.",
      agentType: "strategy",
      status: "queued",
      inputJson: {
        message: cleaned,
        confirmed,
        classification,
        route: commandRouteView(classification),
      },
      updatedAt: now,
    }).returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "command_chat_classified",
      message: `Forge command classified as ${classification.action}.`,
      metadataJson: {
        taskId: task.id,
        classification,
        route: commandRouteView(classification),
        confirmed,
      },
    })

    return [task]
  })

  if (project.status === "archived") {
    return completeCommand({
      projectId,
      actor,
      state,
      userMessage,
      taskId: routerTask.id,
      classification,
      status: "failed",
      output: { error: "Archived Forge projects cannot run command chat actions." },
      assistantContent: "This project is archived, so I classified the command but did not run any pipeline action.",
    })
  }

  if (requiresConfirmation && !confirmed) {
    return completeCommand({
      projectId,
      actor,
      state,
      userMessage,
      taskId: routerTask.id,
      classification,
      status: "completed",
      output: {
        requiresConfirmation: true,
        reason: classification.reason,
      },
      assistantContent: `${classification.summary} This is a guarded ${forgeCommandLabel(classification.action).toLowerCase()} and needs confirmation before Forge runs it. No files were changed.`,
      requiresConfirmation: true,
    })
  }

  try {
    const jobRoute = routeCommandToForgeJob(classification)
    const assistantMessageId = randomUUID()
    const outcome = await enqueueForgeJob({
      projectId,
      kind: jobRoute.kind,
      actor,
      payload: {
        ...jobRoute.payload,
        commandTaskId: routerTask.id,
        commandMessageId: assistantMessageId,
      },
      mode: "background",
      autoStart: false,
    })

    const queued = await queueCommand({
      projectId,
      actor,
      state,
      userMessage,
      taskId: routerTask.id,
      jobId: outcome.jobId,
      assistantMessageId,
      classification,
      assistantContent: buildQueuedMessage(classification, routerTask.id, outcome.jobId),
    })
    void processForgeJob(outcome.jobId, { propagate: false }).catch(() => undefined)
    return queued
  } catch (error) {
    const safeMessage = error instanceof Error && "safeMessage" in error && typeof error.safeMessage === "string"
        ? error.safeMessage
        : error instanceof Error
          ? error.message
          : "Forge command failed."

    return completeCommand({
      projectId,
      actor,
      state,
      userMessage,
      taskId: routerTask.id,
      classification,
      status: "failed",
      output: { error: safeMessage },
      assistantContent: `I classified this as ${classification.action}, but the Forge job could not be queued: ${safeMessage}`,
    })
  }
}

async function queueCommand({
  projectId,
  actor,
  state,
  userMessage,
  taskId,
  jobId,
  assistantMessageId,
  classification,
  assistantContent,
}: {
  projectId: number
  actor: string
  state: ForgeCommandChatState
  userMessage: ForgeCommandChatMessage
  taskId: number
  jobId: number
  assistantMessageId: string
  classification: ForgeCommandClassification
  assistantContent: string
}) {
  const queuedAt = new Date()
  const assistantMessage = buildMessage(
    "assistant",
    assistantContent,
    queuedAt.toISOString(),
    classification.action,
    "queued",
    taskId,
    false,
    jobId,
    assistantMessageId,
  )
  const nextState = appendForgeCommandMessages(state, [
    { ...userMessage, action: classification.action, intent: classification.action, status: "classified", taskId, jobId, requiresConfirmation: false },
    assistantMessage,
  ], queuedAt.toISOString())

  await db.transaction(async (tx) => {
    await tx.update(forgeTasks).set({
      status: "queued",
      outputJson: {
        classification,
        route: commandRouteView(classification),
        jobId,
      },
      error: null,
      updatedAt: queuedAt,
    }).where(eq(forgeTasks.id, taskId))

    await upsertCommandMemory(tx, projectId, nextState, queuedAt)

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "command_job_queued",
      message: `Forge command queued ${classification.action} as job ${jobId}.`,
      metadataJson: {
        taskId,
        jobId,
        classification,
        route: commandRouteView(classification),
      },
    })
  })

  return {
    ok: true,
    queued: true,
    taskId,
    jobId,
    classification,
    route: commandRouteView(classification),
    chat: nextState,
    message: assistantMessage,
  }
}

async function completeCommand({
  projectId,
  actor,
  state,
  userMessage,
  taskId,
  classification,
  status,
  output,
  assistantContent,
  requiresConfirmation = false,
}: {
  projectId: number
  actor: string
  state: ForgeCommandChatState
  userMessage: ForgeCommandChatMessage
  taskId: number
  classification: ForgeCommandClassification
  status: "completed" | "failed"
  output: Record<string, unknown>
  assistantContent: string
  requiresConfirmation?: boolean
}) {
  const completedAt = new Date()
  const assistantMessage = buildMessage(
    "assistant",
    assistantContent,
    completedAt.toISOString(),
    classification.action,
    requiresConfirmation ? "needs_confirmation" : status,
    taskId,
    requiresConfirmation,
  )
  const nextState = appendForgeCommandMessages(state, [
    { ...userMessage, action: classification.action, intent: classification.action, status: "classified", taskId, requiresConfirmation },
    assistantMessage,
  ], completedAt.toISOString())

  await db.transaction(async (tx) => {
    await tx.update(forgeTasks).set({
      status,
      outputJson: {
        classification,
        ...output,
      },
      error: status === "failed" && typeof output.error === "string" ? output.error : null,
      completedAt,
      updatedAt: completedAt,
    }).where(eq(forgeTasks.id, taskId))

    await upsertCommandMemory(tx, projectId, nextState, completedAt)

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: status === "failed" ? "command_chat_failed" : requiresConfirmation ? "command_chat_confirmation_required" : "command_chat_completed",
      message: status === "failed"
        ? `Forge command failed after classification as ${classification.action}.`
        : requiresConfirmation
          ? `Forge command requires confirmation before running ${classification.action}.`
          : `Forge command routed to ${classification.action}.`,
      metadataJson: {
        taskId,
        classification,
        requiresConfirmation,
      },
    })
  })

  return {
    ok: status === "completed",
    taskId,
    classification,
    requiresConfirmation,
    chat: nextState,
    message: assistantMessage,
  }
}

function buildMessage(
  role: "user" | "assistant",
  content: string,
  createdAt: string,
  action: ForgeCommandClassification["action"] | null = null,
  status: ForgeCommandChatMessage["status"] = null,
  taskId: number | null = null,
  requiresConfirmation = false,
  jobId: number | null = null,
  id: string = randomUUID(),
): ForgeCommandChatMessage {
  return {
    id,
    role,
    content,
    createdAt,
    action,
    intent: action,
    status,
    taskId,
    jobId,
    requiresConfirmation,
  }
}

async function upsertCommandMemory(tx: DbTransaction, projectId: number, nextState: ForgeCommandChatState, updatedAt: Date) {
  const [existingMemory] = await tx
    .select({ id: forgeMemories.id })
    .from(forgeMemories)
    .where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_COMMAND_CHAT_MEMORY_KEY)))
    .orderBy(desc(forgeMemories.updatedAt))
    .limit(1)

  const memoryValues = {
    value: JSON.stringify(nextState),
    source: "forge_command_chat",
    updatedAt,
  }
  if (existingMemory) {
    await tx.update(forgeMemories).set(memoryValues).where(eq(forgeMemories.id, existingMemory.id))
  } else {
    await tx.insert(forgeMemories).values({
      projectId,
      key: FORGE_COMMAND_CHAT_MEMORY_KEY,
      ...memoryValues,
    })
  }
}

function buildQueuedMessage(classification: ForgeCommandClassification, taskId: number, jobId: number) {
  return [
    "Job Created",
    `Task ID: ${taskId}`,
    `Job ID: ${jobId}`,
    "Status: Queued",
    "",
    `${forgeCommandLabel(classification.action)} has been queued for the Forge worker.`,
  ].join("\n")
}
