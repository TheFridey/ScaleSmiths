# ASCEND operator runbook (B2.9)

For founders and the operator on the production VPS. Read with [ASCEND-SECURITY-MODEL.md](ASCEND-SECURITY-MODEL.md) and the
general [PM2 host deployment guide](../../operations/pm2-host-deploy.md). Every step that changes production needs a
founder's explicit go-ahead; steps marked **Founder** need an interactive founder session (password and MFA) and cannot be
done by an agent or by writing to the database.

## 1. Current production state (verified read-only, 24 November 2026)

Release `f55a6bc` on PM2 `scalesmiths-web-b257` (:3300) and `scalesmiths-admin-b257` (:3301). Engine on, scheduler and
agent API off, global emergency stop engaged, all five automations disabled, no identities, workers or executions.
Megaton worker stopped. Evidence: [production-reconciliation.md](evidence/b2-9/production-reconciliation.md).

## 2. Routine checks

```bash
# On the VPS. RELEASE_DIR is the live release directory (see the reconciliation evidence). Prints names and verdicts only.
node "$RELEASE_DIR/scripts/check-release-env-drift.mjs" /var/www/scalesmiths/ScaleSmiths/.env "$RELEASE_DIR/.env"
node "$RELEASE_DIR/ops/ascend/worker-preflight.mjs" "$RELEASE_DIR/.env" 3301   # Megaton only
curl -s https://scalesmiths.co.uk/api/health          # release and database
pm2 ls                                                # b257 online, megaton-worker stopped
```

In the command centre (`/expansion/automation/engine`): the global control shows **Suspended**, every automation shows
**Disabled**, the Workers panel shows no stale worker, and the dead-letter and reconciliation counts are zero.

## 3. Supervised first execution (`ops.queue_health`)

`ops.queue_health` is the right first candidate: it is `writes: "none"`, runs in a database-enforced READ ONLY transaction
with a 30 s statement timeout, reads only aggregate counts from `ascend_executions`, `ascend_review_jobs` and
`ascend_workers`, and its only write is the engine's own bookkeeping (the result, status and events on its execution row).
The full sequence was exercised on disposable PostgreSQL (scenarios A, K, L, O in the integration suite); it has **not**
been run in production.

Prerequisite: the B2.9 release is deployed (section 6), because B2.8 workers ignore their action assignment (defect D1).

| # | Who | Step | Expected evidence |
|---|---|---|---|
| 1 | Operator | Confirm section 2: stop engaged, all disabled | Global **Suspended**; five **Disabled** |
| 2 | **Founder** | Workers & identities → Create identity: name `ascend-worker-1`, kind Worker, tick **only** *Operational health assessment* | Token shown once; identity lists "may execute: Operational health assessment" |
| 3 | Operator | Store the token in a root-only file, never in the shared `.env`: `install -m 600 /dev/null /etc/scalesmiths/ascend-worker.env` then add `ASCEND_WORKER_TOKEN=…`, `ASCEND_WORKER_URL=http://127.0.0.1:3301/api/ascend/worker`, `ASCEND_WORKER_ID=vps-ascend-1`, `ASCEND_WORKER_CONCURRENCY=1` | `stat -c %a` shows `600` |
| 4 | Operator | Smoke test one tick: `cd "$RELEASE_DIR" && node --env-file=/etc/scalesmiths/ascend-worker.env ops/ascend/ascend-worker.mjs --once` | Exit 0; nothing claimed (stop engaged); worker appears in the Workers panel |
| 5 | **Founder** | Automations → `ops.queue_health`: keep *Founder approval required*, concurrency 1, no interval, markets `GB`; then **Enable** | Policy version unchanged by enable alone |
| 6 | **Founder** | Request one run of `ops.queue_health` | Status **Awaiting approval** |
| 7 | Operator | `--once` tick again | Nothing claimed: approval pending and stop engaged |
| 8 | **Founder** | Approve the run (the dialog shows the payload digest) | Status **Queued** |
| 9 | Operator | `--once` tick again | Still nothing claimed: emergency stop engaged (proves the stop holds) |
| 10 | **Founder** | Release the global stop with a reason ("Supervised first execution, B2.9") | Control event `resumed global` |
| 11 | Operator | `--once` tick exactly once | Worker log `<id> -> completed` |
| 12 | **Founder** | Open the execution | Timeline `created, approved, queued, claimed, started, completed`; result source `ascend_executions, ascend_review_jobs, ascend_workers (engine-wide aggregate)` |
| 13 | **Founder** | Re-engage the global stop | Control event `suspended global` |
| 14 | **Founder** | Disable `ops.queue_health` | **Disabled** |
| 15 | Operator | No PM2 worker was started; confirm `pm2 ls` has no `scalesmiths-ascend-worker` | — |
| 16 | **Founder** | Revoke `ascend-worker-1` (or keep it for the next supervised run; it can execute only `ops.queue_health`) | `--once` now exits with HTTP 403 |

