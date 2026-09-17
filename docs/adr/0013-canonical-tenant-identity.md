# ADR 0013: Canonical Tenant Identity and Fail-Closed RLS

- Status: Accepted
- Date: 2026-09-17

## Context

Analytics tables already use forced PostgreSQL RLS keyed by integer `clients.id`. Portal requests, reports and timeline rows stored an external text portal ID, while CRM, invoices, delivery and Forge used the integer primary key. Application `WHERE` filters could not contain a query bug. A naive `USING (true)` admin policy would have reopened tenant data to any admin query, including accidental cross-client writes.

Issue #57 asked for a documented mapping, a classification of client-owned vs internal vs aggregate access, a fail-closed prototype on the existing test database (not a production restore), runtime tests, a forward-only migration plan that keeps existing portal IDs, and documentation.

## Decision

- Treat `clients.id` as the canonical tenant key.
- Keep `portal_client_accounts.client_id` and `clients.portal_client_id` as the external portal identifier; do not rewrite JWT cookies or portal URLs.
- Add nullable `client_record_id` FKs on web-owned request/report tables and fill them from the CRM bridge, including a trigger so existing insert paths remain valid.
- Enable FORCE RLS on those client-owned tables with three explicit modes: `tenant`, `internal_aggregate` (SELECT only), and `internal_write` (admin operational DML). Missing context denies all rows.
- Do not use `BYPASSRLS` for application roles. Backup remains the only bypass role.
- Leave Forge table RLS disabled until write paths are wrapped; ship and test `app_forge_row_visible` as the intended predicate.

## Alternatives Considered

- Replace text portal IDs in place. Breaks existing portal URLs, JWTs and historical rows.
- Enable RLS without an integer FK, comparing text IDs only. Leaves CRM/analytics/Forge on a different key.
- Admin `USING (true)` bypass. Rejected; that is the permissive retrofit the issue forbids.
- Enable Forge RLS in the same migration. Would break unwrapped worker/admin writes.

## Consequences

Portal reads and writes require `withPortalTenant`. Unmapped portal accounts fail closed. Admin list screens keep working through session `internal_write`. Cross-client SELECT-only work can opt into `internal_aggregate`. Analytics stays tenant-only.

## Security Implications

An application query that forgets a portal `WHERE` no longer returns another tenant's request, message, timeline or report rows on the web role. Cross-tenant inserts fail. Admin still has a broad operational mode by design; narrowing that mode per route is follow-up, not a silent bypass of RLS.

## Operational Implications

Forward migrations `web/0021` and `admin/0060` are additive. Production-derived restore proof, privilege verification on a restored copy, and Forge/invoice/delivery RLS remain issue #55 / later #57 work. See `docs/operations/tenant-rls-migration-plan.md`.

## Related Code or Documentation

- `docs/architecture/tenant-identity.md`
- `docs/architecture/database-access-boundaries.md`
- `docs/architecture/data-model.md`
- `web/drizzle/0021_tenant_identity_mapping.sql`
- `admin/drizzle/0060_tenant_rls_prototype.sql`
- `web/src/lib/db.ts` (`withPortalTenant`)
- `admin/src/lib/db.ts` (`withClientTenant`, `withInternalAggregate`, `withInternalWrite`)
