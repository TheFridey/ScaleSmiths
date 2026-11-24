# ASCEND security model (B2.9)

Supersedes the engine-specific parts of [B2-SECURITY-MODEL.md](B2-SECURITY-MODEL.md) for the B2.8 execution engine; that
document remains authoritative for the B2.1–B2.7 founder workspaces. Code: `admin/src/lib/server/ascend-engine.ts`,
`admin/src/lib/server/ascend-engine-actions.ts`, `admin/src/lib/ascend-engine.ts`, `admin/src/lib/server/ascend-http.ts`,
migration `admin/drizzle/0104_ascend_execution_engine.sql`, routes under `admin/src/app/api/ascend/` and
`admin/src/app/api/expansion/automation/engine/`.

## 1. Principals

| Principal | Authenticates with | Can | Can never |
|---|---|---|---|
| Founder (`expansion.manage`) | Admin session (password + MFA, session version) re-read from `admin_users` on every command | Approve, reject, cancel, retry, reconcile, set emergency stops, change policy, create/rotate/revoke identities | Bypass the database state machine or the prohibited-action CHECK |
| Worker identity (`kind=worker`) | `Authorization: Bearer asc_<43>`; SHA-256 digest compared in constant time | Heartbeat, claim, start, renew and complete **only the automations assigned to it** | Submit, approve, read other results, change controls |
| Agent identity (`kind=agent`, TITAN OS / Jarvis) | Same bearer scheme | Discover, submit (allowed actions only), read and cancel **its own** operations | Approve, change controls, administer identities, execute work |
| Scheduler (`system`) | In-process, only when `ASCEND_SCHEDULER_ENABLED=true` | Submit enabled interval automations with bucketed idempotency keys | Anything a founder decides |

Capabilities are constrained twice: `createServiceIdentity` refuses mixed grants, and a CHECK in migration 0104 refuses a
worker row holding agent capabilities (and the reverse). Machine credentials carry no founder authority: no code path maps
a service identity to an `admin_users` row, and approval requires `authorisedFounder()`.

## 2. Machine routes

| Route | Gate (in order) | Notes |
|---|---|---|
| `POST /api/ascend/worker` | engine flag → bearer `worker.execute` → 240 req/min per identity → 16 KiB JSON object | One bounded tick, or `op: "renew"` |
| `GET /api/ascend/v1/capabilities` | agent API flag (404 when off) → bearer `operations.read` | Only the identity's allowed actions |
| `POST /api/ascend/v1/operations` | agent API flag → bearer `operations.submit` → 30 req/min → `Idempotency-Key` header → contract `ascend.operations/v1` | Key is namespaced `agent:<identity>:<key>` |
| `GET /api/ascend/v1/operations/{id}` | agent API flag → bearer `operations.read` | Another identity's operation is indistinguishable from a missing one |
| `POST /api/ascend/v1/operations/{id}/cancel` | agent API flag → bearer `operations.cancel` | Own operations only |
| `GET/POST /api/expansion/automation/engine` | founder session + `expansion.manage` re-read from DB → 60 commands/min | Founder command centre |

Middleware exempts exactly these five machine paths from interactive authentication (an anchored regex), so every one
authenticates itself. Errors are structured and sanitised (`ascendFailure`); driver messages, tokens, connection strings
and email addresses are redacted before storage (`sanitiseError`).

## 3. B2.9 audit: confirmed defects and fixes

All fixes have regression tests on real PostgreSQL (`admin/test/integration/ascend-engine.integration.test.ts`, scenarios
K–O) or unit tests (`admin/src/lib/server/ascend-engine-actions.test.ts`, `ops/ascend/worker-preflight.test.mjs`).

