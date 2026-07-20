# Admin durable operational controls (restart- and replica-safe)

Date: 2026-07-19
Status: Approved for implementation (durability-core-first scope)

## Problem (audit, task 1)

Process-local state that does not survive restart or multiple replicas:

- **Forge jobs** (`admin/src/lib/server/forge-job-runner.ts`): `forge_jobs` exists with
  an atomic `UPDATE…WHERE status='queued'` claim, but background execution is
  fire-and-forget in the persistent process. No lease owner/expiry, heartbeat,
  retry policy, idempotency key, scheduled-at, dead-letter, or task FK. `running`
  jobs are orphaned on restart (`runDueForgeJobs` only drains `queued`); no
  `FOR UPDATE SKIP LOCKED`, so it is not multi-worker safe.
- **Rate limits** (`admin/src/middleware.ts` + `forge-security.ts`):
  `new Map()` per process; resets on restart, inconsistent across replicas.
- **Preview** (`admin/src/lib/server/forge-preview.ts`): a `globalThis` Map of
  child-process/container handles; state in a `forge_memories` JSON blob with no
  owner/lease. Restart orphans real containers.

## Scope (this pass)

Durability core with tests: durable leased jobs, expired-lease recovery,
DB-backed rate limits, preview ownership/reconciliation, PostgreSQL concurrency
tests, and a worker runbook. Operational dashboards UI and a formal retention
policy are a documented follow-up (a minimal cleanup hook is included so tables
do not grow unbounded).

## Design

### Schema (migration 0045)

Extend `forge_jobs`:
`lease_owner text`, `lease_expires_at timestamptz`, `heartbeat_at timestamptz`,
`max_attempts int not null default 3`, `idempotency_key text`
(unique partial index where not null), `scheduled_at timestamptz not null default now()`,
`failure_reason text`, `task_id int references forge_tasks(id) on delete set null`.
Status gains `dead_letter` (text column, no enum). Indexes: `(status, scheduled_at)`
for claiming, `lease_expires_at` for reaping.

New `rate_limit_counters`: `key text`, `window_start timestamptz`, `count int not null default 0`,
`expires_at timestamptz not null`, PK `(key, window_start)`, index on `expires_at`.

New `forge_previews`: `project_id int PK → forge_projects (cascade)`, `status text`,
`owner text`, `lease_expires_at timestamptz`, `heartbeat_at timestamptz`, `method`,
`url`, `host`, `port int`, `pid int`, `container_id text`, `started_at`, `stopped_at`,
`error text`, `updated_at`. Index on `lease_expires_at`.

### Durable leased job runner (tasks 2–4)

- **Claim** with `... WHERE id IN (SELECT id FROM forge_jobs WHERE status='queued'
  AND scheduled_at <= now() ORDER BY scheduled_at, created_at FOR UPDATE SKIP
  LOCKED LIMIT 1)` setting `status='running', lease_owner, lease_expires_at,
  heartbeat_at, started_at`. SKIP LOCKED + the status guard mean two workers can
  never claim the same job (task 3).
- **Heartbeat**: while a handler runs, a timer extends `lease_expires_at` +
  `heartbeat_at` so long jobs are not reaped.
- **Complete/fail**: on error, if `attempts+1 < max_attempts` requeue with
  exponential backoff (`scheduled_at = now + backoff`, clear lease); else
  `status='dead_letter'` with `failure_reason` (task retry policy + dead-letter).
- **Idempotency**: an `idempotency_key` collision returns the existing job instead
  of inserting a duplicate.
- **Reaper** (task 4): finds `status='running' AND lease_expires_at < now()` and
  requeues (or dead-letters past `max_attempts`), so worker termination/expired
  leases recover safely.
- **Cancel**: `cancelForgeJob` sets `status='cancelled'` when queued/running.

### Worker (task 7)

`instrumentation.ts` `register()` starts an in-process loop (unique `owner` per
instance) that claims due jobs, heartbeats, and reaps expired leases, with a
graceful shutdown on SIGTERM/SIGINT that stops claiming and releases its lease.
The existing `/api/forge/jobs/run` cron stays as an external backstop. Single
instance keeps working unchanged; N replicas are safe via SKIP LOCKED + leases.

### Durable rate limits (task 5)

`rate_limit_counters` fixed-window counter incremented atomically:
`INSERT … ON CONFLICT (key, window_start) DO UPDATE SET count = count + 1
RETURNING count`. Enforced in middleware (already `runtime: nodejs`), **fail-open**
on DB error so a database blip cannot lock admins out. Consistent across
instances (acceptance criterion 3).

### Preview ownership (task 6)

`forge_previews` is the source of truth for ownership + lifecycle. Start/stop set
`owner`, `lease_expires_at`, `container_id`/`pid`. On startup and periodically the
worker reconciles: previews owned by this instance whose process is gone → mark
stopped; previews with expired leases from dead instances → mark abandoned and
best-effort stop the recorded container. The `globalThis` handle Map remains a
per-instance cache of live handles on the owning instance only.

## Tests (task 8)

`admin/test/integration/*.integration.test.ts` (real PostgreSQL via
`vitest.integration.config.ts`): concurrent claims of one queued job yield exactly
one winner; expired-lease reaper requeues; idempotency-key insert dedupes;
concurrent rate-limit increments are exact (no lost updates).

## Acceptance criteria

- Restarting admin does not lose queued work (jobs persisted; reaper recovers
  `running` orphans).
- Concurrent workers cannot duplicate execution (SKIP LOCKED + status guard +
  lease).
- Rate limits consistent across instances (shared DB counter).
- Existing Forge workflows remain compatible (enqueue/inline API and endpoints
  unchanged).
