import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import type { ForgeRunStage, ForgeRunStatus, ForgeRunStepStatus } from "./forge-run-stages"

export const FORGE_COMMAND_CHAT_MEMORY_KEY = "forge_command_chat"
export const FORGE_COMMAND_CHAT_ARTIFACT_KIND = "forge_command_chat"

export const FORGE_COMMAND_INTENTS = [
  "build_complete_draft", "continue_current_run", "explain_current_state", "resolve_current_failure", "retry_failed_stage",
  "apply_feedback", "copy_update", "design_update", "research_run", "sitemap_run", "component_spec_run", "code_generate",
  "site_generate",
  "seo_generate", "qa_run", "visual_qa_run", "repair_run", "preview_start", "proposal_generate", "estimate_generate",
  "export_run", "deploy_prepare", "deploy_execute",
] as const

export type ForgeCommandIntent = (typeof FORGE_COMMAND_INTENTS)[number]
export type ForgeCommandAction = ForgeCommandIntent
export type ForgeCommandMessageRole = "user" | "assistant" | "system"
export type ForgeCommandMessageStatus = "classified" | "needs_clarification" | "needs_confirmation" | "queued" | "running" | "completed" | "failed"

export interface ForgeCommandPlanStep extends Record<string, JsonValue> {
  id: string
  action: ForgeCommandIntent
  stage: ForgeRunStage | ""
  summary: string
  params: Record<string, JsonValue>
  guarded: boolean
}

export interface ForgeCommandPlan extends Record<string, JsonValue> {
  intent: ForgeCommandIntent
  summary: string
  confidence: number
  affectedStages: ForgeRunStage[]
  steps: ForgeCommandPlanStep[]
  assumptions: string[]
  requiredApprovals: string[]
  estimatedCost: number
  stopConditions: string[]
  invalidatedArtifacts: string[]
  userVisibleOutcome: string
}

export interface ForgeCommandClassification extends Record<string, JsonValue> {
  action: ForgeCommandAction
  confidence: number
  projectId: number
  params: Record<string, JsonValue>
  summary: string
  target: string
  requiresConfirmation: boolean
  reason: string
}

export interface ForgeCommandChatMessage extends Record<string, JsonValue> {
  id: string
  role: ForgeCommandMessageRole
  content: string
  createdAt: string
  action: ForgeCommandAction | null
  intent: ForgeCommandIntent | null
  status: ForgeCommandMessageStatus | null
  taskId: number | null
  jobId: number | null
  runId: number | null
  requiresConfirmation: boolean
  plan: ForgeCommandPlan | null
}

export interface ForgeCommandChatState extends Record<string, JsonValue> {
  kind: typeof FORGE_COMMAND_CHAT_ARTIFACT_KIND
  messages: ForgeCommandChatMessage[]
  updatedAt: string
}

export interface ForgeCommandPlannerContext {
  projectId: number
  projectOwned: boolean
  archived: boolean
  run: { id: number; status: ForgeRunStatus; currentStage: string | null; steps: Array<{ stage: string; status: ForgeRunStepStatus; approvalRequired: boolean }> } | null
  artifacts: ReadonlySet<string>
  integrations: ReadonlySet<string>
  budgetBlocked: boolean
  deploymentApproved: boolean
}

export interface ForgeCommandPlanValidation {
  legal: boolean
  requiresConfirmation: boolean
  errors: string[]
  warnings: string[]
}

export const FORGE_COMMAND_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "summary", "confidence", "affectedStages", "steps", "assumptions", "requiredApprovals", "estimatedCost", "stopConditions", "invalidatedArtifacts", "userVisibleOutcome"],
  properties: {
    intent: { type: "string", enum: [...FORGE_COMMAND_INTENTS] },
    summary: { type: "string" },
    confidence: { type: "number" },
    affectedStages: { type: "array", items: { type: "string" } },
    steps: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "action", "stage", "summary", "params", "guarded"], properties: {
      id: { type: "string" }, action: { type: "string", enum: [...FORGE_COMMAND_INTENTS] }, stage: { type: "string" },
      summary: { type: "string" }, params: { type: "object", additionalProperties: true }, guarded: { type: "boolean" },
    } } },
    assumptions: { type: "array", items: { type: "string" } },
    requiredApprovals: { type: "array", items: { type: "string" } },
    estimatedCost: { type: "number" },
    stopConditions: { type: "array", items: { type: "string" } },
    invalidatedArtifacts: { type: "array", items: { type: "string" } },
    userVisibleOutcome: { type: "string" },
  },
} as const satisfies ForgeJsonSchema