| # | Defect (confirmed by reading the code) | Impact | Fix | Test |
|---|---|---|---|---|
| D1 | `claimExecution` ignored the worker identity's `allowed_actions`; any worker identity could claim any registered automation | A worker scoped to `ops.queue_health` would also run review preparation and partner-data scans | Claims filter by the identity's assignment, re-read inside the claim lock; workers must be created with at least one automation; empty assignment claims nothing | K |
| D2 | `startExecution` revalidated approval, policy and the *requesting* identity, but not the *executing* identity | Narrowing or revoking a worker between claim and start did not stop the run | The executor's `active`, `worker.execute` and assignment are re-read under the row lock; refusal returns the work to the queue without consuming an attempt | K |
| D3 | Start, renew and complete were bound to the lease token only, not to the owning identity | Defence in depth: a leaked lease token let any authenticated worker renew or complete another worker's lease | All three require `lease_owner` to be a worker registered to the calling identity | L |
| D4 | The idempotency comparison covered action and payload digest but **not the market scope** | Re-sending a key with a different market silently returned the other market's execution instead of 409 | Replays compare action, payload digest **and** canonical scope; any mismatch is 409 `duplicate` | M |
| D5 | The cooldown check ignored scope | A GB run blocked an otherwise identical IE run (cross-market collision) | Cooldown is per action, payload **and** scope | M |
| D6 | Submissions locked the definition `FOR SHARE`, so two concurrent submissions with different keys both passed the cooldown check | Cooldown bypass under concurrency | The definition row is locked `FOR UPDATE`, serialising submissions per automation | N (10 concurrent → exactly 1 accepted, 9 × 429) |
| D7 | Partner-programme handlers ignored the execution's declared market scope and aggregated every market | An execution scoped to GB reported IE partners' pipeline and onboarding counts | `pipeline.inactivity_scan`, `onboarding.progress_check` and `delivery.handoff_readiness` filter on the partner's `operating_country`; an empty or malformed scope is refused | unit |
| D8 | "Read-only" was a review claim with no enforcement, and the deadline was cooperative only (no `statement_timeout`) | A future handler change could write; a slow query could outlive its lease | Analysis handlers run in `SET TRANSACTION READ ONLY` with `statement_timeout` = the action's limit (clamped 1–50 s); a timeout is classified `deadline_exceeded` (retryable) | O, unit |
| D9 | `review.queue_preparation` was described as "Internal only", next to read-only analyses | Classification ambiguity: it **does** mutate internal review records | Registry field `writes: "none" \| "internal_review_state"`; its effects now say "Not read-only"; a test pins each handler's mode to its classification | unit |
| D10 | The Megaton preflight parsed `.env` with a simpler regex than `node --env-file` (no `export`, spaces around `=`, or trailing `# comment`) | **Fail open**: a switch ON at runtime could be reported inactive | The preflight uses Node's own `util.parseEnv` | preflight test |
| D11 | Founder-supplied idempotency keys could occupy the `agent:` and `schedule:` namespaces | Low: a founder could pre-empt a scheduled bucket | Founder keys with those prefixes are refused | M |

### Investigated and found sound

Token rotation invalidates the old token immediately (digest replaced; scenario I). A revoked identity fails
authentication on its next request (I) and, after B2.9, its in-progress claim cannot start (K). Agents cannot read or cancel
other identities' operations (G). Founder authority, session version and role are re-read from the database on every
command (G). Duplicate execution is prevented by `FOR UPDATE SKIP LOCKED` plus an advisory lock for exact caps (D: 40
executions × 8 workers, every one started and completed once). Expired leases are reaped; a stale completion is refused
by compare-and-set (B). A connection killed mid-transaction leaves no partial state (B2). Emergency stop blocks new starts
and returns leased work without consuming an attempt (E). Prohibited action families are refused in code and by a CHECK (J).
Bodies are capped at 16 KiB and must be JSON objects; payloads are schema-validated with unknown keys refused.

### Accepted residual risks (documented, not changed in code)

- **Machine routes are publicly reachable** through `partners.`/`admin.scalesmiths.co.uk` (nginx routes every path to :3301).
  The worker is loopback-only by design. Recommended nginx change in the [runbook](ASCEND-OPERATOR-RUNBOOK.md#5-recommended-production-hardening-needs-founder-approval).
- **Bearer tokens are not request-signed.** A captured token can be replayed until rotated. Mitigations: TLS or loopback
  transport, per-identity rate limits, single-purpose identities, immediate rotation/revocation, idempotency keys.
- **An emergency stop does not interrupt a handler already running.** It runs to its limit (≤ 50 s, now enforced by
  `statement_timeout` for analyses) and is recorded truthfully. Lease renewal reports `stop_requested`.
- **Review preparation's deadline is cooperative** (checked between tasks); each task is a short keyed transaction.
- **Execution is at-least-once.** Exactly-once *business effects* hold because every registered action is a read-only
  aggregate or idempotent internal review preparation; any future non-idempotent action becomes `ambiguous` on lease loss and
  requires founder reconciliation (F2).

## 4. Database boundaries

The admin runtime role has no DELETE or TRUNCATE on ASCEND tables; the web runtime role cannot read them (verified again
on the restored rehearsal copy). Execution events and control events are append-only by trigger. State transitions are
enforced by a trigger independent of application code.