Record step 12's screenshot, the execution id and the control-event ids in `docs/expansion/ascend/evidence/b2-9/` as
production evidence. Run the drift check afterwards and confirm no business table counts changed (section 1 of the reconciliation).

## 4. Megaton containment (do not start)

The read-only preflight run on 24 November **blocks** the Megaton worker on two counts
([evidence](evidence/b2-9/megaton-preflight-production.txt)): its worker URL does not target the live admin port 3301
(it targets a retired canary port), and **review notifications are active** (`MEGATON_NOTIFICATIONS_ENABLED`,
`MEGATON_ENABLED`, `MEGATON_EXTERNAL_ENABLED`, `MEGATON_STOP=false`), which would send external messages independently of
every send switch. Mailbox sync and queued-job processing would also run. PM2 records 2,878,404 restarts and
`autorestart=true` on release `6dcfeff`, so `pm2 resurrect` or `pm2 restart all` would start it on a stale release.

Remediation plan for a separately authorised Megaton rollout:

1. Now, with approval: `pm2 delete scalesmiths-megaton-worker && pm2 save`, so no bulk PM2 command can start it.
2. Decide each effect: set `MEGATON_NOTIFICATIONS_ENABLED=false` (or `MEGATON_STOP=true`) until review notifications are
   wanted; leave every send switch off; keep `MEGATON_MESSAGE_RETENTION_DAYS=0`.
3. Point `MEGATON_WORKER_URL` at `http://127.0.0.1:3301/api/megaton/worker`; re-issue the worker session binding
   (`MEGATON_WORKER_ADMIN_ID`, `MEGATON_WORKER_SESSION_VERSION`, token and digest) from the current release.
4. Re-run the preflight until it passes with only the effects listed in `MEGATON_PREFLIGHT_AUTHORISED_EFFECTS`.
5. Start once with a one-shot invocation, observe, then register under PM2 from the **current** release with a restart
   delay and `max_restarts`, never `autorestart` without a cap.

## 5. Recommended production hardening (needs founder approval)

1. **Fix configuration drift.** Copy the eight governed switches reported by the drift check from the live release `.env`
   into the canonical `.env` (values as listed in the reconciliation), then re-run the check until it reports no drift.
   Make the check a release gate: refuse to cut a release while it fails.
2. **Close machine routes on the public hosts.** In `/etc/nginx/sites-enabled/scalesmiths-partners` and `scalesmiths-admin`,
   inside each TLS `server` block, before `location /`:
   ```nginx
   location ^~ /api/ascend/worker { return 404; }
   location ^~ /api/megaton/worker { return 404; }
   ```
   The workers call 127.0.0.1:3301 directly and are unaffected. Leave `/api/ascend/v1/` reachable only when the agent API
   is authorised. Validate with `nginx -t`, reload, and confirm public `POST /api/ascend/worker` returns 404 while
   `curl -X POST http://127.0.0.1:3301/api/ascend/worker` still returns 401.
3. **Retire the stale canaries** `scalesmiths-web-canary` and `scalesmiths-admin-canary` (release `e48967b`, :3200/:3201,
   not routed, pre-0104 code against the migrated database): `pm2 delete …; pm2 save`.
4. **Move the canonical checkout to master** (`git switch master && git pull --ff-only`) after confirming its two untracked
   npm artefacts are disposable; its four VPS-only commits are already in master.
5. **Process limits.** Every PM2 process runs as root with no memory cap. Add `max_memory_restart` (for example 1G per app)
   and, at the next host maintenance, a dedicated unprivileged service user that can read only its release and env file.

## 6. Deploying the B2.9 release

Migration impact: **none** (no new migration; journal stays web 25/25, admin 105/105). Behaviour changes on deploy:
existing worker identities claim only their assigned automations (production has none); analysis handlers become
market-scoped and read-only-enforced; submissions per automation serialise.

1. Fresh verified backup (`pg_dump -Fc` with the provisioning URL; `sha256sum`), as for B2.9 cutover.
2. Build both apps from the release SHA with `node --env-file=../.env …/next build`, using a release `.env` that passes the
   drift check against the canonical file **after** section 5.1.
3. Start the new release on the alternate ports, health-check, switch nginx, keep `f55a6bc` for rollback.
4. Confirm: health shows the new SHA; `/scale-your-future` → `/partners`; partner login renders; invalid application → 400;
   public worker route 401 (or 404 after 5.2); command centre stop still engaged.
5. Rollback: switch nginx back to `f55a6bc`'s processes; no database step is needed because B2.9 adds no migration.