export const FORGE_COMMAND_CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["action", "confidence", "projectId", "params", "summary", "target", "requiresConfirmation", "reason"],
  properties: {
    action: { type: "string", enum: [...FORGE_COMMAND_INTENTS] },
    confidence: { type: "number" },
    projectId: { type: "integer" },
    params: { type: "object", additionalProperties: true },
    summary: { type: "string" },
    target: { type: "string" },
    requiresConfirmation: { type: "boolean" },
    reason: { type: "string" },
  },
} as const satisfies ForgeJsonSchema

const INTENT_STAGE: Partial<Record<ForgeCommandIntent, ForgeRunStage>> = {
  research_run: "research", sitemap_run: "sitemap", copy_update: "copy", design_update: "design_direction",
  component_spec_run: "component_specification", code_generate: "code_generation", seo_generate: "seo_schema",
  site_generate: "code_generation",
  qa_run: "functional_qa", visual_qa_run: "visual_qa", repair_run: "repair", preview_start: "preview",
  proposal_generate: "client_review", estimate_generate: "client_review", export_run: "deploy_readiness",
  deploy_prepare: "deploy_readiness", deploy_execute: "deploy_readiness",
}

const GUARDED = new Set<ForgeCommandIntent>(["build_complete_draft", "resolve_current_failure", "retry_failed_stage", "apply_feedback", "copy_update", "design_update", "code_generate", "site_generate", "repair_run", "export_run", "deploy_prepare", "deploy_execute"])
const ESTIMATES: Record<ForgeCommandIntent, number> = {
  build_complete_draft: 1.82, continue_current_run: 0, explain_current_state: 0, resolve_current_failure: .18, retry_failed_stage: .18,
  apply_feedback: .5, copy_update: .22, design_update: .16, research_run: .12, sitemap_run: .1, component_spec_run: .12,
  code_generate: .45, site_generate: .45, seo_generate: .1, qa_run: .04, visual_qa_run: .08, repair_run: .18, preview_start: 0,
  proposal_generate: .12, estimate_generate: 0, export_run: 0, deploy_prepare: 0, deploy_execute: 0,
}

