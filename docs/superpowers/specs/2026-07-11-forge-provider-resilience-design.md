# Forge AI Provider Resilience — Exponential Retry, Jitter & Circuit Breakers

**Date:** 2026-07-11
**Status:** Approved design, pending implementation plan
**Area:** `admin/` Forge AI provider layer

## Goal

Upgrade Forge AI provider failure handling from the current fixed linear-backoff retry loop into a
robust retry policy (exponential backoff, jitter, `Retry-After` support, provider-specific error
classification, max elapsed retry time, and a clear retryable-vs-permanent distinction), add a
lightweight per-provider circuit breaker with optional policy-gated failover, and surface provider
health to admins.

## Current state (what exists today)

- [`admin/src/lib/server/forge-ai.ts`](../../../admin/src/lib/server/forge-ai.ts) — `runForgeAiJson`
  contains an inline retry loop with **fixed linear backoff** (`wait(250 * (attempt + 1))`). It does
  **not** use jitter and **ignores** the `retryAfterMs` the adapters already compute.
- [`admin/src/lib/server/forge-provider-adapters.ts`](../../../admin/src/lib/server/forge-provider-adapters.ts)
  — classifies errors into `ProviderAdapterError` with categories
  (`authentication | rate_limit | timeout | unavailable | invalid_response | request`), a `retryable`
  flag, `retryAfterMs` parsed from the `Retry-After` header, and HTTP `status`.
- The budget ledger uses an **in-memory `globalThis` singleton**
  ([`forge-ai.ts:295`](../../../admin/src/lib/server/forge-ai.ts)); usage and warnings are **DB-backed**
  (`forgeAiUsage`, `forgeActivityLogs`).
- No circuit breaker and no provider-health surface exist yet.
- Tests: **vitest**, colocated as `src/lib/*.test.ts`. Pure logic lives in `src/lib/`; server I/O in
  `src/lib/server/`.

## Design decisions (confirmed)

1. **State store:** In-memory circuit-breaker state (a `globalThis` singleton, mirroring the budget
   ledger) **plus** a DB audit trail of state transitions and failovers. Fast per-call reads; durable,
   auditable record satisfying "never silently change provider."
2. **Failover:** Implement it, but **env-gated and always recorded**. When a provider's breaker is open,
   fail over to an approved alternate only if an env allowlist permits it and the alternate is healthy;
   record every switch. Falls back to `mock`/error only when no alternate is permitted/healthy.
3. **Admin surface:** A GET health API endpoint **and** a health panel rendered in `ForgeDashboard`.

## Ambiguity resolutions (explicit)

