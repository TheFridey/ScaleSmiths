import "server-only"
import { randomUUID } from "node:crypto"
import { and, desc, eq } from "drizzle-orm"
import {
  FORGE_COMMAND_CHAT_MEMORY_KEY,
  FORGE_COMMAND_CLASSIFICATION_SCHEMA,
  appendForgeCommandMessages,
  classifyForgeCommandHeuristic,
  forgeCommandLabel,
  forgeCommandRequiresConfirmation,
  readForgeCommandChatMemory,
  type ForgeCommandChatMessage,
  type ForgeCommandChatState,
  type ForgeCommandClassification,
} from "@/lib/forge-command-chat"
import { db } from "@/lib/db"
import { forgeActivityLogs, forgeMemories, forgeProjects, forgeTasks } from "@/lib/schema"
import { ForgeAiError, runForgeAiJson } from "./forge-ai"
import { runForgeCopyAgent } from "./forge-copy-agent"
import { runForgeDesignAgent } from "./forge-design-agent"
import { runForgeFrontendCodeAgent } from "./forge-frontend-code-agent"
import { runForgeProposalAgent } from "./forge-proposal-agent"
import { runForgeQaAgent, runForgeRepairAgent } from "./forge-qa-agent"

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
  const classification = await classifyCommand(project, cleaned, state)
  const requiresConfirmation = forgeCommandRequiresConfirmation(classification.intent) || classification.requiresConfirmation

  const [routerTask] = await db.transaction(async (tx) => {
    const [task] = await tx.insert(forgeTasks).values({
      projectId,
      title: `Command chat: ${forgeCommandLabel(classification.intent)}`,
      description: "Classify a project-level Forge command and route it to an approved pipeline action.",
      agentType: "strategy",
      status: "running",
      inputJson: {
        message: cleaned,
        confirmed,
        classification,
      },
      startedAt: now,
      updatedAt: now,
    }).returning()

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: "command_chat_classified",
      message: `Forge command classified as ${classification.intent}.`,
      metadataJson: {
        taskId: task.id,
        classification,
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
      assistantContent: `${classification.summary} This is a guarded ${forgeCommandLabel(classification.intent).toLowerCase()} and needs confirmation before Forge runs it. No files were changed.`,
      requiresConfirmation: true,
    })
  }

  try {
    const actionResult = await executeApprovedCommand(projectId, actor, classification)
    return completeCommand({
      projectId,
      actor,
      state,
      userMessage,
      taskId: routerTask.id,
      classification,
      status: "completed",
      output: actionResult,
      assistantContent: actionResult.message,
    })
  } catch (error) {
    const safeMessage = error instanceof ForgeAiError
      ? error.safeMessage
      : error instanceof Error && "safeMessage" in error && typeof error.safeMessage === "string"
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
      assistantContent: `I classified this as ${classification.intent}, but the approved Forge action could not run: ${safeMessage}`,
    })
  }
}

async function classifyCommand(
  project: { name: string; businessName: string; industry: string | null; status: string },
  message: string,
  state: ForgeCommandChatState,
) {
  const mockData = classifyForgeCommandHeuristic(message)
  const result = await runForgeAiJson<ForgeCommandClassification>({
    taskType: "planning",
    schemaName: "forge_command_classification",
    schema: FORGE_COMMAND_CLASSIFICATION_SCHEMA,
    systemPrompt: [
      "You are the ScaleSmiths Forge Command Router.",
      "Classify the user request into one approved Forge control intent.",
      "This is not a chatbot. Do not invent file edits or unapproved actions.",
      "Mark repair_run and code_update as requiring confirmation.",
    ].join(" "),
    prompt: [
      "Project:",
      `- Name: ${project.name}`,
      `- Business: ${project.businessName}`,
      `- Industry: ${project.industry ?? "Not set"}`,
      `- Status: ${project.status}`,
      "",
      "Recent command context:",
      ...state.messages.slice(-8).map((item) => `- ${item.role}: ${item.content}`),
      "",
      "User command:",
      message,
    ].join("\n"),
    maxTokens: 500,
    timeoutMs: 15_000,
    maxRetries: 1,
    mockData,
  })

  const data = result.data
  return {
    ...data,
    confidence: Math.max(0, Math.min(1, data.confidence)),
    requiresConfirmation: data.requiresConfirmation || forgeCommandRequiresConfirmation(data.intent),
  }
}