export function planForgeCommandHeuristic(message: string, context: Pick<ForgeCommandPlannerContext, "run">): ForgeCommandPlan {
  const text = message.toLowerCase()
  let intent: ForgeCommandIntent
  if (/why|explain|what.*failed|what.*approval|still needs.*approval|current state|what.*stopped/.test(text)) intent = "explain_current_state"
  else if (/fix.*failed|resolve.*fail/.test(text)) intent = "resolve_current_failure"
  else if (/retry.*failed|retry.*stage/.test(text)) intent = "retry_failed_stage"
  else if (/continue|resume|where it stopped/.test(text)) intent = "continue_current_run"
  else if (/complete.*draft|first draft|build.*complete|build the site/.test(text)) intent = "build_complete_draft"
  else if (/client feedback|apply.*feedback|request.*changes/.test(text)) intent = "apply_feedback"
  else if (/deploy now|execute.*deploy|launch now/.test(text)) intent = "deploy_execute"
  else if (/prepare.*deploy|deployment readiness|ready.*deploy/.test(text)) intent = "deploy_prepare"
  else if (/visual qa|screenshot.*qa/.test(text)) intent = "visual_qa_run"
  else if (/seo|schema|meta description/.test(text)) intent = "seo_generate"
  else if (/component spec|components/.test(text)) intent = "component_spec_run"
  else if (/generate.*code|build code|site generation/.test(text)) intent = "code_generate"
  else if (/repair|fix.*build|build error/.test(text)) intent = "repair_run"
  else if (/run qa|test|typecheck|lint|quality/.test(text)) intent = "qa_run"
  else if (/export|download|zip|handover pack/.test(text)) intent = "export_run"
  else if (/preview/.test(text)) intent = "preview_start"
  else if (/proposal|audit|sales doc/.test(text)) intent = "proposal_generate"
  else if (/estimate|cost this|quote this/.test(text)) intent = "estimate_generate"
  else if (/research|competitor|market|positioning/.test(text)) intent = "research_run"
  else if (/sitemap|site map|navigation|structure/.test(text)) intent = "sitemap_run"
  else if (/copy|headline|hero text|about page|homepage text/.test(text)) intent = "copy_update"
  else if (/design|premium|style|animation|colour|color|typography|visual/.test(text)) intent = "design_update"
  else if (/improve|change|update|regenerate/.test(text)) intent = "site_generate"
  else intent = context.run?.status === "failed" ? "explain_current_state" : "build_complete_draft"

  const affectedStages = stagesForIntent(intent, text, context.run)
  const steps = stepsForIntent(intent, affectedStages, message)
  const requiredApprovals = intent === "build_complete_draft" ? ["Preview/design approval", "Deployment approval"] : intent.startsWith("deploy") ? ["Deployment approval"] : []
  return {
    intent,
    summary: summaryForIntent(intent, message),
    confidence: confidenceForIntent(intent, text),
    affectedStages,
    steps,
    assumptions: assumptionsForIntent(intent, message),
    requiredApprovals,
    estimatedCost: ESTIMATES[intent],
    stopConditions: stopConditionsForIntent(intent),
    invalidatedArtifacts: invalidatedArtifactsForIntent(intent, affectedStages),
    userVisibleOutcome: outcomeForIntent(intent),
  }
}

export function validateForgeCommandPlan(plan: ForgeCommandPlan, context: ForgeCommandPlannerContext): ForgeCommandPlanValidation {
  const errors: string[] = []
  const warnings: string[] = []
  if (!isForgeCommandIntent(plan.intent) || plan.steps.some((step) => !isForgeCommandIntent(step.action))) errors.push("Plan contains an unsupported action.")
  if (!context.projectOwned) errors.push("The command is not scoped to an accessible project.")
  if (context.archived) errors.push("Archived projects cannot run production commands.")
  if (plan.confidence < .55) errors.push("Plan confidence is too low; clarification is required.")
  if (plan.steps.some((step) => containsInventedPath(step.params))) errors.push("Plans may not invent or accept filesystem paths.")
  if (plan.summary.match(/\b(completed|deployed successfully|job finished)\b/i)) errors.push("A proposed plan may not claim that work has completed.")
  if (!isLegalOrdering(plan.affectedStages)) errors.push("Plan stages are not in legal production order.")
  if (context.budgetBlocked && plan.estimatedCost > 0) errors.push("The project AI budget is exhausted.")
  if (needsRun(plan.intent) && !context.run) errors.push("This command requires an existing Forge Run.")
  if (plan.intent === "continue_current_run" && context.run && !["paused", "failed", "running"].includes(context.run.status)) errors.push(`A ${context.run.status} run cannot be continued.`)
  if (["resolve_current_failure", "retry_failed_stage"].includes(plan.intent) && !context.run?.steps.some((step) => step.status === "failed")) errors.push("There is no failed run stage to resolve or retry.")
  if (plan.intent === "repair_run" && !context.artifacts.has("generated_code")) errors.push("Repair requires a generated-code artifact.")
  if (["code_generate", "build_complete_draft"].includes(plan.intent) && !context.artifacts.has("handover_doc")) errors.push("An approved brief is required before code generation.")
  if (plan.intent === "preview_start" && !context.artifacts.has("generated_code")) errors.push("Preview requires generated code.")
  if (plan.intent === "visual_qa_run" && !context.artifacts.has("generated_code")) errors.push("Visual QA requires generated code.")
  if (plan.intent === "copy_update" && !context.artifacts.has("sitemap")) warnings.push("Copy generation will stop until an approved sitemap exists.")
  if (plan.intent === "design_update" && !context.artifacts.has("copy_doc")) warnings.push("Design generation will stop until approved copy exists.")
  if (plan.intent === "deploy_execute") {
    if (!context.deploymentApproved) errors.push("Deployment approval is required.")
    if (!context.artifacts.has("export_record")) errors.push("A validated export record is required before deployment.")
  }
  if (plan.intent === "deploy_prepare" && !context.artifacts.has("generated_code")) errors.push("Deployment preparation requires generated code.")
  if (plan.steps.some((step) => step.action === "copy_update" && /whatsapp/i.test(JSON.stringify(step.params))) && !context.integrations.has("whatsapp")) warnings.push("WhatsApp is requested but not configured.")
  if (context.run?.steps.some((step) => step.status === "awaiting_approval") && !["explain_current_state", "deploy_execute"].includes(plan.intent)) warnings.push("The current run is waiting for human approval and will stop at that gate.")
  if (plan.intent === "apply_feedback" && context.run?.steps.some((step) => plan.affectedStages.includes(step.stage as ForgeRunStage) && ["queued", "running"].includes(step.status))) {
    errors.push("Feedback cannot invalidate a stage while that stage is queued or running. Pause the run first.")
  }
  return { legal: errors.length === 0, requiresConfirmation: GUARDED.has(plan.intent) || plan.steps.some((step) => step.guarded), errors, warnings }
}

