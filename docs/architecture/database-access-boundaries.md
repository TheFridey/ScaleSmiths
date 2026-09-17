# PostgreSQL access boundaries

ScaleSmiths keeps one PostgreSQL database and two independently ordered Drizzle histories, but production login roles are separated by workload. Passwords exist only in operator-managed environment configuration; migrations and committed scripts contain no credentials.

## Role and operation audit

| Workload | Connection | Required operations | Explicit exclusions |
| --- | --- | --- | --- |
| Public web runtime | `WEB_DATABASE_URL` | `quote_requests`: select/insert/update; quote and login rate limits: select/insert/update; portal accounts: select; client requests: select/insert/update; client request messages: select/insert; client timeline: select/insert; published reports: select; experience events: insert; related sequence use | No CRM, admin identity, Forge, provider, financial, analytics-credential or migration-journal access; no DDL |
| Admin runtime | `ADMIN_DATABASE_URL` | Select/insert/update across public application relations, delete only on explicitly declared lifecycle tables, and public sequence use | No schema/database ownership, DDL, role management, migration-journal writes, truncate/reference/trigger rights, or undeclared delete |
| Migration runner | `MIGRATION_DATABASE_URL` | Owns the database application schemas and their objects; creates/alters/drops objects; applies web history first and admin history second | Not supplied to long-running web/admin containers |
| Backup operator | `BACKUP_DATABASE_URL` | Select-only database/schema access and `BYPASSRLS` so `pg_dump` captures protected tenant rows | No DML, DDL, role management or application runtime use |
| Read-only operator | `READONLY_DATABASE_URL` | Select application and migration metadata; RLS-protected analytics and request/report/timeline rows require an explicit tenant or aggregate context | No DML, DDL, sequence privileges or RLS bypass |
| Analytics ingestion | Admin runtime plus transaction-local `app.current_client_id` | Per-client config read/update, metric insert and audit insert | Cannot see or write another client's protected analytics rows |
| Analytics retention | Admin runtime plus transaction-local `app.current_client_id` | Bounded deletes of expired metrics, audits and derived proposals; credential nulling for non-ingestible connections | No cross-tenant delete; no delete without tenant context; no age-delete of connection rows |
| Portal tenant runtime | Web runtime plus transaction-local `app.access_mode=tenant` | Request/report/timeline rows whose `client_record_id` matches the mapped CRM client | Missing mapping, missing GUC, or another client's rows |
| Internal aggregate | Admin runtime plus `app.access_mode=internal_aggregate` | SELECT across client-owned request/report/timeline rows | Writes; analytics tables (still tenant-only) |
| Forge workers | Admin runtime | Forge project/task/artifact/job/budget/provider/activity DML and necessary CRM references | Generated workspaces receive no database URL; workers do not own schema or migrations |

The admin grant is intentionally broader than an individual feature because the internal application contains the CRM, identity, Forge, finance and operations surfaces. It is still materially constrained: it cannot access DDL, own objects, manage roles or alter either migration journal. A future out-of-process Forge worker can receive a narrower fourth runtime role without changing the application schemas.

## RLS boundary

Migration `0044_client_analytics_tenant_rls` enables and forces row-level security on:

- `client_analytics_configs`
- `client_analytics_daily_metrics`
- `client_analytics_audit_logs`
- `client_optimisation_proposals`

Every analytics policy compares integer `client_id` with `current_setting('app.current_client_id', true)`. Missing context returns no rows and rejects writes. `withClientTenant` validates a positive client ID, opens a transaction, and sets `app.access_mode=tenant` plus the client id with transaction-local `set_config`; pooled connections cannot retain tenant context after commit or rollback.

Migration `0060_tenant_rls_prototype` (after web `0021_tenant_identity_mapping`) extends the same fail-closed model to portal-owned request, message, timeline and monthly-report tables. Policies compare `client_record_id` (filled from `clients.portal_client_id`) and require an explicit access mode:

- `tenant` — portal `withPortalTenant` and tenant-scoped admin work
- `internal_aggregate` — SELECT-only cross-client internal reporting
- `internal_write` — explicit admin operational DML (session default on the admin pool; not `BYPASSRLS`)

Unmapped or missing context is deny-all. Forge table RLS is intentionally not enabled yet; `app_forge_row_visible` is the tested predicate for that follow-up. The accepted identity model is [Canonical tenant identity](tenant-identity.md). Forward-only rollout and the #55 restore residual are in [Tenant RLS migration plan](../operations/tenant-rls-migration-plan.md).

Analytics retention enumerates integer `clients.id` values then prunes each tenant inside `withClientTenant`. It does not introduce a second identity scheme. Operator job state has no personal data. See [Client analytics retention](../operations/client-analytics-retention.md).

## Production isolation

Production URL resolution never falls back to `DATABASE_URL`. The compatibility variable remains valid only in development and tests. Production builds may compile without opening a database, but runtime access fails with a specific missing dedicated-variable error.

The production Compose files blank unrelated database variables in long-running containers. Only the one-shot provisioning tool sees all role URLs; migration containers see only `MIGRATION_DATABASE_URL`; web and admin see only their respective runtime URL.

`admin/scripts/postgres-privilege-policy.mjs` is the executable grant declaration shared by provisioning and verification. `admin/scripts/verify-postgres-privileges.mjs` queries real PostgreSQL ownership, role attributes, memberships, effective database/schema/relation/sequence/function privileges, and migration-owner default ACLs. The root `test:postgres-privileges` harness proves the policy against PostgreSQL 16 and injects an unauthorized schema grant to prove drift detection and idempotent repair. Operational commands and recovery steps are documented in [PostgreSQL least-privilege rollout](../operations/postgresql-least-privilege-rollout.md).
