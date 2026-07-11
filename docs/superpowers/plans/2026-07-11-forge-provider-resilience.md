# Forge AI Provider Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Forge AI provider failure handling with exponential backoff + jitter + `Retry-After`, a retryable-vs-permanent classification, a per-provider circuit breaker with policy-gated recorded failover, and an admin provider-health surface.

**Architecture:** Pure, unit-tested logic (retry policy, breaker state machine) lives in `admin/src/lib/`; server wiring (in-memory breaker singleton, DB audit, failover policy, `runForgeAiJson` integration) lives in `admin/src/lib/server/`. Breaker state is an in-memory `globalThis` singleton (mirroring the existing budget ledger); every state transition and failover is appended to a new `forge_provider_health` DB table for audit and admin visibility.

**Tech Stack:** TypeScript, Next.js (App Router, `nodejs` runtime), Drizzle ORM (PostgreSQL), Vitest (colocated `*.test.ts`), React client components with existing `T` CSS-var theme tokens.

## Global Constraints

- All server-only modules start with `import "server-only"`; pure `src/lib/` modules must NOT import `server-only` or `@/lib/db`.
- Follow existing code style in touched files (compact one-line helpers in `forge-provider-adapters.ts`; multi-line in `forge-ai.ts`).
- Tests are Vitest, run with `npm test` (`vitest run`) from `admin/`, colocated as `src/lib/<name>.test.ts`.
- Env config values must be clamped with sane defaults (existing `clampBudgetInteger` pattern); never trust raw env numbers.
- Migrations are hand-authored numbered SQL in `admin/drizzle/`, registered in `admin/drizzle/meta/_journal.json`. Next index is **21**, next file prefix `0021_`.
- Provider switches must ALWAYS be recorded (DB event + result metadata). Never switch silently.
- Circuit breaker applies only to real providers (`openai`, `anthropic`), never to `mock`.
- All commands below run from the `admin/` directory unless stated otherwise.

---

### Task 1: `forge_provider_health` schema + migration

**Files:**
- Modify: `admin/src/lib/schema.ts` (add table after `forgeAiUsage`, ~line 475)
- Create: `admin/drizzle/0021_provider_health.sql`
- Modify: `admin/drizzle/meta/_journal.json` (append idx 21 entry)

**Interfaces:**
- Produces: `forgeProviderHealth` Drizzle table with columns `id, provider, event, fromState, toState, category, detail, model, projectId, taskId, actor, createdAt`.

- [ ] **Step 1: Add the table to `schema.ts`**

Insert immediately after the `forgeAiUsage` table definition (after its closing `])` near line 475):

```ts
export const forgeProviderHealth = pgTable("forge_provider_health", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  event: text("event").notNull(),
  fromState: text("from_state"),
  toState: text("to_state"),
  category: text("category"),
  detail: text("detail"),
  model: text("model"),
  projectId: integer("project_id").references(() => forgeProjects.id, { onDelete: "set null" }),
  taskId: integer("task_id").references(() => forgeTasks.id, { onDelete: "set null" }),
  actor: text("actor"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("forge_provider_health_provider_idx").on(table.provider),
  index("forge_provider_health_created_at_idx").on(table.createdAt),
])
```

- [ ] **Step 2: Write the migration SQL**

Create `admin/drizzle/0021_provider_health.sql`:

```sql
CREATE TABLE "forge_provider_health" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event" text NOT NULL,
	"from_state" text,
	"to_state" text,
	"category" text,
	"detail" text,
	"model" text,
	"project_id" integer,
	"task_id" integer,
	"actor" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "forge_provider_health" ADD CONSTRAINT "forge_provider_health_project_id_forge_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."forge_projects"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "forge_provider_health" ADD CONSTRAINT "forge_provider_health_task_id_forge_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forge_tasks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "forge_provider_health_provider_idx" ON "forge_provider_health" USING btree ("provider");
--> statement-breakpoint
CREATE INDEX "forge_provider_health_created_at_idx" ON "forge_provider_health" USING btree ("created_at");
```

- [ ] **Step 3: Register the migration in the journal**

In `admin/drizzle/meta/_journal.json`, append to the `entries` array (after the idx 20 object), matching the existing shape:

```json
    {
      "idx": 21,
      "version": "7",
      "when": 1784016000000,
      "tag": "0021_provider_health",
      "breakpoints": true
    }
```

(Add a comma after the previous `}` so the array stays valid JSON.)

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no new type errors referencing `schema.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.ts drizzle/0021_provider_health.sql drizzle/meta/_journal.json
git commit -m "feat(forge): add forge_provider_health audit table"
```

---

### Task 2: Pure retry-policy module

**Files:**
- Create: `admin/src/lib/forge-retry-policy.ts`
- Test: `admin/src/lib/forge-retry-policy.test.ts`

**Interfaces:**
- Produces:
  - `type RetryCategory = "authentication" | "invalid_request" | "model_unsupported" | "safety" | "budget" | "rate_limit" | "timeout" | "unavailable" | "invalid_response" | "network" | "schema_mismatch"`
  - `interface RetryClassification { retryable: boolean; category: RetryCategory; retryAfterMs?: number }`
  - `interface RetryPolicyConfig { baseMs: number; maxMs: number; maxElapsedMs: number; maxAttempts: number }`
  - `function classifyRetryability(error: unknown): RetryClassification`
  - `function computeBackoffMs(attempt: number, opts: { baseMs: number; maxMs: number; retryAfterMs?: number; random?: () => number }): number`
  - `function nextRetryDecision(input: { classification: RetryClassification; attempt: number; elapsedMs: number; config: RetryPolicyConfig; random?: () => number }): { retry: boolean; delayMs: number; reason: string }`
  - `function resolveRetryPolicyConfig(env: Record<string, string | undefined>, maxAttempts: number): RetryPolicyConfig`
  - `function clampInt(value: string | undefined, fallback: number, min: number, max: number): number`

- [ ] **Step 1: Write the failing test**

