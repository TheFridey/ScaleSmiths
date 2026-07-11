import { afterEach, describe, expect, it, vi } from "vitest"
import { parseAndValidateStructuredJson, type ForgeJsonSchema } from "../forge-ai"
import { AnthropicProviderAdapter, MockProviderAdapter, OpenAiProviderAdapter, ProviderAdapterError, type ForgeProviderAdapter } from "./forge-provider-adapters"

const schema = { type:"object", additionalProperties:false, required:["ok"], properties:{ ok:{ type:"boolean" } } } as const satisfies ForgeJsonSchema
const base = { taskType:"planning" as const, prompt:"test", systemPrompt:"safe", schema, schemaName:"contract", maxTokens:100, timeoutMs:100, env:{ FORGE_ENABLE_AI:"true", OPENAI_API_KEY:"openai-secret", ANTHROPIC_API_KEY:"anthropic-secret" } as NodeJS.ProcessEnv }
afterEach(() => vi.unstubAllGlobals())

describe.each([
  ["OpenAI", new OpenAiProviderAdapter(), { id:"resp_o", output_text:'{"ok":true}', usage:{ input_tokens:2, output_tokens:3, total_tokens:5 } }],
  ["Anthropic", new AnthropicProviderAdapter(), { id:"resp_a", content:[{ type:"text", text:'{"ok":true}' }], usage:{ input_tokens:2, output_tokens:3 } }],
] as const)("%s provider adapter contract", (_name, adapter, success) => {
  it("normalises structured output, usage and response identifiers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, success)))
    const result = await adapter.generateStructuredJson(base)
    expect(JSON.parse(result.text)).toEqual({ ok:true })
    expect(result.usage).toEqual({ inputTokens:2, outputTokens:3, totalTokens:5 })
    expect(result.responseId).toMatch(/^resp_/)
    expect(result.diagnostics).not.toHaveProperty("body")
  })
  it.each([[429, "rate_limit", true], [401, "authentication", false]] as const)("classifies HTTP %s", async (status, category, retryable) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(status, { secret:"must not leak" })))
    await expect(adapter.generateStructuredJson(base)).rejects.toMatchObject({ category, retryable })
  })
  it("classifies timeouts without leaking requests", async () => {
    const abort = Object.assign(new Error("aborted"), { name:"AbortError" })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort))
    await expect(adapter.generateStructuredJson(base)).rejects.toMatchObject({ category:"timeout", retryable:true, safeMessage:"AI provider request timed out." })
  })
  it("rejects malformed provider envelopes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { id:"bad", unexpected:true })))
    await expect(adapter.generateStructuredJson(base)).rejects.toMatchObject({ category:"invalid_response" })
  })
})

describe("mock adapter contract", () => {
  it("is deterministic and schema mismatches remain detectable", async () => {
    const adapter: ForgeProviderAdapter = new MockProviderAdapter()
    const valid = await adapter.generateStructuredJson({ ...base, mockData:{ ok:true } })
    expect(parseAndValidateStructuredJson(schema, valid.text).ok).toBe(true)
    const malformed = await adapter.generateStructuredJson({ ...base, mockData:{ wrong:true } })
    expect(parseAndValidateStructuredJson(schema, malformed.text)).toMatchObject({ ok:false })
    expect(adapter.capabilities().strictJsonSchema).toBe(true)
  })
  it("provides safe error classification", () => expect(new MockProviderAdapter().classifyError(new Error("secret response"))).toEqual(expect.objectContaining<Partial<ProviderAdapterError>>({ category:"invalid_response", retryable:false })))
})

// Reach the protected httpError via a tiny subclass so we can test classification directly.
class TestAdapter extends OpenAiProviderAdapter {
  classify(response: Response, body?: unknown) {
    return (this as unknown as { httpError(name: string, response: Response, body?: unknown): ProviderAdapterError }).httpError("OpenAI", response, body)
  }
}

function res(status: number, headers: Record<string, string> = {}) {
  return new Response(null, { status, headers })
}

describe("httpError classification", () => {
  const adapter = new TestAdapter()

  it("401/403 -> authentication, permanent", () => {
    const e = adapter.classify(res(401))
    expect(e.category).toBe("authentication")
    expect(e.retryable).toBe(false)
  })

  it("429 -> rate_limit, retryable, parses Retry-After seconds", () => {
    const e = adapter.classify(res(429, { "retry-after": "2" }))
    expect(e.category).toBe("rate_limit")
    expect(e.retryable).toBe(true)
    expect(e.retryAfterMs).toBe(2000)
  })

  it("500 -> unavailable, retryable", () => {
    const e = adapter.classify(res(500))
    expect(e.category).toBe("unavailable")
    expect(e.retryable).toBe(true)
  })

  it("404 / model_not_found -> model_unsupported, permanent", () => {
    expect(adapter.classify(res(404)).category).toBe("model_unsupported")
    expect(adapter.classify(res(400), { error: { code: "model_not_found" } }).category).toBe("model_unsupported")
  })

  it("content policy -> safety, permanent", () => {
    const e = adapter.classify(res(400), { error: { type: "content_policy_violation" } })
    expect(e.category).toBe("safety")
    expect(e.retryable).toBe(false)
  })

  it("other 400 -> invalid_request, permanent", () => {
    const e = adapter.classify(res(400), { error: { type: "invalid_request_error" } })
    expect(e.category).toBe("invalid_request")
    expect(e.retryable).toBe(false)
  })
})

function response(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers:{ "Content-Type":"application/json", ...(status === 429 ? { "Retry-After":"2" } : {}) } }) }
