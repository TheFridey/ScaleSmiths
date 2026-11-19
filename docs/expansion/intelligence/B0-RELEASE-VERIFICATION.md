# B0 release verification

Branch `claude/modest-newton-jo2d95`. **Starting head** `0f71e96` (end of B0 finalisation). **Final head** `FINALHEAD` (application code changed after the first CI run; both heads are reported). Base `master` `4c399b8`, with **0 commits ahead of this branch since development began**, so there is no unrelated drift to reconcile.

**Pull request:** none opened. Opening one needs your explicit authorisation, which this brief makes conditional ("where authorised") without granting it. The description is prepared in `PR-DESCRIPTION.md` in the repository template format and passes the real `check:pr-metadata` gate when run against a synthetic pull-request event. Nothing was merged or deployed.

## Engineering verdict: CONDITIONAL RELEASE CANDIDATE

Ready for independent human pull-request review. Not ready to release or to describe as approved for commercial use. The conditions are listed under Outstanding risks and Release gates. Two model reviews are not a human audit.

## 1. The five web Playwright failures
Diagnosed under CI-equivalent conditions: a disposable web database prepared, migrated, seeded and asserted exactly as CI does; production server mode; full traces. A baseline checkout of `master` was built in the same container and run side by side.

| Test | Diagnosis | Evidence |
|---|---|---|
| `public-site.spec.ts:99` commercial claims fail closed | **Not a regression. Missing guarded environment.** The test mutates verified claims through a helper that refuses to run without `SCALESMITHS_TEST_ENVIRONMENT=forge-v2-e2e` and a seeded isolated database. | Reproduced with the exact message ("SCALESMITHS_TEST_ENVIRONMENT=forge-v2-e2e is required for database-mutating E2E tests"); passes (1.4s) under the CI-equivalent environment. The commercial-claims requirement is preserved and was exercised. |
| `enterprise-architecture.visual.spec.ts:11` and `:20` | **Pre-existing environment baseline mismatch.** Fail identically on `master` in the same container. | Same sizes on master and branch (1440x4446 expected, 1440x4487 received; 1440x4582 vs 4623, about 5% of pixels). |
| `public-site.visual.spec.ts:12` and `:21` homepage | **Environment mismatch plus one intentional change.** The container renders Inter as a system font, which the committed baseline machine does not; that already differs from the baseline by 47,054 pixels below the nav bar on `master` too. On top of that, this branch added the Become a Partner nav button. Playwright tolerates 2% of pixels: `master` sits just under it, the nav button tips the branch over it here. | Raw renders captured with the test's own helpers: branch vs master differ only in the nav bar (9,079 pixels, **0 below it**); both differ from the baseline by the identical 47,054 pixels below the nav. Baselines are byte-identical in both trees. Shared `Nav.tsx` and `Footer.tsx` were changed on purpose (checkpoint 1). |

**GitHub runner confirmation:** the CI "Web" job step "Chromium journeys and visual regression" **succeeded** on run `44617306801`, so all four visual tests pass on the baseline machine with the branch's changes. **No baseline was updated, no threshold changed, no test skipped.** The local failures remain in this container because of its fonts. Before-and-after images: `web/test-results` (not committed); the numbers above are the durable evidence.

## 2. IPv6 `safe-outbound` test
Cannot bind `::1` in this container (`EAFNOSUPPORT`), so it still fails locally; the test was not changed. On GitHub's runner (run `44617306801`, job "Admin") the **Unit tests step succeeded**. That step runs the whole admin Vitest suite, including `safe-outbound.test.ts`, so the DNS-rebinding-to-IPv6-loopback assertion passed. Evidence is the step conclusion, not a printed test line.

## 3. GitHub CI
Remote CI normally triggers only for pushes to `master` or for pull requests, so there was nothing to inspect for this branch. With no pull request authorised, all three workflows were started with their existing `workflow_dispatch` trigger on the branch (no deploy, no merge, no secrets added).

| Workflow | First head `0f71e96` | Final head `FINALHEAD` |
|---|---|---|
| CI (run 44617306801 / `FINALCIRUN`) | success: Web, Admin, Admin Forge E2E, Forge Workflow E2E, Database and Migrations, Backup and Restore, Cross-browser Smoke, Nginx Topology, Root Hygiene; **PR Metadata skipped** (needs a pull request) | FINALCI |
| Security (44617312102 / `FINALSECRUN`) | success | FINALSEC |
| CodeQL (44617316618 / `FINALCQLRUN`) | success | FINALCQL |

CI covers: admin and web lint and unit tests, both production builds, Playwright chromium journeys and visual regression, portal lifecycle, cross-browser smoke, Forge and Golden Path journeys, the full PostgreSQL integration suite, migration journals, and the least-privilege role verification against real catalogs (below).

**Gaps in what CI proves.** (a) `PR Metadata` only runs on a real pull request. (b) CI sets only `TEST_DATABASE_URL`, so the **Expansion real-PostgreSQL concurrency suite is skipped in CI**; its results (86 tests as restricted `scalesmiths_admin`, plus `scalesmiths_web` profile-role tests) are local evidence only, on native PostgreSQL 16. Wiring it into CI is a protected-area workflow change that needs separate authorisation. I recommend it.

