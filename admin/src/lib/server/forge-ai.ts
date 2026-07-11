import "server-only"
import {
  buildForgeTaskOutputMetadata,
  assertForgeAiBudgetAllowsRequest as assertForgeAiTokenBudgetAllowsRequest,
  createMockStructuredResponse,
  estimateForgeAiCostUsd,
  getForgeAiBudgetDate,
  parseAndValidateStructuredJson,
  resolveForgeAiBudgetConfig,
  resolveForgeAiProvider,
  type ForgeAiBudgetLedger,
  type ForgeAiProvider,
  type ForgeAiResult,
  type ForgeAiTaskType,
  type ForgeJsonSchema,
  type JsonValue,
} from "@/lib/forge-ai"
import {
  ForgeAiBudgetExceededError,
  assertForgeAiBudgetAllowsRequest,
  recordForgeAiUsage,
} from "./forge-ai-usage"
import { normalizeUnknownError } from "./logging"
import { requestLogger } from "./request-context"
import { addMonitoringBreadcrumb, captureMonitoringException, setMonitoringContext } from "./monitoring"
import { getForgeProviderAdapter, ProviderAdapterError } from "./forge-provider-adapters"
import { classifyRetryability, nextRetryDecision, resolveRetryPolicyConfig } from "@/lib/forge-retry-policy"
import { isTripCategory } from "@/lib/forge-circuit-breaker"
import {
  providerCanAttempt,
  recordProviderFailover,
  recordProviderFailure,
  recordProviderSuccess,
  resolveFailoverTarget,
} from "./forge-provider-health"

