import "server-only"
import {
  buildForgeTaskOutputMetadata,
  assertForgeAiBudgetAllowsRequest,
  createMockStructuredResponse,
  estimateForgeAiCostUsd,
  getForgeAiBudgetDate,
  parseAndValidateStructuredJson,
  resolveForgeAiBudgetConfig,
  resolveForgeAiModel,
  resolveForgeAiProvider,
  supportsOpenAiTemperature,
  type ForgeAiBudgetLedger,
  type ForgeAiProvider,
  type ForgeAiResult,
  type ForgeAiTaskType,
  type ForgeAiUsage,
  type ForgeJsonSchema,
  type JsonValue,
} from "@/lib/forge-ai"

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"
const DEFAULT_TIMEOUT_MS = 20_000
const DEFAULT_MAX_RETRIES = 2
const FORGE_AI_SAFETY_SYSTEM_PROMPT = [
  "Return only safe structured JSON for ScaleSmiths Forge.",
  "Never request, expose, infer, or embed API keys, private keys, credentials, or server secrets.",
  "Generated code must not phone home to unknown domains or add telemetry/beacons.",
  "Generated scripts must not contain destructive shell commands or modify files outside the generated workspace.",
].join(" ")

declare global {
  var __forgeAiBudgetLedger: ForgeAiBudgetLedger | undefined
}

export class ForgeAiError extends Error {
  safeMessage: string
  retryable: boolean

  constructor(safeMessage: string, retryable = false) {
    super(safeMessage)
    this.name = "ForgeAiError"
    this.safeMessage = safeMessage
    this.retryable = retryable
  }
}

export interface ForgeAiRequest<TData extends JsonValue = JsonValue> {
  taskType: ForgeAiTaskType
  prompt: string
  systemPrompt?: string
  schema: ForgeJsonSchema
  schemaName: string
  provider?: ForgeAiProvider
  timeoutMs?: number
  maxRetries?: number
  env?: NodeJS.ProcessEnv
  maxTokens?: number
  temperature?: number
  mockData?: TData
}

export async function runForgeAiJson<TData extends JsonValue = JsonValue>(request: ForgeAiRequest<TData>): Promise<ForgeAiResult<TData>> {
  const env = request.env ?? process.env
  const configuredProvider = request.provider ?? resolveForgeAiProvider(env)
  const provider = providerReady(configuredProvider, env) ? configuredProvider : "mock"
  const model = resolveForgeAiModel(request.taskType, provider)
  const startedAt = Date.now()

  if (provider === "mock") {
    const data = request.mockData ?? createMockStructuredResponse(request.schema, request.taskType)
    const parsed = parseAndValidateStructuredJson<TData>(request.schema, data)

    if (!parsed.ok) {
      throw new ForgeAiError("Mock AI response did not match the requested schema.")
    }

    return {
      provider,
      model,
      taskType: request.taskType,
      data: parsed.data,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      costEstimateUsd: null,
      latencyMs: Date.now() - startedAt,
      retries: 0,
      responseId: "mock",
    }
  }

  const budgetConfig = resolveForgeAiBudgetConfig(env)
  const requestedMaxTokens = request.maxTokens ?? 800
  const budgetCheck = assertForgeAiBudgetAllowsRequest({
    config: budgetConfig,
    ledger: currentBudgetLedger(),
    requestedMaxTokens,
  })
  if (!budgetCheck.ok) throw new ForgeAiError(budgetCheck.error)

  const maxRetries = Math.max(0, request.maxRetries ?? DEFAULT_MAX_RETRIES)
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const raw = provider === "openai"
        ? await callOpenAi(request, model, env)
        : await callAnthropic(request, model, env)
      const parsed = parseAndValidateStructuredJson<TData>(request.schema, raw.text)

      if (!parsed.ok) {
        throw new ForgeAiError("AI response did not match the requested schema.", true)
      }

      const costEstimateUsd = estimateForgeAiCostUsd(provider, raw.usage)
      recordBudgetUsage(raw.usage.totalTokens ?? 0, costEstimateUsd ?? 0)

      return {
        provider,
        model,
        taskType: request.taskType,
        data: parsed.data,
        usage: raw.usage,
        costEstimateUsd,
        latencyMs: Date.now() - startedAt,
        retries: attempt,
        responseId: raw.responseId,
      }
    } catch (error) {
      lastError = error
      const retryable = error instanceof ForgeAiError ? error.retryable : true
      if (!retryable || attempt === maxRetries) break
      await wait(250 * (attempt + 1))
    }
  }

  if (lastError instanceof ForgeAiError) throw lastError
  throw new ForgeAiError("Unable to get a safe AI response right now.", true)
}

export { buildForgeTaskOutputMetadata }

