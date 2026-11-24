# Operation ASCEND B2.8: execution engine, worker and founder command centre

**Status:** implemented and verified on disposable infrastructure; **not deployed**. Every switch defaults off, and when switched
on the engine starts under a global emergency stop with every automation disabled. Nothing here sends messages, moves money,
changes commission, publishes agreements, activates partners, deletes applicant data or changes founder permissions.

## 0. Scope reconciliation

The authoritative [B2 roadmap](B2-ROADMAP.md) ended at B2.7 ("Automation and full acceptance"); **no B2.8 was defined**. The
only prior "B2.8" label was the payload-validation commit recovered from the VPS ([#177](https://github.com/TheFridey/ScaleSmiths/pull/177)).
This document defines B2.8 from the founders' Operation ASCEND B2.8 mission (24 November 2026), and builds on B2.7's durable
review queue rather than replacing it. B2.7's open item "unattended scheduling, authenticated worker … not implemented" is what
B2.8 delivers; the B2.7 manual founder inbox is unchanged and is reused as the `review.queue_preparation` action.

Baseline consolidated on this branch: #176 (launch redirect), #177 (VPS-only commits `b7282d7`, `d0e153f`, `4814408`,
`2460de1`: review payload validation before persistence and preparation, strict database-test typing, Megaton preflight) and
#174 (B2.7 enabled-inbox browser acceptance). #176 and #177 contained the same typing fix; #177's version was kept.

## 1. Architecture

```
founder browser ──► /api/expansion/automation/engine ──┐   (session + expansion.manage, re-read from DB each command)
TITAN OS / Jarvis ► /api/ascend/v1/*  (agent token) ───┤
ASCEND worker ────► /api/ascend/worker (worker token) ─┼─► ascend-engine.ts ──► PostgreSQL (migration 0104)
  (ops/ascend/ascend-worker.mjs under PM2)             │      │ state machine, leases, policy, audit
                                                        │      └─► ascend-engine-actions.ts (registered handlers only)
```

- **Execution happens inside the admin app**, during the worker's request, exactly like the existing Megaton worker pattern.
  The worker process only paces requests, reports load and shuts down cleanly. No Redis or new infrastructure.
- **PostgreSQL provides every guarantee**: `FOR UPDATE SKIP LOCKED` claims, a transaction-scoped advisory lock that makes
  global and per-action concurrency caps exact, lease tokens with compare-and-set completion, and triggers that enforce
  the state machine and immutability independently of application code.

Files: `admin/drizzle/0104_ascend_execution_engine.sql`, `admin/src/lib/ascend-engine.ts` (pure rules, shared with the UI),
`admin/src/lib/server/ascend-engine.ts`, `admin/src/lib/server/ascend-engine-actions.ts`, `admin/src/lib/server/ascend-http.ts`,
routes under `admin/src/app/api/ascend/` and `admin/src/app/api/expansion/automation/engine/`, the page
`/expansion/automation/engine` (`admin/src/components/ascend/EngineCommandCentre.tsx`, `engine.css`), and
`ops/ascend/ascend-worker.mjs`.

## 2. Execution lifecycle

Every execution has: execution id, correlation id, idempotency key (unique), originating request (`founder`, `schedule`,
`signal`, `agent` + `origin_ref`), action type, authorised scope (markets), versioned payload with SHA-256 digest, recorded
policy decision, policy version, deadline, bounded attempts, append-only event history and a terminal outcome.

| From | Allowed to |
|---|---|
| created | pending_approval, queued, scheduled, cancelled, expired, superseded |
| pending_approval | approved, cancelled, expired, superseded |
| approved | queued, scheduled, cancelled, expired, superseded |
| scheduled | queued, cancelled, expired, superseded |
| queued | leased, cancelled, expired, superseded |
| retry_scheduled | leased, queued, cancelled, expired, dead_lettered, superseded |
| leased | running, queued (stopped before start), retry_scheduled, failed, dead_lettered, cancelled, expired |
| running | completed, retry_scheduled, queued, failed, dead_lettered, ambiguous, cancelled, expired |
| ambiguous | completed, failed (founder reconciliation only) |
| failed, dead_lettered | pending_approval or queued (founder retry under current policy) |
| completed, cancelled, expired, superseded | terminal |

The table is enforced by the `ascend_execution_guard` trigger; a unit test asserts the TypeScript table is identical to it.
Identity, payload, scope, origin and requester columns are immutable after insert. `superseded` is reserved in the model; no
code path creates supersession yet (see limitations).

## 3. Worker contract

`POST /api/ascend/worker` with `Authorization: Bearer asc_…` (a worker-kind identity holding `worker.execute`) and
`{ workerId, version, maxConcurrency, inFlight, status }`. One tick: heartbeat → optional scheduling → reap expired leases →
expire overdue work → claim at most one due execution → **revalidate** → run the handler with a timeout → record the outcome.
`{ op: "renew", id, token }` extends a held lease unless cancellation or a stop is pending.

Revalidation immediately before execution, inside the row lock, refuses to start when: a global or action stop is active
(work returns to the queue without consuming an attempt), cancellation was requested, the deadline passed, the definition is
disabled or expired, the policy version changed, a market is no longer authorised, the approval expired or no longer matches
its digest, the approving founder is inactive or lost `expansion.manage`, the requesting agent identity is revoked, or the
stored payload no longer matches the registered schema.

Delivery is **at-least-once**. Every registered handler is idempotent (read-only aggregates or B2.7 review preparation, which
is itself lease-protected). A lost lease on an idempotent action is retried; on a non-idempotent action (none exist yet) it
becomes `ambiguous` for founder reconciliation. Exactly-once is not claimed.

Worker process: `ASCEND_WORKER_URL` (loopback HTTP or HTTPS, path `/api/ascend/worker`), `ASCEND_WORKER_TOKEN`,
`ASCEND_WORKER_ID`, `ASCEND_WORKER_CONCURRENCY` (1-8 lanes), `ASCEND_WORKER_IDLE_MS`. Jittered idle and error backoff;
stops (does not retry) on 401/403/404; `SIGTERM` drains and reports `stopped`; `--once` for smoke tests. Never logs the token.

## 4. Registered actions and scheduling

| Action | What it reads | Effect |
|---|---|---|
| `ops.queue_health` | ASCEND executions, review jobs, worker heartbeats | Aggregate health summary with findings |
| `pipeline.inactivity_scan` | `expansion_opportunities.status, updated_at` | Counts of open opportunities idle beyond the threshold, by stage |
| `onboarding.progress_check` | `expansion_partners` invitation/activation timestamps | Counts of expired and slow invitations |
| `delivery.handoff_readiness` | accepted opportunities without a handoff | Count awaiting founder handoff |
| `review.queue_preparation` | B2.7 review queue | Validates and prepares due review tasks (internal only) |

No handler reads names, email, phone or notes. Each finding states its source, reasoning and a link to the founder screen.
Per-definition controls: enabled, interval (≥ 5 min), cooldown, max concurrency (1-8), max attempts (1-10), timeout
(1-50 s), approval required and approval lifetime, market scope, expiry, policy version, action-level suspension. Any change
other than enable/disable increments the policy version, which invalidates outstanding approvals. Scheduling uses an
idempotency key per interval bucket, so every worker can run the scheduler safely; it is off unless
`ASCEND_SCHEDULER_ENABLED=true`. Payloads are validated against the registry; unknown fields are refused, never ignored.

**Prohibited** (refused by the registry, by a database `CHECK` on action names, and by a foreign key from executions):
payouts, withdrawals, commission, ledgers, payments, refunds, invoices, clawback, agreements, publishing, activation,
permissions, roles, grants, retention, purge, delete, erase, email, mail, send, notify, dispatch, SMS, social, contact.

## 5. Approval model

An approval binds the execution id, action, payload digest, scope and policy version (SHA-256 of a canonical serialisation).
The founder approves the digest shown in the dialog; a different digest or policy version is refused. Approvals expire
(`approval_ttl_seconds`). Agents have no approval capability, and the database forbids granting one. A founder retry of a
failed or dead-letter execution re-enters current policy: if approval is required it returns to the approval queue.

## 6. Failure classification and recovery

Classes: `transient`, `database_unavailable`, `rate_limited`, `provider_failure`, `deadline_exceeded` (retried with bounded
exponential backoff and full jitter, 15 s to 1 h), and `invalid_payload`, `authentication`, `permission`, `approval_expired`,
`policy_rejection`, `duplicate`, `ambiguous`, `business_rule`, `cancelled` (permanent: `failed`, never retried automatically).
Retry exhaustion produces `dead_lettered`. Diagnostics are sanitised (tokens, connection strings, email addresses and long
secrets redacted; 480-character cap) and raw driver messages are never stored.

Founder recovery: cancel (running work is asked to stop and, if it finishes first, is reported `completed`, never falsely
cancelled), retry under current policy (not for invalid payloads), reconcile ambiguous outcomes as completed or failed with a
recorded note.

## 7. Emergency controls

Global and per-action suspension rows in `ascend_automation_controls`, server-side only, versioned (a stale browser cannot
overwrite a newer decision) and audited in the append-only `ascend_control_events`. While stopped: no claim succeeds, a
leased-but-not-started execution returns to the queue without losing an attempt, lease renewal is refused, running work
finishes and is recorded truthfully, queued work remains intact, and the founder views stay available. The global stop is
**on** after migration; resuming requires a founder and a recorded reason.

## 8. Security model

- Founders: session + `expansion.manage`, re-read from `admin_users` (active, role, session version) on every command.
- Service identities: `asc_` + 43 base64url characters, stored only as SHA-256, compared in constant time, shown once at
  creation or rotation. Worker identities may hold only `worker.execute`; agent identities only `operations.submit/read/cancel`
  (enforced by a `CHECK`). Revocation is immediate and stops the identity's workers. A worker id cannot be taken over by
  another identity.
- Routes: registered in `authorization-policy.ts` (`ascend.engine.*`, `ascend.agent.*`); the machine routes are excluded from
  interactive authentication in `middleware.ts` because they authenticate tokens themselves (as Megaton and Jarvis do).
- Database privilege: the admin runtime has SELECT/INSERT/UPDATE (no DELETE/TRUNCATE) on the new tables; the public web role
  has no access at all (verified with `information_schema.role_table_grants`). Event tables reject UPDATE and DELETE.
- Rate limits: founder commands 60/min, worker ticks 240/min per identity, agent submissions 30/min per identity.
- Partner isolation: no partner-facing surface; handlers return aggregates only; an agent cannot see or cancel another
  identity's operations (indistinguishable from not found).
- Resilience fix found during B2.8: the admin `pg` pool had no `error` listener, so a database restart or a terminated
  connection during a transaction raised an uncaught exception and **terminated the whole admin process**.
  `admin/src/lib/db-pool-safety.ts` now handles idle and checked-out client errors (code-only logging). This may explain part
  of the historical PM2 restart counts; confirm against production logs.

## 9. Database migration 0104

Additive and forward-only: seven `ascend_*` tables, one trigger function, three triggers, indexes, one control row (global
stop on) and five definition rows (disabled). Registered in the Drizzle journal, `scripts/shared-migration-plan.json` (admin
95-104) and `scripts/migration-checksums.json`. Applied by the shared migrator on PostgreSQL 16.15 together with all 130
migrations; the privilege verifier passes. **Rehearsed on PostgreSQL 14.25** in the required Database and Migrations CI job
(migration plus disabled-by-default checks; added by the repository owner), matching production's PostgreSQL 14.24. Rollback: revert the code; leaving the tables in place is safe because nothing else reads them.

## 10. Configuration

Admin: `ASCEND_ENGINE_ENABLED`, `ASCEND_SCHEDULER_ENABLED`, `ASCEND_AGENT_API_ENABLED` (all default `false`),
`ASCEND_MAX_GLOBAL_CONCURRENCY` (default 4). Worker process: `ASCEND_WORKER_*` (see section 3). See `.env.example`.

## 11. Deployment and rollback (production, when authorised)

Use the existing PM2 release procedure in [pm2-host-deploy.md](../../operations/pm2-host-deploy.md). In addition:

1. Take and verify a fresh backup before migrating (the 24 November pre-launch dump predates 0104). The owner verified on
   24 November: PostgreSQL 14.24, PM2 web/admin on 3300/3301, release `07521b1`, 0104 not applied. Re-check before deploying.
2. Deploy the release **without** changing the live web environment (recruitment variables must be preserved). Run migrations.
   Confirm `select scope, suspended from ascend_automation_controls` shows `global | t` and all definitions disabled.
3. Optionally set `ASCEND_ENGINE_ENABLED=true` on the admin app only, restart, and review `/expansion/automation/engine`.
   Leave the scheduler and agent interface off.
4. Only with founder authorisation: create a worker identity in the command centre, put its token in the worker's own
   environment, and start `node ops/ascend/ascend-worker.mjs --once` first, then under PM2
   (`pm2 start ops/ascend/ascend-worker.mjs --name scalesmiths-ascend-worker`). Enable one read-only automation with approval
   required, resume, approve one run, and confirm the timeline.
5. Rollback: emergency stop in the UI (or `update ascend_automation_controls set suspended = true … where scope = 'global'`),
   stop the worker, set `ASCEND_ENGINE_ENABLED=false`, then redeploy the previous release if needed. Tables can stay.

## 12. Megaton worker (stopped in production)

Re-verified from code: one call to `/api/megaton/worker` can, behind different switches, deliver **review notifications**
(`MEGATON_NOTIFICATIONS_ENABLED`, independent of every send switch), dispatch social posts, dispatch approved outbox email
(`MEGATON_WORKER_SEND_ENABLED`), **delete messages** for retention (`MEGATON_MESSAGE_RETENTION_DAYS > 0`), enqueue mailbox sync
and process queued jobs. `ops/ascend/worker-preflight.mjs` now prints this effect matrix, blocks on any external or destructive
effect not listed in `MEGATON_PREFLIGHT_AUTHORISED_EFFECTS`, and still checks the target port (`… /path/.env 3301`), token
digest and identity. The Megaton worker authenticates as a bound admin user and session version; the ASCEND worker uses its own
scoped identity, so Megaton deficiencies do not block ASCEND. The production Megaton worker **must stay stopped** until the
preflight passes on the server and the session binding is re-issued; neither could be done from this session (no VPS access).

## 13. TITAN OS / Jarvis integration contract (`ascend.operations/v1`)

Off unless `ASCEND_AGENT_API_ENABLED=true`. Agent identity required; every rule above applies.

| Call | Purpose |
|---|---|
| `GET /api/ascend/v1/capabilities` | Contract version, identity, the actions it may request (schema, defaults, effects, approval, markets, policy version) |
| `POST /api/ascend/v1/operations` + `Idempotency-Key` header, body `{ contract, actionType, payload?, scope?, correlationId? }` | Submit; 202 new, 200 replay, 409 key reused for different work |
| `GET /api/ascend/v1/operations/{id}` | Status, attempts, failure class, sanitised error and (when completed) the structured result |
| `POST /api/ascend/v1/operations/{id}/cancel` | Cancel own unfinished operation |

Example (isolated environment only):

```bash
curl -s -X POST http://127.0.0.1:3301/api/ascend/v1/operations \
  -H "Authorization: Bearer $ASCEND_AGENT_TOKEN" -H "Idempotency-Key: titan-health-2026-11-24" \
  -H "Content-Type: application/json" \
  -d '{"contract":"ascend.operations/v1","actionType":"ops.queue_health","payload":{"staleWorkerMinutes":10}}'
```

Agents cannot approve, change controls, administer identities, see other identities' operations or request any prohibited
action. Scenario I in the integration suite exercises discovery, submission, replay, refusal, approval enforcement,
cancellation, status, rotation and revocation.

## 14. Verification evidence (24 November 2026, disposable PostgreSQL 16.15, 4 vCPU container)

| Check | Result |
|---|---|
| `test/integration/ascend-engine.integration.test.ts` (scenarios A-G, I, J, scheduler race, financial invariance) as the restricted admin role | 13/13, re-runnable; added to the CI step that fails on skipped tests |
| CI restricted-role PostgreSQL step (Expansion, Empower, onboarding and ASCEND suites together) | 157/157, 0 skipped |
| `test/e2e/ascend-engine-command-centre.spec.ts` on a production build (RBAC, approval, real worker endpoint, stop, identities, keyboard dialog, axe, 6 widths, long errors, 150 rows, reduced motion, financial invariance) | 1/1 passed; added to the Empower browser job |
| `src/lib/ascend-engine.test.ts` (state-machine and prohibited-pattern parity with the migration, validation, classification, redaction, backoff, digest binding) | 9/9 |
| `ops/ascend/*.test.mjs` (worker driver, Megaton effect preflight) | 10/10 |
| Authorisation policy gate | 79/79 |
| Admin unit suite | 1412 passed, 4 skipped; 1 environmental failure (IPv6 loopback unavailable in the container; passes in CI) |
| Migration history, journals, order, consistency | pass (full, unshallowed history) |

Concurrency (scenario D): 40 executions across 8 racing workers, each started and completed exactly once; global cap 4 and
per-action cap 1 hold exactly under 8 simultaneous claims. Recovery (B, B2): a killed worker's lease is reaped and the work
completes once; a database backend terminated mid-transaction leaves no partial state and the process survives.

### Performance (`npm run bench:ascend`, evidence in [evidence/b2-8-benchmark.json](evidence/b2-8-benchmark.json))

| Partners | Stored executions | Throughput (8 workers) | Claim p95 | Tick p95 | Overview p50 | Explorer p50 | Tables |
|---|---|---|---|---|---|---|---|
| 10 | 90 | 90/s | 13.5 ms | 112 ms | 2.6 ms | 1.2 ms | 0.5 MB |
| 100 | 640 | 147/s | 9.5 ms | 66 ms | 3.3 ms | 0.8 ms | 1.4 MB |
| 1,000 | 5,540 | 174/s | 6.7 ms | 57 ms | 13 ms | 0.9 ms | 8.8 MB |
| 10,000 | 50,940 | 120/s | 6.9 ms | 84 ms | 110 ms | 1.4 ms | 73 MB |

Zero duplicate completions at every scale. The benchmark led to three indexes in 0104 (explorer 25.8 → 1.4 ms and overview
205 → 110 ms at 10,000 partners). Remaining growth: the overview's whole-table status count and `ops.queue_health`'s group-by
scale linearly with history. Past roughly 250,000 stored executions, add a status summary table or an archival policy for
completed executions (a founder retention decision). These are single-host synthetic figures, not a production capacity claim.

## 15. Known limitations

- Not deployed. This session had no VPS access; production facts above were verified by the repository owner.
- GitHub CI on head `9e7a99e`: all 22 checks green (restricted-role PostgreSQL step 157/157, Empower browser 11/11, PostgreSQL 14.25 rehearsal).
- `superseded` is modelled but never produced; signal-originated executions (`origin = 'signal'`) are modelled but no producer
  exists yet; partner-facing recommendations are not built (all findings are founder-only aggregates).
- Execution history has no retention policy; events grow about three rows per execution.
- The engine is not wired into the B2.3 founder command centre navigation beyond the B2.7 signals page link.

## 16. Founder decisions required

1. Authorise enabling `ASCEND_ENGINE_ENABLED` in production (command centre only; stop stays on).
2. Authorise a worker identity and the worker process, and which automations may run without per-run approval.
3. Authorise the scheduler, and intervals per automation.
4. Authorise any agent identity for TITAN OS / Jarvis, and its allowed actions.
5. Retention period for ASCEND execution history and events.
6. Megaton: re-issue the worker session binding, and decide each effect in the preflight matrix (notifications, retention
   deletion, mailbox sync) before the Megaton worker is restarted.
