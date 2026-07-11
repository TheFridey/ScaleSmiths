import { createMockStructuredResponse, resolveForgeAiModel, supportsOpenAiTemperature, type ForgeAiProvider, type ForgeAiTaskType, type ForgeAiUsage, type ForgeJsonSchema, type JsonValue } from "../forge-ai"

export type ProviderErrorCategory = "authentication" | "rate_limit" | "timeout" | "unavailable" | "invalid_response" | "invalid_request" | "model_unsupported" | "safety" | "request"
export class ProviderAdapterError extends Error {
  constructor(public safeMessage: string, public category: ProviderErrorCategory, public retryable: boolean, public retryAfterMs?: number, public status?: number) { super(safeMessage); this.name = "ProviderAdapterError" }
}
export interface ProviderAdapterRequest { taskType: ForgeAiTaskType; prompt: string; systemPrompt: string; schema: ForgeJsonSchema; schemaName: string; maxTokens: number; temperature?: number; timeoutMs: number; env: NodeJS.ProcessEnv; mockData?: JsonValue }
export interface ProviderAdapterResult { text: string; usage: ForgeAiUsage; responseId: string | null; diagnostics: Record<string, string | number | boolean | null> }
export interface ForgeProviderAdapter {
  readonly provider: ForgeAiProvider
  generateStructuredJson(request: ProviderAdapterRequest): Promise<ProviderAdapterResult>
  normalizeUsage(value: unknown): ForgeAiUsage
  classifyError(error: unknown): ProviderAdapterError
  retryGuidance(error: ProviderAdapterError): { retryable: boolean; retryAfterMs?: number }
  capabilities(): { strictJsonSchema: boolean; temperature: boolean }
  model(taskType: ForgeAiTaskType): string
  isConfigured(env: NodeJS.ProcessEnv): boolean
}

abstract class HttpAdapter implements ForgeProviderAdapter {
  abstract readonly provider: "openai" | "anthropic"
  abstract generateStructuredJson(request: ProviderAdapterRequest): Promise<ProviderAdapterResult>
  abstract normalizeUsage(value: unknown): ForgeAiUsage
  abstract capabilities(): { strictJsonSchema: boolean; temperature: boolean }
  model(taskType: ForgeAiTaskType) { return resolveForgeAiModel(taskType, this.provider) }
  isConfigured(env: NodeJS.ProcessEnv) { return env.FORGE_ENABLE_AI === "true" && Boolean(this.provider === "openai" ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY) }
  retryGuidance(error: ProviderAdapterError) { return { retryable: error.retryable, retryAfterMs: error.retryAfterMs } }
  classifyError(error: unknown) { return error instanceof ProviderAdapterError ? error : new ProviderAdapterError("AI provider request failed.", "request", true) }
  protected async fetch(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), timeoutMs)
    try { return await fetch(url, { ...init, signal:controller.signal }) }
    catch (error) { if (error instanceof Error && error.name === "AbortError") throw new ProviderAdapterError("AI provider request timed out.", "timeout", true); throw this.classifyError(error) }
    finally { clearTimeout(timeout) }
  }
  protected httpError(name: string, response: Response, body?: unknown) {
    const retryAfter = Number(response.headers.get("retry-after"))
    const status = response.status
    const err = record(record(body)?.error)
    const type = (stringValue(err?.type) ?? "").toLowerCase()
    const code = (stringValue(err?.code) ?? "").toLowerCase()
    if (status === 401 || status === 403) return new ProviderAdapterError(`${name} credentials were rejected.`, "authentication", false, undefined, status)
    if (status === 429) return new ProviderAdapterError(`${name} rate limit reached.`, "rate_limit", true, Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined, status)
    if (status >= 500) return new ProviderAdapterError(`${name} is temporarily unavailable.`, "unavailable", true, undefined, status)
    if (status === 404 || /model/.test(code) || /not_found/.test(type)) return new ProviderAdapterError(`${name} model is not available.`, "model_unsupported", false, undefined, status)
    if (/content|policy|safety|permission/.test(type) || /content|policy|safety/.test(code)) return new ProviderAdapterError(`${name} rejected the request on safety policy.`, "safety", false, undefined, status)
    return new ProviderAdapterError(`${name} rejected the request.`, "invalid_request", false, undefined, status)
  }
}

