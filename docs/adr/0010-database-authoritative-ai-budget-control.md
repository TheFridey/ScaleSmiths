# ADR 0010: Database-Authoritative AI Budget Control

- Status: Accepted
- Date: 2026-07-13

## Context

Initial Forge AI usage included process-local budget assumptions. The system now includes database reservation and usage records so concurrent workers, restarts, failed calls, unknown usage, fallback, and replayed tasks can be reconciled more safely.

## Decision

Use database-authoritative AI budget reservations before provider calls. Reserve estimated maximum cost atomically, reconcile actual usage after the call, release unused reservation, and mark abandoned reservations after timeout.

## Alternatives Considered

- Process-local in-memory budget ledger only.
- Provider-side spend limits only.
- Post-call usage reporting without pre-call reservation.

## Consequences

Database reservations reduce concurrency overspend and provide durable reporting. They add transactional complexity and require cleanup/reconciliation jobs or routines for abandoned reservations.

## Security Implications

Budget control is a cost-safety boundary. It must fail closed when limits are exceeded or reservation state is unclear. Provider keys and billing details remain server-only.

## Operational Implications

Operators can set daily/global/project/provider limits and investigate usage through economics dashboards. Unknown usage and fallback paths must be reconciled honestly rather than hidden.

## Related Code or Documentation

- `admin/src/lib/server/forge-budget-reservations.ts`
- `admin/src/lib/forge-budget-reservations.ts`
- `admin/src/lib/server/forge-economics.ts`
- `admin/src/app/(protected)/forge/economics/page.tsx`
- `admin/drizzle/0021_ai_budget_reservations.sql`
- `docs/operations/ai-budget-reservations.md`
- `docs/operations/forge-economics-dashboard.md`
