# ADR 0005: Provider Adapters

- Status: Accepted
- Date: 2026-07-13

## Context

Forge supports OpenAI, Anthropic, and deterministic mock/fallback behaviour. Provider-specific request formatting, usage normalisation, error classification, retry guidance, capability detection, and response metadata should not leak into agent logic.

## Decision

Use explicit provider adapters behind a stable Forge provider contract. Keep provider-specific request/response handling inside adapter modules and expose safe, normalised results to Forge agents.

## Alternatives Considered

- Direct provider SDK calls from each agent.
- A single generic HTTP wrapper without provider-specific capabilities.
- Outsourcing orchestration to a third-party AI gateway.

## Consequences

Adapters make contract tests and provider substitution possible. They add one layer of indirection and require adapter-specific maintenance when provider APIs change.

## Security Implications

Provider keys stay server-only. Diagnostics must be safe and must not store raw provider responses, prompts, secrets, or generated source code in monitoring or logs.

## Operational Implications

Provider failures can be classified consistently for retries, failover, circuit-breaker health, and economics reporting. Live provider behaviour still needs monitored rollout and budget controls.

## Related Code or Documentation

- `admin/src/lib/server/forge-provider-adapters.ts`
- `admin/src/lib/server/forge-provider-health.ts`
- `admin/src/lib/server/forge-ai.ts`
- `docs/architecture/provider-adapters.md`
- `docs/operations/error-monitoring.md`
