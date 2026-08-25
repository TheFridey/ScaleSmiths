# Production backup and restore

Run repository-relative commands from `/var/www/scalesmiths/ScaleSmiths`. This framework creates encrypted recovery bundles and restores only into explicitly confirmed isolated infrastructure. It does not authorise a production restore, and no real production backup or restore was executed while implementing it.

## Recovery ownership and objectives

| Control | Default policy | Owner |
| --- | --- | --- |
| PostgreSQL and filesystem backup | Daily, with a 20-minute random timer delay | Production operations |
| Recovery point objective | 24 hours (`BACKUP_RPO_HOURS`) | Product owner and production operations |
| Recovery time objective | 60 minutes (`BACKUP_RTO_MINUTES`) | Incident lead and production operations |
| Daily retention | 14 days | Production operations |
| Weekly retention | 8 weeks | Production operations |
| Monthly retention | 12 months | Production operations |
| Minimum protected recovery points | 3; configuration cannot reduce this below 2 | Production operations |
| Isolated restore drill | Monthly | Named recovery operator |
| Encryption identity/passphrase ownership | Private recovery owners, separate from application credentials | Named in the private operations vault |
| Off-host storage and object lock | Separate account/location from the VPS | Infrastructure owner |

RPO and RTO are operational commitments, not guarantees. A successful timer invocation is not proof of recoverability: the newest bundle remains only integrity-verified until an isolated restore drill passes and a human reviews its evidence.

## Bundle scope and format

`create-backup-bundle.sh` captures:

- a PostgreSQL custom-format dump created with owner/privilege restoration disabled;
- the root production `.env`, readable only inside the encrypted bundle;
- the reviewed host Nginx paths configured in `BACKUP_NGINX_PATHS`;
- `generated-sites` as a non-dereferenced archive;
- `/var/lib/scalesmiths-release` state, release records, and deployment logs;
- the separately owned web and admin Drizzle journals plus the migration checksum manifest;
- immutable Docker image IDs and available repository digests;
- environment/key-file UID, GID, mode, key identifier, and owner metadata without key values;
- an internal `SHA256SUMS` file and a minimal manifest containing the source release, Git commit, PostgreSQL versions, RPO, and RTO.

The final files are:

- `scalesmiths-backup-<id>.tar.gz.age` or `.gpg`;
- `<bundle>.sha256`;
- `<bundle>.verified.json`.

The verification marker distinguishes internal checksum validation from `restoreVerifiedAt`. Retention always preserves the configured newest verified points and the newest restore-verified point.

## One-time host preparation

1. Install `bash`, PostgreSQL client tools matching PostgreSQL 16, `jq`, `tar`, `sha256sum`, `flock`, `rclone`, and either `age` or `gpg`.
2. Create root-owned directories:

   ```bash
   sudo install -d -m 0700 /etc/scalesmiths
   sudo install -d -m 0700 /var/backups/scalesmiths
   sudo install -d -m 0700 /var/lib/scalesmiths-backup-tmp
   sudo install -d -m 0700 /var/lib/scalesmiths-restore-drill
   sudo install -d -m 0700 /var/lib/scalesmiths-backup-evidence
   ```

3. Copy `ops/backup/backup.env.example` to `/etc/scalesmiths/backup.env`, set mode `0600`, and replace every example recipient, owner, destination, Nginx path, and drill target.
4. Put the production database URL in `/etc/scalesmiths/backup-database-url` and the dedicated drill URL in `/etc/scalesmiths/restore-drill-database-url`. Both must be non-symlink files with mode `0600`.
5. On the newly provisioned, dedicated drill database only, install the fixed safety marker after verifying `current_database()`:

   ```sql
   COMMENT ON DATABASE scalesmiths_restore_drill IS 'scalesmiths-isolated-restore-target-v1';
   ```

   The restore refuses to reset schemas without this database-level marker. Never add it to the production database.
6. Configure one encryption mode:

   - preferred: an `age` public recipient in the environment file and its private identity on the controlled drill/recovery host;
   - alternative: a high-entropy GPG passphrase in a separate root-only file referenced by `BACKUP_GPG_PASSPHRASE_FILE`.

7. Configure `rclone` for an off-host destination with independent credentials, restricted write scope, provider-side retention or object lock, and alerting. The scripts never print the configured destination or credentials.
8. Install the reviewed systemd units from `ops/systemd`, then validate before enabling them:

   ```bash
   sudo install -m 0644 ops/systemd/scalesmiths-backup.{service,timer} /etc/systemd/system/
   sudo install -m 0644 ops/systemd/scalesmiths-restore-drill.{service,timer} /etc/systemd/system/
   sudo systemd-analyze verify /etc/systemd/system/scalesmiths-{backup,restore-drill}.{service,timer}
   sudo systemctl daemon-reload
   ```

   Run the documented dry runs and one operator-attended disposable restore first. Only then use `sudo systemctl enable --now scalesmiths-backup.timer scalesmiths-restore-drill.timer`, and confirm both schedules with `systemctl list-timers 'scalesmiths-*'`.

Do not store operational backup variables or recovery secrets in the application `.env`. The application environment is backup content, not backup-control configuration.

## Creation and validation

Start with a mutation-free plan:

