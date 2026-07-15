# Canary release and rollback

Run every repository-relative command in this runbook from `/var/www/scalesmiths/ScaleSmiths`, the authoritative production checkout.

This runbook keeps the supported VPS topology: Dockerized `web` and `admin`, the existing PostgreSQL service and generated-sites bind mount, and host Nginx terminating TLS. It adds two loopback application slots:

| Slot | Web | Admin |
| --- | ---: | ---: |
| blue | 3100 | 3101 |
| green | 3200 | 3201 |

Only Nginx's small upstream include changes during a release. The release manager never deploys production by itself; an authorised operator must run `prepare`, inspect the result, and separately run `switch`.

Before preparing a generated client site, confirm its selected Forge deployment candidate has current dependency-admission evidence and a generated-site SPDX SBOM bound to the same workspace and lockfile hashes. This is a server-enforced gate and cannot be replaced with a manual checkbox or routine owner override.

## One-time setup

1. Create and validate the complete encrypted recovery bundle from [Production backup and restore](backup-and-restore.md), confirm its off-host marker, and ensure recent isolated restore evidence exists.
2. Install [scalesmiths-upstreams.conf](../../nginx/scalesmiths-upstreams.conf) as `/etc/nginx/scalesmiths/upstreams.conf`.
3. Install the reviewed `host-scalesmiths.conf`, then run `sudo nginx -t && sudo systemctl reload nginx`.
4. Ensure the existing production Docker network name is known (`docker network ls`). Set it as `SS_PRODUCTION_NETWORK`; a typical Compose-created name is `ss_ss-net`, but it must be verified on the host.
5. Export server-only operational values:

   ```bash
   export SS_ENV_FILE=/var/www/scalesmiths/ScaleSmiths/.env
   export SS_GENERATED_SITES_DIR=/var/www/scalesmiths/ScaleSmiths/generated-sites
   export SS_PRODUCTION_NETWORK=verified-network-name
   export ADMIN_HEALTH_CHECK_TOKEN='existing-32-character-or-longer-token'
   export SS_PUBLIC_HEALTH_URL=https://scalesmiths.co.uk/api/health
   ```

6. Adopt the currently working blue services so the first canary preserves a rollback target:

   ```bash
   sudo -E node scripts/release-manager.mjs adopt \
     --release legacy-blue-20260713 \
     --slot blue \
     --actor owner@example.com \
     --notes "Working production version before blue-green releases"
   ```

The adoption operation checks both loopback health endpoints. It does not rebuild, restart, or switch traffic.

## Prepare a canary

Use a unique release identifier, preferably the Git commit SHA or signed release tag. Start with dry-run output:

```bash
sudo -E node scripts/release-manager.mjs prepare \
  --release 2026-07-13-abcdef1 \
  --slot green \
  --actor developer@example.com \
  --notes "Release candidate approved in Forge" \
  --dry-run
```

Then run the same command without `--dry-run`. Preparation fails closed if Compose validation, either version-tagged Docker build, container startup, or either health check fails. A release becomes switchable only after both health responses report the expected release identifier. Partially built or unhealthy releases remain recorded as `preparing` and cannot be switched.

Before preparing production, complete the immutable Forge deployment-candidate and release gates. Review migration compatibility separately. Database migrations must be backward-compatible with the retained previous application version; create an encrypted recovery bundle and run the existing `web-migrate` and `admin-migrate` tools manually only after review. The release manager intentionally does not run migrations or restore backups.

## Manual traffic switch

Review the canary containers and logs first:

```bash
docker compose -p scalesmiths-2026-07-13-abcdef1 -f docker-compose.release.yml logs --tail=200 web admin
sudo -E node scripts/release-manager.mjs status
```

Switch only after approval:

```bash
sudo -E node scripts/release-manager.mjs switch \
  --release 2026-07-13-abcdef1 \
  --actor owner@example.com
```

The switch sequence is:

1. Recheck both inactive containers.
2. Write a complete candidate upstream file.
3. Atomically rename it over the active include.
4. Run `nginx -t`.
5. Reload Nginx only if validation succeeds.
6. Restore the previous include if validation or reload fails.
7. Persist active and previous release IDs atomically.
8. Recheck active services and the configured public health URL.
9. Append an actor/timestamp/notes record to `/var/lib/scalesmiths-release/deployments.jsonl`.

The former containers remain running and their version-tagged images and release record are retained.

## Fast rollback

Rollback also validates the retained target before changing traffic:

```bash
sudo -E node scripts/release-manager.mjs rollback --actor owner@example.com
```

This switches to `previousReleaseId`, tests Nginx before reload, verifies health afterwards, reverses active/previous pointers, and appends a rollback log. If a database migration is not backward-compatible, application rollback alone is unsafe; follow the reviewed database restoration plan from the deployment candidate.

### Rollback checklist

- [ ] Declare the incident/release failure, identify the actor and freeze further switches and migrations.
- [ ] Record active/previous release IDs, image digests, upstream include, database migration state and relevant logs.
- [ ] Confirm the retained previous web and admin health endpoints are healthy before switching.
- [ ] Confirm the previous applications are compatible with the current database. If not, stop and restore an isolated backup first; never improvise a down migration in production.
- [ ] Run `rollback` and retain its deployment-log entry; do not edit the Nginx upstream file manually unless the release manager itself is unavailable.
- [ ] Verify Nginx, public routes, admin login/MFA, portal scoping, quote flow and Forge read-only views.
- [ ] Confirm monitoring release metadata and error rates have returned to the expected approved commit SHA.
- [ ] Preserve the failed containers, workspace hashes and bounded logs until incident evidence is captured.
- [ ] Follow [Production incident response](incident-response.md) and document the decision to resume or abandon the release.

## Post-release verification

- Confirm public and admin HTTPS routes.
- Exercise login, public experience choice, quote submission and critical Forge views.
- Inspect `docker compose ... logs` and host Nginx logs.
- Confirm health metadata matches the release slot ID and monitoring metadata matches the separately approved full commit SHA.
- Confirm migrations and background jobs are healthy.
- Keep the previous slot until the observation window closes.

Old images and records are deliberately not pruned automatically. After the retention period, remove releases manually only after confirming they are neither `activeReleaseId` nor `previousReleaseId` and that backups exist.

## Local and CI simulation

`npm run test:release-simulation` uses temporary directories and fake Docker, curl, Nginx and systemd commands. It verifies fail-closed preparation, incomplete-release rejection, atomic switching, Nginx failure restoration, previous-version retention, rollback and mutation-free dry runs. It never contacts production or Docker and runs in the root CI hygiene job.
