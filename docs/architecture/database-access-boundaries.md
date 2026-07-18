# PostgreSQL access boundaries

ScaleSmiths keeps one PostgreSQL database and two independently ordered Drizzle histories, but production login roles are separated by workload. Passwords exist only in operator-managed environment configuration; migrations and committed scripts contain no credentials.

## Role and operation audit

| Workload | Connection | Required operations | Explicit exclusions |
| --- | --- | --- | --- |
| Public web runtime | `WEB_DATABASE_URL` | `quote_requests`: select/insert/update; quote and login rate limits: select/insert/update; portal accounts: select; client requests: select/insert/update; client request messages: select/insert; client timeline: select/insert; published reports: select; experience events: insert; related sequence use | No CRM, admin identity, Forge, provider, financial, analytics-credential or migration-journal access; no DDL |
| Admin runtime | `ADMIN_DATABASE_URL` | Select/insert/update/delete across application tables and sequence use | No schema/database ownership, DDL, role management or migration-journal writes |
| Migration runner | `MIGRATION_DATABASE_URL` | Owns the database application schemas and their objects; creates/alters/drops objects; applies web history first and admin history second | Not supplied to long-running web/admin containers |
| Backup operator | `BACKUP_DATABASE_URL` | Select-only database/schema access and `BYPASSRLS` so `pg_dump` captures protected tenant rows | No DML, DDL, role management or application runtime use |
| Read-only operator | `READONLY_DATABASE_URL` | Select application and migration metadata; RLS-protected analytics requires an explicit transaction-local client context | No DML, DDL or RLS bypass |
| Analytics ingestion | Admin runtime plus transaction-local `app.current_client_id` | Per-client config read/update, metric insert and audit insert | Cannot see or write another client's protected analytics rows |
| Forge workers | Admin runtime | Forge project/task/artifact/job/budget/provider/activity DML and necessary CRM references | Generated workspaces receive no database URL; workers do not own schema or migrations |

The admin grant is intentionally broader than an individual feature because the internal application contains the CRM, identity, Forge, finance and operations surfaces. It is still materially constrained: it cannot access DDL, own objects, manage roles or alter either migration journal. A future out-of-process Forge worker can receive a narrower fourth runtime role without changing the application schemas.

## RLS boundary

Migration `0044_client_analytics_tenant_rls` enables and forces row-level security on:

- `client_analytics_configs`
- `client_analytics_daily_metrics`
- `client_analytics_audit_logs`
- `client_optimisation_proposals`

Every policy compares `client_id` with `current_setting('app.current_client_id', true)`. Missing context returns no rows and rejects writes. `withClientTenant` validates a positive client ID, opens a transaction, and sets the value with transaction-local `set_config`; pooled connections cannot retain it after commit or rollback. Analytics routes pass the route client ID into ingestion and additionally match the requested configuration ID.

RLS was evaluated but deferred for portal requests, reports and Forge records. Portal ownership currently uses external text client identifiers while admin CRM clients use integer IDs, and Forge project access includes legitimate cross-client internal reporting. Applying reliable policies there requires an explicit identity-to-tenant mapping and separate internal aggregate access, not a permissive bypass policy.

## Production isolation

Production URL resolution never falls back to `DATABASE_URL`. The compatibility variable remains valid only in development and tests. Production builds may compile without opening a database, but runtime access fails with a specific missing dedicated-variable error.

The production Compose files blank unrelated database variables in long-running containers. Only the one-shot provisioning tool sees all role URLs; migration containers see only `MIGRATION_DATABASE_URL`; web and admin see only their respective runtime URL.
