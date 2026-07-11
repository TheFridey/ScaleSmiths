# Forge AI provider adapters

`admin/src/lib/server/forge-provider-adapters.ts` defines the provider contract and OpenAI, Anthropic, and deterministic mock implementations. Each adapter owns structured JSON request formatting, usage normalization, capability detection, model selection, response ID extraction, error classification, retry guidance, timeouts, and safe diagnostic metadata.

`forge-ai.ts` remains the provider-neutral orchestrator. It selects an adapter, supplies the shared safety system prompt, enforces budgets, validates returned text against the requested strict JSON Schema, applies configured deterministic schema fallback, records normalized usage/cost, and emits redacted logs and monitoring events. Forge agents receive only normalized `ForgeAiResult` values.

Provider errors are classified as authentication, rate limit, timeout, unavailable, invalid response, or request failures. Authentication errors are not retryable; rate limits, timeouts, temporary unavailability, and unreadable provider envelopes may be retried according to existing retry limits. Provider response bodies are never included in diagnostics.

Contract tests use mocked Fetch responses and cover successful structured responses, usage and response IDs, malformed envelopes, HTTP 401, HTTP 429 with retry guidance, timeouts, deterministic mock output, and schema mismatches.
