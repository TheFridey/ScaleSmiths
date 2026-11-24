# B2.9 production reconciliation (read-only), 24 November 2026

**Classification: production evidence, read-only.** Collected over `ssh scalesmiths` between 13:32Z and 14:20Z. No process,
file, database row or configuration was changed. Environment values were never printed except the named non-secret
feature switches below; secrets were compared by presence only. `$RELEASES` denotes the `releases` directory that sits
beside the canonical checkout `/var/www/scalesmiths/ScaleSmiths` on the VPS.

## Release identity

| Item | Observed | Matches mandate baseline |
|---|---|---|
| `origin/master` | `f55a6bc9ee71b185f306cae81c7ad4c138d664bc` (merge of #176) | yes |
| Live release directory | `$RELEASES/f55a6bc9…` (newest of five retained) | yes |
| Previous release retained | `07521b12…` | yes |
| Public `/api/health` | `status ok`, `database ok`, `release f55a6bc9…` | yes |
| PRs #174, #176, #177 | all **merged** at 2026-11-24T11:31Z; each PR's head commit is an ancestor of master | discrepancy: the mandate called #174/#177 "superseded" and to be closed; they are already merged, so nothing is left to close or re-merge |

## Discrepancies found

1. **Canonical checkout is behind master.** `/var/www/scalesmiths/ScaleSmiths` is on branch `chore/ascend-worker-preflight-20261123`
   at `2460de1` (four VPS-only commits `b7282d7`, `d0e153f`, `4814408`, `2460de1`). Every line it has that master lacks is an
   older version of code master superseded (the first Megaton preflight and pre-B2.8 files); master contains the
   recovered commits' content via #177. Two untracked paths (`admin/node`, `admin/scalesmiths-admin@0.1.0`) are stray
   npm artefacts. **Nothing in the checkout is unrecovered work.** Moving it to master is a production change left for a founder.
2. **Configuration drift (release blocker for future deploys).** `scripts/check-release-env-drift.mjs` (new in B2.9) run
   against the two files: 8 governed switches exist in the live release `.env` but are **missing from the canonical
   `.env`**: `PARTNER_APPLICATIONS_ENABLED`, `PARTNER_APPLICATION_PRIVACY_VERSION`, `PARTNER_APPLICATION_RETENTION_DAYS`,
   `PARTNER_RETENTION_EXECUTION_ENABLED`, `EMPOWER_FOUNDER_CONTENT_ENABLED`, `ASCEND_ENGINE_ENABLED`, `ASCEND_SCHEDULER_ENABLED`,
   `ASCEND_AGENT_API_ENABLED`. A release prepared from the canonical file would switch public recruitment off. All Megaton
   switches are identical in both files.
3. **Stale canary processes still online.** PM2 `scalesmiths-web-canary` and `scalesmiths-admin-canary` run release
   `e48967b` on 127.0.0.1:3200/3201. Nginx does not route to them, but they hold database connections and run code older
   than migration 0104 against the migrated database.
4. **Machine routes are reachable from the public hosts.** Nginx proxies every path of `partners.` and `admin.scalesmiths.co.uk`
   to :3301, including `/api/ascend/worker` and `/api/megaton/worker`. Both authenticate (observed: worker 401,
   capabilities 404), but the worker is designed to use loopback only, so public exposure is unnecessary attack surface.
5. **Megaton worker crash history.** `scalesmiths-megaton-worker` is `stopped`, `autorestart=true`, cwd release `6dcfeff`,
   with **2,878,404 recorded restarts**. If anyone runs `pm2 restart all` or `pm2 resurrect`, it starts on a stale release.
6. **The live b257 processes carry no `SS_RELEASE_ID`** in their PM2 environment; health reports the release from the
   build. Harmless, but the PM2 listing cannot be used to confirm release identity.

## Live switches (non-secret values)

Live release `.env`: `PARTNER_APPLICATIONS_ENABLED=true`, `PARTNER_APPLICATION_PRIVACY_VERSION=applicant-2026-11-24-v1`,
`PARTNER_APPLICATION_RETENTION_DAYS=180`, `PARTNER_RETENTION_EXECUTION_ENABLED=false`, `EMPOWER_FOUNDER_CONTENT_ENABLED=true`,
`ASCEND_ENGINE_ENABLED=true`, `ASCEND_SCHEDULER_ENABLED=false`, `ASCEND_AGENT_API_ENABLED=false`, `ASCEND_AUTOMATION_ENABLED` unset.
Megaton: `MEGATON_ENABLED=true`, `MEGATON_STOP=false`, `MEGATON_EXTERNAL_ENABLED=true`, `MEGATON_NOTIFICATIONS_ENABLED=true`,
all send switches `false`, `MEGATON_MESSAGE_RETENTION_DAYS=0`. Both `.env` files: mode `600 root:root`, regular files.

## Processes and routing

| PM2 process | Status | Restarts | Release | Port |
|---|---|---|---|---|
| scalesmiths-web-b257 | online | 0 | f55a6bc | 3300 (nginx `scalesmiths.co.uk`) |
| scalesmiths-admin-b257 | online | 0 | f55a6bc | 3301 (nginx `admin.` and `partners.`) |
| scalesmiths-web-canary | online | 0 | e48967b | 3200 (not routed) |
| scalesmiths-admin-canary | online | 0 | e48967b | 3201 (not routed) |
| scalesmiths-megaton-worker | stopped | 2,878,404 | 6dcfeff | n/a |

All processes run as `root`; no `max_memory_restart` is set on any of them.

## Database (admin runtime role, inside `BEGIN READ ONLY`)

PostgreSQL 14.24. Global emergency stop **engaged** (version 1, set 13:06:08Z). Five definitions installed, **all disabled**,
all `requires_approval=true`, `max_concurrency=1`, no interval, market scope `GB`, policy version 1. Executions 0, events 0,
service identities 0, workers 0, control events 0, review jobs 0. Business tables: partner applications 2, partners 1,
opportunities 0, commission ledger 0, payouts 0, agreement acceptances 0. The admin role cannot read the drizzle migration
journal (42501), which is expected; the journal was verified at deployment (web 25/25, admin 105/105).

## Public journey probes

`/scale-your-future` → 308 `/partners`. `partners.scalesmiths.co.uk/partner/login` → 307 `/login` (the mandate's "HTTP 200"
is the target of that redirect). Unauthenticated `POST /api/ascend/worker` → 401. `GET /api/ascend/v1/capabilities` → 404
(agent API disabled).

## Backups

`pre-b29-cutover-20261124T130607Z.dump` (1,888,032 bytes) and `pre-b29-20261124T114037Z.dump` (1,888,035 bytes): both
`sha256sum -c` **OK**; both custom-format archives from pg_dump 14.24, 2,335 TOC entries, 188 table-data entries, no
`ascend_executions` (both predate migration 0104). Files are `600`. Disk: 35 GB free of 146 GB. **No restore was run on the
production host**; see [ASCEND-DISASTER-RECOVERY.md](../../ASCEND-DISASTER-RECOVERY.md).
