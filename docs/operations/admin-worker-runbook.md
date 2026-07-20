# Admin durable worker runbook

The admin app runs a durable, PostgreSQL-backed worker so queued Forge work
survives restarts and multiple replicas coordinate safely. This replaces the
former process-local job execution, rate-limit `Map`, and preview handle map.

## What is durable now

| Concern | Where | Guarantee |
|---|---|---|
| Forge jobs | `forge_jobs` + `src/lib/server/forge-job-queue.ts` | Lease-based claim with `FOR UPDATE SKIP LOCKED`; retry with backoff; dead-letter; idempotency key; scheduled-at |
| Job execution | `src/lib/server/forge-job-runner.ts` | Heartbeat keeps the lease alive; complete/fail is durable |
| Recovery | reaper in `forge-job-queue.ts` | Expired leases are requeued (or dead-lettered) |
| Rate limits | `rate_limit_counters` + `src/lib/server/rate-limit-store.ts` | Atomic `INSERT … ON CONFLICT DO UPDATE`, shared across replicas |
| Previews | `forge_previews` + `src/lib/server/forge-preview.ts` | Ownership + lease; abandoned previews reconciled |

## Startup

The worker starts from Next.js instrumentation (`src/instrumentation.ts` →
`register()` → `startForgeWorker()`) on the Node.js server runtime only. Each
process gets a unique `owner` id. On boot it runs a recovery tick within ~1s
(reap expired leases, then drain due jobs), so a restart immediately resumes
in-flight work.

The worker is a no-op during `next build` (`NEXT_PHASE=phase-production-build`),
under test (`VITEST`/`NODE_ENV=test`), or when `FORGE_WORKER_DISABLED=true`.

### Tunables (env)

- `FORGE_WORKER_TICK_MS` (default 5000) — loop interval.
- `FORGE_WORKER_BATCH` (default 3) — jobs claimed per tick.
- `FORGE_WORKER_DISABLED=true` — do not start the in-process worker (rely on the
  cron backstop instead).
- `FORGE_JOB_RETENTION_DAYS` (default 14) — completed/cancelled job pruning window.

## Shutdown

On `SIGTERM`/`SIGINT` the worker stops claiming new jobs. In-flight jobs are
allowed to finish. If the process is killed mid-job, that job's lease expires and
the reaper on another tick (or another replica) requeues it — no work is lost and
nothing runs twice. There is no forced lease release on shutdown, precisely
because releasing a still-running job's lease could let another worker double-run
it.

## Recovery

Two mechanisms recover abandoned work:

1. **In-process reaper** — every tick, `reapExpiredForgeJobLeases()` finds
   `running` jobs whose `lease_expires_at < now()` and requeues them (or
   dead-letters those out of attempts).
2. **Cron backstop** — `POST /api/forge/jobs/run` reaps expired leases and then
   drains due jobs. Drive it from an external scheduler (e.g. a systemd timer) as
   defence in depth, especially if `FORGE_WORKER_DISABLED=true`.

Manually inspect the queue:

```sql
SELECT status, count(*) FROM forge_jobs GROUP BY status;                 -- queue depth by state
SELECT id, kind, attempts, max_attempts, scheduled_at FROM forge_jobs
  WHERE status='queued' ORDER BY scheduled_at LIMIT 20;                  -- oldest queued
SELECT id, kind, lease_owner, lease_expires_at FROM forge_jobs
  WHERE status='running';                                               -- active leases
SELECT id, kind, failure_reason FROM forge_jobs WHERE status='dead_letter'; -- dead letters
```

Re-drive a dead-lettered job by resetting it (after fixing the cause):

```sql
UPDATE forge_jobs SET status='queued', attempts=0, scheduled_at=now(),
  failure_reason=NULL, lease_owner=NULL, lease_expires_at=NULL WHERE id=$1;
```

## Scaling to multiple replicas

The single-instance path is unchanged: one worker, one owner. To scale out, run
more admin instances — no configuration change is required:

- Job claiming uses `FOR UPDATE SKIP LOCKED`, so two workers can never claim the
  same job. Concurrency is bounded per instance by `FORGE_WORKER_BATCH`.
- Rate limits are a shared DB counter, so limits are enforced consistently across
  all instances.
- Previews are owned by one instance via `forge_previews.owner` + a lease; other
  instances only reconcile a preview once its lease has expired (owning instance
  gone), and will best-effort stop the recorded container to avoid orphans.

Because previews launch local processes/containers, a preview is only usable on
the instance that owns it. Route preview traffic to the owning instance, or treat
previews as best-effort in a multi-replica deployment.

## Rate-limit failure behaviour

The middleware rate-limit check **fails open**: if the durable counter query
errors (DB blip), the request is allowed and a warning is logged
(`errorCategory: rate_limit_unavailable`). This trades a brief loss of limiting
for never locking admins out of Forge during a database hiccup.

## Retention / cleanup

The worker periodically prunes expired `rate_limit_counters` and old
completed/cancelled `forge_jobs` (`FORGE_JOB_RETENTION_DAYS`). Failed and
dead-lettered jobs are retained for investigation.

## Documented follow-up (not in this change)

- **Operational dashboards UI**: surface queue depth, oldest queued job, active
  leases, retries, dead letters, and abandoned previews in the admin dashboard.
  The SQL above is the data source; the metrics are already queryable.
- **Full retention policy**: per-state windows (e.g. dead-letter archival) and a
  configurable schedule beyond the current worker-driven cleanup.