- **"Do not retry: invalid schema."** Split into two distinct cases:
  - *Request* schema/format the provider rejects (HTTP 400) → category `invalid_request` /
    `model_unsupported` → **permanent, never retried.**
  - *Response* JSON that fails our schema validation → **retryable**, because re-rolling the model call
    frequently returns valid JSON. (This preserves today's `fallbackOnSchemaMismatch` behaviour.)
- **"Safety-policy rejection unless explicitly appropriate."** Treated as category `safety` →
  **permanent** by default. No automatic retry; a future explicit opt-in can override per-call.
- **Which failures trip the breaker:** Only *transient, provider-health* categories
  (`rate_limit`, `timeout`, `unavailable`, transient network) count toward opening the breaker. An
  `authentication` / `invalid_request` failure means the *credentials or request* are wrong, not that
  the provider is unhealthy, so those must not open the breaker.

## Components

### 1. `admin/src/lib/forge-retry-policy.ts` (pure, unit-tested)

No I/O; imported by the server layer.

- `computeBackoffMs(attempt, { baseMs, maxMs, retryAfterMs })` — exponential `baseMs · 2^attempt`,
  capped at `maxMs`, with **full jitter** (`Math.random() · capped`). When `retryAfterMs` is present,
  return `max(retryAfterMs, jittered)` so a server-provided delay is never undercut.
- `classifyRetryability(error)` → `{ retryable, category, retryAfterMs? }`. Builds on
  `ProviderAdapterError`. Permanent categories: `authentication`, `invalid_request`,
  `model_unsupported`, `safety`, budget exhaustion. Retryable: `rate_limit`, `timeout`, `unavailable`,
  transient network, and response-schema mismatch.
- `nextRetryDecision({ attempt, elapsedMs, error, config })` → `{ retry, delayMs, reason }`. Enforces
  **max elapsed retry time** (stop if `elapsedMs + delayMs` would exceed the deadline) and **max
  attempts**; returns `retry: false` with a reason for permanent errors.
- Config resolved from env with clamped defaults (existing `clampBudgetInteger` pattern):
  `FORGE_AI_RETRY_BASE_MS`=250, `FORGE_AI_RETRY_MAX_MS`=8000, `FORGE_AI_RETRY_MAX_ELAPSED_MS`=30000.
  Existing `maxRetries` / `DEFAULT_MAX_RETRIES` continues to bound attempts.

### 2. `admin/src/lib/forge-circuit-breaker.ts` (pure state machine, unit-tested)

- States per provider: `closed → open → half-open → closed`.
- Pure reducers operating on a plain state object: `onFailure(state, category, now, config)`,
  `onSuccess(state, now)`, `canAttempt(state, now, config)` → `{ allowed, state, reason }`.
- State fields: rolling-window failure timestamps/count, consecutive failures, `lastCategory`,
  `openedAt`, `opensUntil`, `halfOpenInFlight`.
- Only transient/provider-health categories count toward tripping (see ambiguity resolution).
- Transitions: threshold reached within window → `open`; after `opensUntil` a single probe is allowed
  → `half-open`; probe success → `closed` (counters reset); probe failure → `open` again (cooldown
  restarts).
- Config env (clamped): `FORGE_AI_BREAKER_FAILURE_THRESHOLD`=5, `FORGE_AI_BREAKER_COOLDOWN_MS`=30000,
  `FORGE_AI_BREAKER_WINDOW_MS`=60000.
- Live singleton wrapper on `globalThis.__forgeProviderBreakers` lives in the server layer (below);
  the reducers themselves stay pure and dependency-free.

### 3. `admin/src/lib/server/forge-provider-health.ts` (server: singleton + DB audit + failover policy)

- Holds the `globalThis.__forgeProviderBreakers` singleton and thin `canAttempt/recordSuccess/
  recordFailure` wrappers that call the pure reducers and, on any state change, call
  `recordProviderHealthEvent`.
- `recordProviderHealthEvent({ provider, event, fromState, toState, category, detail, model, projectId,
  taskId, actor })` — appends a row to `forge_provider_health`.
- `resolveFailoverTarget(fromProvider, env)` — parses env allowlist `FORGE_AI_FAILOVER_ALLOW`
  (e.g. `anthropic:openai,openai:anthropic`); returns an alternate provider only if the pair is
  permitted, the alternate adapter is configured, and its breaker is not open.
- `loadProviderHealthSnapshot()` — merges live breaker snapshots for all real providers with recent
  `forge_provider_health` events for the admin surface.

### 4. Schema — `forgeProviderHealth` + migration `0021_provider_health.sql`

New append-only table `forge_provider_health`:

| column       | type      | notes                                             |
|--------------|-----------|---------------------------------------------------|
| id           | serial PK |                                                   |
| provider     | text      | not null                                          |
| event        | text      | `state_change` \| `failover` \| `probe`           |
| from_state   | text      | nullable                                          |
| to_state     | text      | nullable                                          |
| category     | text      | nullable (error category that drove the event)    |
| detail       | text      | nullable (safe message)                           |
| model        | text      | nullable                                          |
| project_id   | integer   | nullable, FK `forge_projects` on delete set null  |
| task_id      | integer   | nullable, FK `forge_tasks` on delete set null     |
| actor        | text      | nullable (`system` for automatic transitions)     |
| created_at   | timestamptz | default now, not null                           |

Indexes: `(provider)`, `(created_at)`. Migration authored by hand to match the numbered `drizzle/`
files and registered in `drizzle/meta/_journal.json` as idx 21 (next after `0020`). Schema definition
added to `schema.ts` alongside `forgeAiUsage`.

### 5. `admin/src/lib/server/forge-ai.ts` wiring (surgical edits)

- **Before the retry loop:** call `canAttempt(provider)`. If the breaker is **open**, call
  `resolveFailoverTarget`. On a permitted, healthy alternate → switch adapter + model, and record a
  `provider_failover` event (health table + `forgeActivityLogs` when a project is present) and set
  `result.failover` metadata. If no alternate is available → throw
  `ForgeAiError(safeMessage, retryable=false, { code: "circuit_open" })` so callers see clear status
  without hammering.
- **Inside the loop:** replace `wait(250 * (attempt + 1))` with `nextRetryDecision(...)`. Call
  `recordSuccess(provider)` on success and `recordFailure(provider, category)` on transient failure. A
  half-open success closes the breaker. Permanent errors and deadline/attempt exhaustion break the loop.
- **Result surface:** extend `ForgeAiResult` with optional `failover` and `breakerState`, and surface
  them via `buildForgeTaskOutputMetadata` so task metadata records any provider switch.

### 6. API — `admin/src/app/api/forge/ai/health/route.ts`

Auth-guarded `GET` (same `auth()` guard and `withRequestLogContext` pattern as the AI test route),
returns `loadProviderHealthSnapshot()`. `dynamic = "force-dynamic"`, `runtime = "nodejs"`.

### 7. UI — `ForgeProviderHealthPanel`

New client component rendered inside `ForgeDashboard`. Per-provider chips (green/amber/red for
`closed`/`half-open`/`open`) showing state, recent failure count, last error category, cooldown
remaining, and recent failover events. Uses the existing `T` theme tokens. Data supplied through
`loadForgeDashboardPageData` (server) so the dashboard stays a server-rendered page with a client panel,
consistent with the existing structure.

## Error handling summary

- Permanent errors → `ForgeAiError(retryable: false)` with a specific `code`.
- Breaker open + no permitted/healthy alternate → `ForgeAiError(code: "circuit_open", retryable: false)`.
- Every provider switch is recorded (health table + activity log + result metadata) — never silent.
- Transient failures counted toward the breaker; config/auth/format errors are not.

## Testing

Vitest, colocated `*.test.ts` under `src/lib/`:

- `forge-retry-policy.test.ts` — backoff exponential growth and `maxMs` cap; jitter stays within
  `[0, cap]`; `Retry-After` precedence (`max(retryAfterMs, jittered)`); max-elapsed stop; max-attempts
  stop; each do-not-retry category classified as permanent; response-schema mismatch classified
  retryable.
- `forge-circuit-breaker.test.ts` — opens at threshold within window; window expiry drops stale
  failures; cooldown elapses → `half-open`; probe success → `closed` with reset counters; probe failure
  → `open` with restarted cooldown; non-transient categories never trip.
- Adapter classification: `httpError` splits HTTP 400 into `invalid_request` / `model_unsupported` /
  `safety` and marks them permanent; 429 retryable with `retryAfterMs`; 5xx `unavailable` retryable.

Manual verification: exercise `GET /api/forge/ai/health` and confirm the dashboard panel renders live
state, then simulate failures to observe the breaker opening and a recorded failover.

## Out of scope (YAGNI)

- Cross-instance shared breaker state (single-instance in-memory is sufficient now; the DB audit trail
  covers durability/visibility needs).
- Automatic retry of `safety` rejections (permanent by default; explicit per-call override deferred).
- Provider health alerting/notifications beyond the admin panel and existing activity log.