export function forgeCommandSuggestions(context: ForgeCommandPlannerContext) {
  const candidates = [
    "Build the complete first draft.", "Continue from where it stopped.", "Why has this failed?",
    "Fix the failed step and resume.", "Show me what still needs my approval.", "Run QA.", "Prepare this for deployment.",
  ]
  return candidates.map((message) => {
    const plan = planForgeCommandHeuristic(message, context)
    const validation = validateForgeCommandPlan(plan, context)
    return { message, intent: plan.intent, enabled: validation.legal, reason: validation.errors[0] ?? null }
  })
}

export function classifyForgeCommandHeuristic(message: string, projectId = 0): ForgeCommandClassification {
  const plan = planForgeCommandHeuristic(message, { run: null })
  return { action: plan.intent, confidence: plan.confidence, projectId, params: plan.steps[0]?.params ?? {}, summary: plan.summary, target: inferTarget(message), requiresConfirmation: GUARDED.has(plan.intent), reason: plan.stopConditions.join(" ") }
}

export function readForgeCommandChatMemory(value: string | null | undefined): ForgeCommandChatState {
  if (!value) return emptyForgeCommandChatState()
  try {
    const parsed = JSON.parse(value) as Partial<ForgeCommandChatState>
    if (parsed.kind !== FORGE_COMMAND_CHAT_ARTIFACT_KIND || !Array.isArray(parsed.messages)) return emptyForgeCommandChatState()
    return { kind: FORGE_COMMAND_CHAT_ARTIFACT_KIND, messages: parsed.messages.filter(isForgeCommandMessage).map(normaliseForgeCommandMessage).slice(-80), updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString() }
  } catch { return emptyForgeCommandChatState() }
}

export function emptyForgeCommandChatState(): ForgeCommandChatState { return { kind: FORGE_COMMAND_CHAT_ARTIFACT_KIND, messages: [], updatedAt: new Date().toISOString() } }
export function appendForgeCommandMessages(state: ForgeCommandChatState, messages: ForgeCommandChatMessage[], now = new Date().toISOString()): ForgeCommandChatState {
  return { kind: FORGE_COMMAND_CHAT_ARTIFACT_KIND, messages: [...state.messages, ...messages].slice(-80), updatedAt: now }
}
export function isForgeCommandIntent(value: unknown): value is ForgeCommandIntent { return typeof value === "string" && FORGE_COMMAND_INTENTS.includes(value as ForgeCommandIntent) }
export function forgeCommandRequiresConfirmation(intent: ForgeCommandIntent) { return GUARDED.has(intent) }
export function forgeCommandLabel(intent: ForgeCommandIntent) { return intent.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }

