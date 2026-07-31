# Forge V2 release readiness

- Date: 2026-07-31
- Branch: `master`
- Merged commit: `5ac4bacd89cffc6bd524dfa527738ac239c961c2`
- Decision: **BLOCKED — DO NOT DEPLOY**

Forge V2 is now **automated-gate complete**. Every mandatory automated gate has passed on
Linux GitHub Actions runners against exact, recorded SHAs. The release remains blocked on
operational evidence that cannot be produced by automation: an authorised
production-derived encrypted backup restore, the documented manual production checks, and
recorded human release approval.

This document is a release ledger, not an approval.

## Authoritative identifiers

Release evidence is only meaningful against an exact SHA. These five identifiers are
distinct and must not be conflated.

| Identifier | Value | What it means |
| --- | --- | --- |
| Forge V2 candidate head | `b9b6be2af9d7645588a95d66ce61ab12b29eaec9` | Final commit on `release/forge-v2-rc`; the reviewed candidate tree |
| Previous `master` | `1cc9e4e071926154ba7dbd4d3c5e4f851e54912b` | PR #35 base at merge time |
| PR merge-test SHA | `44e7e3a8d5a20e0cd754b66f8e353a71e5013b44` | Ephemeral `Merge b9b6be2a into 1cc9e4e0` commit that `pull_request` jobs actually checked out |
| Merged `master` SHA | `5ac4bacd89cffc6bd524dfa527738ac239c961c2` | Merge commit of PR #35; the current release candidate |
| Merged pull request | [#35](https://github.com/TheFridey/ScaleSmiths/pull/35) | Merged 2026-07-30T22:50:26Z |

### Evidence classes

| Class | Trigger | Scope and limits |
| --- | --- | --- |
| Branch-push evidence | `push` to `release/forge-v2-rc` | Runs against the candidate head exactly. Dependency Review is skipped by design; `dependency-review-action` requires a pull-request context. |
| Pull-request evidence | `pull_request` into `master` | Runs against the ephemeral merge-test SHA, not the candidate head. This is the only context in which Dependency Review executes. |
| Merged-`master` evidence | `push` to `master` | Runs against the merged tree that would actually be deployed. Authoritative for release. |
| Synthetic backup evidence | CI `Backup and Restore` job | Disposable PostgreSQL fixture created inside the runner. Proves the framework, encryption, redaction and verifier logic. Proves nothing about production data. |
| Production-derived restore evidence | Authorised operator, out of band | Restore of a real encrypted production backup into an isolated target. **Not executed.** Cannot be produced by CI and must never be simulated. |

## Automated gate results

### Merged `master` — `5ac4bacd` (authoritative)

| Workflow | Run | Result |
| --- | --- | --- |
| CI | `30588532289` | **Passed** — 9/9 jobs |
| Security | `30588532278` | **Passed** — 8/8 executed jobs; Dependency Review **Not applicable** on `push` |
| CodeQL | `30588532257` | **Passed** — JavaScript/TypeScript analysis |

CI jobs, all **Passed**: Web, Admin, Cross-browser Smoke, Admin Forge E2E, Forge Workflow
E2E, Database and Migrations, Backup and Restore, Nginx Topology, Root Hygiene.

Security jobs, all **Passed**: npm Audit (web), npm Audit (admin), Image Security (web),
Image Security (admin), Hadolint (web), Hadolint (admin), Generated-site Sandbox,
TruffleHog.

### Forge V2 candidate head — `b9b6be2a` (branch push)

| Workflow | Run | Result |
| --- | --- | --- |
| CI | `30587778565` | **Passed** |
| Security | `30587778551` | **Passed**; Dependency Review **Not applicable** on `push` |
| CodeQL | `30587779137` | **Passed** |

### PR #35 pull-request context — merge-test SHA `44e7e3a8`

| Workflow | Run | Result |
| --- | --- | --- |
| CI | `30588518342` | **Passed** — 9/9 jobs |
| CodeQL | `30588518349` | **Passed** |
| Security | `30588518347` | **Failed** — Dependency Review only; 8/9 jobs passed |

The single Security failure was the Dependency Review preflight, which received
**HTTP 404** from `GET /repos/TheFridey/ScaleSmiths/dependency-graph/sbom`. That is an
unavailable Dependency Graph endpoint, **not** a vulnerability finding and not a
disallowed dependency change. GitHub Dependency Graph has since been enabled; see
`docs/security/dependency-audit-2026-07.md` for the verification event and its result.

## Gate-by-gate ledger

| Gate | Evidence | Status |
| --- | --- | --- |
| Web lint, unit tests, production build | CI `Web`, run `30588532289` | **Passed** |
| Web performance budgets | CI `Web` | **Passed** |
| Web Chromium journeys and visual regression | CI `Web` | **Passed** |
| Web cross-browser smoke (Firefox, WebKit) | CI `Cross-browser Smoke` | **Passed** |
| Admin lint, unit tests, production build | CI `Admin` | **Passed** |
| Forge benchmark suite | CI `Admin` | **Passed** |
| Authenticated admin browser journeys | CI `Admin Forge E2E` | **Passed** — 3/3 |
| Forge browser journeys | CI `Admin Forge E2E` | **Passed** — 18/18 |
| Full Forge workflow API E2E | CI `Forge Workflow E2E` | **Passed** |
| Migration journal and history integrity | CI `Database and Migrations` | **Passed** |
| PostgreSQL integration suite | CI `Database and Migrations` | **Passed** |
| Synthetic backup/restore framework drill | CI `Backup and Restore` | **Passed** |
| ShellCheck on backup scripts | CI `Backup and Restore` | **Passed** |
| Nginx config syntax and topology integration | CI `Nginx Topology` | **Passed** |
| Repository policy checks and release simulation | CI `Root Hygiene` | **Passed** |
| Production npm audit (web) | Security `30588532278` | **Passed** — 0 vulnerabilities |
| Production npm audit (admin) | Security `30588532278` | **Passed** — 0 vulnerabilities |
| Dockerfile lint (web, admin) | Security `30588532278` | **Passed** |
| Container image build, Trivy scan, SPDX SBOM (web, admin) | Security `30588532278` | **Passed** — no unfixed High/Critical |
| Generated-site sandbox security fixtures | Security `30588532278` | **Passed** |
| Secret-history scan (TruffleHog, verified only) | Security `30588532278` | **Passed** |
| CodeQL static analysis | CodeQL `30588532257` | **Passed** |
| Dependency Review | Requires `pull_request`; last attempt HTTP 404 | **Pending** — re-verification in progress |
| Production-derived encrypted backup restore | Requires authorised operator | **Not executed** |
| Manual production checks | Requires authorised release operator | **Not executed** |
| Human release approval | Requires named approver | **Not executed** |

Full development audits report four Moderate findings per application through the
development-only Drizzle Kit → `@esbuild-kit/*` → esbuild chain. These are **accepted
temporarily** and are absent from both production installs. See
`docs/security/dependency-audit-2026-07.md`.

## Forge journey coverage

All 18 Forge operator journeys execute in a production-mode admin server against a
disposable PostgreSQL 16 fixture in CI (`admin/test/e2e/forge-journeys.spec.ts`), and all
**Passed** on `5ac4bacd`:

1. Creates a new project from prompt only.
2. Creates a project from website URL and prompt using the guarded deterministic reader.
3. Reviews and edits the interpreted brief before creation.
4. Approving the brief creates and starts a Forge Run.
5. Observes an active Forge Run in the production workspace.
6. Pauses a running Forge Run through the authenticated API.
7. Resumes the paused Forge Run and records the transition.
8. Displays a provider failure with an operator-facing recovery.
9. Retries a provider-failed stage through the real run API.
10. Displays a failed functional QA stage.
11. Requests repair by retrying the failed atomic QA stage.
12. Opens the desktop preview workspace (1440×900).
13. Opens the tablet preview workspace (1024×768).
14. Opens the mobile preview workspace (390×844).
15. Submits guarded feedback and invalidates only affected run stages.
16. Approves the preview through the existing project action.
17. Blocks deployment without the required final evidence and approval.
18. Opens Advanced records for historical tasks, artifacts and activity.

Three authenticated journeys run alongside them
(`admin/test/e2e/admin-auth.spec.ts`), plus the real-credentials `auth-setup` project —
22 browser checks total, all **Passed**.

## Visual evidence

Desktop, tablet and mobile Chromium baselines for the public site are **accepted** and
enforced. The candidate diffs recorded in
`docs/release-readiness/visual-review/public-homepage-86cfc75.md` were inspected, the
mobile experience-control overlap was fixed in `9821074`, and the inspected baselines
were accepted in `b9b6be2a` ("test(web): accept inspected mobile homepage baseline").

The web visual regression suite now **Passes** against those committed baselines on
`5ac4bacd` with the configured 0.02 maximum difference ratio unchanged. Baselines under
`web/tests/e2e/public-site.visual.spec.ts-snapshots/` cover normal home, chooser and
interactive-plan routes at desktop, tablet and mobile widths.

The six-viewport authenticated admin shell suite (`npm run test:visual:shell`) is **Not
executed** in CI. It is not a Forge V2 release gate; the Forge preview viewports are
covered by journeys 12–14 above. Inspection of authenticated captures and keyboard/focus
order remains a manual production check.

## Remaining release blockers

These are the real unresolved limits. None can be closed by re-running automation.

1. **No authorised production-derived encrypted backup restore has been completed.** The
   CI drill is synthetic: it creates its own disposable PostgreSQL source inside the
   runner. Production recovery evidence must not be inferred from it or fabricated.
2. **Manual production checks still require an authorised release operator.** See
   "Remaining manual production checks" below.
3. **Dependency Review must pass on a pull request** before this governance task is
   complete. It has never executed successfully in its native context because Dependency
   Graph was disabled. Status is **Pending** until a real pull-request check passes.
4. **Human release approval is separate from automated test success.** A fully green
   pipeline is a precondition for approval, not approval itself.

## Database migration and rollback

Forward migrations in this release:

- Web `0010`–`0013`: verified claims, enquiry intent, local-growth analytics and the
  additive `web_vital` enum value.
- Admin `0042`–`0048`: historical reconciliation, dependency admission, tenant controls,
  durable operations, Forge Runs, operational health and atomic-stage cost fields.

Production sequence:

1. Freeze the candidate at a reviewed commit and record both migration ledgers.
2. Produce and verify an encrypted backup of PostgreSQL, environment configuration, Nginx
   state and generated workspaces.
3. Restore that backup into an explicitly isolated PostgreSQL 16 target.
4. Apply **web migrations first**, then **admin migrations**.
5. Run the guarded backup-migration verifier and attach its JSON evidence.
6. Confirm old projects, auth/RBAC, artifacts, jobs and workspaces before touching live
   traffic.

These migrations are primarily additive. Do not attempt ad-hoc down migrations for enum
values or populated Forge tables. Application rollback may use the previous image only
when it is schema-forward-compatible. Otherwise restore the tested pre-release backup.

## Deployment sequence

1. Complete the production-derived restore drill and record its evidence.
2. Confirm the merged candidate SHA and rerun the full pipeline against it.
3. Record image digests, SBOMs, Trivy/CodeQL/TruffleHog/Dependency Review results and
   inspected screenshots.
4. Verify production secrets, provider budgets, Docker sandbox mode, backup ownership,
   monitoring delivery and the maintenance window.
5. Back up, then migrate web then admin.
6. Deploy immutable web/admin images to the inactive release slot.
7. Run health, login/RBAC, Forge project/run, preview, quote and portal smoke checks.
8. Validate Nginx, switch traffic through the release manager, monitor, then save the
   approved release evidence.

## Rollback sequence

1. Stop new Forge runs and preserve failed-job/artifact evidence.
2. Switch Nginx to the previous healthy release using the release manager.
3. Re-run public/admin health, auth, quote, portal and Forge read-only checks.
4. If the previous application cannot safely use the migrated schema, take a forensic
   backup and restore the verified pre-release database backup.
5. Restore generated workspaces separately only when their hashes and ownership match
   recorded evidence.
6. Keep the failed release, logs, SBOMs and database evidence for incident review.

## Environment variables

No `.env.example` changes were introduced by this release-closure pass. The CI fixtures
use isolated, test-only values for:

- `WEB_DATABASE_URL`, `ADMIN_DATABASE_URL`, `MIGRATION_DATABASE_URL`, `TEST_DATABASE_URL`
- `SCALESMITHS_TEST_ENVIRONMENT`
- `ADMIN_E2E_PASSWORD`
- `AUTH_SECRET`
- `ADMIN_MFA_BOOTSTRAP_GRACE_UNTIL` (test-only bootstrap grace window)
- `FORGE_E2E_URL_FIXTURE`
- `ADMIN_FORGE_SERVER_MODE`
- `TEST_SOURCE_DATABASE_URL`, `TEST_RESTORE_DATABASE_URL`

Production must use the Docker sandbox and real secret-manager values, and must configure
the provider, monitoring, R2, Resend, backup, release-manager and health-check variables
documented in the operations runbooks. Never reuse E2E credentials, the MFA bootstrap
grace window, or local sandbox mode in production.

## Remaining manual production checks

- Inspect the authenticated viewport captures and keyboard/focus order.
- Verify Focus Mode persistence and reversible global navigation.
- Verify actual production backup ownership, encryption, off-host retention and restore.
- Verify Sentry delivery and alert routing.
- Verify Cloudflare/Nginx origin controls and TLS without changing DNS during rehearsal.
- Confirm provider credentials, budgets and fallback policy with safe non-production
  calls.
- Confirm named deployment, database and rollback operators.
- Record human release approval only after every mandatory automated gate is green and
  the production-derived restore is evidenced.

## Audit history

Earlier revisions of this document recorded a dirty working checkout, missing
authenticated Forge fixtures, unavailable browser journeys, unavailable final CI, and
unavailable responsive screenshots. Those observations were accurate when written and are
now **superseded** by the GitHub Actions evidence above. They have been removed rather
than retained inline, because a release ledger that states both "blocked: tests never ran"
and "passed" cannot be read safely. The superseded statements remain recoverable through
this file's git history.

The release verdict has not changed. Forge V2 is **BLOCKED — DO NOT DEPLOY** until the
production-derived restore and the authorised manual production checks are complete.