## 4. Docker privilege verification
- **Real Docker, GitHub runner:** CI step "Verify least-privilege PostgreSQL roles against real catalogs" succeeded on both heads' runs (first head confirmed above; final head: see table).
- **Local:** the canonical harness passed through a command shim onto native PostgreSQL 16 (not Docker), including injected-drift rejection and repair. The policy test now asserts the web role holds exactly one named view, SELECT only.

## 5. Database and migration evidence
Migrations 0083 to 0087 are forward-only; none was rewritten after commit. Fresh build from empty to admin 88 of 88 (browser database, three times). Upgrade from the checkpoint-4 head `25a96e6` with synthetic rows: preserved, defaults correct, privileges verified, new guards act on old rows as the restricted role. CI's "Database and Migrations" job succeeded (journals plus the real integration suite). Full local integration: 9 files, 177 passed, 0 skipped.

## 6. Local verification on the final head
Admin vitest 1,182 passed / 4 skipped / 1 failed (IPv6, container only); web 468 passed; `tsc` and `eslint .` clean in both; 14 of 15 repository gates (the 15th is PR metadata); gate script tests pass; both production builds; original `expansion.spec.ts` reconciles exactly **£705**; the programme and B0 journeys pass on production builds with restricted runtime roles (run twice from a fresh database).
**Journey harness note:** the app limits a founder to 120 commands a minute and the B0 journey sends about 110. Back-to-back runs inside one minute got HTTP 429 and failed intermittently. Production behaviour is correct; the specs now reset the limiter between sections and log any 429, and runs must be at least a minute apart.

## 7. Final security review (model review, not a human audit)
A second fresh agent reviewed the final branch read-only. **No critical or high findings; no SQL injection, no partner IDOR, no path to move money, create payable liability or double-reserve ledger entries.** Verified real: the allocation lock-order fix, partners never evaluated against exclusivity, frozen candidate facts, consent v2, receiving-partner market check. Areas checked and found sound: public projection, database privileges (no SECURITY DEFINER; one web view), market gating, exclusivity confidentiality, withdrawal and commission safety, reward gating, and the release switches.

**Fixed after the review:** release now takes the opportunity row before the candidate row (a residual lock inversion, deadlock-only); an area made of stop words ("UK") can no longer prove two areas different; **partners can withdraw consent and remove their own page at once** (previously only a founder could, which the consent text implied was possible and which UK GDPR Art. 7(3) expects to be as easy as giving it); the phone-number screen needs 10 or more digits.

## 8. Outstanding software risks
**Medium**
1. **Geographic exclusivity matching can fail open** for a region against a city inside it ("North West England" against "Manchester"); fixing it needs a founder-approved area vocabulary. Founders must record areas at the granularity they want matched.
2. **A page can stay live after entitlement lapses:** a qualification revoked after a webpage reward was approved leaves the reward approved, and the page live, until a founder withdraws the reward (procedure, not code).
3. **Excluding a previously released candidate permanently locks its domain**, with no in-app remedy (needs a reviewed forward migration or procedure).
4. Remote CI does not run the Expansion concurrency suite (see section 3).

**Low (all documented):** partner-supplied customer country counts for progression and scope approval before confirmation (acceptance still requires it); acceptance does not re-check the operating market; operating-market change takes no 7102 lock; re-activating a partner revives a live page without re-review; achievement text is static; the referral reference is the recruitment identifier; contact-detail screening is a heuristic with founder review as the real control; trigger flags are tokens, not a boundary, against a compromised runtime; dashboards run several queries per load; single-founder approvals (no four-eyes); consent hash excludes the consent version and uses an ambiguous delimiter; one-bit duplicate-business oracle at registration (pre-existing).

## 9. Release controls (all verified disabled by default)
Intake (`PARTNER_APPLICATIONS_ENABLED`), activation (`PARTNER_ACTIVATION_ENABLED` plus an approved operating market), applicant purge, achievement and referral bonuses (an approved programme version with the financial or referral flag, then per-reward founder approval; non-payable and no payout integration exists), withdrawals (no policy row is seeded), commercial plans (seed disabled), markets (all four reviews), public profiles (`PARTNER_PROFILE_PUBLICATION_ENABLED` and `PUBLIC_PARTNER_PROFILES_ENABLED` plus a founder-approved profile, entitled reward and consent), external provisioning (none exists). No real emails, customers, payouts or transfers occurred.

## 10. Release gates that are not engineering
**Legal and accounting:** independent-contractor status and the partner agreement; earnings and "uncapped" marketing claims; programme version, bonus amounts, referral reward, refund and clawback semantics; withdrawal policy, VAT and invoicing; per-market legal, tax and accounting review before any market is approved; exclusivity terms and vocabulary.
**Privacy and commercial:** consent text `profile-consent-v2`, privacy notice, indexing decision and enquiry route; applicant retention period; researched-prospect screening standard and volumes; Founding Partner benefits and wording; four-eyes approval policy; photographs (not built).
**Production operations:** protected-area review; backup and restore verified on the production host before migrating; maintenance window and the rollback plan (restore the pre-migration backup); setting the secrets and switches deliberately and leaving profile publication unset; running the Expansion concurrency suite in CI; an IPv6-capable runner for `safe-outbound` (GitHub already provides one); founder procedures for items 2 and 3 above.
