# Migration history integrity and backup verification

ScaleSmiths uses one PostgreSQL database with two independently owned Drizzle histories. The production order is always:

1. `web/drizzle`, recorded in `drizzle.__drizzle_web_migrations`;
2. `admin/drizzle`, recorded in `drizzle.__drizzle_migrations`.

Do not combine the journals, reverse this order, or edit a locked migration. The repository does not contain evidence proving which historical SQL bytes ran against production, so this runbook deliberately makes no such claim.

## Established Git history

| File | Proven history | Repository decision |
| --- | --- | --- |
| `admin/drizzle/0009_known_iron_monger.sql` | Commit `bfbabc6930b037c441067336530c2900e6cef749` introduced unconditional Forge artifact columns and indexes. Commit `e94e14fe9727d4a275b538f75fd2f271e888d5b1` added `IF NOT EXISTS`. The original conflicts with the same objects created by `0008`, which entered the journal in the same original commit. | Keep and lock the `e94e14f` compatibility form. Restoring the original would break migration from zero. |
| `admin/drizzle/0012_client_request_threads.sql` | Commit `417d54ee2d42306ed88c2ff791369953c6b62e78` introduced only request-message enums/table/indexes and relied on the web-owned `client_requests` table. Commit `e94e14fe9727d4a275b538f75fd2f271e888d5b1` prepended defensive creation of that shared table. | Restore and lock the proven original because the required web-first order supplies `client_requests`; move compatibility protection to `0042`. |
| `web/drizzle/meta/_journal.json` | Commit `e94e14f` appended web migration `0009`; it did not rewrite the earlier web entries. | Lock the ten-entry journal baseline separately from admin. |
| `admin/drizzle/meta/_journal.json` | Commit `e94e14f` renamed the provider-health tag from `0021` to `0022`, retained AI budget reservations at `0021`, and appended `0023` through `0041`. | Lock the 42-entry adopted journal baseline and permit only manifest-recorded appends. |

`admin/drizzle/0042_historical_schema_reconciliation.sql` is the forward-only repair. Its idempotent statements reconcile objects associated with either known `0009`/`0012` form. It does not infer or rewrite the production journal.

## Immutable-history control

`scripts/migration-checksums.json` records canonical-LF SHA-256 hashes for every migration. Entries are explicitly classified as `historical-baseline` or a new forward migration. It also records the proven Git source for historical baselines, both known `0009`/`0012` variants, each journal's immutable prefix, and permitted appended entries.

Run from the repository root:

```bash
npm run check:migration-history
npm run test:migration-history
npm run test:migration-consistency
node scripts/check-migrations.mjs
```

The history check fails for changed or missing locked SQL, unregistered migrations, changed historical journal entries, unapproved forward journal entries, or a changed lock that existed in the pull request base. Hashes normalise CRLF to LF so Windows checkout policy cannot create false mutation reports. CI performs a full-history checkout for the Git-provenance checks.

For a new migration, create a new numbered SQL file, append its owning journal, and add it to `forwardMigrations` plus the journal's `appendedEntries`. Never reclassify, remove, or change an existing locked entry. Pull-request comparison prevents an already committed forward entry from being relocked to different bytes.

## Disposable migration paths

The PostgreSQL integration suite has two distinct cases:

- **clean database:** reset the disposable schema and apply current web migrations followed by current admin migrations;
- **upgraded database:** apply locked web/admin fixture prefixes, model the known historical compatibility gaps and known modified `0012` journal hash, then apply the current histories. Only `0042` may be newly recorded, existing client-request data must survive, and repaired objects must exist.

Run `npm run test:integration` from the repository root. Its URL guard permits only a dedicated local/CI test database.

## Isolated production-backup verification

This is a manual operational exercise, not a CI connection to production. Restore the latest verified production backup into a separately provisioned database first. Never point the verifier at the live database.

The verifier:

- accepts a URL only through `--database-url` or a restricted `--database-url-file` and never falls back to `DATABASE_URL`;
- requires a database name containing `backup`, `restore`, `snapshot`, `clone`, `staging`, `migration`, or `test`;
- requires `--confirm-isolated-backup` and an exact repeated `--confirm-target host/database`;
- requires `--confirm-localhost-isolated` because localhost may be a production tunnel or proxy;
- prints only the target host and database, never the URL or password;
- captures public/Drizzle tables, columns, indexes, enums, and both journals before and after;
- runs web migrations first and admin migrations second;
- writes a JSON report with schema digests, journal counts, and added/removed objects.

Example for an isolated local restore:

```bash
node scripts/verify-production-backup-migrations.mjs \
  --database-url-file '/secure/operator-inputs/scalesmiths-backup-database-url' \
  --confirm-isolated-backup \
  --confirm-localhost-isolated \
  --confirm-target '127.0.0.1/scalesmiths_backup_restore' \
  --report '/secure/operator-evidence/scalesmiths-backup-migration-report.json'
```

The report path must not already exist, preventing accidental evidence replacement. The report contains schema metadata and journal hashes but no application rows. Store it as restricted operational evidence and review every schema removal or unexpected journal change before any production migration approval.

## Remaining human requirement

No production backup was accessed while implementing this control, and no production-backup evidence has been fabricated. An authorised operator must still run the verifier against an isolated restore of the latest verified production backup, review the JSON comparison, and attach that evidence to the release approval.
