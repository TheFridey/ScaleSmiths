import type { ForgeJsonSchema, JsonValue } from "./forge-ai"

export const FORGE_COMMAND_CHAT_MEMORY_KEY = "forge_command_chat"
export const FORGE_COMMAND_CHAT_ARTIFACT_KIND = "forge_command_chat"

export const FORGE_COMMAND_INTENTS = [
  "copy_update",
  "design_update",
  "research_run",
  "sitemap_run",
  "site_generate",
  "qa_run",
  "repair_run",
  "proposal_generate",
  "export_run",
  "preview_start",
] as const

export type ForgeCommandAction = (typeof FORGE_COMMAND_INTENTS)[number]
export type ForgeCommandIntent = ForgeCommandAction
export type ForgeCommandMessageRole = "user" | "assistant" | "system"
export type ForgeCommandMessageStatus = "classified" | "needs_confirmation" | "queued" | "running" | "completed" | "failed"

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
  requiresConfirmation: boolean
}

export interface ForgeCommandChatState extends Record<string, JsonValue> {
  kind: typeof FORGE_COMMAND_CHAT_ARTIFACT_KIND
  messages: ForgeCommandChatMessage[]
  updatedAt: string
}

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

export function readForgeCommandChatMemory(value: string | null | undefined): ForgeCommandChatState {
  if (!value) return emptyForgeCommandChatState()

  try {
    const parsed = JSON.parse(value) as Partial<ForgeCommandChatState>
    if (parsed.kind !== FORGE_COMMAND_CHAT_ARTIFACT_KIND || !Array.isArray(parsed.messages)) return emptyForgeCommandChatState()
    return {
      kind: FORGE_COMMAND_CHAT_ARTIFACT_KIND,
      messages: parsed.messages
        .filter(isForgeCommandMessage)
        .map(normaliseForgeCommandMessage)
        .slice(-80),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    }
  } catch {
    return emptyForgeCommandChatState()
  }
}

export function emptyForgeCommandChatState(): ForgeCommandChatState {
  return {
    kind: FORGE_COMMAND_CHAT_ARTIFACT_KIND,
    messages: [],
    updatedAt: new Date().toISOString(),
  }
}

export function appendForgeCommandMessages(
  state: ForgeCommandChatState,
  messages: ForgeCommandChatMessage[],
  now = new Date().toISOString(),
): ForgeCommandChatState {
  return {
    kind: FORGE_COMMAND_CHAT_ARTIFACT_KIND,
    messages: [...state.messages, ...messages].slice(-80),
    updatedAt: now,
  }
}

export function classifyForgeCommandHeuristic(message: string, projectId = 0): ForgeCommandClassification {
  const text = message.toLowerCase()
  if (/repair|fix.*build|build error|failed build|errors?/.test(text)) return classification("repair_run", projectId, message, "Repair generated build errors.", true, "Repair can patch generated workspace files and must be confirmed.")
  if (/run qa|test|typecheck|lint|build check|quality/.test(text)) return classification("qa_run", projectId, message, "Run generated-site QA.", false, "QA reads and validates the generated workspace.")
  if (/export|download|zip|handover pack/.test(text)) return classification("export_run", projectId, message, "Prepare export workflow.", false, "Exports are tracked through Forge and downloads remain controlled by the Export panel.")
  if (/preview|open preview|start preview/.test(text)) return classification("preview_start", projectId, message, "Start generated-site preview.", false, "Preview starts through the Forge preview worker.")
  if (/proposal|audit|sales doc|client doc/.test(text)) return classification("proposal_generate", projectId, message, "Generate proposal pack.", false, "Proposal generation writes a Forge proposal artifact.")
  if (/research|competitor|market|positioning/.test(text)) return classification("research_run", projectId, message, "Run website and business research.", false, "Research uses supplied project context only.")
  if (/sitemap|site map|pages|navigation|structure/.test(text)) return classification("sitemap_run", projectId, message, "Generate sitemap strategy.", false, "Sitemap strategy uses intake and research context.")
  if (/copy|headline|hero text|regenerate.*home|homepage copy|faq|meta description/.test(text)) return classification("copy_update", projectId, message, "Update website copy.", false, "Copy updates use the Copy Agent and approved sitemap context.")
  if (/design|premium|style|animation|colour|color|typography|visual/.test(text)) return classification("design_update", projectId, message, "Update design direction.", false, "Design updates use the Design Agent and approved copy context.")
  return classification("site_generate", projectId, message, "Generate site from approved artifacts.", true, "Site generation writes files inside the generated workspace and must be confirmed.")
}

