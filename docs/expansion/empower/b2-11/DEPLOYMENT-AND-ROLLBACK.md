# B2.11 deployment and rollback

Production runs PM2 release pairs, not the Docker release manager. Each release is a self-contained tree under `/var/www/scalesmiths/ScaleSmiths/../releases/<sha>`.

## Build a release (self-contained)

1. In the canonical checkout, run `git fetch` and confirm `<sha>` is the merged commit on `master`.
2. Create the release tree: `git archive <sha> | tar -x -C /var/www/scalesmiths/ScaleSmiths/../releases/<sha>`.
3. Replace `generated-sites` with a symlink to the canonical one. This is the **only** permitted symlink.
4. Copy `.env` from the live release.
5. Run `npm run check:release-env-drift` and confirm it reports `identical`.
6. Run `npm ci` **inside** `admin/` and `web/`. Never symlink or copy `node_modules`, and never copy `.next` from another release.
7. Run `node scripts/check-release-tree.mjs /var/www/scalesmiths/ScaleSmiths/../releases/<sha>`. It must exit 0. If it fails, delete the reported directories and repeat step 6.
8. Build each app with `node --env-file=../.env ./node_modules/next/dist/bin/next build`.

Step 7 exists because, on 25 Nov 2026, a tree with a symlinked `admin/node_modules` and a borrowed webpack cache failed "Collecting page data" for `/api/ascend/v1/operations/[id]/cancel`.

## Cut over

1. Take a fresh backup into `/var/backups/scalesmiths/pre-b211-<ts>-<sha>/`, with `SHA256SUMS`. Verify it with `sha256sum -c`.
2. Start the new pair on free ports (the next pair after 3400/3401), with `SS_RELEASE_ID=<sha>`.
3. Health-check on loopback: login 200, `/partner/agreement` 307 when signed out, and the web home page 200.
4. Back up the three `sites-available/scalesmiths*` files. Point `proxy_pass` at the new ports, then run `nginx -t && systemctl reload nginx`.
5. Purge Cloudflare only if a changed asset kept its old URL. Next's content-hashed `/_next/static` names change with content, so a normal deploy needs no purge. The 25 Nov purge was needed only because the compiled CSS was edited in place.

## Rollback

1. Point nginx back at the previous pair's ports (kept online), then run `nginx -t && systemctl reload nginx`.
2. To roll back env switches, restore the matching `env-before-*` snapshot and restart the admin process.
3. B2.11 adds no migrations.
