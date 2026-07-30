import "server-only"
import { getForgeAgentRegistryReference } from "@/lib/forge-prompt-registry"
import {
  FORGE_COMMAND_CLASSIFICATION_SCHEMA,
  FORGE_COMMAND_INTENTS,
  FORGE_COMMAND_PLAN_SCHEMA,
  classifyForgeCommandHeuristic,
  forgeCommandRequiresConfirmation,
  planForgeCommandHeuristic,
  type ForgeCommandAction,
  type ForgeCommandChatState,
  type ForgeCommandClassification,
  type ForgeCommandPlan,
  type ForgeCommandPlannerContext,
} from "@/lib/forge-command-chat"
import { FORGE_RUN_STAGES } from "@/lib/forge-run-stages"
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

export async function planCommand({
  project,
  projectId,
  message,
  state,
  context,
}: {
  project: { name: string; businessName: string; industry: string | null; status: string }
  projectId: number
  message: string
  state: ForgeCommandChatState
  context: ForgeCommandPlannerContext
}): Promise<ForgeCommandPlan> {
  const fallback = planForgeCommandHeuristic(message, context)
  try {
    const result = await runForgeAiJson<ForgeCommandPlan>({
      ...getForgeAgentRegistryReference("command_classification"),
      taskType: "planning",
      schemaName: "forge_command_plan",
      schema: FORGE_COMMAND_PLAN_SCHEMA,
      systemPrompt: [
        "You are the ScaleSmiths Forge production planner.",
        "Propose a constrained plan only; never execute it.",
        `Supported intents: ${FORGE_COMMAND_INTENTS.join(", ")}.`,
        "Never invent file paths, claim a job completed, bypass an approval, or add unsupported actions.",
        "Keep affected stages in production order and preserve approved artifacts unless the request explicitly changes them.",
      ].join(" "),
      prompt: [
        `Project: ${projectId} / ${project.name} / ${project.businessName} / ${project.industry ?? "unknown"} / ${project.status}`,
        `Run: ${context.run ? `${context.run.id} ${context.run.status} ${context.run.currentStage ?? ""}` : "none"}`,
        `Artifacts: ${[...context.artifacts].join(", ") || "none"}`,
        `Integrations: ${[...context.integrations].join(", ") || "none"}`,
        "Recent commands:",
        ...state.messages.slice(-6).map((item) => `${item.role}: ${item.content}`),
        "User command:",
        message,
      ].join("\n"),
      maxTokens: 1400,
      timeoutMs: 20_000,
      maxRetries: 1,
      projectId,
      mockData: fallback,
    })
    return normalisePlan(result.data, fallback)
  } catch (error) {
    if (error instanceof ForgeAiError) return fallback
    throw error
  }
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
    case "code_generate":
      return { kind: "generate_site", payload: basePayload }
    case "qa_run":
      return { kind: "qa", payload: basePayload }
    case "visual_qa_run":
      return { kind: "visual_qa", payload: basePayload }
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
    case "component_spec_run":
      return { kind: "component_spec", payload: basePayload }
    case "seo_generate":
      return { kind: "seo", payload: basePayload }
    case "deploy_prepare":
      return { kind: "export", payload: { ...basePayload, kind: "site" } }
    case "build_complete_draft":
    case "continue_current_run":
    case "explain_current_state":
    case "resolve_current_failure":
    case "retry_failed_stage":
    case "apply_feedback":
    case "estimate_generate":
    case "deploy_execute":
      throw new ForgeAiError(`The ${classification.action} intent is handled by Forge Run orchestration rather than a standalone job.`)
  }
}

function normalisePlan(data: ForgeCommandPlan, fallback: ForgeCommandPlan): ForgeCommandPlan {
  const intent = FORGE_COMMAND_INTENTS.includes(data.intent) ? data.intent : fallback.intent
  const affectedStages = Array.isArray(data.affectedStages)
    ? data.affectedStages.filter((stage): stage is ForgeCommandPlan["affectedStages"][number] => fallback.affectedStages.includes(stage as ForgeCommandPlan["affectedStages"][number]) || FORGE_RUN_STAGES.includes(stage as ForgeCommandPlan["affectedStages"][number]))
    : fallback.affectedStages
  const steps = Array.isArray(data.steps) ? data.steps.filter((step) => step && FORGE_COMMAND_INTENTS.includes(step.action)).slice(0, 20) : fallback.steps
  return {
    intent,
    summary: typeof data.summary === "string" ? data.summary.slice(0, 1000) : fallback.summary,
    confidence: Math.max(0, Math.min(1, Number(data.confidence) || 0)),
    affectedStages,
    steps: steps.length ? steps : fallback.steps,
    assumptions: Array.isArray(data.assumptions) ? data.assumptions.filter((item): item is string => typeof item === "string").slice(0, 12) : fallback.assumptions,
    requiredApprovals: Array.isArray(data.requiredApprovals) ? data.requiredApprovals.filter((item): item is string => typeof item === "string").slice(0, 12) : fallback.requiredApprovals,
    estimatedCost: Math.max(0, Math.min(100, Number(data.estimatedCost) || 0)),
    stopConditions: Array.isArray(data.stopConditions) ? data.stopConditions.filter((item): item is string => typeof item === "string").slice(0, 12) : fallback.stopConditions,
    invalidatedArtifacts: Array.isArray(data.invalidatedArtifacts) ? data.invalidatedArtifacts.filter((item): item is string => typeof item === "string").slice(0, 30) : fallback.invalidatedArtifacts,
    userVisibleOutcome: typeof data.userVisibleOutcome === "string" ? data.userVisibleOutcome.slice(0, 1000) : fallback.userVisibleOutcome,
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