const DEFAULT_TIMEOUT_MS = 60_000
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
  code?: string

  constructor(safeMessage: string, retryable = false, options: { code?: string; cause?: unknown } = {}) {
    super(safeMessage, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = "ForgeAiError"
    this.safeMessage = safeMessage
    this.retryable = retryable
    this.code = options.code
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
  fallbackOnSchemaMismatch?: boolean
  projectId?: number | null
  taskId?: number | null
  promptIdentifier: string
  promptVersion: string
  schemaIdentifier: string
  schemaVersion: string
}

export async function runForgeAiJson<TData extends JsonValue = JsonValue>(request: ForgeAiRequest<TData>): Promise<ForgeAiResult<TData>> {
  const registry = { promptIdentifier: request.promptIdentifier, promptVersion: request.promptVersion, schemaIdentifier: request.schemaIdentifier, schemaVersion: request.schemaVersion }
  const env = request.env ?? process.env
  const configuredProvider = request.provider ?? resolveForgeAiProvider(env)
  let provider = getForgeProviderAdapter(configuredProvider).isConfigured(env) ? configuredProvider : "mock"
  let adapter = getForgeProviderAdapter(provider)
  let model = adapter.model(request.taskType)
  let failover: ForgeAiResult["failover"] = null
  const startedAtDate = new Date()
  const startedAt = startedAtDate.getTime()
  let log = requestLogger({
    component: "forge-ai",
    projectId: request.projectId ?? undefined,
    taskId: request.taskId ?? undefined,
    forgeStage: request.taskType,
    provider,
    model,
  })
  setMonitoringContext({ projectId: request.projectId ?? undefined, taskId: request.taskId ?? undefined, forgeStage: request.taskType, provider, model })
  addMonitoringBreadcrumb({ category: "forge.ai", message: "AI provider request started", data: { provider, model, projectId: request.projectId, taskId: request.taskId } })

  if (provider === "mock") {
    const data = request.mockData ?? createMockStructuredResponse(request.schema, request.taskType)
    const parsed = parseAndValidateStructuredJson<TData>(request.schema, data)

    if (!parsed.ok) {
      throw new ForgeAiError("Mock AI response did not match the requested schema.")
    }

    const completedAt = new Date()
    const result = {
      provider,
      model,
      taskType: request.taskType,
      data: parsed.data,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      costEstimateUsd: null,
      latencyMs: completedAt.getTime() - startedAt,
      retries: 0,
      responseId: "mock",
      registry,
    }
    await recordForgeAiUsage({
      projectId: request.projectId ?? null,
      taskId: request.taskId ?? null,
      provider,
      model,
      usage: result.usage,
      estimatedCost: result.costEstimateUsd,
      startedAt: startedAtDate,
      completedAt,
    })
    log.debug("Forge AI mock response completed", {
      durationMs: result.latencyMs,
      fallbackUsed: configuredProvider !== "mock",
      fallbackReason: configuredProvider !== "mock" ? "provider_not_ready" : undefined,
    })
    return result
  }

  const healthCtx = { projectId: request.projectId ?? null, taskId: request.taskId ?? null, model, actor: "system" as const }
  const gate = await providerCanAttempt(provider, healthCtx)
  if (!gate.allowed) {
    const target = resolveFailoverTarget(provider, env)
    if (target && getForgeProviderAdapter(target).isConfigured(env)) {
      const targetGate = await providerCanAttempt(target, { ...healthCtx })
      if (targetGate.allowed) {
        failover = { from: provider, to: target, reason: gate.reason }
        await recordProviderFailover({ from: provider, to: target, reason: gate.reason, ctx: healthCtx })
        provider = target
        adapter = getForgeProviderAdapter(target)
        model = adapter.model(request.taskType)
        log = log.child({ provider, model })
        healthCtx.model = model
      } else {
        throw new ForgeAiError("All approved AI providers are temporarily unavailable.", false, { code: "circuit_open" })
      }
    } else {
      throw new ForgeAiError(`The ${provider} AI provider is temporarily unavailable (circuit open).`, false, { code: "circuit_open" })
    }
  }

  const budgetConfig = resolveForgeAiBudgetConfig(env)
  const requestedMaxTokens = request.maxTokens ?? 800
  const budgetCheck = assertForgeAiTokenBudgetAllowsRequest({
    config: budgetConfig,
    ledger: currentBudgetLedger(),
    requestedMaxTokens,
  })
  if (!budgetCheck.ok) throw new ForgeAiError(budgetCheck.error)

  const estimatedMaxCost = estimateForgeAiCostUsd(provider, {
    inputTokens: estimatePromptTokens(request),
    outputTokens: requestedMaxTokens,
    totalTokens: estimatePromptTokens(request) + requestedMaxTokens,
  }) ?? 0
  try {
    await assertForgeAiBudgetAllowsRequest({
      projectId: request.projectId ?? null,
      estimatedMaxCost,
      env,
    })
  } catch (error) {
    if (error instanceof ForgeAiBudgetExceededError) throw new ForgeAiError(error.safeMessage)
    throw error
  }

  const maxRetries = Math.max(0, request.maxRetries ?? DEFAULT_MAX_RETRIES)
  const retryConfig = resolveRetryPolicyConfig(env, maxRetries)
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const raw = await adapter.generateStructuredJson({ taskType:request.taskType, prompt:request.prompt, systemPrompt:buildSafeSystemPrompt(request.systemPrompt), schema:request.schema, schemaName:request.schemaName, maxTokens:request.maxTokens ?? 800, temperature:request.temperature, timeoutMs:request.timeoutMs ?? DEFAULT_TIMEOUT_MS, env, mockData:request.mockData })
      await recordProviderSuccess(provider)
      const parsed = parseAndValidateStructuredJson<TData>(request.schema, raw.text)

      if (!parsed.ok) {
        if (request.fallbackOnSchemaMismatch && request.mockData && attempt === maxRetries) {
          const fallback = parseAndValidateStructuredJson<TData>(request.schema, request.mockData)
          if (fallback.ok) {
            const costEstimateUsd = estimateForgeAiCostUsd(provider, raw.usage)
            recordBudgetUsage(raw.usage.totalTokens ?? 0, costEstimateUsd ?? 0)
            const completedAt = new Date()
            await recordForgeAiUsage({
              projectId: request.projectId ?? null,
              taskId: request.taskId ?? null,
              provider,
              model,
              usage: raw.usage,
              estimatedCost: costEstimateUsd,
              startedAt: startedAtDate,
              completedAt,
            })
            log.warn("Forge AI structured response used deterministic fallback", {
              durationMs: completedAt.getTime() - startedAt,
              retryCount: attempt,
              fallbackUsed: true,
              errorCategory: "schema_mismatch",
            })

            return {
              registry,
              provider,
              model,
              taskType: request.taskType,
              data: fallback.data,
              usage: raw.usage,
              costEstimateUsd,
              latencyMs: completedAt.getTime() - startedAt,
              retries: attempt,
              responseId: raw.responseId ?? "schema-fallback",
              failover,
            }
          }
        }
        throw new ForgeAiError("AI response did not match the requested schema.", true, { code: "schema_mismatch" })
      }

      const costEstimateUsd = estimateForgeAiCostUsd(provider, raw.usage)
      recordBudgetUsage(raw.usage.totalTokens ?? 0, costEstimateUsd ?? 0)
      const completedAt = new Date()
      await recordForgeAiUsage({
        projectId: request.projectId ?? null,
        taskId: request.taskId ?? null,
        provider,
        model,
        usage: raw.usage,
        estimatedCost: costEstimateUsd,
        startedAt: startedAtDate,
        completedAt,
      })
      log.info("Forge AI request completed", {
        durationMs: completedAt.getTime() - startedAt,
        retryCount: attempt,
        fallbackUsed: false,
        inputTokens: raw.usage.inputTokens,
        outputTokens: raw.usage.outputTokens,
        totalTokens: raw.usage.totalTokens,
        estimatedCostUsd: costEstimateUsd,
      })

      return {
        registry,
        provider,
        model,
        taskType: request.taskType,
        data: parsed.data,
        usage: raw.usage,
        costEstimateUsd,
        latencyMs: completedAt.getTime() - startedAt,
        retries: attempt,
        responseId: raw.responseId,
        failover,
      }
    } catch (error) {
      lastError = error
      const retryable = error instanceof ForgeAiError || error instanceof ProviderAdapterError ? error.retryable : true
      const normalizedError = normalizeUnknownError(error, {
        safeMessage: error instanceof ForgeAiError || error instanceof ProviderAdapterError ? error.safeMessage : "Unable to get a safe AI response right now.",
        category: "ai_provider",
      })
      log.warn("Forge AI provider attempt failed", {
        retryCount: attempt,
        retryable,
        fallbackUsed: false,
        durationMs: Date.now() - startedAt,
        errorCategory: normalizedError.category,
        error: normalizedError,
      })
      captureMonitoringException(error, {
        projectId: request.projectId ?? undefined,
        taskId: request.taskId ?? undefined,
        forgeStage: request.taskType,
        provider,
        model,
        retryCount: attempt,
        errorCategory: normalizedError.category,
      })
      const classification = classifyRetryability(error)
      if (provider !== "mock" && isTripCategory(classification.category)) {
        await recordProviderFailure(provider, classification.category, normalizedError.safeMessage, healthCtx)
      }
      const decision = nextRetryDecision({ classification, attempt, elapsedMs: Date.now() - startedAt, config: retryConfig })
      if (!decision.retry) break
      await wait(decision.delayMs)
    }
  }

  if (lastError instanceof ForgeAiError) throw lastError
  if (lastError instanceof ProviderAdapterError) throw new ForgeAiError(lastError.safeMessage, lastError.retryable, { code:`provider_${lastError.category}`, cause:lastError })
  throw new ForgeAiError("Unable to get a safe AI response right now.", true)
}

export { buildForgeTaskOutputMetadata }

function buildSafeSystemPrompt(systemPrompt: string | undefined) {
  if (!systemPrompt) return FORGE_AI_SAFETY_SYSTEM_PROMPT
  return `${FORGE_AI_SAFETY_SYSTEM_PROMPT}\n\nTask instructions:\n${systemPrompt}`
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function estimatePromptTokens(request: ForgeAiRequest) {
  const chars = `${request.systemPrompt ?? ""}\n${request.prompt}`.length
  return Math.max(1, Math.ceil(chars / 4))
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