Create `admin/src/lib/forge-retry-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  classifyRetryability,
  computeBackoffMs,
  nextRetryDecision,
  resolveRetryPolicyConfig,
  type RetryPolicyConfig,
} from "./forge-retry-policy"

const config: RetryPolicyConfig = { baseMs: 250, maxMs: 8000, maxElapsedMs: 30000, maxAttempts: 3 }

describe("classifyRetryability", () => {
  it("marks provider auth/credential errors permanent", () => {
    expect(classifyRetryability({ category: "authentication", retryable: false })).toMatchObject({ retryable: false, category: "authentication" })
  })

  it("marks invalid request, unsupported model, and safety permanent", () => {
    expect(classifyRetryability({ category: "invalid_request", retryable: false }).retryable).toBe(false)
    expect(classifyRetryability({ category: "model_unsupported", retryable: false }).retryable).toBe(false)
    expect(classifyRetryability({ category: "safety", retryable: false }).retryable).toBe(false)
  })

  it("marks rate_limit retryable and preserves retryAfterMs", () => {
    expect(classifyRetryability({ category: "rate_limit", retryable: true, retryAfterMs: 2000 })).toMatchObject({ retryable: true, category: "rate_limit", retryAfterMs: 2000 })
  })

  it("treats response schema mismatch as retryable", () => {
    expect(classifyRetryability({ code: "schema_mismatch", retryable: true, safeMessage: "bad" }).category).toBe("schema_mismatch")
    expect(classifyRetryability({ code: "schema_mismatch", retryable: true, safeMessage: "bad" }).retryable).toBe(true)
  })

  it("treats unknown/plain errors as retryable network", () => {
    expect(classifyRetryability(new Error("boom"))).toMatchObject({ retryable: true, category: "network" })
  })
})

describe("computeBackoffMs", () => {
  it("grows exponentially and caps at maxMs (with jitter at its ceiling)", () => {
    const noJitter = () => 1 // full jitter multiplier = 1 returns the cap
    expect(computeBackoffMs(0, { baseMs: 250, maxMs: 8000, random: noJitter })).toBe(250)
    expect(computeBackoffMs(1, { baseMs: 250, maxMs: 8000, random: noJitter })).toBe(500)
    expect(computeBackoffMs(2, { baseMs: 250, maxMs: 8000, random: noJitter })).toBe(1000)
    expect(computeBackoffMs(10, { baseMs: 250, maxMs: 8000, random: noJitter })).toBe(8000)
  })

  it("keeps jittered delay within [0, cap]", () => {
    for (let i = 0; i < 50; i++) {
      const d = computeBackoffMs(3, { baseMs: 250, maxMs: 8000 })
      expect(d).toBeGreaterThanOrEqual(0)
      expect(d).toBeLessThanOrEqual(2000)
    }
  })

  it("never undercuts a server Retry-After", () => {
    expect(computeBackoffMs(0, { baseMs: 250, maxMs: 8000, retryAfterMs: 5000, random: () => 0 })).toBe(5000)
  })
})

describe("nextRetryDecision", () => {
  it("does not retry permanent errors", () => {
    const d = nextRetryDecision({ classification: { retryable: false, category: "authentication" }, attempt: 0, elapsedMs: 0, config })
    expect(d.retry).toBe(false)
    expect(d.reason).toContain("permanent")
  })

  it("does not retry once attempts are exhausted", () => {
    const d = nextRetryDecision({ classification: { retryable: true, category: "timeout" }, attempt: 3, elapsedMs: 0, config })
    expect(d.retry).toBe(false)
    expect(d.reason).toContain("attempts")
  })

  it("does not retry when the delay would pass the elapsed deadline", () => {
    const d = nextRetryDecision({ classification: { retryable: true, category: "timeout" }, attempt: 0, elapsedMs: 29900, config, random: () => 1 })
    expect(d.retry).toBe(false)
    expect(d.reason).toContain("elapsed")
  })

  it("retries a transient error within budget", () => {
    const d = nextRetryDecision({ classification: { retryable: true, category: "unavailable" }, attempt: 0, elapsedMs: 0, config, random: () => 1 })
    expect(d.retry).toBe(true)
    expect(d.delayMs).toBe(250)
  })
})

describe("resolveRetryPolicyConfig", () => {
  it("uses defaults and clamps out-of-range env values", () => {
    expect(resolveRetryPolicyConfig({}, 2)).toEqual({ baseMs: 250, maxMs: 8000, maxElapsedMs: 30000, maxAttempts: 2 })
    const c = resolveRetryPolicyConfig({ FORGE_AI_RETRY_BASE_MS: "5", FORGE_AI_RETRY_MAX_MS: "999999" }, 2)
    expect(c.baseMs).toBe(50)
    expect(c.maxMs).toBe(60000)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- forge-retry-policy`
Expected: FAIL — cannot resolve `./forge-retry-policy`.

- [ ] **Step 3: Write the implementation**

Create `admin/src/lib/forge-retry-policy.ts`:

```ts
export type RetryCategory =
  | "authentication"
  | "invalid_request"
  | "model_unsupported"
  | "safety"
  | "budget"
  | "rate_limit"
  | "timeout"
  | "unavailable"
  | "invalid_response"
  | "network"
  | "schema_mismatch"

export interface RetryClassification {
  retryable: boolean
  category: RetryCategory
  retryAfterMs?: number
}

export interface RetryPolicyConfig {
  baseMs: number
  maxMs: number
  maxElapsedMs: number
  maxAttempts: number
}

const PERMANENT: ReadonlySet<RetryCategory> = new Set([
  "authentication",
  "invalid_request",
  "model_unsupported",
  "safety",
  "budget",
])

// Maps a provider-adapter error category (or a legacy "request" category) onto our retry taxonomy.
const CATEGORY_ALIASES: Record<string, RetryCategory> = {
  authentication: "authentication",
  invalid_request: "invalid_request",
  request: "invalid_request",
  model_unsupported: "model_unsupported",
  safety: "safety",
  budget: "budget",
  rate_limit: "rate_limit",
  timeout: "timeout",
  unavailable: "unavailable",
  invalid_response: "invalid_response",
  network: "network",
  schema_mismatch: "schema_mismatch",
}

export function classifyRetryability(error: unknown): RetryClassification {
  const shape = error as { category?: string; code?: string; retryable?: boolean; retryAfterMs?: number } | null
  const rawCategory = shape?.category ?? shape?.code
  const category = (rawCategory && CATEGORY_ALIASES[rawCategory]) || "network"
  const retryable = !PERMANENT.has(category)
  const retryAfterMs = typeof shape?.retryAfterMs === "number" && Number.isFinite(shape.retryAfterMs) ? shape.retryAfterMs : undefined
  return { retryable, category, retryAfterMs }
}

export function computeBackoffMs(
  attempt: number,
  opts: { baseMs: number; maxMs: number; retryAfterMs?: number; random?: () => number },
): number {
  const random = opts.random ?? Math.random
  const exponential = opts.baseMs * 2 ** Math.max(0, attempt)
  const cap = Math.min(opts.maxMs, exponential)
  const jittered = Math.round(random() * cap) // full jitter in [0, cap]
  if (typeof opts.retryAfterMs === "number" && Number.isFinite(opts.retryAfterMs)) {
    return Math.max(opts.retryAfterMs, jittered)
  }
  return jittered
}

export function nextRetryDecision(input: {
  classification: RetryClassification
  attempt: number
  elapsedMs: number
  config: RetryPolicyConfig
  random?: () => number
}): { retry: boolean; delayMs: number; reason: string } {
  const { classification, attempt, elapsedMs, config } = input
  if (!classification.retryable) {
    return { retry: false, delayMs: 0, reason: `permanent error (${classification.category})` }
  }
  if (attempt + 1 >= config.maxAttempts + 1) {
    // attempt is 0-based; maxAttempts additional retries beyond the first try.
    if (attempt >= config.maxAttempts) {
      return { retry: false, delayMs: 0, reason: "max attempts reached" }
    }
  }
  if (attempt >= config.maxAttempts) {
    return { retry: false, delayMs: 0, reason: "max attempts reached" }
  }
  const delayMs = computeBackoffMs(attempt, {
    baseMs: config.baseMs,
    maxMs: config.maxMs,
    retryAfterMs: classification.retryAfterMs,
    random: input.random,
  })
  if (elapsedMs + delayMs > config.maxElapsedMs) {
    return { retry: false, delayMs: 0, reason: "max elapsed retry time reached" }
  }
  return { retry: true, delayMs, reason: `retrying ${classification.category}` }
}

export function resolveRetryPolicyConfig(
  env: Record<string, string | undefined>,
  maxAttempts: number,
): RetryPolicyConfig {
  return {
    baseMs: clampInt(env.FORGE_AI_RETRY_BASE_MS, 250, 50, 10_000),
    maxMs: clampInt(env.FORGE_AI_RETRY_MAX_MS, 8_000, 250, 60_000),
    maxElapsedMs: clampInt(env.FORGE_AI_RETRY_MAX_ELAPSED_MS, 30_000, 1_000, 300_000),
    maxAttempts: Math.max(0, maxAttempts),
  }
}

export function clampInt(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}
```

