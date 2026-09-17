# Tenant identity and RLS migration plan

Forward-only plan for canonical tenant mapping and fail-closed RLS. This file does not authorise production restore, credential changes, or live grant repair.

## Already applied in this change (additive / reversible by forward correction)

1. Web `0021_tenant_identity_mapping` adds nullable `client_record_id` FKs on `client_requests`, `monthly_reports` and `monthly_report_audit_logs`, backfills from `clients.portal_client_id`, and installs a `SECURITY DEFINER` fill trigger (also covering `client_timeline_events`). Existing text portal IDs are unchanged.
2. Admin `0060_tenant_rls_prototype` adds `app_*` access-mode helpers and FORCE RLS on the client-owned request/report/timeline tables with three policies: `tenant`, `internal_aggregate` (SELECT), `internal_write`.
3. Runtime helpers: portal `withPortalTenant`; admin `withClientTenant` now also sets `app.access_mode=tenant`; admin pool connections set session `internal_write`. Privilege policy grants EXECUTE on the helper functions to web, admin and read-only roles.
4. Integration tests on the disposable PostgreSQL used by `npm run test:integration` prove missing context, cross-tenant reads and cross-tenant writes fail for the web runtime role.

These migrations are additive. They do not rewrite historical SQL, do not delete portal IDs, and do not require a production dump. Rolling back application code without a forward migration would leave RLS enabled; operators would keep using a build that sets the GUCs, or apply a new forward migration that drops policies. Do not edit `0021` or `0060` in place.

## Shared planner

`scripts/shared-migration-plan.json` order is web `0000`-`0017`, admin `0000`-`0051`, web `0018`-`0021`, admin `0052`-`0060`. `admin/0060` requires `web/0021` because policies read `client_record_id`. Admin `0059` is the analytics-retention job from #94 and is unrelated to this RLS prototype.

## Compatibility

| Existing artefact | Action |
| --- | --- |
| Portal JWT `clientId` and `/portal/[clientId]` | Keep. Resolver maps text → `clients.id`. |
| `portal_client_accounts.client_id` | Keep unique external login key. |
| Text `client_id` on requests/reports/timeline | Keep. Trigger and backfill populate `client_record_id`. |
| Unmapped historical rows | Stay nullable. Tenant mode cannot see them until `clients.portal_client_id` is repaired. |
| Analytics `0044` policies | Unchanged. Still tenant-only; internal aggregate does not open analytics rows. |

## Deliberately not in this prototype

- FORCE RLS on `forge_projects` and children. Predicate `app_forge_row_visible` is tested; table policies wait until Forge write paths set tenant vs `internal_write` per operation.
- FORCE RLS on `invoices`, `delivery_*`, `client_documents`. Portal already joins through `clients.portal_client_id`; expanding RLS is the same pattern once those query sites set tenant context.
- Changing production roles, passwords, or `BYPASSRLS`.
- Running policies against a production-derived restore.

## Remaining checklist for issue #55

An authorised operator must still, after #55's isolated production-derived restore exists:

1. Restore the latest verified encrypted production bundle only into the guarded isolated target (never production).
2. Run `npm run db:migrate` / the guarded forward-migration verifier against that copy and confirm `0021`/`0060` apply, backfill `client_record_id` for real portal IDs, and leave both Drizzle journals intact.
3. Re-run `admin/scripts/verify-postgres-privileges.mjs` on the restored copy (non-mutating) and confirm web/admin/read-only EXECUTE on `app_*` helpers, backup `BYPASSRLS`, and no unexpected policy drift.
4. Repeat the cross-tenant isolation queries from `admin/test/integration/postgres.integration.test.ts` against anonymised restored rows (two real clients), without using production credentials in CI.
5. Prove `pg_dump` as the backup role still returns RLS-protected request/report rows.
6. Decide whether to enable FORCE RLS on Forge and integer-keyed delivery/invoice tables on a subsequent forward migration after wrapping those write paths.
7. Attach checksums, journal counts, operator name, recovery point and human approval to the release record. Do not copy client rows into this repository.

Until that drill is approved, production rollout of `0021`/`0060` is a normal forward migration review, not restore evidence.