function stagesForIntent(intent: ForgeCommandIntent, text: string, run: ForgeCommandPlannerContext["run"]): ForgeRunStage[] {
  if (intent === "build_complete_draft") return ["research", "sitemap", "copy", "design_direction", "design_system", "component_specification", "code_generation", "seo_schema", "accessibility", "consistency_review", "copy_quality_review", "originality_review", "quality_review", "visual_critique", "functional_qa", "repair", "visual_qa", "preview"]
  if (intent === "apply_feedback") {
    if (/copy|word|headline|about page|content/i.test(text)) return ["copy", "code_generation", "seo_schema", "quality_review", "functional_qa", "visual_qa", "preview"]
    if (/design|premium|colour|color|layout|visual/i.test(text)) return ["design_direction", "design_system", "component_specification", "code_generation", "visual_critique", "functional_qa", "visual_qa", "preview"]
    return ["copy", "design_direction", "code_generation", "functional_qa", "visual_qa", "preview"]
  }
  if (intent === "continue_current_run" || intent === "resolve_current_failure" || intent === "retry_failed_stage" || intent === "explain_current_state") {
    const current = run?.currentStage
    return current && isRunStage(current) ? [current] : []
  }
  return INTENT_STAGE[intent] ? [INTENT_STAGE[intent]!] : []
}

function stepsForIntent(intent: ForgeCommandIntent, stages: ForgeRunStage[], message: string): ForgeCommandPlanStep[] {
  if (intent === "build_complete_draft") return [{ id: "start-run", action: intent, stage: stages[0] ?? "", summary: "Start or continue the validated production pipeline through preview.", params: {}, guarded: true }]
  if (intent === "apply_feedback") return stages.map((stage, index): ForgeCommandPlanStep => ({ id: `feedback-${index + 1}`, action: actionForStage(stage), stage, summary: index === 0 ? `Apply feedback: ${message.slice(0, 240)}` : `Regenerate ${stage.replaceAll("_", " ")} only if invalidated.`, params: index === 0 ? { feedback: message.slice(0, 1000) } : {}, guarded: index === 0 }))
  return [{ id: `step-${intent}`, action: intent, stage: stages[0] ?? "", summary: summaryForIntent(intent, message), params: inferParams(message, intent, inferTarget(message)), guarded: GUARDED.has(intent) }]
}