```bash
sudo --preserve-env -u root /usr/bin/bash scripts/backup/create-backup-bundle.sh --dry-run
```

Create a real bundle only after reviewing the resolved source paths, policy file, off-host target, and encryption ownership:

```bash
sudo --preserve-env -u root /usr/bin/bash scripts/backup/create-backup-bundle.sh
```

Creation fails when required state is missing, encryption is absent or ambiguous, the off-host destination is required but unset, a source contains a special filesystem entry or escaping/absolute symlink, a second backup/prune/restore holds the recovery-point lock, or any dump/archive/checksum/upload step fails. Restore readers hold a shared lock through selection and evidence/marker updates, so pruning cannot remove a bundle mid-drill. Relative symlinks that resolve within their declared source root are preserved. Plaintext staging uses mode `0700` and is removed by the exit trap.

Validation requires the relevant private age identity or GPG passphrase file:

```bash
sudo --preserve-env -u root /usr/bin/bash scripts/backup/validate-backup-bundle.sh \
  --bundle /var/backups/scalesmiths/scalesmiths-backup-<id>.tar.gz.age
```

Validation checks the external checksum and marker, decrypts into a private temporary directory, rejects absolute/parent paths, duplicate or unrecognised outer members, and outer symlinks/special entries, verifies every internal checksum and required metadata file, and asks `pg_restore` to list the database archive. It never prints environment contents or key material.

## Explicit isolated restore

The restore script deliberately resets only the confirmed target database's `public` and `drizzle` schemas before `pg_restore`. It therefore requires all of:

- a database name containing `restore`, `drill`, `test`, or `isolated`;
- the exact database comment `scalesmiths-isolated-restore-target-v1`, provisioned only on the disposable restore database;
- `--confirm-isolated-restore`;
- exact `--confirm-target host/database`;
- an extra `--confirm-localhost-isolated` for loopback targets;
- an absolute target root containing an isolation word, outside the production repository;
- exact `--confirm-root`;
- a named operator and new evidence path.

Use a URL file to avoid command history exposure:

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
  --evidence /var/lib/scalesmiths-backup-evidence/manual-<id>.json
```

Restored environment and Nginx files remain under the isolated root; they are never installed into production paths. The script compares both restored Drizzle journal tables with the bundle state and records the result. Never point this command at a live database, production tunnel, or production repository.

## Scheduled restore drills

`restore-drill.sh` selects the newest integrity-verified marker, creates a unique isolated filesystem root, performs the guarded restore, optionally runs the forward migration verifier, records evidence, uploads the evidence before updating and uploading `restoreVerifiedAt`, and deletes the plaintext drill filesystem unless `BACKUP_DRILL_RETAIN_RESTORE=1`.

The example timer runs monthly. A passing automated report still requires a human to:

1. confirm source release and bundle checksum;
2. inspect PostgreSQL source/target versions and both journal arrays;
3. confirm the RTO was met;
4. verify the off-host copy independently exists;
5. sign or attach the evidence to the release/operations record.

Evidence follows [restore-evidence.schema.json](../../ops/backup/restore-evidence.schema.json). Failed restores also produce a safe failure record where possible, without database URLs, exception bodies, environment contents, or key material.

## Retention and pruning

`prune-backups.sh --dry-run` shows eligible backup identifiers without deleting them. The real run selects the newest point per retained day/week/month, always protects at least the configured newest verified points, and separately protects the newest restore-verified point. It deletes only complete bundle/checksum/marker triplets whose resolved paths remain directly inside `BACKUP_OUTPUT_DIR`.

Off-host retention is intentionally not deleted by this script. Configure provider-side lifecycle/object-lock rules at least as conservative as the repository policy, and review them independently before reducing local retention.

## Failure notification and monitoring

`BACKUP_FAILURE_HOOK` must be an absolute, non-symlink executable. It receives only a fixed event name and host in a clean environment; notification credentials belong in the hook's separate protected configuration. Alert on failed services, missing daily markers beyond the RPO, missed timers, off-host upload failures, restore evidence older than the drill interval, and RTO breaches.

## Docker-based verification

When the VPS-hosted restore drill is not available (e.g. during initial provisioning, or when the dedicated drill database is not yet configured), run the self-contained Docker verification:

```bash
chmod +x ops/restore-drill-docker.sh
bash ops/restore-drill-docker.sh
```

This spins up disposable PostgreSQL containers, creates an encrypted backup using the production `create-backup-bundle.sh`, validates it with `validate-backup-bundle.sh`, restores it into an isolated target with `restore-backup-bundle.sh`, and verifies table row counts, foreign keys, migration journals, and file restoration. It produces evidence at `ops/restore-evidence/restore-<timestamp>.json` and cleans up all containers/volumes/networks afterward.

This proves the toolchain is sound. It does not prove that a specific production backup is restorable — that requires the VPS restore drill against an actual production bundle.

## Human production gate

No script promotes restored files or databases to production. Replacing production PostgreSQL, `.env`, Nginx, generated workspaces, release state, or image selection remains an incident-lead action requiring reviewed evidence, maintenance/write controls, a fresh forensic backup where appropriate, and the rollback runbook. Actual production restore evidence cannot be created by CI and remains explicitly human-gated.
