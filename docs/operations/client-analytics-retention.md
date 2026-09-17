# Client analytics retention and deletion

Reporting owns scheduled deletion of client-site analytics. The job enforces each connection’s `retentionDays` window (30–730, default 395) using PostgreSQL `now()`, not application clocks. Canonical tenant mapping (#57) is not required: pruning reuses integer `clients.id` and the existing transaction-local `withClientTenant` RLS session.

## Deletion semantics

| Record | Rule | Not deleted |
| --- | --- | --- |
| Daily metrics | `metric_date < now() - retentionDays`. Exact cutoff timestamps are kept. Orphaned rows (`config_id` null or invalid retention) use 395 days. | Metrics inside the window, including the boundary instant |
| Analytics audits | `created_at < now() - retentionDays` with the same default for orphans | Job-state rows in `analytics_retention_job_state` |
| Encrypted credentials | Null `credentials_encrypted` when the connection is not ingestible (`enabled=false` or `consent_granted=false`) | Credentials for enabled, consented connections; the config row itself |
| Optimisation proposals | `updated_at < now() - max(valid client retentionDays)` defaulting to 395 | Proposals still inside the longest valid client window |
| Connection configs | Never age-deleted | Attribution and retention policy remain |

Archived clients and disabled connections are still pruned. Retention is a storage limit, not an ingestion feature flag. Offboarding already wipes credentials immediately; this job covers disabled connections that were not offboarded.

Deletion is fail-closed and tenant-isolated:

- every destructive statement runs inside `withClientTenant`
- forced RLS hides other tenants when `app.current_client_id` is missing
- invalid retention values do not collapse to zero days; they fall back to 395
- a tenant failure stops further cursor advancement so the same tenant is retried

## Durable schedule

The in-process admin worker runs the job on its housekeeping tick (`docs/operations/admin-worker-runbook.md`). A lease on the singleton `analytics_retention_job_state` row uses `FOR UPDATE`-style claim (`lease_expires_at`) so replicas do not overlap. Expired leases are taken over. Deletes are idempotent bounded batches (`ANALYTICS_RETENTION_BATCH`, default 500 rows; `ANALYTICS_RETENTION_TENANT_BATCH`, default 100 clients).

Manual or cron backstop:

```http
POST /api/operations/analytics-retention
{ "force": true }
```

Requires `analytics.write`. `force` ignores the due interval but still respects an active lease.

Get operator state (no personal data):

```http
GET /api/operations/analytics-retention
```

Requires `analytics.read`. The JSON and the **Operations → Retention** screen expose last success/failure timestamps, error category, tenant/row counts, lease held, and cursor client id only.

## Operator checks

```sql
SELECT last_status, last_success_at, last_failure_at, last_error_category,
       last_tenants_scanned, last_tenants_failed, last_metrics_deleted,
       last_audits_deleted, last_credentials_cleared, last_proposals_deleted,
       lease_owner, lease_expires_at, cursor_client_id
FROM analytics_retention_job_state
WHERE id = 1;
```

If `last_status` is `failure` or `partial`, inspect `last_error_category` (`invalid_tenant`, `tenant_context_failed`, `prune_failed`, `lease_unavailable`, `unexpected`). Do not expect client names, emails, property ids or credential material in this row or in the API payload.

A poison tenant (repeated `prune_failed` with a stuck `cursor_client_id`) needs an incident review of that integer client id. Do not disable RLS or run a cross-tenant `DELETE` to clear the alert.

## Grants

Admin runtime `DELETE` is limited to declared lifecycle tables, including:

- `client_analytics_daily_metrics`
- `client_analytics_audit_logs`
- `client_optimisation_proposals`

Credential clearing is `UPDATE`, not `DELETE`. Re-run `postgres-provision` after migration `0059` so the new grants exist.

## Rollback

Application rollback without reversing `0059` leaves the table in place and stops scheduled pruning; data then persists until the worker/API is restored. Rolling back the migration is a restore/forward-fix decision, not an in-place journal edit.

## Related

- [Client-site analytics ingestion](client-analytics-ingestion.md)
- [Admin durable worker runbook](admin-worker-runbook.md)
- [Public privacy and storage audit](../legal/public-privacy-and-storage-audit.md)
