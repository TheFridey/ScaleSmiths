# TITAN OS / Jarvis integration contract: `ascend.operations/v1`

**Status:** implemented and tested on disposable PostgreSQL; **disabled in production** (`ASCEND_AGENT_API_ENABLED=false`,
every route returns 404). Enabling it is a separate founder decision. This contract lets TITAN OS delegate narrowly scoped,
founder-governed work to ASCEND. It never gives an agent approval authority, control over emergency stops, identity
administration, or access to another identity's work.

## 1. Identity requirements

- One agent identity per integration and purpose, created by a founder in the command centre (kind **Agent**). Capabilities
  are any of `operations.submit`, `operations.read`, `operations.cancel`; an identity that submits must list at least one
  allowed automation. Worker capabilities cannot be combined with agent capabilities (code and database CHECK).
- Token format `asc_` + 43 base64url characters, shown once, stored by ASCEND only as a SHA-256 digest. Send it as
  `Authorization: Bearer <token>` over TLS or loopback only. Rotation invalidates the previous token immediately;
  revocation is immediate and stops the identity's queued work from starting.
- A machine credential can never approve work. Approval requires an interactive founder session with MFA; there is no API
  for it and no mapping from a service identity to a founder.

## 2. Calls

| Call | Capability | Success |
|---|---|---|
| `GET /api/ascend/v1/capabilities` | `operations.read` | 200: contract, identity, the actions it may request |
| `POST /api/ascend/v1/operations` | `operations.submit` | 202 new; 200 replay of the same request |
| `GET /api/ascend/v1/operations/{id}` | `operations.read` | 200: status, attempts, failure class, sanitised error, result when completed |
| `POST /api/ascend/v1/operations/{id}/cancel` | `operations.cancel` | 200: `cancelled`, or `cancelRequested: true` while running |

Every request body is a JSON object of at most 16 KiB with `Content-Type: application/json`.

### Submission

Headers: `Authorization`, `Content-Type: application/json`, **`Idempotency-Key`** (8–200 of `A-Z a-z 0-9 . _ : -`, required).
Body: `{ "contract": "ascend.operations/v1", "actionType": string, "payload"?: object, "scope"?: { "markets": ["GB", …] }, "correlationId"?: uuid }`.

- **Idempotency.** The key is namespaced per identity (`agent:<identity>:<key>`). Re-sending the same key with the same
  action, payload **and market scope** returns the original operation (200, `replay: true`). The same key with anything
  different is refused with 409 `duplicate` (B2.9; previously a different market silently replayed).
- **Correlation.** Supply a UUID to group related operations across TITAN OS and ASCEND; ASCEND generates one otherwise.
  It is returned on every response and shown in the founder's execution view.
- **Scope.** Markets must be within the automation's founder-approved market scope; omitted means that scope. Handlers
  restrict partner-programme aggregates to these markets.
- **Approval.** If the automation requires approval (the production default), the operation waits as `pending_approval`
  until a founder approves the exact payload digest and policy version. Policy changes invalidate pending approvals.
- **Emergency stop.** Submissions are accepted while a stop is engaged, but nothing starts; leased work returns to the queue.

### Example (isolated environment only)

```http
POST /api/ascend/v1/operations
Authorization: Bearer asc_…
Idempotency-Key: titan-health-2026-11-24T14
Content-Type: application/json

{"contract":"ascend.operations/v1","actionType":"ops.queue_health","payload":{"staleWorkerMinutes":10},"correlationId":"5f0c1c8e-3b9a-4a8e-9a43-2a4d6d1e7b10"}
```

```json
{"contract":"ascend.operations/v1","id":"8c4e…","status":"pending_approval","correlationId":"5f0c1c8e-…","replay":false}
```

Status once completed:

```json
{"contract":"ascend.operations/v1","id":"8c4e…","correlationId":"5f0c1c8e-…","actionType":"ops.queue_health","status":"completed","attempts":1,
 "failureClass":null,"error":null,"createdAt":"…","completedAt":"…",
 "result":{"summary":"No operational issues detected.","source":"ascend_executions, ascend_review_jobs, ascend_workers (engine-wide aggregate)","generatedAt":"…","findings":[],"metrics":{"executionsQueued":0}}}
```

## 3. Errors and retry behaviour

Errors are `{"error": string, "failureClass": string | null}`.

| HTTP | failureClass | Meaning | Client action |
|---|---|---|---|
| 400 | `invalid_payload` | Missing `Idempotency-Key`, wrong contract, bad key or correlation id, malformed JSON | Fix the request; do not retry |
| 401 | `authentication` | Missing or unknown token | Stop; check the credential |
| 403 | `authentication` / `permission` | Revoked identity, missing capability, or action not allowed for this identity | Stop; a founder must change the identity |
| 404 | — | Agent API disabled, or the operation is not this identity's | Stop |
| 409 | `duplicate` | Idempotency key reused for different work | Use a new key for new work |
| 409 | `policy_rejection` | Automation disabled or its definition expired | Stop; founder decision |
| 413 / 415 | `invalid_payload` | Body over 16 KiB / not JSON | Fix the request |
| 422 | `invalid_payload` / `policy_rejection` | Payload fails the action schema, prohibited action family, or market not authorised | Fix or stop |
| 429 | `rate_limited` | 30 submissions/min per identity, or the automation's cooldown | Retry after a delay **with the same key** |
| 5xx / network | — | Transient | Retry with exponential backoff and jitter **with the same key** |

Execution itself is at-least-once inside ASCEND; registered actions are read-only or idempotent internal preparation, so
business effects are exactly-once. Operation states: `pending_approval`, `queued`, `leased`, `running`, `retry_scheduled`,
`completed`, `failed`, `dead_lettered`, `cancelled`, `expired`, `ambiguous` (founder reconciliation required).

## 4. Limits and boundaries

- Rate limits: 30 submissions per minute per agent identity; per-automation cooldown, concurrency and attempts are founder policy.
- Allowed actions today: the five registered read-only or internal review automations. Payout, commission, ledger, payment,
  refund, invoice, agreement, publishing, activation, permission, retention, deletion and any communication families are
  refused in code and by a database CHECK, whatever an identity is granted.
- An agent cannot read results of operations it did not submit, see founder diagnostics, or list the engine queue.

## 5. Tests

Scenario I (discovery, submission, replay, refusal of other actions and markets, approval enforcement, cancellation,
status, rotation, revocation), G (cross-identity isolation), J (prohibited families) and M (scope-bound idempotency) in
`admin/test/integration/ascend-engine.integration.test.ts`. 18/18 passed on disposable PostgreSQL 16 on 24 November 2026.

## 6. Enabling (future, founder-authorised)

Create a dedicated agent identity with only the actions TITAN OS needs; keep approval required; set
`ASCEND_AGENT_API_ENABLED=true` on the admin app only; expose `/api/ascend/v1/` to TITAN OS over a private network or an
authenticated tunnel rather than the public partner host; monitor the identity's activity in the command centre.
