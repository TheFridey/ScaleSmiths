# B0 merge readiness

Status: **NOT MERGED. Blocked on governance: no eligible human code-owner reviewer exists, and GitHub does not enforce the documented branch protection on `master`.** Engineering verification is complete.

Verified 2026-11-20 by an agent. Model review is not human approval and has not been presented as one.

## State

| Item | Observed |
|---|---|
| PR | #155, draft, open, `claude/modest-newton-jo2d95` -> `master` |
| PR head | `173714ed52a279856b3c7c59de6516ce6fd9187f` (only change since the last fully green head `a82a605` is this document) |
| Master | `4c399b87e833b12d15791f6b5f8b08ab35871667` (merge of #154); merge base equals master, branch is 0 behind / 41 ahead |
| Reviews | none; no review requests; 0 review threads, 0 unresolved |
| Mergeable | `MERGEABLE` |

## CI on the final head

Workflows triggered by `pull_request` on `173714e`: CI run 44719629619, Security 44719629455, CodeQL 44719629730. All 21 required check contexts in `scripts/branch-protection-policy.json` now report `success`.

Cross-browser Smoke was cancelled on the first attempt: the job sat in `npx playwright install --with-deps firefox webkit` until the job timeout (25 min) and the runner killed it. No test ran. The commit only changed this document, and the same job passed on `a82a605`. The failed job was re-run once without changes and passed (attempt 2, started 11:29 UTC). Diagnosis: transient runner/package-mirror stall, not a code defect.

## Migration 0090

| Check | Result | Evidence |
|---|---|---|
| Sequence | `0090_expansion_domain_release_guard_hardening` is journal idx 90, `when` strictly after 0089; the shared plan's last admin range runs through 90 | `admin/drizzle/meta/_journal.json`, `scripts/shared-migration-plan.json` |
| Checksum | committed blob sha256 `b9a0dbb7…c1c9` matches `scripts/migration-checksums.json` | `git show HEAD:<file> \| sha256sum` |
| Repository gates | `check-migrations`, `check-shared-migration-plan` (115 migrations), `check-migration-history` (52 historical + 63 forward locked) pass locally; the same gates pass in CI | local run, CI `Database and Migrations` |
| Fresh database | CI applies 0090 on every integration database and on the dedicated `postgres-expansion` service, then the restricted-role privilege verifier passes | CI job log (run 44717578398 on `a82a605`, identical migrations) |
| Concurrency on the migrated schema | 89/89, 0 skipped, run as `scalesmiths_expansion_admin` / `scalesmiths_expansion_web` after 0090 was applied; the step fails on any skipped test | same job log |
| Upgrade from a checkpoint-5 (0089) database with history | Passed. The migrator applied only 0090. Of 55 snapshotted tables, the only change was the admin migration journal (90 -> 91 rows); all 53 `expansion_*` tables (for example 214 opportunities, 2 with released domains, 194 commission-ledger rows) kept identical row counts and content digests. Privilege verification passed before and after. Concurrency suite on the upgraded schema: 88/89, the one failure being the collation-dependent test described below (also failed identically on the 0089 schema; passes in CI) | isolated `postgres:16` container, see below |
| Guard behaviour after upgrade | INSERT of a released row refused (new in 0090); rewriting or clearing a recorded release refused; direct release of a non-withdrawn prospect refused; release without a reason refused | `checks-0090.sql` against the upgraded database |
| Founder-controlled release | founder-only, reason required, idempotent replay, audited `domain_released` event, permanent history, suppression still applies; a partner is refused | concurrency test "a founder can release the domain held by an excluded, released candidate" |
| Restricted principals | `verify-postgres-privileges.mjs` passes before and after 0090 on the isolated database, and in CI | local and CI logs |

The supplied `database-migration-logs.zip` ended at `admin/0089`; it was not used as evidence for 0090.

Isolated upgrade method: a detached worktree at `173714e`; a disposable `postgres:16` container; shared migrator run with 0090 temporarily removed from the journal and plan (worktree only, restored afterwards, never committed); history seeded by running the concurrency suite on the 0089 schema; a per-table row count and content digest of every `expansion_*` table taken; 0090 applied by the normal migrator; the digest repeated and compared; the concurrency suite re-run on the upgraded schema.

## Remediation review

| Finding | Status on the final head |
|---|---|
| Geographic exclusivity | Fixed in 0088: founder-approved `expansion_areas` tree; containment comes from the tree, not wording; unclassified wording goes to review (fail-closed). Covered by the 5B geography test. |
| Public profile entitlement | Fixed in 0089: the security-barrier view requires a live webpage reward, a current qualified-client count at or above its milestone, and no open qualification flag. Suspension is automatic on the next request; records are kept; a founder restoring entitlement restores the page. Covered by the 5E tests. |
| Released-candidate domain lock | Fixed in 0088 + 0090: founder-only, audited, permanent release for a withdrawn, unworked prospect from an excluded candidate; 0090 makes the database guard match the owner guard and cover INSERT. |
| Concurrency suite in CI | Fixed: `ci.yml` adds a `postgres-expansion` service and two steps; runs as restricted roles; fails if any test is skipped. |

No critical or high findings remain from the agent review. One low-severity test-portability issue: two tests (`expansion-concurrency.integration.test.ts:686`, `expansion-finance.test.ts:315`) select `amount_pence::text` and `ORDER BY amount_pence`, which sorts the text output column. It passes on CI's `postgres:16-alpine` and failed once on a Debian `postgres:16` (`en_US.utf8`) because that collation ignores the minus sign (confirmed: `ORDER BY v DESC` gives `-6000,30000` under `en_US.utf8` and `30000,-6000` under `C`). No production query in `admin/src` or `web/src` uses the pattern. Recommended follow-up, not a B0 blocker.

Protected flags default to `false` in `.env.example`. `PARTNER_APPLICATIONS_ENABLED`, `PARTNER_ACTIVATION_ENABLED`, `PARTNER_PROFILE_PUBLICATION_ENABLED`, `PUBLIC_PARTNER_PROFILES_ENABLED` and `PARTNER_RETENTION_EXECUTION_ENABLED` are read with `=== "true"`, so anything else is closed. Withdrawals additionally need a founder-enabled commercial plan.

## Deployment impact of merging

Merging runs CI, Security and CodeQL on `master` (push trigger). No workflow deploys, uses an environment, or connects to a server; the repository has no deployment environments or webhooks. Production deployment is a separate, manual release-manager operation (`docs/operations/release-runbook.md`). Not verified: any host-side automation outside GitHub (for example a scheduled pull on the VPS).

## Blockers

1. **No eligible human code-owner reviewer.** `.github/CODEOWNERS` assigns every path to `@TheFridey`, the PR author and the repository's only collaborator. GitHub does not allow an author to approve their own PR, so the required code-owner approval cannot be given by anyone.
2. **Branch protection is documented but not applied.** `GET /repos/TheFridey/ScaleSmiths/branches/master/protection` returns `404 Branch not protected`, and the repository has no rulesets. `scripts/branch-protection-policy.json` (1 approval, code-owner review, last-push approval, conversation resolution, up-to-date branch, 20 required checks) is therefore not enforced. A merge would technically succeed today; that is exactly why it was not attempted.
3. PR is still a draft.

## Proposed resolution (repository owner only)

The agent has not changed repository settings and will not.

1. Add a trusted second person as a collaborator with write access, and list them in `CODEOWNERS` for the protected paths (at least `admin/drizzle/`, `.github/`, the restricted-role scripts and the Expansion server code).
2. Apply `scripts/branch-protection-policy.json` to `master` (classic protection or a ruleset), and confirm `check-branch-protection-policy.mjs` reports no drift.
3. That reviewer reviews against the checklist below and approves after the final push.
4. Owner marks the PR ready, confirms deployment impact, and merges.

If the owner instead chooses a documented solo-maintainer exception, that is the owner's decision, should be recorded in `docs/operations/protected-areas-and-branch-protection.md`, and still does not make an agent or model review count as approval.

## Reviewer checklist

- [ ] **Migrations 0073-0090**: forward-only, none rewritten, journal/plan/checksums agree; 0088 area tree and domain release columns; 0089 view; 0090 guard (INSERT path, permanent history). Rollback is restore-from-backup, not down-migrations.
- [ ] **Financial invariants**: commission is never paid from conditional rewards; refunds adjust unpaid or reserved commission; negative adjustments travel with withdrawals; no double allocation under contention; ledger and audit append-only.
- [ ] **PostgreSQL privileges**: web role reads only the security-barrier view; admin runtime role cannot migrate or own schema; `provision-postgres-roles.mjs` and `verify-postgres-privileges.mjs` agree.
- [ ] **Public profile view**: only live, consented, approved content of an active partner with current entitlement; no private columns; partner self-takedown.
- [ ] **Exclusivity**: area-tree containment, fail-closed review for unclassified wording, partner requests never evaluated against exclusivity.
- [ ] **Domain allocation and release**: single holder under races; release founder-only, reasoned, audited, permanent; suppression unaffected.
- [ ] **CI workflow**: `postgres-expansion` service, CI-only credentials, skip guard; no new secrets, permissions or deploy steps.
- [ ] **Production deployment triggers**: none in GitHub; confirm no host-side automation.
- [ ] **Rollback**: restore the pre-migration backup; keep all partner flags unset.

## After a permitted merge

Verify the merge commit and its tree on `master`, inspect `master` CI, confirm every protected flag above remains unset in production configuration, and confirm no deployment occurred. Do not activate partner intake, public profiles, withdrawals or rewards. B1 (Operation Empower) must not begin until this is recorded.
