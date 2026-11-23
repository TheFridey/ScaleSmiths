# Operation ASCEND — B2.7 automation and integration checkpoint

**Current state:** early engineering draft, no autonomous actions, no live feature activation.

B2.7 is intentionally stacked on `feature/operation-ascend-b2-6`. Its PR must target that branch until B2.6 is reviewed/merged; only then can it be rebased and retargeted to master. It does not incorporate B2.5 because B2.5 remains a separate draft.

## Implemented first vertical slice
- `ASCEND_AUTOMATION_ENABLED=false` by default; guarded founder-only read API `GET /api/expansion/automation` and page `/expansion/automation`.
- Uses the existing B2.3 founder command queue and B2.6 accepted-contract handoff readiness queue; does not create another source of truth.
- Deterministic reasons for existing failed notifications, assistance/meetings, pending scope reviews, overdue proposals, stalled opportunities, applications and accepted-contract handoff blockers.
- Each signal links back to its original authorised source record; no automatic messages, payouts, opportunity stage changes, project creation, reminders, recurring worker or external AI calls.
- The signal view refuses to operate unless B2.7, B2.3 and B2.6 feature switches are explicitly on.
- Underlying B2.3 and B2.6 services independently re-check active founder capability and current session.
- Both source projections are independently consistent, but there is **not** a single global transaction-wide snapshot. Generated timestamps are exposed to make this limitation visible.
- Operational signals are ephemeral derived recommendations, not durable automation jobs.

## Before B2.7 can be considered complete
1. Add idempotent **durable** scheduled automation with explicit outbox, retries and DLQ, authenticated processing and rate limits. Must not bypass human approval of commercial actions. Do not enable background jobs before an agreed policy, lifecycle and production-monitoring setup.
2. Add role, flag-off, stale-session, cross-tenant and malformed-request tests with disposable PostgreSQL.
3. Run full integration E2E for the complete B2.1–B2.7 sales-to-delivery journey, including a populated B2.6 founder handoff.
4. Perform a real-PostgreSQL 14 compatibility rehearsal and performance checks.
5. Resolve review of B2.5, B2.6 and outstanding founder commercial/legal/production readiness gates separately.
6. Ensure operational metrics don't become independent-contractor quotas or covert learning-monitoring.

**No merge or deployment without human review.** The `ASCEND_AUTOMATION_ENABLED` flag remains unset in real environments.
