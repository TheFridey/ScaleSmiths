# ASCEND disaster recovery (B2.9)

## 1. What was and was not proven

| Item | Status | Evidence |
|---|---|---|
| Production pre-B2.9 backups intact | **VERIFIED (production, read-only)** | Both dumps pass `sha256sum -c`; custom-format pg_dump 14.24 archives with 2,335 TOC entries and 188 table-data entries; neither contains `ascend_executions` (both predate 0104). [Reconciliation](evidence/b2-9/production-reconciliation.md#backups) |
| Full restore of the production backup | **BLOCKED_EXTERNAL** | Needs a founder-approved restore into an isolated cluster on the VPS. Copying the dump off the server would export personal data, so it was not done. Procedure in section 3 |
| Synthetic restore rehearsal | **VERIFIED (synthetic)** | Disposable PostgreSQL 16.14 in WSL: dump, checksum, isolated restore, row counts and fingerprints, grants, privilege verification. [Output](evidence/b2-9/synthetic-restore-rehearsal.txt) |
| Applying 0104 to a pre-0104 PostgreSQL 14 schema | **VERIFIED (CI, synthetic)** | The required database check rehearses migrations and ASCEND safe defaults on PostgreSQL 14 (B2.8 evidence); the production cutover applied it on 14.24 |
| Previous application release against the 0104 schema | **NOT_TESTED** in B2.9 | Expected compatible: 0104 only adds tables, and release `07521b1` never reads them. The stale `e48967b` canaries have run against the migrated database since cutover without restarts |

## 2. Synthetic rehearsal results (24 November 2026, 14:0xZ)

Source: the disposable `ss_expansion_test` database after the full integration suite (193 tables, 150 executions, 566
execution events, 10 service identities). Target: a new database `ss_b29_restore_rehearsal` on the same disposable cluster.

| Step | Result |
|---|---|
| `pg_dump -Fc` | 1,198,491 bytes, 2,404 TOC entries, 0.3–4.8 s across runs |
| Checksum | SHA-256 recorded and re-verified |
| `pg_restore --no-owner --no-privileges --exit-on-error --single-transaction` | **139.9 s**; dominated by WAL fsync on the WSL virtual disk (each DDL statement waits on `WALSync`; a run without `--single-transaction` was still running after 300 s). Not representative of the VPS |
| Row counts, all 193 tables | Identical |
| Content fingerprints: commission ledger, payouts, agreement acceptances, contracts | Identical |
| Migration journal | 105 / 105 |
| ASCEND safe default after restore | Global stop engaged |
| Re-provision least-privilege roles + `verify-postgres-privileges.mjs` | Passed (1.4 s verification) |
| Runtime boundaries on the restored copy | Admin reads ASCEND; web denied ASCEND (42501); `DELETE` on execution events denied to both (42501) |

## 3. Production restore procedure (operator, needs founder approval)

Never restore over the live database. This procedure uses a throw-away second cluster on the VPS so the live cluster is
not touched. Run as root in a `tmux` session; record every timestamp.

```bash
set -euo pipefail
DUMP=/var/backups/scalesmiths/pre-b29-cutover-20261124T130607Z.dump
sha256sum -c "$DUMP.sha256"                                   # 1. checksum
T0=$(date +%s)
pg_createcluster 14 b29drill --port 55441 --start             # 2. isolated cluster (separate data dir and port)
sudo -u postgres psql -p 55441 -c "create database ss_restore_drill"
sudo -u postgres pg_restore -p 55441 --no-owner --no-privileges --exit-on-error --single-transaction -d ss_restore_drill "$DUMP"
T1=$(date +%s); echo "restore_seconds=$((T1-T0))"
# 3. structure and counts (compare with the live read-only counts taken at the same time)
sudo -u postgres psql -p 55441 -d ss_restore_drill -Atc "select count(*) from pg_tables where schemaname='public'"
sudo -u postgres psql -p 55441 -d ss_restore_drill -Atc "select count(*) from partner_applications"
# 4. apply the outstanding migration sequence (0104) with the release's migrator, pointed ONLY at port 55441
#    Use a migration URL for the drill cluster; confirm the host:port in the URL is 127.0.0.1:55441 before running.
# 5. re-provision grants and verify, against the drill cluster only
#    POSTGRES_PROVISIONING_DATABASE_URL / MIGRATION_DATABASE_URL / ADMIN_DATABASE_URL / WEB_DATABASE_URL all on :55441
#    node admin/scripts/provision-postgres-roles.mjs --confirm-provision && node admin/scripts/verify-postgres-privileges.mjs
# 6. ASCEND safe defaults
sudo -u postgres psql -p 55441 -d ss_restore_drill -Atc "select scope, suspended from ascend_automation_controls"
sudo -u postgres psql -p 55441 -d ss_restore_drill -Atc "select count(*) from ascend_automation_definitions where enabled"
T2=$(date +%s); echo "total_seconds=$((T2-T0))"
# 7. tear down
pg_dropcluster 14 b29drill --stop
```

Expected: checksum OK; table and row counts equal the live counts at dump time; migrations end at web 25/25, admin
105/105; privilege verification passes; global stop `t`; enabled definitions `0`. Record results in
`docs/expansion/ascend/evidence/b2-9/` as production evidence.

## 4. Recovery objectives

- **RPO.** Backups are manual pre-release dumps (`/var/backups/scalesmiths/pre-<name>-<ts>.dump`); the repository's
  scheduled backup framework is not installed on the VPS. The recovery point is therefore the **last manual dump**:
  currently 13:06Z on 24 November. Until scheduled backups exist, every production change should be preceded by a dump.
- **RTO (estimate, not measured in production).** The production dump is 1.9 MB with 2,335 TOC entries. Restore time is
  dominated by DDL count and fsync latency, not data volume; on the VPS's disk expect well under the 140 s observed on
  WSL. Add release rebuild/switch time from the PM2 runbook. Measure it with section 3.
- **ASCEND specifics.** After any restore the engine comes back with whatever stop and definition state the dump held.
  Before restarting any worker: confirm the global stop is engaged, then reconcile executions that were `leased` or
  `running` at dump time (they are reaped to `retry_scheduled` on the next claim, or `ambiguous` for a future
  non-idempotent action). Rotate every service identity token if the dump could have been exposed.

## 5. Execution-history growth and retention

`ascend_executions` and the append-only `ascend_execution_events` grow without bound. The B2.8 benchmark measured about
5.8 MB of executions and 3 MB of events per 5,540 executions. No deletion is permitted without an approved policy, and the
admin role cannot delete. Proposed policy for founder approval: keep full history for 180 days; after that, aggregate
completed executions into a daily summary (counts by action, status and failure class, p50/p95 latency) and archive the
raw rows to an encrypted export before a migration-owned purge function removes them. Never purge `ambiguous`,
`dead_lettered` or any execution referenced by an open reconciliation.
