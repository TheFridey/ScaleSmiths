# Expansion hardening release runbook

Use this addendum with the canonical release runbook. The production checkout is `/var/www/scalesmiths/ScaleSmiths`. The two existing Next.js apps share PostgreSQL. Public recruitment uses `https://scalesmiths.co.uk/partners` and the partner and founder workspaces use `https://admin.scalesmiths.co.uk/partner` and `/expansion` on the admin origin. Host Nginx owns routing. The canonical release path is Docker with host-Nginx blue/green switching. The parent operational runbook also documents the PM2 route if the operator has verified that it still serves live traffic. [Canonical release runbook](../../operations/release-runbook.md)

## Sign-off before preparing a release

- Record approved SHA, CI link and all required check results, reviewers including protected-area owners, release identity, immutable image IDs, operator, approver and rollback owner. Require a compatible retained application and assessed schema compatibility before application rollback.
- Record reviewed SQL and journal starting and expected ending prefixes. Independently verify upgrade from the retained state and clean provisioning. Keep migration and provisioning credentials out of app containers. [Least privilege rollout](../../operations/postgresql-least-privilege-rollout.md)
- Validate a fresh encrypted bundle and independently reviewed isolated restore, including recovery key ownership, off-host verification and recovery objectives. Synthetic evidence is useful for checking the method. Production-derived recovery readiness still requires an approved operation. [Backup and restore](../../operations/backup-and-restore.md)
- Configure `AUTH_SECRET`, `AUTH_URL`, MFA encryption and app-specific database URLs as specified in the existing production runbook. Keep `PARTNER_APPLICATIONS_ENABLED`, `PARTNER_ACTIVATION_ENABLED` and `PARTNER_RETENTION_EXECUTION_ENABLED` false for closed mode. Set notice version and days only from the approved policy when moving to the relevant mode. Environment file values are runtime settings and must stay out of Git.
- Confirm review ownership, financial operations coverage and mode approval. Clear unrelated releases, catalogue maintenance and any overlapping backup/prune or migration window.

## Approved production procedure

Use the canonical tool services after named authorisation. This is preparation guidance, not a record of production execution.

```sh
cd /var/www/scalesmiths/ScaleSmiths
docker compose -f docker-compose.host-nginx.yml --profile tools run --rm postgres-provision
docker compose -f docker-compose.host-nginx.yml --profile tools run --rm database-migrate
docker compose -f docker-compose.host-nginx.yml --profile tools run --rm postgres-provision
```

Check migration checksums, both journal prefixes and grant verification after migration. The shared migrator orders both histories. Separate application migration runs can miss cross-history prerequisites. Prepare the inactive slot using the canonical release manager with `--dry-run`, validate the resolved plan, and repeat without that flag after approval. Confirm both prepared images and loopback endpoints before the named operator switches traffic. Follow the practical host note only when verified against the actual service topology. [Canary and rollback procedure](../../operations/canary-release-and-rollback.md)

After the switch, verify expected release identity, both HTTPS health paths, web navigation, admin MFA and RBAC, partner route denial for the wrong identity, closed intake and activation, current migration and least-privilege checks. Inspect canonical client, prospect, invoice and Forge read paths. Reconcile existing commercial collections, commission and payout aggregates using approved read-only access. Avoid synthetic registrations, invitations, ledger writes and transfers on production. Keep the previous slot and recovery point through the observation window.

## Rollback and incident handling

First close intake, activation and executable retention. Pause affected financial operations through the incident process and revoke affected identities if needed. Record the latest collected-payment and payout reconciliation point before further writes. Preserve ledger, payout, audit and both migration histories. Use the approved compatible previous-slot rollback only after checking that its financial readers interpret new records safely. If new financial records cannot be interpreted by the previous application, hold mutations and fix forward. Restore only under separately approved incident recovery that accounts for writes after the recovery point. Record release ID, operator, reason, observed incident, rollback decision and follow-up check owners.