export class OpenAiProviderAdapter extends HttpAdapter {
  readonly provider = "openai" as const
  async generateStructuredJson(request: ProviderAdapterRequest) {
    if (!request.env.OPENAI_API_KEY) throw new ProviderAdapterError("OpenAI is not configured.", "authentication", false)
    const model = this.model(request.taskType)
    const body: Record<string, unknown> = { model, input:[{ role:"system", content:request.systemPrompt }, { role:"user", content:request.prompt }], text:{ format:{ type:"json_schema", name:request.schemaName, schema:request.schema, strict:true } }, max_output_tokens:request.maxTokens }
    if (typeof request.temperature === "number" && supportsOpenAiTemperature(model)) body.temperature = request.temperature
    const response = await this.fetch("https://api.openai.com/v1/responses", { method:"POST", headers:{ Authorization:`Bearer ${request.env.OPENAI_API_KEY}`, "Content-Type":"application/json" }, body:JSON.stringify(body) }, request.timeoutMs)
    const json = await response.json().catch(() => null)
    if (!response.ok) throw this.httpError("OpenAI", response, json)
    return { text:extractOpenAiText(json), usage:this.normalizeUsage(record(json)?.usage), responseId:stringValue(record(json)?.id), diagnostics:{ provider:"openai", status:response.status, responseId:stringValue(record(json)?.id) } }
  }
  normalizeUsage(value: unknown) { const usage = record(value); return { inputTokens:numberValue(usage?.input_tokens), outputTokens:numberValue(usage?.output_tokens), totalTokens:numberValue(usage?.total_tokens) } }
  capabilities() { return { strictJsonSchema:true, temperature:true } }
}

export class AnthropicProviderAdapter extends HttpAdapter {
  readonly provider = "anthropic" as const
  async generateStructuredJson(request: ProviderAdapterRequest) {
    if (!request.env.ANTHROPIC_API_KEY) throw new ProviderAdapterError("Anthropic is not configured.", "authentication", false)
    const response = await this.fetch("https://api.anthropic.com/v1/messages", { method:"POST", headers:{ "x-api-key":request.env.ANTHROPIC_API_KEY, "anthropic-version":"2023-06-01", "content-type":"application/json" }, body:JSON.stringify({ model:this.model(request.taskType), max_tokens:request.maxTokens, system:request.systemPrompt, messages:[{ role:"user", content:request.prompt }], output_config:{ format:{ type:"json_schema", schema:request.schema } } }) }, request.timeoutMs)
    const json = await response.json().catch(() => null)
    if (!response.ok) throw this.httpError("Anthropic", response, json)
    return { text:extractAnthropicText(json), usage:this.normalizeUsage(record(json)?.usage), responseId:stringValue(record(json)?.id), diagnostics:{ provider:"anthropic", status:response.status, responseId:stringValue(record(json)?.id) } }
  }
  normalizeUsage(value: unknown) { const usage = record(value), inputTokens = numberValue(usage?.input_tokens), outputTokens = numberValue(usage?.output_tokens); return { inputTokens, outputTokens, totalTokens:inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null } }
  capabilities() { return { strictJsonSchema:true, temperature:false } }
}

export class MockProviderAdapter implements ForgeProviderAdapter {
  readonly provider = "mock" as const
  async generateStructuredJson(request: ProviderAdapterRequest) { return { text:JSON.stringify(request.mockData ?? createMockStructuredResponse(request.schema, request.taskType)), usage:{ inputTokens:0, outputTokens:0, totalTokens:0 }, responseId:"mock", diagnostics:{ provider:"mock", deterministic:true } } }
  normalizeUsage() { return { inputTokens:0, outputTokens:0, totalTokens:0 } }
  classifyError(error: unknown) { return error instanceof ProviderAdapterError ? error : new ProviderAdapterError("Mock provider failed.", "invalid_response", false) }
  retryGuidance(error: ProviderAdapterError) { return { retryable:error.retryable } }
  capabilities() { return { strictJsonSchema:true, temperature:false } }
  model(taskType: ForgeAiTaskType) { return resolveForgeAiModel(taskType, "mock") }
  isConfigured() { return true }
}

const adapters: Record<ForgeAiProvider, ForgeProviderAdapter> = { openai:new OpenAiProviderAdapter(), anthropic:new AnthropicProviderAdapter(), mock:new MockProviderAdapter() }
export function getForgeProviderAdapter(provider: ForgeAiProvider) { return adapters[provider] }
function record(value: unknown) { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null }
function numberValue(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null }
function stringValue(value: unknown) { return typeof value === "string" ? value : null }
function extractOpenAiText(value: unknown) { const json = record(value); if (typeof json?.output_text === "string") return json.output_text; if (Array.isArray(json?.output)) for (const item of json.output) { const row = record(item); if (Array.isArray(row?.content)) for (const content of row.content) { const block = record(content); if (typeof block?.text === "string") return block.text } } throw new ProviderAdapterError("OpenAI returned an unreadable response.", "invalid_response", true) }
function extractAnthropicText(value: unknown) { const json = record(value); if (Array.isArray(json?.content)) for (const content of json.content) { const block = record(content); if (typeof block?.text === "string") return block.text } throw new ProviderAdapterError("Anthropic returned an unreadable response.", "invalid_response", true) }
