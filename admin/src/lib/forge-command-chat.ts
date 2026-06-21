import type { ForgeJsonSchema, JsonValue } from "./forge-ai"

export const FORGE_COMMAND_CHAT_MEMORY_KEY = "forge_command_chat"
export const FORGE_COMMAND_CHAT_ARTIFACT_KIND = "forge_command_chat"

export const FORGE_COMMAND_INTENTS = [
  "copy_update",
  "design_update",
  "code_update",
  "integration_update",
  "qa_run",
  "repair_run",
  "proposal_generate",
] as const

export type ForgeCommandIntent = (typeof FORGE_COMMAND_INTENTS)[number]
export type ForgeCommandMessageRole = "user" | "assistant" | "system"
export type ForgeCommandMessageStatus = "classified" | "needs_confirmation" | "running" | "completed" | "failed"

export interface ForgeCommandClassification extends Record<string, JsonValue> {
  intent: ForgeCommandIntent
  confidence: number
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
  intent: ForgeCommandIntent | null
  status: ForgeCommandMessageStatus | null
  taskId: number | null
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
  required: ["intent", "confidence", "summary", "target", "requiresConfirmation", "reason"],
  properties: {
    intent: { type: "string", enum: [...FORGE_COMMAND_INTENTS] },
    confidence: { type: "number" },
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

export function classifyForgeCommandHeuristic(message: string): ForgeCommandClassification {
  const text = message.toLowerCase()
  if (/repair|fix.*build|build error|failed build|errors?/.test(text)) return classification("repair_run", message, "Repair generated build errors.", true, "Repair can patch generated workspace files and must be confirmed.")
  if (/run qa|test|typecheck|lint|build check|quality/.test(text)) return classification("qa_run", message, "Run generated-site QA.", false, "QA reads and validates the generated workspace.")
  if (/proposal|audit|sales doc|client doc/.test(text)) return classification("proposal_generate", message, "Generate proposal pack.", false, "Proposal generation writes a Forge proposal artifact.")
  if (/whatsapp|resend|email|contact form|integration|analytics|stripe|calendly/.test(text)) return classification("integration_update", message, "Update integration plan.", false, "Integration commands are routed through existing configuration panels and generator steps.")
  if (/copy|headline|hero text|regenerate.*home|homepage copy|faq|meta description/.test(text)) return classification("copy_update", message, "Update website copy.", false, "Copy updates use the Copy Agent and approved sitemap context.")
  if (/design|premium|style|animation|colour|color|typography|visual/.test(text)) return classification("design_update", message, "Update design direction.", false, "Design updates use the Design Agent and approved copy context.")
  return classification("code_update", message, "Update generated site code.", true, "Code generation overwrites files inside the generated workspace and must be confirmed.")
}

export function isForgeCommandIntent(value: unknown): value is ForgeCommandIntent {
  return typeof value === "string" && FORGE_COMMAND_INTENTS.includes(value as ForgeCommandIntent)
}

export function forgeCommandRequiresConfirmation(intent: ForgeCommandIntent) {
  return intent === "code_update" || intent === "repair_run"
}

export function forgeCommandLabel(intent: ForgeCommandIntent) {
  const labels: Record<ForgeCommandIntent, string> = {
    copy_update: "Copy update",
    design_update: "Design update",
    code_update: "Code update",
    integration_update: "Integration update",
    qa_run: "QA run",
    repair_run: "Repair run",
    proposal_generate: "Proposal generation",
  }
  return labels[intent]
}

function classification(intent: ForgeCommandIntent, message: string, summary: string, requiresConfirmation: boolean, reason: string): ForgeCommandClassification {
  return {
    intent,
    confidence: 0.82,
    summary,
    target: inferTarget(message),
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
