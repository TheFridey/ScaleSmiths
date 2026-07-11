# Transactional AI budget reservations

Migration `0021_ai_budget_reservations.sql` introduces the database-authoritative reservation ledger. Provider calls no longer depend on process-local accumulated spend.

Before every provider or deterministic fallback call, Forge estimates the maximum cost and starts a serializable PostgreSQL transaction. A transaction-scoped advisory lock serializes the budget decision across workers. The decision includes completed usage, conservative unknown-usage charges, and all unexpired active reservations. A unique idempotency key prevents concurrent or restarted workers from replaying the same task/prompt/provider operation.

Enforced scopes are daily global, lifetime project, optional task, and optional provider daily budgets. Limits are hard. Reservations reaching 80% of a configured scope create a project activity alert. Configure:

- `FORGE_AI_DAILY_USD_BUDGET`
- `FORGE_MAX_PROJECT_AI_COST`
- `FORGE_AI_MAX_TASK_USD_BUDGET` (optional)
- `FORGE_AI_PROVIDER_OPENAI_DAILY_USD_BUDGET` (optional)
- `FORGE_AI_PROVIDER_ANTHROPIC_DAILY_USD_BUDGET` (optional)
- `FORGE_AI_RESERVATION_TIMEOUT_MS` (default 15 minutes)

Successful calls reconcile reserved cost to normalized actual cost, releasing the difference. Schema/mock fallback records the fallback provider. Failed calls with known zero usage release the reservation; calls whose usage is unknown conservatively reconcile at the reserved maximum. Expired active reservations become `abandoned` during the next reservation transaction or an explicit `abandonExpiredForgeAiReservations` maintenance call.

Reservation states are `reserved`, `reconciled`, `released`, `failed`, and `abandoned`, protected by database checks. Monetary values cannot be negative. Process restarts leave reservations recoverable through expiry; no in-memory ledger is authoritative.

Apply migration `0021` before deploying the matching application build.
