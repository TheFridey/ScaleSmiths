# Isolated backup and restore evidence

The source was the synthetic Expansion demonstration database `ss_expansion_test` in `ss-expansion-ephemeral-20261117`. PostgreSQL 16.13 ran locally with a loopback port. The application journey that populated this source used the previous implementation checkpoint `f18b1f9` and its 95 migrations. No production data or credentials were used.

## Baseline replay and migration

The format was a PostgreSQL custom archive with no owner or ACL restoration. Credentials were supplied separately as disposable environment configuration. Commands were run from the workspace in PowerShell, with successful exit checked after each step.

```powershell
docker exec ss-expansion-ephemeral-20261117 pg_dump -Fc --no-owner --no-privileges -U postgres -d ss_expansion_test -f /tmp/ss-expansion-hardening-baseline.dump
docker cp ss-expansion-ephemeral-20261117:/tmp/ss-expansion-hardening-baseline.dump .tmp/expansion-hardening-restore/baseline.dump
Get-FileHash -Algorithm SHA256 .tmp/expansion-hardening-restore/baseline.dump
docker exec ss-expansion-ephemeral-20261117 createdb -U postgres ss_expansion_hardening_restore_tmpfs
docker exec ss-expansion-ephemeral-20261117 pg_restore --exit-on-error --single-transaction --no-owner --no-privileges -U postgres -d ss_expansion_hardening_restore_tmpfs /tmp/ss-expansion-hardening-baseline.dump
# Set MIGRATION_DATABASE_URL to the explicit loopback restore target for this invocation.
node scripts/migrate-database.mjs
```

Archive size 799,771 bytes. SHA-256 `32216cd7364b2a53e6a0d02c50be8afd98bfc93958fec50572b6eb9158478df7`. The restore populated a separate database in the existing test-only cluster. The shared migrator then applied admin migrations 0071 and 0072. Final journal status was web 24/24 and admin 73/73.

| Restored and upgraded check | Result |
| --- | --- |
| Applicants | 3 |
| Partners / activated | 2 / 2 |
| Expansion opportunities / contracts | 1 / 1 |
| Payment events | 3 |
| Earned and paid commission totals | 70500 pence each |
| Backfilled active or paid payout claims | 3 |
| Hold primary key, foreign keys and reason constraint | All four validated |

The first privilege provisioning attempt against the populated restore failed with PostgreSQL `0A000` when the script tried to change the owner of a serial sequence linked to its table. Grants and ownership require separate provisioning because the archive intentionally excludes them. This failure is distinct from the successful restore and migration. Record remediation and the subsequent privilege verification separately.

On 19 November, the same archive restored into a dedicated PostgreSQL 18.3 cluster on loopback port 55444 using the native `pg_restore --exit-on-error --single-transaction --no-owner --no-privileges` command. The shared runner applied 0071 and 0072 to the populated restore. The provisioner now transfers owning tables before sequences. `node admin/scripts/provision-postgres-roles.mjs --confirm-provision` and `node admin/scripts/verify-postgres-privileges.mjs` then both exited zero for all six principals. Logs are stored locally as `hardening-native-restore-*.log`. The isolated native cluster was initialised without synchronising its starting files to disk, so this still does not establish crash durability.

The follow-up race database contained new hardening records. On 19 November, `pg_dump -Fc --no-owner --no-privileges` created `candidate-with-void.dump`. The archive restored with `pg_restore --single-transaction --exit-on-error --no-owner --no-privileges` into a new loopback database. The checksum was `a2953f11e133f91b3f0e231ee79d81af53c0bb3d3d0dd8e5cce219b0be1fe6db`. Both databases returned the same counts and totals: 17 payment events, four refunds, 354000 pence earned, two cancellations, eight claims and 60000 pence recorded paid. The figures include multiple independent synthetic scenarios. The original £705 reconciliation is the baseline check above.

## Evidence boundary

An additional test container and durable named volume were created, but its initial PostgreSQL startup hung during disk synchronisation in the local Docker environment. The successful fallbacks used separate test databases on Docker tmpfs and native PostgreSQL. Archives were stored in the ignored host evidence directory. These results do not establish crash durability, sealed encrypted bundle restoration, production RPO/RTO, or recovery from actual production data. Application startup against a restored database is a separate check.

For an approved production-derived drill, collect the exact encrypted bundle identity and off-host checksum, confirm recovery-key access and isolated database safety marker, restore with the existing recovery tooling, verify preserved migration histories and forward compatibility, reprovision least-privilege principals, start the pinned apps against drill-only credentials and reconcile sampled catalogue, client, partner and financial records. Preserve original payout/refund events and apply post-backup privacy decisions before opening restored access. Record duration, recovery point, operator, approver and gaps. [Production backup and restore](../../operations/backup-and-restore.md)
