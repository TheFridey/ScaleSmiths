# Project Aegis: controlled release runbook

The release has two separate gates. **Gate A** ships dormant code. **Gate B** turns on partner features. Passing Gate A authorises nothing in Gate B.

Nothing here has been run against production. The PM2 sequence below was rehearsed on a disposable PostgreSQL 14.25 stack (`docs/expansion/empower/evidence/b1-7/deployment-rehearsal-pg14.txt`):

1. previous release `37995d2` running;
2. encrypted backup taken;
3. forward migrations applied;
4. cut over to the candidate;
5. code rolled back onto the migrated schema;
6. pre-migration backup restored into an isolated database.

Paths and process names below come from [PM2 host deploy](pm2-host-deploy.md), which records what production runs today. Before relying on them, confirm them against the host with the [audit](AEGIS-PRODUCTION-READINESS-AUDIT.md) section 7 commands.

## Gate A: dormant code deployment

### A0. Preconditions (all must be met; none is engineering's to grant)

| Requirement | Evidence | State on 22 November 2026 |
|---|---|---|
| Human review of the release PR(s) | GitHub review | Pending (#163; #164 for Forge) |
| Final CI green on the exact SHA to deploy | PR checks | Green at `964eb2c` (#163); re-run on the final head |
| Production-version database rehearsal | Upgrade rehearsal from `37995d2` on PostgreSQL 14.25 | Done (rehearsal evidence) |
| Backup verified **on the VPS**, with an off-host copy | Operator evidence | NOT VERIFIED; off-host BLOCKED (`AP-AEGIS-BAK-01`) |
| Restore path verified | Isolated restore with role re-provisioning | Rehearsed off-host; a production-bundle drill is pending (`AP-AEGIS-BAK-02`) |
| Migration sequence verified | admin 0095, 0096, 0097; web 0024 | Done (journals and rehearsal) |
| Rollback path verified | Code rollback onto the migrated schema | Rehearsed |
| Infrastructure health | Audit section 7 | Partly observed; host NOT VERIFIED |
| Explicit deployment approval for the exact SHA | Founder record (`AP-AEGIS-REL-01`) | Pending |

Every `PARTNER_*` and `EMPOWER_*` switch stays **unset**. There is no public application intake, no invitations and no content publication.

### A1. Before

```bash
CANONICAL_CHECKOUT=/var/www/scalesmiths/ScaleSmiths
SHA=<approved full SHA>                     # the exact SHA from the approval record
PREV=$(curl -s https://scalesmiths.co.uk/api/health | jq -r .release)   # record it; 37995d2 on 22 Nov 2026
RELEASE_TREE="$(dirname "$CANONICAL_CHECKOUT")/releases/$SHA"
```

1. Confirm that no partner switch is set in the running processes. Print variable **names** only:

   ```bash
   pm2 env <admin id> | grep -oE '^(PARTNER|EMPOWER)_[A-Z_]+_ENABLED='
   ```

   Expect no output.
2. Take a fresh encrypted backup: `scripts/backup/create-backup-bundle.sh` with the host's `/etc/scalesmiths/backup.env`, then `validate-backup-bundle.sh`. Record the bundle ID and its checksum. **Do not continue without a validated bundle.**

### A2. Build the immutable release

Follow [PM2 host deploy](pm2-host-deploy.md), "Prepare a release tree": rsync the detached `$SHA` checkout into `$RELEASE_TREE` (excluding `.env`, `node_modules`, `.next` and `generated-sites`), copy the protected `.env`, then run `npm ci` and `npm run build` for `web/` and `admin/`. Keep `$PREV`'s tree on disk.

### A3. Migrate (forward only)

From the repository root of `$RELEASE_TREE`, with the production migration and provisioning URLs:

```bash
node admin/scripts/provision-postgres-roles.mjs --confirm-provision
npm run db:migrate                      # applies admin 0095-0097 and web 0024 only
node admin/scripts/provision-postgres-roles.mjs --confirm-provision
node admin/scripts/verify-postgres-privileges.mjs
```

Expected result: admin 98 and web 25 journal entries, and privileges verified. **Never reverse a migration.** If migration fails, stop: the old release is still serving. Follow the restore path, which is an incident-lead decision.

### A4. Cut over

Delete and recreate `scalesmiths-web-canary` and `scalesmiths-admin-canary` with `cwd` set to `$RELEASE_TREE/{web,admin}` and `SS_RELEASE_ID=$SHA`, on the ports currently in use (3200/3201 per the deploy notes). Then run `pm2 save`.

### A5. Smoke tests (all must pass; this was the rehearsed list)

| Check | Expected |
|---|---|
| `https://scalesmiths.co.uk/api/health` | `status ok`, `database ok`, `release = $SHA` |
| Admin health with the token, on the loopback port | `status ok`, `release = $SHA` |
| `/`, `/pricing`, `/services`, `/partners`, `/contact`, `/sitemap.xml`, `/robots.txt` | 200 |
| An unknown path | 404 |
| `https://partners.scalesmiths.co.uk/login` | 200; `/partner` redirects to `/login` |
| Anonymous `GET /api/partner/workspace?view=today`, `/api/partner/agreement`, `/api/expansion`, `/api/forge/projects` | 401 |
| Founder sign-in with MFA | Succeeds; the Expansion overview loads |
| Partner modules | `/partner/guidance`, `/partner/objections`, `/partner/academy`, `/partner/resources` and `/partner/knowledge` all 404 (switches off) |
| Logs, first 30 minutes | No new errors in `pm2 logs`; no 5xx at the Cloudflare edge |

### A6. Rollback triggers and procedure

**Triggers:** any smoke-test failure, a health check failing, a 5xx rate above the pre-release baseline, or an authentication failure.

**Decision-maker:** the founder on call.

1. Recreate both PM2 apps on `$PREV`'s tree and its `SS_RELEASE_ID`, on the same ports, then `pm2 save`.
2. The schema stays migrated: the rehearsal showed `37995d2` runs healthily on it. No schema rollback is needed for a code problem.
3. Restore the database **only** if data is wrong. Use the A1 bundle, restore into an isolated database first, re-provision roles, and promote only by incident-lead decision. Follow [Production backup and restore](backup-and-restore.md).
4. Re-run A5 against `$PREV`, then record the incident following [Partner programme incidents](partner-programme-incidents.md).

### A7. Monitoring after Gate A

- Watch health and logs at 1 hour and 24 hours.
- Error monitoring is disabled in production today (audit finding P3). Until it is enabled, check `pm2 logs` manually.

## Gate B: partner programme activation

These are separate decisions, taken one wave at a time. Each switch is set in the protected host environment, followed by a PM2 recreate. Turning a switch off reverses it.

| Requirement | Decision or evidence | State |
|---|---|---|
| Approved commercial terms | `AP-COM-03`, `AP-LR-02` | Pending |
| Approved partner agreement, converted text confirmed by the solicitor, published | [Agreement review](../expansion/empower/AEGIS-AGREEMENT-INTEGRATION-REVIEW.md); `AP-LR-01` | Pending (documents not yet supplied) |
| Approved privacy documentation and retention | `AP-PRIV-01` to 04, `AP-AEGIS-PRIV-05` to 08 | Pending |
| Email ready, or an approved alternative | Resend DNS and keys (audit P4), `AP-LR-03`, `AP-LR-04`. The manual invitation link is the alternative | Pending |
| Approved operating markets | Market records | GB only, under review |
| Founder-reviewed content per module | Approval register sections C to F | Nothing published |
| Support procedures | [Partner programme incidents](partner-programme-incidents.md) | Written, not exercised |
| `admin.` origin fixed | Audit P1, `AP-LR-05` | Pending |
| Production smoke tests per wave | A5, plus the wave's module | Per wave |
| Controlled pilot approval | Named partners, `AP-AEGIS-UNI-01` | Pending |

**Waves:**

1. `EMPOWER_FOUNDER_CONTENT_ENABLED`, so founders can draft content and the agreement.
2. `PARTNER_ACTIVATION_ENABLED` and `PARTNER_UNIFIED_WORKSPACE_ENABLED`, for **named, approved pilot partners only**.
3. One module at a time, each only when it has approved, published, in-date content.
4. `PARTNER_EMAIL_ENABLED` and wider applications.

After each wave, the Gate A smoke tests and that wave's own checks must pass before the next wave is considered.
