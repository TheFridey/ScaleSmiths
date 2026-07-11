import "server-only"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import {
  FORGE_COMMAND_CLASSIFICATION_SCHEMA,
  classifyForgeCommandHeuristic,
  forgeCommandRequiresConfirmation,
  type ForgeCommandAction,
  type ForgeCommandChatState,
  type ForgeCommandClassification,
} from "@/lib/forge-command-chat"
import type { ForgeJobKind } from "@/lib/forge-jobs"
import { ForgeAiError, runForgeAiJson } from "./forge-ai"

export interface ForgeCommandRoute {
  action: ForgeCommandAction
  confidence: number
  projectId: number
  params: Record<string, unknown>
}

export interface ForgeCommandJobRoute {
  kind: ForgeJobKind
  payload: Record<string, unknown>
}

export async function classifyCommand({
  project,
  projectId,
  message,
  state,
}: {
  project: { name: string; businessName: string; industry: string | null; status: string }
  projectId: number
  message: string
  state: ForgeCommandChatState
}): Promise<ForgeCommandClassification> {
  const mockData = classifyForgeCommandHeuristic(message, projectId)

  try {
    const result = await runForgeAiJson<ForgeCommandClassification>({
      ...getForgeAgentRegistryReference("command_classification"),
      taskType: "planning",
      schemaName: "forge_command_classification",
      schema: FORGE_COMMAND_CLASSIFICATION_SCHEMA,
      systemPrompt: [
        "You are the ScaleSmiths Forge Command Router.",
        "Classify the user request into one approved Forge command action.",
        "Return only a route. Never execute actions, invent file edits, or claim work has completed.",
        "Allowed actions: copy_update, design_update, research_run, sitemap_run, site_generate, qa_run, repair_run, proposal_generate, export_run, preview_start.",
        "Mark repair_run and site_generate as requiring confirmation.",
      ].join(" "),
      prompt: [
        "Project:",
        `- ID: ${projectId}`,
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
      projectId,
      mockData,
    })

    return normaliseClassification(result.data, projectId)
  } catch (error) {
    if (error instanceof ForgeAiError) return normaliseClassification(mockData, projectId)
    throw error
  }
}

export function commandRouteView(classification: ForgeCommandClassification): ForgeCommandRoute {
  return {
    action: classification.action,
    confidence: classification.confidence,
    projectId: classification.projectId,
    params: classification.params,
  }
}

export function routeCommandToForgeJob(classification: ForgeCommandClassification): ForgeCommandJobRoute {
  const params = classification.params ?? {}
  const basePayload = {
    commandAction: classification.action,
    commandRoute: commandRouteView(classification),
    commandParams: params,
  }

  switch (classification.action) {
    case "copy_update":
      return {
        kind: "copy",
        payload: {
          ...basePayload,
          regeneratePagePath: typeof params.regeneratePagePath === "string" ? params.regeneratePagePath : null,
        },
      }
    case "design_update":
      return {
        kind: "design",
        payload: {
          ...basePayload,
          preferredStylePack: typeof params.preferredStylePack === "string" ? params.preferredStylePack : null,
          preferredAnimationPack: typeof params.preferredAnimationPack === "string" ? params.preferredAnimationPack : null,
        },
      }
    case "research_run":
      return { kind: "research", payload: basePayload }
    case "sitemap_run":
      return { kind: "sitemap", payload: basePayload }
    case "site_generate":
      return { kind: "generate_site", payload: basePayload }
    case "qa_run":
      return { kind: "qa", payload: basePayload }
    case "repair_run":
      return { kind: "repair", payload: basePayload }
    case "proposal_generate":
      return {
        kind: "proposal",
        payload: {
          ...basePayload,
          action: params.action === "audit" ? "audit" : "proposal",
        },
      }
    case "export_run":
      return {
        kind: "export",
        payload: {
          ...basePayload,
          kind: params.kind === "site" || params.kind === "audit" || params.kind === "handover" ? params.kind : "proposal",
        },
      }
    case "preview_start":
      return { kind: "preview_start", payload: basePayload }
  }
}

function normaliseClassification(data: ForgeCommandClassification, projectId: number): ForgeCommandClassification {
  const action = data.action
  return {
    ...data,
    action,
    projectId,
    confidence: Math.max(0, Math.min(1, data.confidence)),
    params: data.params && typeof data.params === "object" && !Array.isArray(data.params) ? data.params : {},
    target: typeof data.target === "string" ? data.target : "project",
    requiresConfirmation: Boolean(data.requiresConfirmation) || forgeCommandRequiresConfirmation(action),
  }
}
