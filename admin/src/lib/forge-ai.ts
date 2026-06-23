export const FORGE_AI_PROVIDERS = ["openai", "anthropic", "mock"] as const
export const FORGE_AI_TASK_TYPES = ["planning", "copywriting", "code", "repair", "qa"] as const

export type ForgeAiProvider = (typeof FORGE_AI_PROVIDERS)[number]
export type ForgeAiTaskType = (typeof FORGE_AI_TASK_TYPES)[number]
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface ForgeJsonSchema {
  type: "object" | "array" | "string" | "number" | "integer" | "boolean"
  properties?: Record<string, ForgeJsonSchema>
  items?: ForgeJsonSchema
  required?: string[]
  additionalProperties?: boolean
  enum?: JsonValue[]
  description?: string
}

export interface ForgeAiUsage {
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
}

export interface ForgeAiResult<TData extends JsonValue = JsonValue> {
  provider: ForgeAiProvider
  model: string
  taskType: ForgeAiTaskType
  data: TData
  usage: ForgeAiUsage
  costEstimateUsd: number | null
  latencyMs: number
  retries: number
  responseId?: string | null
}

export interface ForgeAiBudgetConfig {
  enabled: boolean
  maxTokensPerTask: number
  dailyTokenBudget: number
  dailyUsdBudget: number
}

export interface ForgeAiBudgetLedger {
  date: string
  totalTokens: number
  totalCostUsd: number
  requests: number
}

export interface ForgeAiRoute {
  openai: string
  anthropic: string
  mock: string
}

export const FORGE_AI_MODEL_ROUTES: Record<ForgeAiTaskType, ForgeAiRoute> = {
  planning: {
    openai: "gpt-5.5",
    anthropic: "claude-opus-4-8",
    mock: "mock-planning",
  },
  copywriting: {
    openai: "gpt-5.5",
    anthropic: "claude-opus-4-8",
    mock: "mock-copywriting",
  },
  code: {
    openai: "gpt-5.5",
    anthropic: "claude-opus-4-8",
    mock: "mock-code",
  },
  repair: {
    openai: "gpt-5.5",
    anthropic: "claude-opus-4-8",
    mock: "mock-repair",
  },
  qa: {
    openai: "gpt-5.5",
    anthropic: "claude-opus-4-8",
    mock: "mock-qa",
  },
}

export const FORGE_AI_TEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "nextSteps", "riskLevel"],
  properties: {
    summary: { type: "string", description: "Short safe response summary." },
    nextSteps: { type: "array", items: { type: "string" }, description: "Practical next steps." },
    riskLevel: { type: "string", enum: ["low", "medium", "high"], description: "Implementation risk level." },
  },
} as const satisfies ForgeJsonSchema

export function isForgeAiProvider(value: unknown): value is ForgeAiProvider {
  return typeof value === "string" && FORGE_AI_PROVIDERS.includes(value as ForgeAiProvider)
}

export function isForgeAiTaskType(value: unknown): value is ForgeAiTaskType {
  return typeof value === "string" && FORGE_AI_TASK_TYPES.includes(value as ForgeAiTaskType)
}

export function resolveForgeAiProvider(env: Partial<Record<string, string | undefined>> = process.env): ForgeAiProvider {
  if (env.FORGE_ENABLE_AI !== "true") return "mock"

  const configured = env.FORGE_DEFAULT_AI_PROVIDER?.trim().toLowerCase()
  return isForgeAiProvider(configured) && configured !== "mock" ? configured : "mock"
}

export function resolveForgeAiModel(taskType: ForgeAiTaskType, provider: ForgeAiProvider) {
  return FORGE_AI_MODEL_ROUTES[taskType][provider]
}

export function supportsOpenAiTemperature(model: string) {
  const normalised = model.trim().toLowerCase()
  return !/^(gpt-5|o\d|o-|o\.|codex)/.test(normalised)
}

export function resolveForgeAiBudgetConfig(env: Partial<Record<string, string | undefined>> = process.env): ForgeAiBudgetConfig {
  return {
    enabled: env.FORGE_ENABLE_AI === "true",
    maxTokensPerTask: clampBudgetInteger(env.FORGE_AI_MAX_TOKENS_PER_TASK, 6_000, 500, 50_000),
    dailyTokenBudget: clampBudgetInteger(env.FORGE_AI_DAILY_TOKEN_BUDGET, 50_000, 1_000, 2_000_000),
    dailyUsdBudget: clampBudgetNumber(env.FORGE_AI_DAILY_USD_BUDGET, 10, 1, 500),
  }
}

