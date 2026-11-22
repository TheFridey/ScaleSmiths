# Project Aegis (Operation Empower B1.7): final acceptance report

Status words are used precisely: **Implemented**, **Tested**, **Approved**, **Enabled**, **Published**, **Deployed**, **Production verified**. Everything in this report is at most *Implemented and Tested*. Nothing was approved, enabled, published, merged or deployed. Founder decisions are prepared in [B1-7-RELEASE-DECISIONS.md](B1-7-RELEASE-DECISIONS.md).

**Position: ENGINEERING COMPLETE — RELEASE BLOCKED PENDING APPROVALS** (subject to green CI on the final PR head and human review).

## 1. Starting point (verified 22 November 2026)

- `master` was `06d6b4f9969da3843aaae0a6bca2ff5d734bfee2`, confirmed on GitHub. CI, Security and CodeQL passed on it (CI run 44956796307).
- PRs #159, #160, #161 and #162 are merged:

  | PR | Merge commit |
  |---|---|
  | #159 | `089733a` |
  | #160 | `30f64d9` |
  | #161 | `d903e5e` |
  | #162 | `06d6b4f` |

- The local `master` ref in this environment was stale (`4c399b8`, PR #154). The branch was therefore created from `origin/master`, not from it.
- Branch: `feature/operation-aegis-b1-7`.
- Environment limits:
  - Graph (`entire`) is not installed, so discovery used direct source reading.
  - There is no access to the production VPS, its database or its backups.
  - The sandbox has no IPv6.
  - Docker Hub pulls are rate-limited, and Alpine's package mirror is blocked inside Docker builds.

## 2. Scope

This was integration, hardening and acceptance, not new modules. In line with the brief, nothing touched Forge, QUANT, the commission engine, migrations, Nginx, workflows or the public website code.

## 3. Implemented fixes

| Work package | Change |
|---|---|
| AEGIS-02 | Approved objection responses join unified guidance in four places: search, prospect guidance, meeting preparation and Today's recently approved list. Each result is labelled *Objection response*. They appear only under `PARTNER_OBJECTION_HANDLING_ENABLED`, with the objection workspace's own servability rule: published, within review date, partner-only. Only the founder-approved client line can be copied. The partner explanation is labelled "Partner explanation, not for clients" |
| AEGIS-02 | Plan guidance uses the rule table's `objectionCategories`, which B1.6 prepared but never read, plus a fixed meeting-type map (`MEETING_OBJECTIONS`). A test checks every category against the real vocabulary |
| AEGIS-02 | Today shows the partner's own agreement state from real records: *no agreement issued*, *awaiting acceptance*, *accepted and current*, *updated agreement awaiting acceptance*, *unavailable* (withdrawn, superseded or expired). Acceptance is never inferred from an invitation. Acceptance still happens only on the existing agreement page and route |
| AEGIS-02 | "Your next steps" uses the same state. Before, it called a first issue an "updated" agreement and offered "Read or download the agreement you accepted" when nothing had been accepted |
| AEGIS-02 | `/partner/objections?q=` deep links run the search on arrival, as the Knowledge Base already does |
| §3.3 dead navigation | The agreement page dropped the objection and guidance links. The partner sidebar never linked to objection handling or Find guidance. Both now follow the same switches as their routes |
| §3.4 visual | A link styled as a button rendered gold text on a gold fill, about 1.2:1 contrast (`.expansion a` outranked `.gd-button`). axe did not report it; screenshot inspection did. A computed-style regression assertion now guards it |
| §3.4 visual | The category chip read "Seo"; it now reads "SEO" (and similar acronyms) |
| §3.4 duplicate action | The first Today design added a second "View agreement" link beside "Your next steps". Today now offers an action only when an acceptance is due |
| AEGIS-08 | The founder "Needs your attention" queue (the existing panel, not a new dashboard) now lists three more things: applications awaiting a decision; activated partners whose current agreement is unaccepted or no longer current; partner emails that failed, or were switched on without a provider, in the last 30 days. The notification module promised founders could see and retry email outcomes, but nothing read `partner_notifications`. No address or message body is read |
| AEGIS-04 | Runbook: bundles are named `scalesmiths-backup-<id>.age` or `.gpg`, not `.tar.gz.age`. The copy-paste restore commands in two runbooks would have failed |
| AEGIS-04 | Runbook: a restored database has no grants, because the dump excludes privileges. Role re-provisioning and privilege verification are now required steps, demonstrated in the drill |
| AEGIS-03 | `scripts/rehearse-migration-upgrade.sh`: a reproducible, disposable-only upgrade rehearsal (section 7) |
| AEGIS-13 | Post-merge reconciliation of the B1.6 report and B1 status (historical evidence kept and marked historical); the release decision package; register section G; [partner incident procedures](../../operations/partner-programme-incidents.md) |

## 4–6. Problems found, resolved and remaining

**Resolved:** everything in section 3, plus four findings from the independent model review (section 24).

**Remaining, outside engineering authority:**

- No partner agreement text exists, so no clause can be verified (AP-LR-01, AP-LR-02).
- The off-host backup destination and its installation on the VPS are not verified.
- The production PostgreSQL version was not re-read.
- No production-bundle restore drill has been run.
- No screen-reader walkthrough was done.
- There was no full visual pass of every public page, and no new Lighthouse measurement: the web app is unchanged in B1.7.

**Remaining, low engineering items:**

- Plan-scoped guidance is capped and not run-scoped, so two real-PostgreSQL cases (B1.6's and B1.7's) assume a fresh disposable database, as CI provisions. Re-runs on a reused database can crowd out a run's own fixtures. This is a test-isolation limitation, not a product defect.
- `safe-outbound.test.ts` "DNS rebind to IPv6 loopback" cannot run in an IPv6-less sandbox (`EAFNOSUPPORT`). The file is untouched; CI covers it.

## 7. Migration verification

- **Sequence on `master`** (journals, not filenames): admin `0091` to `0097` in order: content foundation, Academy, partner lessons, resource search, partner agreements, partner notifications, objections. Web `0024` is the Web Vitals repair.
  - Journals hold 98 admin and 25 web entries, matching the SQL files.
  - `check:migration-history`, `check:migration-order` (123 migrations, 8 cross-history dependencies) and `check-migrations.mjs` pass.
  - B1.7 adds no migration.
- **Fresh install:** passes on PostgreSQL 14.25 and 16.16 with the repository tooling, restricted roles provisioned and `verify-postgres-privileges` passing.
- **Upgrade from the recorded production release `37995d2`** (admin 95, web 24 entries), using `scripts/rehearse-migration-upgrade.sh`:
  - That release's own tooling migrated the baseline.
  - That release's own suites populated it (117 tests).
  - Every pre-existing row was fingerprinted: 6,055 rows in 180 tables on 14, and 6,053 on 16. These included 194 commission ledger entries, 170 contracts, 211 payment events, 15 payouts, 21 withdrawal requests, 29 immutable content versions and 1,591 audit rows.
  - The current tooling then upgraded it.
  - Result: every pre-existing row is identical, admin gained +3 journal entries and web +1, and the upgraded schema dump equals a fresh install's byte for byte (SHA-256 identical, 7,051 lines).
  - The current suites then pass on each upgraded database: 142/142.
  - Evidence is in `evidence/b1-7/upgrade-rehearsal-pg14` and `-pg16`.
- **Not applicable:** historical agreement records. The deployed release predates agreements (0095), so none can exist in production yet.
- **Environment note:** this sandbox's PostgreSQL stamps every column with a random `pg_attver` attribute option, even on a plain `create table`. The harness drops exactly that line shape from schema comparisons, and says why.

## 8. PostgreSQL production-version compatibility

- B1.6 recorded production as 14.24. Re-reading it needs VPS access I do not have, so the production version is **NOT VERIFIED**.
- Rehearsals ran on 14.25, the same major version and a later patch.
- Fresh install, upgrade, the CI database suites (140 baseline, 142 with B1.7), restore and the deployment rehearsal all ran on 14.
- **PASS WITH LIMITATION.**

## 9–10. Backup and restore

- **Framework:** the repository already has a complete encrypted backup framework:
  - age or GPG encryption (encryption is mandatory);
  - rclone off-host copies;
  - checksums;
  - tamper detection;
  - isolated-restore guards;
  - systemd timers;
  - restore drills.

  B1.6's finding (local dumps only; no age, rclone or jq on the VPS) is therefore an installation and configuration gap on the host, not missing code. No second framework was written.
- **CI drill (GPG mode)** passes on PostgreSQL 14: `npm run test:backup-framework`, 6 s.
- **Age-mode drill of a full application schema** (PostgreSQL 14, which CI does not cover):
  - The bundle is unreadable without the key.
  - The checksum verifies, and a wrong key is refused.
  - The restore needs the isolated-target database comment, a safeguard that worked as designed.
  - The restore matched the source: 182 tables with identical row counts and content hash; 895 constraints, 101 triggers, 120 functions and 483 indexes; journals web 25 and admin 98; the one `NOT VALID` constraint from 0097, which is intentional.
  - Timings: backup 0.9 s, restore 4.3 s.
- **Restored database without grants:** before role re-provisioning, the restricted roles could not read the restored tables. After provisioning (2 s), privileges verify. The web role is refused `partner_agreement_acceptances` and `expansion_commission_ledger`, and can read its own tables.
- **Recovery point and time** shown on synthetic data: a pre-migration bundle restored in 4 s, and represented the previous release (journals 24/95). No formal RTO or RPO is claimed.
- **Off-host:** **BLOCKED.**
  - No destination has been approved (`AP-AEGIS-BAK-01`).
  - The VPS installation is not verified.
  - rclone is absent from this sandbox, and nothing was sent off the host.
- **Rollback:** application code rollback is rehearsed (section 26). Schema rollback means restoring the pre-release bundle. Applied migrations are never reversed automatically.

## 11–12. Authentication and partner authorisation

Covered by the existing and extended suites, on real PostgreSQL and in the browser.

**Founder access:** sign-in with TOTP MFA, rate limiting (observed: the sixth sign-in from one IP within 10 minutes is refused), anonymous refusal (401 on every partner and founder API in the deployment rehearsal), and the token-protected health check (401 without the token).

**Partner access:**

- suspension and revocation (`session_version` increment refuses the stale session);
- partners refused founder APIs (403), and founders and viewers refused partner workspace APIs;
- activation impossible without accepting the issued, current agreement (onboarding suite);
- invitations single-use.

**Isolation:** cross-partner checks pass for prospects, meetings, the day view, agreement state and agreement documents, all returning 404 or omitting the data.

**Not exercised in this run:** password change and reset, and concurrent-session edge cases beyond `session_version`. Those are covered by existing admin-identity suites in CI, not by B1.7.

## 13. Agreement acceptance

The onboarding suite (real PostgreSQL) and browser journey pass. They cover:

- an invitation bound to a published version;
- activation refused without acceptance;
- the digest and time fixed by the database;
- the invitation not reusable;
- each partner's own downloadable copy, refused to other partners;
- reissue and re-acceptance;
- a stale digest refused;
- exactly one of two concurrent acceptances recorded.

B1.7 adds the derived state and its lifecycle test, through issue, accept, supersede, reissue and withdraw. Acceptance is a simple electronic signature with a tamper-evident record, **not** a qualified electronic signature.

## 14. Commercial regression

- The financial engine is unchanged.
- The concurrency suite passes on 14 and 16 (89 tests), including the B0 financial invariants, idempotency, concurrent ledger writes and the **£705** standard acquisition ledger (`70500`).
- Rows identical through the upgrade (section 7).
- These actions never write commercial state: guidance and objection search, prospect guidance, meeting preparation, Today and the agreement state. The suite hashes the ledger, payouts, withdrawals, contracts and opportunity statuses before and after, and the browser journeys hash the ledger at each stage, including after an agreement is accepted.

## 15–16. Content governance and search

Search and guidance serve only content that is **published**, **in date**, from a **switched-on module** and of the **right audience**. Tested exclusions:

- drafts, withdrawn content and wrong-audience lessons;
- a client-facing objection row;
- the objection module while it is off, from results, filters, plan guidance and Today.

Copy is decided only on the server:

- the client explanation of a client-facing answer;
- the summary of a client-facing resource;
- the client line of an objection.

Hostile queries are handled safely, and over-long queries are refused. Ranking is deterministic.

## 17–18. Founder and partner workflows

- **Partner:** browser journeys A–F (B1.6 A–D plus B1.7 E and F) on a production build.
- **Founder:** founder operations (C), recruitment and onboarding, the Content studio (B1.1–B1.5 journeys), and queue additions tested on real PostgreSQL.
- All six Empower journeys pass with none skipped:

  | Run | Result |
  |---|---|
  | PostgreSQL 14 | 6/6 |
  | PostgreSQL 16, final code `344cab9` | 6/6 |

## 19. Website review

The web app is unchanged in B1.7. Its typecheck, lint and 470 unit tests pass. The production build is clean, from an immutable export at the candidate.

The deployment rehearsal smoke-tested `/`, `/pricing`, `/services`, `/partners`, `/contact`, `/sitemap.xml` and `/robots.txt` (200), `/privacy` (308 to `/legal/privacy`, intentional) and an unknown path (404).

**Not done:**

- a fresh visual and Lighthouse pass of every public page. The 900 ms budget policy is unchanged, and CI's performance job applies it;
- the AP-COM-03 wording on `/partners`, which was left exactly as published (section 25).

## 20. Visual evidence

`evidence/b1-7/` holds viewport screenshots at 320, 375, 768 and 1440 px, with the subject scrolled into view, of:

- the objection result in guidance search;
- Today with an agreement awaiting acceptance;
- Today with the agreement accepted.

Every width passes the no-horizontal-overflow check. Each image was inspected; that inspection found the contrast and label defects in section 3. Earlier B1.2–B1.6 evidence is left as recorded.

## 21. Accessibility

axe (WCAG 2.2 AA tags) shows no serious or critical findings on:

- Today, with each agreement state;
- guidance search with objection results;
- prospect guidance;
- meeting preparation;
- founder operations.

State is always carried by text, focus outlines are visible, touch targets are at least 44 px, and reduced motion is honoured.

A zero axe result is not proof: axe missed the gold-on-gold link. **No NVDA or VoiceOver walkthrough was possible here.**

## 22. Performance

- No web code changed.
- The admin changes add two small queries to Today and three to the founder queue, all bounded with `limit`.
- The 900 ms main-thread budget and the performance policy are untouched.
- No new measurement was taken.
- **PASS WITH LIMITATION.**

## 23. CI and local verification

Local results at the final code commit:

| Check | Result |
|---|---|
| Admin typecheck / lint / production build | clean / clean / pass |
| Admin unit (full) | 1,310 passed, 4 skipped, 1 IPv6-only environment failure (untouched file; CI covers it) |
| Web typecheck / lint / unit / production build | clean / clean / 470 passed / pass |
| Real PostgreSQL, the eight CI suites, fresh PostgreSQL 16 | 142 passed, none skipped |
| Same suites, upgraded PostgreSQL 14 and 16 | 142 and 142 passed |
| Sole-founder suite | 2 passed |
| Backup framework (GPG, PostgreSQL 14) | pass |
| Repository gates | pass (17 gates; listed below) |
| Nginx config gate | not runnable here (Alpine mirror blocked in Docker builds); B1.7 changes no Nginx file; CI runs Nginx Topology |
| Empower browser acceptance, six journeys | PostgreSQL 14: 6 passed, 0 skipped; PostgreSQL 16 at `344cab9`: 6 passed, 0 skipped |

Repository gates that passed:

- env hygiene;
- architecture docs;
- dependency governance;
- production topology;
- migration history, order and checksums;
- GitHub Actions;
- documentation links;
- domain boundaries;
- branch-protection policy;
- authorisation policy;
- database environment boundaries;
- Forge V2 release docs;
- backup migration safety;
- their test suites.

Remote CI results are recorded on the PR at its final head, not here.

## 24. Independent review

A separate model reviewed the source diff and the harness. **This is a model review, not a human review.**

- **Critical:** none. **High:** none.
- **Medium (fixed):** the harness URL guard could be bypassed by libpq `?host=` query parameters. It now refuses any query string or fragment; verified.
- **Low (fixed):**
  - baseline suite failures were hidden;
  - a non-empty or already-current target could pass trivially;
  - reuse of the dependency tree was unchecked;
  - "Checking…" could hang forever;
  - the "none" wording read as if no agreement could exist outside the portal.
- **Informational:**
  - a pre-0097 published objection line is not rechecked by 0097's trigger. Exposure is unchanged from B1.5, where the line is already copyable;
  - a crafted `?q=` link only pre-fills a search. It is React-escaped, matching the Knowledge Base;
  - a stale route comment (fixed).
- **Areas confirmed clean:** partner isolation, content governance, the copy boundary, SQL parameterisation, XSS and links, agreement-state correctness, flag coherence and accessibility.

## 25. Outstanding founder approvals

See [B1-7-RELEASE-DECISIONS.md](B1-7-RELEASE-DECISIONS.md) and register sections A and G:

| Area | Decisions |
|---|---|
| Commercial | **AP-COM-03** (twelve-month term: a prepared record; the site and engine already enforce it) |
| Agreements | AP-LR-01, AP-LR-02, AP-GOV-01 |
| Email | AP-LR-03, AP-LR-04 |
| DNS | AP-LR-05 |
| Privacy | AP-PRIV-01 to 04, AP-AEGIS-PRIV-05 to 08 |
| Backup | AP-AEGIS-BAK-01 and 02 |
| Release | AP-AEGIS-REL-01 |
| Switches | every module's own enabling decision, plus AP-AEGIS-UNI-01 |
| Content | every content item |

## 26. Deployment rehearsal

[`deployment-rehearsal-pg14.txt`](evidence/b1-7/deployment-rehearsal-pg14.txt) follows [PM2 host deploy](../../operations/pm2-host-deploy.md) on a disposable stack (PostgreSQL 14.25, PM2 6.0.14, throwaway secrets, no production access):

1. Immutable `releases/<sha>` trees for `37995d2` (the previous release) and `344cab9` (the candidate), by `git archive`, then `npm ci` and production builds of web and admin.
2. The previous release ran on loopback 3200/3201 with `SS_RELEASE_ID` reported by both health endpoints.
3. An encrypted pre-migration backup (age) was taken.
4. Forward migration with the candidate's tooling, and privilege verification.
5. PM2 cut-over by delete and recreate. Health reported the candidate SHA, and the smoke list passed:
   - public pages 200 and unknown 404;
   - admin pages redirect to sign-in;
   - every partner and founder API refuses anonymous calls (401);
   - all partner switches unset.
6. **Code rollback** to `37995d2` on the migrated schema: healthy, and the same smoke list passed. The previous release is forward-compatible with 0095–0097 and 0024.
7. **Recovery:** the pre-migration bundle restored into an isolated database in 4 s and represented the previous release (journals 24/95; RTO met).

**Not rehearsed:**

- Nginx routing, because the gate cannot build here;
- authenticated founder and partner sign-in on the PM2 stack (they are covered by the browser journeys on the same production build);
- a real VPS.

## 27. Recovery procedure

- [Production backup and restore](../../operations/backup-and-restore.md), now including role re-provisioning.
- [PM2 host deploy](../../operations/pm2-host-deploy.md) rollback, now rehearsed.
- [Partner programme incident procedures](../../operations/partner-programme-incidents.md).

## 28. Feature switches

| Switch | Default | B1.7 |
|---|---|---|
| `EMPOWER_FOUNDER_CONTENT_ENABLED`, `PARTNER_ACADEMY_ENABLED`, `PARTNER_RESOURCE_CENTRE_ENABLED`, `PARTNER_KNOWLEDGE_BASE_ENABLED`, `PARTNER_OBJECTION_HANDLING_ENABLED`, `PARTNER_UNIFIED_WORKSPACE_ENABLED`, `PARTNER_ACTIVATION_ENABLED`, `PARTNER_EMAIL_ENABLED`, `PARTNER_APPLICATIONS_ENABLED` | off | unchanged; none added; none enabled anywhere but disposable test servers |

## 29. Go / no-go

**NO-GO for any release until the founders decide.** Engineering gates are green locally. Release, commercial, legal, privacy, email, DNS, off-host backup and content gates are BLOCKED. The checklist is in [B1-7-RELEASE-DECISIONS.md](B1-7-RELEASE-DECISIONS.md) section 4.

## 30–31. Final commit and pull request

Draft PR [TheFridey/ScaleSmiths#163](https://github.com/TheFridey/ScaleSmiths/pull/163) from `feature/operation-aegis-b1-7`. The final head SHA and CI status are on the PR. The last application-code commit is `344cab9`; later commits are documentation and evidence only. **Not merged. Not deployed.**

## Final acceptance matrix

| Area | Requirement | Result |
|---|---|---|
| Code | Clean production builds | PASS |
| Unit testing | Full relevant suites pass | PASS WITH LIMITATION (one IPv6-only test cannot run here) |
| Integration | All B-series functionality interoperates | PASS |
| Database | Fresh and upgrade migrations verified | PASS |
| Compatibility | PostgreSQL production-version rehearsal | PASS WITH LIMITATION (14.25 rehearsed; production version not re-read) |
| Financial | Commission invariants preserved | PASS |
| Security | Founder and partner isolation verified | PASS WITH LIMITATION (automated and model review; no human penetration test) |
| Agreement | Issuance and acceptance integrity | PASS (engineering); legal adequacy BLOCKED (AP-LR-01) |
| Content | Publication and audience controls | PASS |
| Search | Approved, current results only | PASS |
| Partner UX | Complete tested user journeys | PASS |
| Founder UX | Complete tested operational journeys | PASS WITH LIMITATION (queue additions tested on PostgreSQL; no new founder screenshots) |
| Accessibility | Automated and manual checks documented | PASS WITH LIMITATION (no screen reader) |
| Performance | Existing budgets preserved | PASS WITH LIMITATION (budget unchanged; not re-measured) |
| Browser | No unexplained skipped critical journeys | PASS |
| Backup | Backup and restore verified | PASS WITH LIMITATION (local and disposable); off-host BLOCKED |
| Recovery | Rollback procedure rehearsed | PASS WITH LIMITATION (Nginx not rehearsed) |
| CI | Required checks green at final head | see the PR at its final head |
| Governance | Human review and decisions recorded honestly | BLOCKED (human review and founder decisions pending) |
| Deployment | Controlled runbook ready | PASS |
| Production | Unchanged unless separately authorised | PASS (nothing deployed, enabled or published) |