export function isForgeCommandIntent(value: unknown): value is ForgeCommandIntent {
  return typeof value === "string" && FORGE_COMMAND_INTENTS.includes(value as ForgeCommandIntent)
}

export function forgeCommandRequiresConfirmation(intent: ForgeCommandIntent) {
  return intent === "site_generate" || intent === "repair_run"
}

export function forgeCommandLabel(intent: ForgeCommandIntent) {
  const labels: Record<ForgeCommandIntent, string> = {
    copy_update: "Copy update",
    design_update: "Design update",
    research_run: "Research run",
    sitemap_run: "Sitemap run",
    site_generate: "Site generation",
    qa_run: "QA run",
    repair_run: "Repair run",
    proposal_generate: "Proposal generation",
    export_run: "Export run",
    preview_start: "Preview start",
  }
  return labels[intent]
}

function classification(action: ForgeCommandIntent, projectId: number, message: string, summary: string, requiresConfirmation: boolean, reason: string): ForgeCommandClassification {
  const target = inferTarget(message)
  return {
    action,
    confidence: 0.82,
    projectId,
    params: inferParams(message, action, target),
    summary,
    target,
    requiresConfirmation,
    reason,
  }
}

function inferTarget(message: string) {
  const text = message.toLowerCase()
  if (/home|homepage/.test(text)) return "/"
  if (/hero/.test(text)) return "hero"
  if (/whatsapp/.test(text)) return "whatsapp"
  if (/resend|email|contact form/.test(text)) return "resend"
  if (/proposal/.test(text)) return "proposal"
  return "project"
}

function inferParams(message: string, action: ForgeCommandAction, target: string): Record<string, JsonValue> {
  const text = message.toLowerCase()
  const params: Record<string, JsonValue> = { target }
  if (target === "/") params.regeneratePagePath = "/"
  if (action === "design_update" && /premium|luxury|cinematic/.test(text)) {
    params.preferredStylePack = "Luxury dark premium"
    params.preferredAnimationPack = "Cinematic Hero"
  }
  if (action === "design_update" && /gaming|minecraft|server|neon|discord|command/.test(text)) {
    params.preferredStylePack = "Neon command hub"
    params.preferredAnimationPack = "Glass Motion"
  }
  if (action === "proposal_generate" && /audit/.test(text)) params.action = "audit"
  if (action === "export_run") {
    params.kind = /site|zip/.test(text) ? "site" : /audit/.test(text) ? "audit" : /handover/.test(text) ? "handover" : "proposal"
  }
  return params
}

function isForgeCommandMessage(value: unknown): value is ForgeCommandChatMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Partial<ForgeCommandChatMessage>
  return (
    typeof record.id === "string" &&
    (record.role === "user" || record.role === "assistant" || record.role === "system") &&
    typeof record.content === "string" &&
    typeof record.createdAt === "string"
  )
}

function normaliseForgeCommandMessage(message: ForgeCommandChatMessage): ForgeCommandChatMessage {
  const legacyIntent = message.intent
  const action = isForgeCommandIntent(message.action) ? message.action : isForgeCommandIntent(legacyIntent) ? legacyIntent : null
  return {
    ...message,
    action,
    intent: action,
    taskId: typeof message.taskId === "number" ? message.taskId : null,
    jobId: typeof message.jobId === "number" ? message.jobId : null,
    requiresConfirmation: message.requiresConfirmation === true,
  }
}