- [ ] **Step 4: Simplify the attempt guard**

The duplicate attempt check in Step 3 is deliberately redundant so the test passes; clean it to a single guard. Replace the whole block:

```ts
  if (attempt + 1 >= config.maxAttempts + 1) {
    // attempt is 0-based; maxAttempts additional retries beyond the first try.
    if (attempt >= config.maxAttempts) {
      return { retry: false, delayMs: 0, reason: "max attempts reached" }
    }
  }
  if (attempt >= config.maxAttempts) {
    return { retry: false, delayMs: 0, reason: "max attempts reached" }
  }
```

with:

```ts
  if (attempt >= config.maxAttempts) {
    return { retry: false, delayMs: 0, reason: "max attempts reached" }
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- forge-retry-policy`
Expected: PASS (all cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/forge-retry-policy.ts src/lib/forge-retry-policy.test.ts
git commit -m "feat(forge): add pure retry-policy module (backoff, jitter, classification)"
```

---

### Task 3: Pure circuit-breaker state machine

**Files:**
- Create: `admin/src/lib/forge-circuit-breaker.ts`
- Test: `admin/src/lib/forge-circuit-breaker.test.ts`

**Interfaces:**
- Consumes: `RetryCategory` from `./forge-retry-policy`; `clampInt` from `./forge-retry-policy`.
- Produces:
  - `type BreakerState = "closed" | "open" | "half-open"`
  - `interface ProviderBreakerState { state: BreakerState; failures: number[]; consecutiveFailures: number; lastCategory: RetryCategory | null; openedAt: number | null; opensUntil: number | null; halfOpenInFlight: boolean }`
  - `interface BreakerConfig { failureThreshold: number; cooldownMs: number; windowMs: number }`
  - `interface BreakerTransition { from: BreakerState; to: BreakerState }`
  - `function createBreakerState(): ProviderBreakerState`
  - `function isTripCategory(category: RetryCategory): boolean`
  - `function evaluateAttempt(state, now, config): { next: ProviderBreakerState; allowed: boolean; transition: BreakerTransition | null; reason: string }`
  - `function recordSuccess(state, now): { next: ProviderBreakerState; transition: BreakerTransition | null }`
  - `function recordFailure(state, category, now, config): { next: ProviderBreakerState; transition: BreakerTransition | null }`
  - `function resolveBreakerConfig(env): BreakerConfig`

- [ ] **Step 1: Write the failing test**

Create `admin/src/lib/forge-circuit-breaker.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  createBreakerState,
  evaluateAttempt,
  isTripCategory,
  recordFailure,
  recordSuccess,
  resolveBreakerConfig,
  type BreakerConfig,
} from "./forge-circuit-breaker"

const config: BreakerConfig = { failureThreshold: 3, cooldownMs: 1000, windowMs: 5000 }

function tripOpen(now = 0) {
  let s = createBreakerState()
  for (let i = 0; i < 3; i++) s = recordFailure(s, "timeout", now, config).next
  return s
}

describe("isTripCategory", () => {
  it("counts only provider-health failures", () => {
    expect(isTripCategory("timeout")).toBe(true)
    expect(isTripCategory("rate_limit")).toBe(true)
    expect(isTripCategory("unavailable")).toBe(true)
    expect(isTripCategory("network")).toBe(true)
    expect(isTripCategory("authentication")).toBe(false)
    expect(isTripCategory("invalid_request")).toBe(false)
    expect(isTripCategory("schema_mismatch")).toBe(false)
  })
})

describe("recordFailure", () => {
  it("opens once the threshold is reached within the window", () => {
    const s = tripOpen(0)
    expect(s.state).toBe("open")
    expect(s.opensUntil).toBe(1000)
  })

  it("does not count non-trip categories", () => {
    let s = createBreakerState()
    for (let i = 0; i < 5; i++) s = recordFailure(s, "authentication", 0, config).next
    expect(s.state).toBe("closed")
  })

  it("drops failures older than the window", () => {
    let s = createBreakerState()
    s = recordFailure(s, "timeout", 0, config).next
    s = recordFailure(s, "timeout", 100, config).next
    s = recordFailure(s, "timeout", 9000, config).next // first two are stale (>5000 old)
    expect(s.state).toBe("closed")
    expect(s.failures.length).toBe(1)
  })
})

describe("evaluateAttempt", () => {
  it("allows attempts while closed", () => {
    const r = evaluateAttempt(createBreakerState(), 0, config)
    expect(r.allowed).toBe(true)
  })

  it("blocks while open during cooldown", () => {
    const r = evaluateAttempt(tripOpen(0), 500, config)
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain("open")
  })

  it("transitions open -> half-open after cooldown and allows one probe", () => {
    const r = evaluateAttempt(tripOpen(0), 1000, config)
    expect(r.allowed).toBe(true)
    expect(r.next.state).toBe("half-open")
    expect(r.transition).toEqual({ from: "open", to: "half-open" })
    // a second concurrent probe is blocked
    const r2 = evaluateAttempt(r.next, 1000, config)
    expect(r2.allowed).toBe(false)
  })
})

describe("recordSuccess", () => {
  it("closes the breaker from half-open", () => {
    const open = tripOpen(0)
    const probing = evaluateAttempt(open, 1000, config).next
    const r = recordSuccess(probing, 1100)
    expect(r.next.state).toBe("closed")
    expect(r.next.failures.length).toBe(0)
    expect(r.transition).toEqual({ from: "half-open", to: "closed" })
  })
})

describe("recordFailure from half-open", () => {
  it("re-opens and restarts cooldown", () => {
    const open = tripOpen(0)
    const probing = evaluateAttempt(open, 1000, config).next
    const r = recordFailure(probing, "unavailable", 1200, config)
    expect(r.next.state).toBe("open")
    expect(r.next.opensUntil).toBe(2200)
    expect(r.transition).toEqual({ from: "half-open", to: "open" })
  })
})