async function executeApprovedCommand(projectId: number, actor: string, classification: ForgeCommandClassification) {
  switch (classification.intent) {
    case "copy_update": {
      const pagePath = classification.target === "/" ? "/" : null
      const result = await runForgeCopyAgent(projectId, actor, pagePath)
      return {
        message: pagePath ? "I routed this to the Copy Agent and regenerated homepage copy from approved sitemap context." : "I routed this to the Copy Agent and regenerated the approved copy document.",
        result,
      }
    }
    case "design_update": {
      const preferPremium = /premium|luxury|cinematic/i.test(`${classification.summary} ${classification.target} ${classification.reason}`)
      const result = await runForgeDesignAgent(projectId, actor, preferPremium ? "Luxury Dark" : null, preferPremium ? "Cinematic Hero" : null)
      return {
        message: "I routed this to the Design Agent. Review and approve the new design direction before code generation.",
        result,
      }
    }
    case "code_update": {
      const result = await runForgeFrontendCodeAgent(projectId, actor)
      return {
        message: "I regenerated the generated site from approved artifacts only. Forge did not perform blind file edits.",
        result,
      }
    }
    case "integration_update":
      return {
        message: integrationGuidance(classification),
        result: { routed: "integration_update", target: classification.target },
      }
    case "qa_run": {
      const result = await runForgeQaAgent(projectId, actor)
      return {
        message: "I routed this to generated-site QA. The result is based on actual checks, not AI claims.",
        result,
      }
    }
    case "repair_run": {
      const result = await runForgeRepairAgent(projectId, actor)
      return {
        message: "I routed this to the Repair Agent after confirmation. Any patch is restricted to the generated workspace.",
        result,
      }
    }
    case "proposal_generate": {
      const result = await runForgeProposalAgent(projectId, actor, "proposal")
      return {
        message: "I generated the proposal pack from the available Forge project artifacts.",
        result,
      }
    }
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
    classification.intent,
    requiresConfirmation ? "needs_confirmation" : status,
    taskId,
    requiresConfirmation,
  )
  const nextState = appendForgeCommandMessages(state, [
    { ...userMessage, intent: classification.intent, status: "classified", taskId, requiresConfirmation },
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

    const [existingMemory] = await tx
      .select({ id: forgeMemories.id })
      .from(forgeMemories)
      .where(and(eq(forgeMemories.projectId, projectId), eq(forgeMemories.key, FORGE_COMMAND_CHAT_MEMORY_KEY)))
      .orderBy(desc(forgeMemories.updatedAt))
      .limit(1)

    const memoryValues = {
      value: JSON.stringify(nextState),
      source: "forge_command_chat",
      updatedAt: completedAt,
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

    await tx.insert(forgeActivityLogs).values({
      projectId,
      actor,
      action: status === "failed" ? "command_chat_failed" : requiresConfirmation ? "command_chat_confirmation_required" : "command_chat_completed",
      message: status === "failed"
        ? `Forge command failed after classification as ${classification.intent}.`
        : requiresConfirmation
          ? `Forge command requires confirmation before running ${classification.intent}.`
          : `Forge command routed to ${classification.intent}.`,
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
  intent: ForgeCommandClassification["intent"] | null = null,
  status: ForgeCommandChatMessage["status"] = null,
  taskId: number | null = null,
  requiresConfirmation = false,
): ForgeCommandChatMessage {
  return {
    id: randomUUID(),
    role,
    content,
    createdAt,
    intent,
    status,
    taskId,
    requiresConfirmation,
  }
}

function integrationGuidance(classification: ForgeCommandClassification) {
  if (classification.target === "whatsapp") {
    return "I mapped this to the WhatsApp integration. Configure the WhatsApp number and placements in the WhatsApp CTAs panel, then regenerate the site so Forge writes the CTA module. No files were edited from chat."
  }
  if (classification.target === "resend") {
    return "I mapped this to the Resend integration. Configure sender/recipient settings in the Resend panel, then regenerate the site so Forge writes the contact route. API keys stay in environment variables."
  }
  return "I mapped this to an integration update. Use the relevant Forge integration panel first, then regenerate the site from approved artifacts. Chat did not edit files directly."
}