function actionForStage(stage: ForgeRunStage): ForgeCommandIntent {
  const entries = Object.entries(INTENT_STAGE) as Array<[ForgeCommandIntent, ForgeRunStage]>
  return entries.find(([, mapped]) => mapped === stage)?.[0] ?? "continue_current_run"
}
function isLegalOrdering(stages: ForgeRunStage[]) { const order = ["brief","research","sitemap","copy","design_direction","design_system","component_specification","code_generation","seo_schema","accessibility","consistency_review","copy_quality_review","originality_review","quality_review","visual_critique","functional_qa","repair","visual_qa","preview","client_review","deploy_readiness"]; return stages.every((stage, index) => index === 0 || order.indexOf(stage) >= order.indexOf(stages[index - 1])) }
function needsRun(intent: ForgeCommandIntent) { return ["continue_current_run","resolve_current_failure","retry_failed_stage"].includes(intent) }
function containsInventedPath(params: Record<string, JsonValue>) { return Object.entries(params).some(([key, value]) => /path|file|directory|workspace/i.test(key) && typeof value === "string" && (/^[a-z]:[\\/]/i.test(value) || value.startsWith("/") || value.includes("../"))) }
function isRunStage(value: string): value is ForgeRunStage { return ["brief","research","sitemap","copy","design_direction","design_system","component_specification","code_generation","seo_schema","accessibility","consistency_review","copy_quality_review","originality_review","quality_review","visual_critique","functional_qa","repair","visual_qa","preview","client_review","deploy_readiness"].includes(value) }
function confidenceForIntent(intent: ForgeCommandIntent, text: string) { if (text.trim().split(/\s+/).length < 2) return .42; return intent === "apply_feedback" && !/copy|design|layout|colour|color|content|headline|page/i.test(text) ? .5 : .86 }
function assumptionsForIntent(intent: ForgeCommandIntent, message: string) { const values = ["Approved artifacts remain authoritative.", "Forge will stop at human approval and budget gates."]; if (intent === "apply_feedback") values.unshift(`Feedback is limited to: ${message.slice(0, 240)}`); return values }
function stopConditionsForIntent(intent: ForgeCommandIntent) { const conditions = ["Missing prerequisite artifact", "Budget exhausted", "Provider or job failure", "Required human approval"]; if (intent === "deploy_execute") conditions.push("Deployment policy or release gate failure"); return conditions }
function invalidatedArtifactsForIntent(intent: ForgeCommandIntent, stages: ForgeRunStage[]) {
  const artifactByStage: Partial<Record<ForgeRunStage, string[]>> = {
    copy: ["copy_doc"],
    design_direction: ["design_direction"],
    design_system: ["design_system"],
    component_specification: ["component_spec"],
    code_generation: ["generated_code"],
    seo_schema: ["seo_pack"],
    quality_review: ["quality_report"],
    visual_critique: ["visual_critique"],
    functional_qa: ["qa_report"],
    repair: ["repair_report", "generated_code"],
    visual_qa: ["visual_qa_report"],
    preview: ["preview_record"],
  }
  if (!["copy_update", "design_update", "apply_feedback"].includes(intent)) return []
  return [...new Set(stages.flatMap((stage) => artifactByStage[stage] ?? []))]
}
function summaryForIntent(intent: ForgeCommandIntent, message: string) { const target = inferTarget(message); const summaries: Partial<Record<ForgeCommandIntent,string>> = { build_complete_draft:"Build the complete first draft through preview using the approved pipeline.",continue_current_run:"Continue the current run from its persisted stage.",explain_current_state:"Explain the current run state, blockers and outstanding approvals.",resolve_current_failure:"Retry the failed stage and resume only after validation.",retry_failed_stage:"Retry the current failed stage.",apply_feedback:"Apply the supplied feedback and rerun only invalidated downstream stages.",deploy_prepare:"Prepare validated artifacts and release gates for deployment.",deploy_execute:"Execute the approved deployment." }; return summaries[intent] ?? `${forgeCommandLabel(intent)} for ${target}.` }
function outcomeForIntent(intent: ForgeCommandIntent) { if (intent === "explain_current_state") return "A concise explanation of the current stage, failure or pending approvals."; if (intent === "build_complete_draft") return "A validated first-draft preview, paused at any required human gate."; if (intent === "continue_current_run") return "The current run continues from durable state without duplicate execution."; return `${forgeCommandLabel(intent)} is queued through Forge and its meaningful result will appear here.` }
function inferTarget(message: string) { const text=message.toLowerCase(); if (/about page/.test(text)) return "/about"; if (/home|homepage/.test(text)) return "/"; if (/hero/.test(text)) return "hero"; return "project" }
function inferParams(message: string, action: ForgeCommandIntent, target: string): Record<string, JsonValue> { const text=message.toLowerCase(); const params:Record<string,JsonValue>={target}; if(target.startsWith("/"))params.regeneratePagePath=target; if(action==="design_update"&&/premium|luxury|cinematic/.test(text)){params.preferredStylePack="Luxury dark premium";params.preserveApprovedCopy=/without changing.*copy|preserve.*copy/.test(text)} if(action==="proposal_generate"&&/audit/.test(text))params.action="audit"; if(action==="export_run")params.kind=/site|zip/.test(text)?"site":/handover/.test(text)?"handover":"proposal"; return params }

function isForgeCommandMessage(value: unknown): value is ForgeCommandChatMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record=value as Partial<ForgeCommandChatMessage>
  return typeof record.id==="string" && ["user","assistant","system"].includes(record.role ?? "") && typeof record.content==="string" && typeof record.createdAt==="string"
}
function normaliseForgeCommandMessage(message: ForgeCommandChatMessage): ForgeCommandChatMessage {
  const action=isForgeCommandIntent(message.action)?message.action:isForgeCommandIntent(message.intent)?message.intent:null
  return {...message,action,intent:action,taskId:typeof message.taskId==="number"?message.taskId:null,jobId:typeof message.jobId==="number"?message.jobId:null,runId:typeof message.runId==="number"?message.runId:null,requiresConfirmation:message.requiresConfirmation===true,plan:message.plan&&typeof message.plan==="object"?message.plan:null}
}