describe("resolveBreakerConfig", () => {
  it("defaults and clamps", () => {
    expect(resolveBreakerConfig({})).toEqual({ failureThreshold: 5, cooldownMs: 30_000, windowMs: 60_000 })
    expect(resolveBreakerConfig({ FORGE_AI_BREAKER_FAILURE_THRESHOLD: "1" }).failureThreshold).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- forge-circuit-breaker`
Expected: FAIL — cannot resolve `./forge-circuit-breaker`.

- [ ] **Step 3: Write the implementation**

Create `admin/src/lib/forge-circuit-breaker.ts`:

```ts
import { clampInt, type RetryCategory } from "./forge-retry-policy"

export type BreakerState = "closed" | "open" | "half-open"

export interface ProviderBreakerState {
  state: BreakerState
  failures: number[]
  consecutiveFailures: number
  lastCategory: RetryCategory | null
  openedAt: number | null
  opensUntil: number | null
  halfOpenInFlight: boolean
}

export interface BreakerConfig {
  failureThreshold: number
  cooldownMs: number
  windowMs: number
}

export interface BreakerTransition {
  from: BreakerState
  to: BreakerState
}

const TRIP_CATEGORIES: ReadonlySet<RetryCategory> = new Set(["rate_limit", "timeout", "unavailable", "network"])

export function isTripCategory(category: RetryCategory): boolean {
  return TRIP_CATEGORIES.has(category)
}

export function createBreakerState(): ProviderBreakerState {
  return {
    state: "closed",
    failures: [],
    consecutiveFailures: 0,
    lastCategory: null,
    openedAt: null,
    opensUntil: null,
    halfOpenInFlight: false,
  }
}

export function evaluateAttempt(
  state: ProviderBreakerState,
  now: number,
  config: BreakerConfig,
): { next: ProviderBreakerState; allowed: boolean; transition: BreakerTransition | null; reason: string } {
  if (state.state === "closed") {
    return { next: state, allowed: true, transition: null, reason: "closed" }
  }
  if (state.state === "open") {
    if (state.opensUntil !== null && now >= state.opensUntil) {
      const next: ProviderBreakerState = { ...state, state: "half-open", halfOpenInFlight: true }
      return { next, allowed: true, transition: { from: "open", to: "half-open" }, reason: "half-open probe" }
    }
    return { next: state, allowed: false, transition: null, reason: "circuit open (cooling down)" }
  }
  // half-open: allow only a single probe at a time
  if (state.halfOpenInFlight) {
    return { next: state, allowed: false, transition: null, reason: "half-open probe already in flight" }
  }
  return { next: { ...state, halfOpenInFlight: true }, allowed: true, transition: null, reason: "half-open probe" }
}

export function recordSuccess(
  state: ProviderBreakerState,
  now: number,
): { next: ProviderBreakerState; transition: BreakerTransition | null } {
  void now
  if (state.state === "half-open" || state.state === "open") {
    return {
      next: createBreakerState(),
      transition: { from: state.state, to: "closed" },
    }
  }
  return { next: { ...state, consecutiveFailures: 0 }, transition: null }
}

export function recordFailure(
  state: ProviderBreakerState,
  category: RetryCategory,
  now: number,
  config: BreakerConfig,
): { next: ProviderBreakerState; transition: BreakerTransition | null } {
  if (!isTripCategory(category)) {
    return { next: state, transition: null }
  }

  // Half-open probe failed: re-open immediately and restart the cooldown.
  if (state.state === "half-open") {
    const next: ProviderBreakerState = {
      ...state,
      state: "open",
      lastCategory: category,
      consecutiveFailures: state.consecutiveFailures + 1,
      openedAt: now,
      opensUntil: now + config.cooldownMs,
      halfOpenInFlight: false,
    }
    return { next, transition: { from: "half-open", to: "open" } }
  }

  const failures = [...state.failures.filter((ts) => now - ts < config.windowMs), now]
  const consecutiveFailures = state.consecutiveFailures + 1

  if (state.state === "closed" && failures.length >= config.failureThreshold) {
    const next: ProviderBreakerState = {
      ...state,
      state: "open",
      failures,
      consecutiveFailures,
      lastCategory: category,
      openedAt: now,
      opensUntil: now + config.cooldownMs,
      halfOpenInFlight: false,
    }
    return { next, transition: { from: "closed", to: "open" } }
  }

  return {
    next: { ...state, failures, consecutiveFailures, lastCategory: category },
    transition: null,
  }
}

export function resolveBreakerConfig(env: Record<string, string | undefined>): BreakerConfig {
  return {
    failureThreshold: clampInt(env.FORGE_AI_BREAKER_FAILURE_THRESHOLD, 5, 2, 100),
    cooldownMs: clampInt(env.FORGE_AI_BREAKER_COOLDOWN_MS, 30_000, 1_000, 600_000),
    windowMs: clampInt(env.FORGE_AI_BREAKER_WINDOW_MS, 60_000, 1_000, 3_600_000),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- forge-circuit-breaker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/forge-circuit-breaker.ts src/lib/forge-circuit-breaker.test.ts
git commit -m "feat(forge): add pure per-provider circuit-breaker state machine"
```

---

### Task 4: Enrich provider-adapter error classification

**Files:**
- Modify: `admin/src/lib/server/forge-provider-adapters.ts` (`ProviderErrorCategory` type line 3; `httpError` lines 35-41; the two `throw this.httpError(...)` call sites lines 53 and 66)
- Test: `admin/src/lib/server/forge-provider-adapters.test.ts`

**Interfaces:**
- Produces: `ProviderErrorCategory` now includes `"invalid_request" | "model_unsupported" | "safety"`; `httpError(name, response, body?)` classifies HTTP 4xx into those categories.

- [ ] **Step 1: Write the failing test**

Create `admin/src/lib/server/forge-provider-adapters.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { OpenAiProviderAdapter, ProviderAdapterError } from "./forge-provider-adapters"

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- forge-provider-adapters`
Expected: FAIL — categories `model_unsupported`/`safety`/`invalid_request` not produced (current code returns `request`).

- [ ] **Step 3: Update the category type**

In `forge-provider-adapters.ts` line 3, replace:

```ts
export type ProviderErrorCategory = "authentication" | "rate_limit" | "timeout" | "unavailable" | "invalid_response" | "request"
```

with:

```ts
export type ProviderErrorCategory = "authentication" | "rate_limit" | "timeout" | "unavailable" | "invalid_response" | "invalid_request" | "model_unsupported" | "safety" | "request"
```

- [ ] **Step 4: Rewrite `httpError` to classify 4xx and accept the parsed body**

Replace the `httpError` method (lines 35-41):

```ts
  protected httpError(name: string, response: Response) {
    const retryAfter = Number(response.headers.get("retry-after"))
    if (response.status === 401 || response.status === 403) return new ProviderAdapterError(`${name} credentials were rejected.`, "authentication", false, undefined, response.status)
    if (response.status === 429) return new ProviderAdapterError(`${name} rate limit reached.`, "rate_limit", true, Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined, response.status)
    if (response.status >= 500) return new ProviderAdapterError(`${name} is temporarily unavailable.`, "unavailable", true, undefined, response.status)
    return new ProviderAdapterError(`${name} request failed.`, "request", false, undefined, response.status)
  }
```

with:

```ts
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
```

- [ ] **Step 5: Pass the parsed body at both call sites**

Line 53 (OpenAI), replace `throw this.httpError("OpenAI", response)` with `throw this.httpError("OpenAI", response, json)`.

Line 66 (Anthropic), replace `throw this.httpError("Anthropic", response)` with `throw this.httpError("Anthropic", response, json)`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- forge-provider-adapters`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/forge-provider-adapters.ts src/lib/server/forge-provider-adapters.test.ts
git commit -m "feat(forge): classify provider 4xx into permanent error categories"
```

---

### Task 5: Server provider-health module (singleton + audit + failover policy)

**Files:**
- Create: `admin/src/lib/server/forge-provider-health.ts`
- Test: `admin/src/lib/server/forge-provider-health.test.ts` (failover-policy resolution only — pure, no DB)

**Interfaces:**
- Consumes: breaker reducers from `@/lib/forge-circuit-breaker`; `RetryCategory` from `@/lib/forge-retry-policy`; `db` from `@/lib/db`; `forgeProviderHealth` from `@/lib/schema`; `FORGE_AI_PROVIDERS`, `ForgeAiProvider` from `@/lib/forge`... (import from `@/lib/forge-ai`).
- Produces:
  - `interface ProviderHealthEventContext { projectId?: number | null; taskId?: number | null; model?: string | null; actor?: string | null }`
  - `interface ProviderHealthEntry { provider: ForgeAiProvider; state: BreakerState; recentFailures: number; lastCategory: string | null; opensUntil: string | null; cooldownRemainingMs: number }`
  - `interface ProviderHealthEventRow { id: number; provider: string; event: string; fromState: string | null; toState: string | null; category: string | null; detail: string | null; model: string | null; createdAt: string }`
  - `interface ProviderHealthSnapshot { providers: ProviderHealthEntry[]; recentEvents: ProviderHealthEventRow[] }`
  - `function resolveFailoverTarget(from: ForgeAiProvider, env: Record<string, string | undefined>): ForgeAiProvider | null`
  - `async function providerCanAttempt(provider: ForgeAiProvider, ctx?: ProviderHealthEventContext): Promise<{ allowed: boolean; state: BreakerState; reason: string }>`
  - `async function recordProviderSuccess(provider: ForgeAiProvider): Promise<void>`
  - `async function recordProviderFailure(provider: ForgeAiProvider, category: RetryCategory, detail: string, ctx?: ProviderHealthEventContext): Promise<void>`
  - `async function recordProviderFailover(input: { from: ForgeAiProvider; to: ForgeAiProvider; reason: string; ctx?: ProviderHealthEventContext }): Promise<void>`
  - `async function loadProviderHealthSnapshot(): Promise<ProviderHealthSnapshot>`

- [ ] **Step 1: Write the failing test (failover policy only)**

Create `admin/src/lib/server/forge-provider-health.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { resolveFailoverTarget } from "./forge-provider-health"

describe("resolveFailoverTarget", () => {
  it("returns null when no allowlist is configured", () => {
    expect(resolveFailoverTarget("anthropic", {})).toBeNull()
  })

  it("returns the permitted alternate when configured", () => {
    const env = { FORGE_AI_FAILOVER_ALLOW: "anthropic:openai,openai:anthropic" }
    expect(resolveFailoverTarget("anthropic", env)).toBe("openai")
    expect(resolveFailoverTarget("openai", env)).toBe("anthropic")
  })

  it("ignores malformed or self-referential pairs", () => {
    expect(resolveFailoverTarget("anthropic", { FORGE_AI_FAILOVER_ALLOW: "anthropic:anthropic" })).toBeNull()
    expect(resolveFailoverTarget("anthropic", { FORGE_AI_FAILOVER_ALLOW: "garbage" })).toBeNull()
    expect(resolveFailoverTarget("anthropic", { FORGE_AI_FAILOVER_ALLOW: "anthropic:mock" })).toBeNull()
  })
})
```

Note: `mock` is not a valid failover target (breaker only guards real providers), so `anthropic:mock` resolves to null.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- forge-provider-health`
Expected: FAIL — cannot resolve `./forge-provider-health`.

- [ ] **Step 3: Write the implementation**

Create `admin/src/lib/server/forge-provider-health.ts`:

```ts
import "server-only"
import { and, desc } from "drizzle-orm"
import { db } from "@/lib/db"
import { forgeProviderHealth } from "@/lib/schema"
import { FORGE_AI_PROVIDERS, isForgeAiProvider, type ForgeAiProvider } from "@/lib/forge-ai"
import type { RetryCategory } from "@/lib/forge-retry-policy"
import {
  createBreakerState,
  evaluateAttempt,
  recordFailure as reduceFailure,
  recordSuccess as reduceSuccess,
  resolveBreakerConfig,
  type BreakerState,
  type BreakerTransition,
  type ProviderBreakerState,
} from "@/lib/forge-circuit-breaker"

declare global {
  var __forgeProviderBreakers: Record<string, ProviderBreakerState> | undefined
}

const REAL_PROVIDERS = FORGE_AI_PROVIDERS.filter((p): p is Exclude<ForgeAiProvider, "mock"> => p !== "mock")

export interface ProviderHealthEventContext {
  projectId?: number | null
  taskId?: number | null
  model?: string | null
  actor?: string | null
}

export interface ProviderHealthEntry {
  provider: ForgeAiProvider
  state: BreakerState
  recentFailures: number
  lastCategory: string | null
  opensUntil: string | null
  cooldownRemainingMs: number
}

export interface ProviderHealthEventRow {
  id: number
  provider: string
  event: string
  fromState: string | null
  toState: string | null
  category: string | null
  detail: string | null
  model: string | null
  createdAt: string
}

export interface ProviderHealthSnapshot {
  providers: ProviderHealthEntry[]
  recentEvents: ProviderHealthEventRow[]
}

function breakers(): Record<string, ProviderBreakerState> {
  if (!globalThis.__forgeProviderBreakers) globalThis.__forgeProviderBreakers = {}
  return globalThis.__forgeProviderBreakers
}

function getState(provider: ForgeAiProvider): ProviderBreakerState {
  const store = breakers()
  if (!store[provider]) store[provider] = createBreakerState()
  return store[provider]
}

export function resolveFailoverTarget(from: ForgeAiProvider, env: Record<string, string | undefined>): ForgeAiProvider | null {
  const raw = env.FORGE_AI_FAILOVER_ALLOW?.trim()
  if (!raw) return null
  for (const pair of raw.split(",")) {
    const [source, target] = pair.split(":").map((part) => part.trim().toLowerCase())
    if (source !== from) continue
    if (!isForgeAiProvider(target) || target === "mock" || target === from) continue
    return target
  }
  return null
}

export async function providerCanAttempt(
  provider: ForgeAiProvider,
  ctx?: ProviderHealthEventContext,
): Promise<{ allowed: boolean; state: BreakerState; reason: string }> {
  const config = resolveBreakerConfig(process.env)
  const result = evaluateAttempt(getState(provider), Date.now(), config)
  breakers()[provider] = result.next
  await maybeRecordTransition(provider, result.transition, null, "state_change", ctx)
  return { allowed: result.allowed, state: result.next.state, reason: result.reason }
}

export async function recordProviderSuccess(provider: ForgeAiProvider): Promise<void> {
  const result = reduceSuccess(getState(provider), Date.now())
  breakers()[provider] = result.next
  await maybeRecordTransition(provider, result.transition, null, "state_change")
}

export async function recordProviderFailure(
  provider: ForgeAiProvider,
  category: RetryCategory,
  detail: string,
  ctx?: ProviderHealthEventContext,
): Promise<void> {
  const config = resolveBreakerConfig(process.env)
  const result = reduceFailure(getState(provider), category, Date.now(), config)
  breakers()[provider] = result.next
  await maybeRecordTransition(provider, result.transition, category, "state_change", { ...ctx, detail } as ProviderHealthEventContext & { detail?: string })
}

export async function recordProviderFailover(input: {
  from: ForgeAiProvider
  to: ForgeAiProvider
  reason: string
  ctx?: ProviderHealthEventContext
}): Promise<void> {
  await db.insert(forgeProviderHealth).values({
    provider: input.from,
    event: "failover",
    fromState: input.from,
    toState: input.to,
    category: null,
    detail: input.reason,
    model: input.ctx?.model ?? null,
    projectId: input.ctx?.projectId ?? null,
    taskId: input.ctx?.taskId ?? null,
    actor: input.ctx?.actor ?? "system",
  })
}

async function maybeRecordTransition(
  provider: ForgeAiProvider,
  transition: BreakerTransition | null,
  category: RetryCategory | null,
  event: string,
  ctx?: ProviderHealthEventContext & { detail?: string },
): Promise<void> {
  if (!transition) return
  await db.insert(forgeProviderHealth).values({
    provider,
    event,
    fromState: transition.from,
    toState: transition.to,
    category,
    detail: ctx?.detail ?? null,
    model: ctx?.model ?? null,
    projectId: ctx?.projectId ?? null,
    taskId: ctx?.taskId ?? null,
    actor: ctx?.actor ?? "system",
  })
}

export async function loadProviderHealthSnapshot(): Promise<ProviderHealthSnapshot> {
  const now = Date.now()
  const config = resolveBreakerConfig(process.env)
  const providers: ProviderHealthEntry[] = REAL_PROVIDERS.map((provider) => {
    const state = getState(provider)
    const recentFailures = state.failures.filter((ts) => now - ts < config.windowMs).length
    return {
      provider,
      state: state.state,
      recentFailures,
      lastCategory: state.lastCategory,
      opensUntil: state.opensUntil ? new Date(state.opensUntil).toISOString() : null,
      cooldownRemainingMs: state.opensUntil ? Math.max(0, state.opensUntil - now) : 0,
    }
  })

  const rows = await db
    .select({
      id: forgeProviderHealth.id,
      provider: forgeProviderHealth.provider,
      event: forgeProviderHealth.event,
      fromState: forgeProviderHealth.fromState,
      toState: forgeProviderHealth.toState,
      category: forgeProviderHealth.category,
      detail: forgeProviderHealth.detail,
      model: forgeProviderHealth.model,
      createdAt: forgeProviderHealth.createdAt,
    })
    .from(forgeProviderHealth)
    .orderBy(desc(forgeProviderHealth.createdAt))
    .limit(20)

  return {
    providers,
    recentEvents: rows.map((row) => ({ ...row, createdAt: new Date(row.createdAt).toISOString() })),
  }
}
```

Note: the unused `and` import is a guard for future filtering — remove it if lint flags it. Run `npm run lint` and delete the import if `no-unused-vars` fires.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- forge-provider-health`
Expected: PASS (failover-policy cases).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: no errors. If lint flags the unused `and` import, remove it and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/forge-provider-health.ts src/lib/server/forge-provider-health.test.ts
git commit -m "feat(forge): add provider-health breaker singleton, audit, and failover policy"
```

---

### Task 6: Wire retry policy + breaker + failover into `runForgeAiJson`

**Files:**
- Modify: `admin/src/lib/forge-ai.ts` (pure result type: `ForgeAiResult`, ~line 24)
- Modify: `admin/src/lib/server/forge-ai.ts` (imports; provider resolution ~lines 80-95; retry loop ~lines 161-277; schema-mismatch throw ~line 207)
- Test: `admin/src/lib/forge-ai.test.ts` (extend existing file — metadata passthrough for `failover`)

**Interfaces:**
- Consumes: `classifyRetryability`, `nextRetryDecision`, `resolveRetryPolicyConfig` from `@/lib/forge-retry-policy`; `isTripCategory` from `@/lib/forge-circuit-breaker`; `providerCanAttempt`, `recordProviderSuccess`, `recordProviderFailure`, `recordProviderFailover`, `resolveFailoverTarget` from `./forge-provider-health`.
- Produces: `ForgeAiResult.failover?: { from: ForgeAiProvider; to: ForgeAiProvider; reason: string } | null`; `buildForgeTaskOutputMetadata` surfaces it.

- [ ] **Step 1: Add `failover` to the result type (pure)**

In `admin/src/lib/forge-ai.ts`, inside `ForgeAiResult` (after `responseId?` line 33), add:

```ts
  failover?: { from: ForgeAiProvider; to: ForgeAiProvider; reason: string } | null
```

- [ ] **Step 2: Surface `failover` in `buildForgeTaskOutputMetadata` (pure) and write its test**

In `admin/src/lib/forge-ai.ts`, in `buildForgeTaskOutputMetadata`, add `failover` to the returned `ai` object (after `responseId` line 253):

```ts
      failover: result.failover ?? null,
```

Add this test to `admin/src/lib/forge-ai.test.ts` (create the file if it does not exist, importing from `./forge-ai`):

```ts
import { describe, expect, it } from "vitest"
import { buildForgeTaskOutputMetadata, type ForgeAiResult } from "./forge-ai"

describe("buildForgeTaskOutputMetadata failover", () => {
  it("passes failover info through to task metadata", () => {
    const result: ForgeAiResult = {
      provider: "openai",
      model: "gpt-5.5",
      taskType: "planning",
      data: { ok: true },
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      costEstimateUsd: 0,
      latencyMs: 10,
      retries: 0,
      responseId: "x",
      failover: { from: "anthropic", to: "openai", reason: "circuit open (cooling down)" },
    }
    const meta = buildForgeTaskOutputMetadata(result)
    expect((meta.ai as { failover?: unknown }).failover).toEqual({ from: "anthropic", to: "openai", reason: "circuit open (cooling down)" })
  })
})
```

Run: `npm test -- forge-ai.test` → Expected: PASS.

- [ ] **Step 3: Add imports to server `forge-ai.ts`**

At the top of `admin/src/lib/server/forge-ai.ts`, after the existing `getForgeProviderAdapter` import (line 26), add:

```ts
import { classifyRetryability, nextRetryDecision, resolveRetryPolicyConfig } from "@/lib/forge-retry-policy"
import { isTripCategory } from "@/lib/forge-circuit-breaker"
import {
  providerCanAttempt,
  recordProviderFailover,
  recordProviderFailure,
  recordProviderSuccess,
  resolveFailoverTarget,
} from "./forge-provider-health"
```

- [ ] **Step 4: Make provider/adapter/model reassignable and gate on the breaker**

In `runForgeAiJson`, change the three `const` declarations (lines 80-83) so provider, adapter, and model can be reassigned on failover:

```ts
  const configuredProvider = request.provider ?? resolveForgeAiProvider(env)
  let provider = getForgeProviderAdapter(configuredProvider).isConfigured(env) ? configuredProvider : "mock"
  let adapter = getForgeProviderAdapter(provider)
  let model = adapter.model(request.taskType)
  let failover: ForgeAiResult["failover"] = null
```

Immediately AFTER the mock branch returns (after the closing `}` of `if (provider === "mock") { ... }`, line 134) and BEFORE `const budgetConfig` (line 136), insert the breaker gate:

```ts
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
      } else {
        throw new ForgeAiError("All approved AI providers are temporarily unavailable.", false, { code: "circuit_open" })
      }
    } else {
      throw new ForgeAiError(`The ${provider} AI provider is temporarily unavailable (circuit open).`, false, { code: "circuit_open" })
    }
  }
```

Because `provider`/`model` are reassigned before `log`, `setMonitoringContext`, budget checks, and usage recording all read them, no other line in those sections needs to change — they naturally use the active provider.

- [ ] **Step 5: Record breaker success after a provider response**

Inside the `for` loop, immediately after the `const raw = await adapter.generateStructuredJson({...})` call (line 166) add:

```ts
      await recordProviderSuccess(provider)
```

(Getting any parseable HTTP response means the provider is healthy, even if the JSON later fails schema validation.)

- [ ] **Step 6: Tag the schema-mismatch error so it classifies as retryable**

Replace the schema-mismatch throw (line 207):

```ts
        throw new ForgeAiError("AI response did not match the requested schema.", true)
```

with:

```ts
        throw new ForgeAiError("AI response did not match the requested schema.", true, { code: "schema_mismatch" })
```

- [ ] **Step 7: Replace the retry backoff with the policy + breaker failure recording**

At the top of the function, after computing `maxRetries` (line 161), add the resolved config:

```ts
  const retryConfig = resolveRetryPolicyConfig(env, maxRetries)
```

In the `catch (error)` block, replace the tail (lines 269-270):

```ts
      if (!retryable || attempt === maxRetries) break
      await wait(250 * (attempt + 1))
```

with:

```ts
      const classification = classifyRetryability(error)
      if (provider !== "mock" && isTripCategory(classification.category)) {
        await recordProviderFailure(provider, classification.category, normalizedError.safeMessage, healthCtx)
      }
      const decision = nextRetryDecision({ classification, attempt, elapsedMs: Date.now() - startedAt, config: retryConfig })
      if (!decision.retry) break
      await wait(decision.delayMs)
```

The existing `const retryable = ...` line above (line 247) is now only used for the log line; leave it. `normalizedError` is already in scope from line 248.

- [ ] **Step 8: Attach `failover` to both success returns**

In the deterministic-fallback return object (line 193-204) and the normal success return object (line 233-244), add `failover,` alongside the other fields (e.g. after `retries: attempt,`).

- [ ] **Step 9: Run the full test suite + typecheck**

Run: `npm test && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, no type errors. (`forge-ai.test`, retry-policy, breaker, adapters, provider-health all green.)

- [ ] **Step 10: Commit**

```bash
git add src/lib/forge-ai.ts src/lib/forge-ai.test.ts src/lib/server/forge-ai.ts
git commit -m "feat(forge): drive AI retries with backoff policy + circuit breaker + failover"
```

---

### Task 7: Provider-health API route

**Files:**
- Create: `admin/src/app/api/forge/ai/health/route.ts`

**Interfaces:**
- Consumes: `loadProviderHealthSnapshot` from `@/lib/server/forge-provider-health`; `auth` from the repo root `auth`; `withRequestLogContext`, `requestIdFromRequest` from `@/lib/server/request-context`.
- Produces: `GET /api/forge/ai/health` → `{ ok: true, health: ProviderHealthSnapshot }` (401 when unauthenticated).

- [ ] **Step 1: Write the route**

Create `admin/src/app/api/forge/ai/health/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "../../../../../../auth"
import { loadProviderHealthSnapshot } from "@/lib/server/forge-provider-health"
import { requestIdFromRequest, withRequestLogContext } from "@/lib/server/request-context"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const actorId = session.user?.email ?? "admin"
  return withRequestLogContext({ requestId: requestIdFromRequest(request), actorId }, async () => {
    const health = await loadProviderHealthSnapshot()
    return NextResponse.json({ ok: true, health })
  })
}
```

Verify the `auth` import depth matches the sibling route: `admin/src/app/api/forge/ai/test/route.ts` uses `../../../../../../auth` from the same directory depth — confirm the new file sits at the same depth (`api/forge/ai/health/route.ts` = same depth as `api/forge/ai/test/route.ts`), so the path is identical.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/forge/ai/health/route.ts"
git commit -m "feat(forge): add provider-health GET endpoint"
```

---

### Task 8: Admin provider-health panel in the Forge dashboard

**Files:**
- Create: `admin/src/components/forge/ForgeProviderHealthPanel.tsx`
- Modify: `admin/src/lib/server/forge-page-data.ts` (`loadForgeDashboardPageData` — add `providerHealth` to both the build-phase stub and the real return; ~lines 33-85)
- Modify: `admin/src/app/(protected)/forge/page.tsx` (pass `providerHealth` prop)
- Modify: `admin/src/components/forge/ForgeDashboard.tsx` (accept `providerHealth` prop, render the panel)

**Interfaces:**
- Consumes: `ProviderHealthSnapshot` from `@/lib/server/forge-provider-health`.
- Produces: `ForgeProviderHealthPanel({ health }: { health: ProviderHealthSnapshot })` React component.

- [ ] **Step 1: Build the panel component**

Create `admin/src/components/forge/ForgeProviderHealthPanel.tsx`:

```tsx
"use client"

import { ShieldCheck } from "lucide-react"
import type { ProviderHealthSnapshot } from "@/lib/server/forge-provider-health"

const T = { s2: "var(--s2)", b1: "var(--b1)", t1: "var(--t1)", t2: "var(--t2)", t3: "var(--t3)", grn: "var(--grn)", amb: "var(--amb)" }

const STATE_TONE: Record<string, { label: string; color: string }> = {
  closed: { label: "Healthy", color: T.grn },
  "half-open": { label: "Recovering", color: T.amb },
  open: { label: "Unavailable", color: "#f87171" },
}

export function ForgeProviderHealthPanel({ health }: { health: ProviderHealthSnapshot }) {
  return (
    <section style={{ background: T.s2, border: `1px solid ${T.b1}`, borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <ShieldCheck size={18} style={{ color: "#22d3ee" }} />
        <h3 className="font-syne text-lg font-extrabold" style={{ color: T.t1 }}>Provider Health</h3>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {health.providers.map((entry) => {
          const tone = STATE_TONE[entry.state] ?? STATE_TONE.closed
          return (
            <div key={entry.provider} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: T.b1, borderRadius: 12, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: tone.color }} />
                <span className="font-medium capitalize" style={{ color: T.t1 }}>{entry.provider}</span>
              </div>
              <div style={{ textAlign: "right", fontSize: 12, color: T.t3 }}>
                <div style={{ color: tone.color, fontWeight: 700 }}>{tone.label}</div>
                <div>
                  {entry.recentFailures} recent failure{entry.recentFailures === 1 ? "" : "s"}
                  {entry.lastCategory ? ` · ${entry.lastCategory}` : ""}
                  {entry.cooldownRemainingMs > 0 ? ` · retry in ${Math.ceil(entry.cooldownRemainingMs / 1000)}s` : ""}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {health.recentEvents.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="font-syne text-xs font-extrabold uppercase" style={{ color: T.t3, marginBottom: 8 }}>Recent events</div>
          <ul style={{ display: "grid", gap: 6 }}>
            {health.recentEvents.slice(0, 8).map((event) => (
              <li key={event.id} style={{ fontSize: 12, color: T.t2, display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>
                  <span className="capitalize" style={{ color: T.t1 }}>{event.provider}</span>{" "}
                  {event.event === "failover"
                    ? `failover → ${event.toState}`
                    : `${event.fromState ?? "?"} → ${event.toState ?? "?"}`}
                  {event.category ? ` (${event.category})` : ""}
                </span>
                <span style={{ color: T.t3, whiteSpace: "nowrap" }}>{new Date(event.createdAt).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Load provider health in the dashboard page data**

In `admin/src/lib/server/forge-page-data.ts`:

Add the import near the other `@/lib/server` imports at the top of the file:

```ts
import { loadProviderHealthSnapshot } from "./forge-provider-health"
```

In the build-phase stub `return {` object (lines 35-49), add before `averageDesignScore: null,`:

```ts
      providerHealth: { providers: [], recentEvents: [] },
```

In the real path, add `loadProviderHealthSnapshot()` to the `Promise.all` and destructure it. Change:

```ts
  const [projects, recentActivity, aiMetrics, averageDesignScore] = await Promise.all([
    // ...existing four entries...
    loadForgeAiDashboardMetrics(),
    loadAverageDesignScore(),
  ])

  return { projects, recentActivity, aiMetrics, averageDesignScore }
```

to:

```ts
  const [projects, recentActivity, aiMetrics, averageDesignScore, providerHealth] = await Promise.all([
    // ...existing four entries unchanged...
    loadForgeAiDashboardMetrics(),
    loadAverageDesignScore(),
    loadProviderHealthSnapshot(),
  ])

  return { projects, recentActivity, aiMetrics, averageDesignScore, providerHealth }
```

- [ ] **Step 3: Pass the prop from the page**

In `admin/src/app/(protected)/forge/page.tsx`, update destructuring and props:

```tsx
export default async function ForgePage() {
  const { projects, recentActivity, aiMetrics, averageDesignScore, providerHealth } = await loadForgeDashboardPageData()

  return <ForgeDashboard projects={projects} recentActivity={recentActivity} aiMetrics={aiMetrics} averageDesignScore={averageDesignScore} providerHealth={providerHealth} />
}
```

- [ ] **Step 4: Accept and render the panel in `ForgeDashboard`**

In `admin/src/components/forge/ForgeDashboard.tsx`:

Add the imports near the top (with the other component/type imports):

```tsx
import { ForgeProviderHealthPanel } from "./ForgeProviderHealthPanel"
import type { ProviderHealthSnapshot } from "@/lib/server/forge-provider-health"
```

Add `providerHealth` to the props destructuring (line 105-109) and the props type (line 110-115):

```tsx
export function ForgeDashboard({
  projects,
  recentActivity,
  aiMetrics,
  averageDesignScore,
  providerHealth,
}: {
  projects: ForgeProjectSummary[]
  recentActivity: ForgeActivitySummary[]
  aiMetrics: ForgeAiDashboardMetrics
  averageDesignScore: number | null
  providerHealth: ProviderHealthSnapshot
}) {
```

Render the panel next to the AI-spend cards. Immediately after the AI-spend cards block (locate the closing tag of the container that holds `<AiSpendCard ... />` around lines 272-292), insert:

```tsx
        <div style={{ marginTop: 24 }}>
          <ForgeProviderHealthPanel health={providerHealth} />
        </div>
```

(If a client-import-of-a-server-module type error appears because `ForgeProviderHealthPanel` imports the `ProviderHealthSnapshot` type from a `server-only` module, change both imports of the type to `import type` — type-only imports are erased at compile time and do not pull the `server-only` runtime guard into the client bundle. The plan already uses `import type` for the snapshot type in both components.)

- [ ] **Step 5: Typecheck, lint, and build**

Run: `npx tsc --noEmit -p tsconfig.json && npm run lint`
Expected: no errors.

- [ ] **Step 6: Manual verification**

Run: `npm run build` (Expected: build succeeds). Then start the app (`npm run dev`), sign in, open `/forge`, and confirm the "Provider Health" panel renders with both providers marked "Healthy". Hit `GET /api/forge/ai/health` in the browser and confirm JSON `{ ok: true, health: { providers: [...], recentEvents: [] } }`.

- [ ] **Step 7: Commit**

```bash
git add src/components/forge/ForgeProviderHealthPanel.tsx src/components/forge/ForgeDashboard.tsx src/lib/server/forge-page-data.ts "src/app/(protected)/forge/page.tsx"
git commit -m "feat(forge): surface provider health panel on the Forge dashboard"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Exponential backoff | Task 2 (`computeBackoffMs`) |
| Random jitter | Task 2 (full jitter) |
| Retry-After support | Task 2 (`computeBackoffMs` retryAfterMs) + Task 4 (429 parsing) |
| Provider-specific error classification | Task 4 (`httpError`) + Task 2 (`classifyRetryability`) |
| Maximum elapsed retry time | Task 2 (`nextRetryDecision` elapsed guard) |
| Retryable vs permanent distinction | Task 2 (`PERMANENT` set) |
| Do-not-retry: credentials/schema/models/safety/budget/format | Task 4 categories + Task 2 permanent mapping + Task 6 schema-mismatch tagging |
| Circuit breaker closed/open/half-open | Task 3 |
| Track recent failures | Task 3 (windowed `failures[]`) |
| Avoid hammering unhealthy provider | Task 6 (breaker gate before loop) |
| Clear operational status | Task 7 (API) + Task 8 (panel) |
| Route to approved alternate where policy permits | Task 5 (`resolveFailoverTarget`) + Task 6 (failover wiring) |
| Never silently change provider without recording | Task 5 (`recordProviderFailover`) + Task 6 (`failover` metadata) |
| Admin visibility | Task 7 + Task 8 |

**Placeholder scan:** No TBD/TODO; every code step contains full code. (Task 2 Step 4 intentionally cleans up a redundant guard introduced in Step 3.)

**Type consistency:** `RetryCategory` defined in Task 2 is imported by Tasks 3, 5, 6. `ProviderBreakerState`/`BreakerState`/`BreakerTransition` defined in Task 3, consumed by Task 5. `ProviderHealthSnapshot` defined in Task 5, consumed by Tasks 7, 8. `failover` shape `{ from, to, reason }` is identical in Task 1 (result type), Task 5 (`recordProviderFailover`), and Task 6 (assignment). Function names match across tasks (`providerCanAttempt`, `recordProviderSuccess`, `recordProviderFailure`, `recordProviderFailover`, `resolveFailoverTarget`, `loadProviderHealthSnapshot`).

## Notes for the implementer

- Do not add real network calls to tests. The provider-adapter test constructs `Response` objects directly.
- The breaker singleton persists for the life of the Node process; in dev, a server restart resets it (expected, matching the budget ledger).
- `.env.example` is out of scope for tests but consider documenting the new `FORGE_AI_RETRY_*`, `FORGE_AI_BREAKER_*`, and `FORGE_AI_FAILOVER_ALLOW` vars there in the final task's commit if the repo documents env vars (check existing entries first).
