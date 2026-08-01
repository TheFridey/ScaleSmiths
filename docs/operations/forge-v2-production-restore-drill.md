# Forge V2 production-derived restore drill

This procedure restores an encrypted production-derived backup only into disposable, isolated infrastructure. It never authorises a production restore or deployment. Stop immediately if any target could route to production.

## Authorisation and roles

Before handling a backup, record approval from the data owner and incident/release lead, the named restore operator, an independent reviewer, the permitted time window, and the evidence location. The operator must have recovery access without receiving application-provider credentials. Two people must verify the target identity before the destructive restore confirmation.

## Mandatory isolation controls

All of these controls are required:

- a dedicated database whose name contains `restore`, `drill`, `test`, or `isolated` and whose database comment is exactly `scalesmiths-isolated-restore-target-v1`;
- a dedicated absolute filesystem root containing an isolation word and outside the production repository;
- `SCALESMITHS_TEST_ENVIRONMENT=1` in any process used for verification;
- no production DNS, Nginx upstream, object-storage mount, queue consumer, cron timer, or worker connected to the target;
- outbound network denied by default, with email, WhatsApp, payments, AI providers, analytics, webhooks, and error-notification delivery disabled;
- no processing of restored client jobs and no browser access by unapproved personnel.

Do not install the isolation database comment on production. Do not copy the restored `.env` into a runnable application environment.

## Backup provenance and encryption

1. Select a production bundle using the backup identifier, source timestamp, source release SHA, external checksum, and `.verified.json` marker.
2. Confirm it came from the approved production backup job and independently exists in protected off-host storage.
3. Verify the age recipient/key identifier or GPG encryption owner against the recovery register. Never paste a private key, passphrase, database URL, or restored environment value into tickets or logs.
4. Place the private identity/passphrase and database URL in separate root-owned, non-symlink files with mode `0600`. Keep evidence outside both the repository and disposable restore root.
5. Run `validate-backup-bundle.sh` and record the bundle and manifest SHA-256 values. A checksum-only validation is not a restore pass.

## Prepare the isolated target

Provision a PostgreSQL 16 target with no production peering and an empty dedicated filesystem root. Verify the exact connection before setting the guard:

```sql
SELECT current_database(), inet_server_addr(), inet_server_port();
COMMENT ON DATABASE scalesmiths_restore_drill IS 'scalesmiths-isolated-restore-target-v1';
```

Record the database host/name and canonical filesystem path. A loopback address still requires explicit confirmation because it may be a production tunnel. Confirm outbound-deny controls and that no application or worker service is running.

## Restore PostgreSQL and generated workspaces

First review the mutation-free plan:

```bash
sudo --preserve-env -u root /usr/bin/bash scripts/backup/restore-backup-bundle.sh \
  --bundle /var/backups/scalesmiths/scalesmiths-backup-<id>.tar.gz.age \
  --target-root /var/lib/scalesmiths-restore-drill/manual-<id> \
  --database-url-file /etc/scalesmiths/restore-drill-database-url \
  --confirm-isolated-restore \
  --confirm-target 127.0.0.1/scalesmiths_restore_drill \
  --confirm-localhost-isolated \
  --confirm-root /var/lib/scalesmiths-restore-drill/manual-<id> \
  --operator operator@example.com \
  --evidence /var/lib/scalesmiths-backup-evidence/manual-<id>.json \
  --dry-run
```

After both operators recheck the resolved target, repeat without `--dry-run`. The guarded script resets only the confirmed target's `public` and `drizzle` schemas, restores PostgreSQL with owner/privilege restoration disabled, and extracts configuration, Nginx, release metadata, and `generated-sites` beneath the isolated root. It never installs those files into production.

## Verification

1. Confirm the restore evidence status is `passed`, source and target PostgreSQL versions are compatible, RTO is recorded, and both Drizzle journals exactly match the backup.
2. Run the forward verifier against the same isolated URL, always web migrations before admin migrations:

```bash
node scripts/verify-production-backup-migrations.mjs \
  --database-url-file /etc/scalesmiths/restore-drill-database-url \
  --confirm-isolated-backup \
  --confirm-localhost-isolated \
  --confirm-target 127.0.0.1/scalesmiths_restore_drill \
  --report /var/lib/scalesmiths-backup-evidence/manual-<id>-migrations.json
```

3. Compare table counts for projects, runs, stages/steps, jobs, artifacts, approvals, users, sessions, and client requests with counts captured in the authorised source manifest or backup job. Record differences; do not include row content in general release evidence.
4. Check foreign-key integrity, orphan counts, required uniqueness constraints, both migration-journal counts/hashes, artifact-to-run references, and generated-workspace inventory, hashes, ownership, modes, and escaping symlinks.
5. Authentication safety checks are metadata-only: confirm expected identity/RBAC records exist, revoke all target login access except operators, do not authenticate as a real user, and do not send MFA or password-reset messages.
6. Do not start web/admin applications unless separately authorised inside a network-denied test enclave. Never start workers or execute restored queued jobs.

## Failure handling

On any target mismatch, decryption/checksum error, journal mismatch, integrity defect, unexpected outbound attempt, or evidence-write failure: stop; preserve the restricted failure record and logs; disable access; notify the incident/release lead; and do not retry destructively until the cause and new target are reviewed. A partial restore is a failure, not evidence of recoverability.

## Cleanup and secure deletion

After review, stop all target processes, revoke credentials, drop the isolated database only after re-verifying its name, host, isolation comment, and approval, then securely delete the disposable filesystem and decrypted temporary material according to the storage medium's approved deletion method. Remove temporary keys and URL files, confirm no snapshots or logs expose secrets, retain only encrypted backups and restricted evidence, and record cleanup verification. Never use a recursive delete with an unresolved variable or production path.

## Evidence and sign-off

Complete [the evidence template](forge-v2-production-restore-evidence-template.md), attach the script JSON, migration report, count/integrity report, checksum output, isolation proof, outbound-control proof, and cleanup record. Operator and independent reviewer sign-off proves only this backup/target exercise; release approval remains separate.
