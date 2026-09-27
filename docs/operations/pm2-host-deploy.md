# PM2 host deploy (current VPS operator path)

> **Status:** descriptive operator notes for the host that currently serves production via PM2 canary processes.
> **Not a topology ADR.** Docker Compose + `scripts/release-manager.mjs` remains the documented long-term / canonical release path in architecture docs and ADRs. Do not treat this file as permission to delete or weaken that path.
>
> Entry point for release policy remains the [Production release runbook](release-runbook.md). Use this document only when operators confirm Nginx is already proxying the PM2 canary ports on this host.

## Why this exists

On the current production VPS, live web/admin traffic has been observed coming from PM2 processes named `scalesmiths-web-canary` and `scalesmiths-admin-canary`, not from Docker release-manager slots. Those processes bind loopback ports **3200** (web) and **3201** (admin) and run from immutable SHA trees under a sibling `releases/<sha>/` directory next to the canonical checkout `/var/www/scalesmiths/ScaleSmiths`.

The Git working tree at `/var/www/scalesmiths/ScaleSmiths` is the sync/source checkout. Restarting PM2 against that checkout alone does **not** change what Nginx serves if the process `cwd` still points at a previous `releases/<sha>/` tree.

Health metadata (`GET /api/health` → `release`) reads `SS_RELEASE_ID` (then `ERROR_MONITORING_RELEASE`) from the **running process environment**. It is not inferred from `git rev-parse` at request time.

## Preconditions

1. Named human approval for the exact full Git SHA.
2. Confirm this host is still on the PM2 canary path (`pm2 show scalesmiths-web-canary`, Nginx upstream include). If Docker release-manager is active instead, stop and follow [Canary release and rollback](canary-release-and-rollback.md).
3. Record the currently live release SHA from public health before changing anything.
4. Apply shared migrations through the repository root when the candidate includes new journals (`npm run db:migrate` / host tool services as in the [release runbook](release-runbook.md)). Do not invent down migrations.
5. Keep the previous `releases/<sha>/` tree on disk until smoke verification passes.

## Path variables (topology-safe)

Use these variables so operators do not hard-code non-canonical host paths in ad-hoc notes:

```bash
CANONICAL_CHECKOUT=/var/www/scalesmiths/ScaleSmiths
SHA=<full-40-char-git-sha>
RELEASE_TREE="$(dirname "$CANONICAL_CHECKOUT")/releases/$SHA"
```

`$RELEASE_TREE` resolves to the sibling release directory of the canonical checkout (layout: `…/ScaleSmiths` and `…/releases/<sha>/`).

## Prepare a release tree

Sync the approved checkout into a new immutable release directory (exclude build artefacts, secrets, and generated sites):

```bash
cd "$CANONICAL_CHECKOUT"
git fetch origin
git checkout --detach "$SHA"

rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .env \
  --exclude generated-sites \
  "$CANONICAL_CHECKOUT"/ "$RELEASE_TREE"/

# Reuse the protected host env; do not rsync secrets from laptops.
cp -a "$CANONICAL_CHECKOUT/.env" "$RELEASE_TREE/.env"

cd "$RELEASE_TREE/web" && npm ci && npm run build
cd "$RELEASE_TREE/admin" && npm ci && npm run build
```

Confirm both apps produced `.next` output before touching PM2.

## Cut over PM2 (one-line starts)

`pm2 restart` against an old `cwd` will not pick up a new tree or a new `SS_RELEASE_ID`. Delete and recreate so both `cwd` and env change. Prefer single-line starts (no shell line-continuations that operators paste incompletely):

```bash
pm2 delete scalesmiths-web-canary
pm2 start bash --name scalesmiths-web-canary --cwd "$RELEASE_TREE/web" -- -lc "export SS_RELEASE_ID=$SHA; exec node --env-file-if-exists=../.env ./node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3200"

pm2 delete scalesmiths-admin-canary
pm2 start bash --name scalesmiths-admin-canary --cwd "$RELEASE_TREE/admin" -- -lc "export SS_RELEASE_ID=$SHA; exec node --env-file-if-exists=../.env ./node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3201"

pm2 save
```

If discovery shows different loopback ports, use those ports instead of 3200/3201 — do not guess against Nginx.

## Verify

```bash
curl -sS http://127.0.0.1:3200/api/health
curl -sS https://scalesmiths.co.uk/api/health
pm2 show scalesmiths-web-canary
pm2 show scalesmiths-admin-canary
```

Expect `release` to equal `$SHA`. Spot-check public routes from the [release runbook](release-runbook.md) smoke list.

## Rollback

Keep the previous SHA tree on disk. Recreate both PM2 apps with `cwd` and `SS_RELEASE_ID` pointed at the previous tree and the same ports, then `pm2 save` and re-check health.

Application rollback alone is unsafe if a forward migration is not backward-compatible with the previous app; follow the backup/restore path in that case.

## Relationship to Docker release-manager

| Concern | This host (today) | Canonical / long-term docs |
| --- | --- | --- |
| Serving process | PM2 `scalesmiths-*-canary` | Docker Compose release slots |
| App ports observed | 3200 / 3201 loopback | blue 3100/3101, green 3200/3201 via release-manager |
| Release identity | `SS_RELEASE_ID` in PM2 start env | `SS_RELEASE_ID` set by release-manager |
| Traffic switch | Recreate PM2 cwd/env (Nginx already on canary ports) | Atomic Nginx upstream include via release-manager |
| Policy source | This ops note + [release runbook](release-runbook.md) cross-link | ADR + [deployment topology](../architecture/deployment-topology.md) + [canary runbook](canary-release-and-rollback.md) |

Migrating this host fully onto Docker release-manager is a separate, approved operations change. Until that happens, documenting the PM2 recipe reduces failed “restart the wrong process” incidents without rewriting topology policy.