export function getForgeAiBudgetDate(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function assertForgeAiBudgetAllowsRequest({
  config,
  ledger,
  requestedMaxTokens,
}: {
  config: ForgeAiBudgetConfig
  ledger: ForgeAiBudgetLedger
  requestedMaxTokens: number
}): { ok: true } | { ok: false; error: string } {
  if (!config.enabled) return { ok: true }
  if (requestedMaxTokens > config.maxTokensPerTask) {
    return { ok: false, error: `Forge AI task token request exceeds the per-task limit (${config.maxTokensPerTask}).` }
  }
  if (ledger.totalTokens + requestedMaxTokens > config.dailyTokenBudget) {
    return { ok: false, error: `Forge AI daily token budget would be exceeded (${config.dailyTokenBudget}).` }
  }
  if (ledger.totalCostUsd >= config.dailyUsdBudget) {
    return { ok: false, error: `Forge AI daily spend budget has been reached ($${config.dailyUsdBudget}).` }
  }
  return { ok: true }
}

export function estimateForgeAiCostUsd(provider: ForgeAiProvider, usage: ForgeAiUsage) {
  if (provider === "mock") return null

  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0
  const pricing = provider === "anthropic"
    ? { inputPerMillion: 15, outputPerMillion: 75 }
    : { inputPerMillion: 5, outputPerMillion: 15 }

  return Number(((inputTokens / 1_000_000) * pricing.inputPerMillion + (outputTokens / 1_000_000) * pricing.outputPerMillion).toFixed(6))
}

export function validateJsonSchemaValue(schema: ForgeJsonSchema, value: unknown, path = "response"): string[] {
  const errors: string[] = []

  if (schema.enum && !schema.enum.some((item) => item === value)) {
    errors.push(`${path} must be one of: ${schema.enum.join(", ")}.`)
    return errors
  }

  if (schema.type === "object") {
    if (!isPlainObject(value)) return [`${path} must be an object.`]

    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key} is required.`)
    }

    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...validateJsonSchemaValue(child, value[key], `${path}.${key}`))
    }

    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties ?? {}))
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) errors.push(`${path}.${key} is not allowed.`)
      }
    }

    return errors
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) return [`${path} must be an array.`]
    if (schema.items) {
      value.forEach((item, index) => errors.push(...validateJsonSchemaValue(schema.items as ForgeJsonSchema, item, `${path}[${index}]`)))
    }
    return errors
  }

  if (schema.type === "integer") {
    if (!Number.isInteger(value)) errors.push(`${path} must be an integer.`)
    return errors
  }

  if (schema.type === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) errors.push(`${path} must be a number.`)
    return errors
  }

  if (typeof value !== schema.type) errors.push(`${path} must be a ${schema.type}.`)
  return errors
}

export function parseAndValidateStructuredJson<TData extends JsonValue>(schema: ForgeJsonSchema, raw: unknown): { ok: true; data: TData } | { ok: false; error: string } {
  const parsed = typeof raw === "string"
    ? parseJson(raw)
    : { ok: true as const, data: raw }

  if (!parsed.ok) return parsed

  const errors = validateJsonSchemaValue(schema, parsed.data)
  if (errors.length) return { ok: false, error: errors.join(" ") }

  return { ok: true, data: parsed.data as TData }
}

export function buildForgeTaskOutputMetadata(result: ForgeAiResult) {
  return {
    ai: {
      provider: result.provider,
      model: result.model,
      taskType: result.taskType,
      usage: result.usage,
      costEstimateUsd: result.costEstimateUsd,
      latencyMs: result.latencyMs,
      retries: result.retries,
      responseId: result.responseId ?? null,
    },
    response: result.data,
  }
}

export function createMockStructuredResponse(schema: ForgeJsonSchema, taskType: ForgeAiTaskType): JsonValue {
  if (schema === FORGE_AI_TEST_SCHEMA) {
    return {
      summary: `Mock ${taskType} response from Forge AI provider abstraction.`,
      nextSteps: ["Keep provider logic server-side", "Validate structured output", "Store usage metadata on Forge tasks"],
      riskLevel: "low",
    }
  }

  return createMockValue(schema)
}

function createMockValue(schema: ForgeJsonSchema): JsonValue {
  if (schema.enum?.length) return schema.enum[0]
  if (schema.type === "string") return "Mock value"
  if (schema.type === "number" || schema.type === "integer") return 0
  if (schema.type === "boolean") return false
  if (schema.type === "array") return schema.items ? [createMockValue(schema.items)] : []

  return Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([key, child]) => [key, createMockValue(child)]),
  )
}

function parseJson(value: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(value) }
  } catch {
    return { ok: false, error: "AI provider returned invalid JSON." }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function clampBudgetInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function clampBudgetNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}