async function callOpenAi(request: ForgeAiRequest, model: string, env: NodeJS.ProcessEnv) {
  const apiKey = env.OPENAI_API_KEY
  if (!apiKey) throw new ForgeAiError("OpenAI is not configured.")
  const body: Record<string, unknown> = {
    model,
    input: [
      { role: "system", content: buildSafeSystemPrompt(request.systemPrompt) },
      { role: "user", content: request.prompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: request.schemaName,
        schema: request.schema,
        strict: true,
      },
    },
    max_output_tokens: request.maxTokens ?? 800,
  }
  const temperature = request.temperature

  if (typeof temperature === "number" && supportsOpenAiTemperature(model)) {
    body.temperature = temperature
  }

  const response = await fetchWithTimeout(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, request.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  const json = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ForgeAiError(providerErrorMessage("OpenAI", response.status, json), response.status >= 429)
  }

  return {
    text: extractOpenAiText(json),
    usage: normalizeOpenAiUsage(json?.usage),
    responseId: typeof json?.id === "string" ? json.id : null,
  }
}

async function callAnthropic(request: ForgeAiRequest, model: string, env: NodeJS.ProcessEnv) {
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) throw new ForgeAiError("Anthropic is not configured.")

  const response = await fetchWithTimeout(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: request.maxTokens ?? 800,
      system: buildSafeSystemPrompt(request.systemPrompt),
      messages: [{ role: "user", content: request.prompt }],
      output_config: {
        format: {
          type: "json_schema",
          schema: request.schema,
        },
      },
    }),
  }, request.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  const json = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ForgeAiError(providerErrorMessage("Anthropic", response.status, json), response.status >= 429)
  }

  return {
    text: extractAnthropicText(json),
    usage: normalizeAnthropicUsage(json?.usage),
    responseId: typeof json?.id === "string" ? json.id : null,
  }
}

function providerReady(provider: ForgeAiProvider, env: NodeJS.ProcessEnv) {
  if (provider === "mock") return true
  if (env.FORGE_ENABLE_AI !== "true") return false
  if (provider === "openai") return Boolean(env.OPENAI_API_KEY)
  if (provider === "anthropic") return Boolean(env.ANTHROPIC_API_KEY)
  return false
}

function buildSafeSystemPrompt(systemPrompt: string | undefined) {
  if (!systemPrompt) return FORGE_AI_SAFETY_SYSTEM_PROMPT
  return `${FORGE_AI_SAFETY_SYSTEM_PROMPT}\n\nTask instructions:\n${systemPrompt}`
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ForgeAiError("AI provider request timed out.", true)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function extractOpenAiText(json: unknown) {
  if (isRecord(json) && typeof json.output_text === "string") return json.output_text

  if (isRecord(json) && Array.isArray(json.output)) {
    for (const item of json.output) {
      if (!isRecord(item) || !Array.isArray(item.content)) continue
      for (const content of item.content) {
        if (isRecord(content) && typeof content.text === "string") return content.text
      }
    }
  }

  throw new ForgeAiError("OpenAI returned an unreadable response.", true)
}

function extractAnthropicText(json: unknown) {
  if (!isRecord(json) || !Array.isArray(json.content)) {
    throw new ForgeAiError("Anthropic returned an unreadable response.", true)
  }

  for (const content of json.content) {
    if (isRecord(content) && typeof content.text === "string") return content.text
  }

  throw new ForgeAiError("Anthropic returned no text content.", true)
}

function normalizeOpenAiUsage(usage: unknown): ForgeAiUsage {
  if (!isRecord(usage)) return {}
  return {
    inputTokens: readNumber(usage.input_tokens),
    outputTokens: readNumber(usage.output_tokens),
    totalTokens: readNumber(usage.total_tokens),
  }
}

function normalizeAnthropicUsage(usage: unknown): ForgeAiUsage {
  if (!isRecord(usage)) return {}
  const inputTokens = readNumber(usage.input_tokens)
  const outputTokens = readNumber(usage.output_tokens)
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null,
  }
}

function providerErrorMessage(provider: string, status: number, body: unknown) {
  const message = isRecord(body) && isRecord(body.error) && typeof body.error.message === "string"
    ? body.error.message
    : "Provider request failed."

  if (status === 401 || status === 403) return `${provider} credentials were rejected.`
  if (status === 429) return `${provider} rate limit reached.`
  if (status >= 500) return `${provider} is temporarily unavailable.`
  return `${provider} request failed: ${message}`
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function currentBudgetLedger(): ForgeAiBudgetLedger {
  const today = getForgeAiBudgetDate()
  if (!globalThis.__forgeAiBudgetLedger || globalThis.__forgeAiBudgetLedger.date !== today) {
    globalThis.__forgeAiBudgetLedger = { date: today, totalTokens: 0, totalCostUsd: 0, requests: 0 }
  }
  return globalThis.__forgeAiBudgetLedger
}

function recordBudgetUsage(tokens: number, costUsd: number) {
  const ledger = currentBudgetLedger()
  ledger.totalTokens += Math.max(0, tokens)
  ledger.totalCostUsd = Number((ledger.totalCostUsd + Math.max(0, costUsd)).toFixed(6))
  ledger.requests += 1
}
