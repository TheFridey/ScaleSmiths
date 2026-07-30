# Forge V2 release readiness

Date: 2026-07-30  
Branch: `master`  
Base commit: `cabf515`  
Decision: **BLOCKED — DO NOT DEPLOY**

This document records the verification actually performed against the current dirty
ScaleSmiths checkout. It is not an approval. The checkout contains extensive uncommitted
admin, Forge, web, migration, workflow and dependency changes, so a release candidate
cannot be reproduced from `cabf515`.

## Release-unblocking rerun

The intentional change set was preserved from the original dirty checkout and reapplied
to an isolated worktree on branch `release/forge-v2-rc`, based on the exact source commit
`cabf515b9798feb3ff90f7b2d527722b9137d770`. Generated Playwright, audit, build and
dependency directories were not reapplied. The original checkout was not reset, cleaned
or otherwise rewritten.

This rerun resolved the local dependency-install blocker. After `npm cache verify`, both
apps completed two consecutive fresh installs:

- Web: `npm ci` installed 603 packages twice.
- Admin: `npm ci` installed 612 packages twice.

The lock graph intentionally resolves root esbuild `0.25.12` and isolated esbuild
`0.28.1` copies for tsx and Vitest. The prior binary mismatch came from the contaminated
installed dependency tree, not package-lock inconsistency. Root, web and admin manifests
now declare `packageManager: npm@10.9.2` and support Node `>=22 <23`.

The release decision remains **BLOCKED**. A disposable PostgreSQL/authenticated Forge
fixture, the 18 required operator journeys, inspected responsive screenshots, Linux
GitHub Actions security/container evidence and an authorised production-backup restore
are still unavailable in this environment. No release tag was created.

### Rerun command evidence

| Area | Command | Exact result |
|---|---|---|
| Candidate | `git worktree add -b release/forge-v2-rc ... cabf515...` | **PASS** - isolated candidate created from exact base SHA |
| Cache | `npm cache verify` | **PASS** - 3,204 content objects verified |
| Web install | `npm ci` twice | **PASS** - 603 packages per run |
| Admin install | `npm ci` twice | **PASS** - 612 packages per run |
| Web lint | `npm run lint` | **PASS** - exit 0 |
| Web unit | `npm test -- --run` | **PASS** - 27 files, 124 tests |
| Web build | `npm run build` | **PASS** - Next.js 15.5.22 production build |
| Web bundle/runtime budgets | `PERFORMANCE_BUDGET_SKIP_LIGHTHOUSE=1 npm run check:performance-budgets` | **PASS** - 2 routes; Lighthouse deliberately not counted |
| Web Lighthouse budgets | `npm run check:performance-budgets` | **BLOCKED** - runtime returned HTTP 500 without `WEB_DATABASE_URL`; timeout handling hardened |
| Admin lint | `npm run lint` | **PASS WITH WARNINGS** - 0 errors, 9 warnings |
| Admin unit | `npm test -- --run` | **PASS** - 77 files, 541 tests |
| Admin build | `npm run build` | **PASS** - Next.js 15.5.22 production build |
| Workflow policy | `npm run check:github-actions` | **PASS** |
| Workflow tests | `npm run test:github-actions` | **PASS after observed fixture fix** - 6 tests |
| Dependency policy | check and tests | **PASS** - 3 tests |
| Migration integrity | history check and consistency tests | **PASS** - 52 historical, 11 forward; 2 tests |
| Web production audit | `npm audit --omit=dev` | **PASS** - 0 vulnerabilities |
| Admin production audit | `npm audit --omit=dev` | **PASS** - 0 vulnerabilities |
| Full audits | `npm audit` in both apps | **WARN** - 4 Moderate development-only Drizzle Kit/esbuild findings per app |

## Release blockers

1. Fresh `npm ci` did not complete for either `web` or `admin` within 15 minutes, even
   after the existing dependency trees were isolated. The web tree also contains an
   esbuild binary mismatch (`0.28.1` package, `0.25.12` binary). Deterministic installation
   is therefore not proven.
2. Docker Desktop is unavailable. PostgreSQL integration, full Forge E2E, Nginx topology,
   container builds, image scans and container-derived SBOMs could not run.
3. The required authenticated Forge visual/user journeys could not run because no
   `ADMIN_EMAIL`/`ADMIN_PASSWORD` test credentials or disposable database were supplied.
   Playwright browsers are now installed, but the application fixture is not provisioned.
4. Web lint, unit, build, performance and cross-browser/visual gates remain blocked by the
   corrupted web dependency tree.
5. TruffleHog, Trivy, Syft and CodeQL CLIs are not installed. GitHub workflow policy was
   validated, but GitHub-native dependency review, CodeQL and secret/image scans were not
   reproduced locally.
6. No latest production backup was supplied for an authorised isolated restore. The
   backup framework and verifier safeguards pass, but production recovery evidence cannot
   be fabricated.
7. The full development audits report four Moderate findings through Drizzle Kit's
   development-only esbuild chain in both apps. Production audits are clean.
8. `next-auth@5.0.0-beta.32` is an explicitly pinned and policy-approved beta, but remains
   a pre-release authentication dependency that requires conscious release acceptance.

## Command ledger

### 2026-07-30 admin/Forge release-unblocking update

The isolated PostgreSQL 16 fixture and production-mode admin server are now proven
locally on Node `v22.14.0`. This supersedes the older admin browser/PostgreSQL blocker
entries below, but does not change the overall release verdict.

| Area | Command | Result |
|---|---|---|
| Guarded database | `npm run test:db:prepare && npm run test:db:migrate && npm run test:db:seed && npm run test:db:assert` | **PASS** - web then admin migrations, deterministic seed and invariants passed against `scalesmiths_admin_e2e` |
| Database idempotency | `npm run test:db:seed && npm run test:db:assert` repeated | **PASS** |
| Database guard | `npx vitest run scripts/test-database-guard.test.mjs` | **PASS** - 3/3 |
| Admin unit | `npm run test` | **PASS** - 78 files, 546 tests |
| Admin lint | `npm run lint` | **PASS WITH WARNINGS** - 0 errors, 9 pre-existing unused legacy-surface warnings |
| Admin build | `npm run build` with isolated production E2E environment | **PASS** - Next.js 15.5.22 |
| Forge benchmark | `npm run test:forge-benchmark` | **PASS** - 10 fixtures, schema 100%, consistency 100, content 99 |
| Admin/Forge browser | `npx playwright test --config=playwright.forge.config.ts` | **PASS** - 22/22 in production mode |
| Diff hygiene | `git diff --check` | **PASS** - no whitespace errors; Windows line-ending notices only |

The production browser suite now proves real credentials authentication, RBAC
navigation, invalid-credential rejection, server-revocable logout, prompt-only and
URL-plus-prompt intake, editable brief interpretation, Forge Run creation, automatic
stage progression, isolated generated-site workspace creation, pause/resume, provider
and QA recovery, desktop/tablet/mobile preview layouts without document overflow,
affected-stage-only feedback invalidation, preview approval, deployment blocking and
Advanced records.

Two runtime defects were found and fixed by this pass:

1. Code generation could be queued without a generated-site workspace. Run
   orchestration now creates and records the isolated workspace before that atomic
   stage.
2. Auth.js rolling-session responses could race browser sign-out. Logout now increments
   the persisted session version before clearing the browser token, so any raced JWT is
   rejected by the existing middleware check.

CI now contains an `Admin Forge E2E` job with PostgreSQL 16, guarded/idempotent fixture
setup, a production admin build, Chromium installation and the auth/Forge journeys.
The job uses an explicit test-only MFA bootstrap grace window; production MFA policy is
unchanged.

| Area | Command | Result |
|---|---|---|
| Repository | `git status --short` | **BLOCKED** — extensive tracked and untracked release changes |
| Runtime | `node -v` / `npm -v` | **PASS** — Node `v22.14.0`, npm `10.9.2` |
| Docker | `docker version` | **BLOCKED** — Docker Desktop Linux engine unavailable |
| Lock/install | `web: npm ci --no-audit --no-fund --progress=false` | **BLOCKED** — timed out after 904 seconds |
| Lock/install | `admin: npm ci --no-audit --no-fund --progress=false` | **BLOCKED** — timed out after 904 seconds |
| Dependencies | `web: npm audit --omit=dev --json` | **PASS** — 0 vulnerabilities |
| Dependencies | `admin: npm audit --omit=dev --json` | **PASS** — 0 vulnerabilities |
| Dependencies | `web: npm audit --json` | **WARN** — 4 Moderate, all Drizzle Kit/esbuild development chain |
| Dependencies | `admin: npm audit --json` | **WARN** — 4 Moderate, all Drizzle Kit/esbuild development chain |
| Policy | `npm run check:dependency-governance` | **PASS** |
| Policy | `npm run test:dependency-governance` | **PASS** — 3 tests |
| Policy | `npm run check:github-actions` | **PASS** |
| Policy | `npm run test:github-actions` | **PASS** — 6 tests |
| Environment | `npm run check:env-hygiene` | **PASS** |
| Admin | `npm run lint` | **PASS WITH WARNINGS** — 0 errors, 9 unused legacy-surface warnings |
| Admin | `npm test` | **PASS** — 77 files, 541 tests |
| Admin | `npm run build` | **PASS** after isolating stale `.next`; Next 15.5.22 production build completed |
| Admin | `npm run test:forge-benchmark` | **PASS** — 10 fixtures, schema 100%, consistency 100, content 99 |
| Admin | `npm run test -- src/lib/forge-sandbox-security.test.ts` | **PASS** — 6 tests |
| Admin visual | `npm run test:visual:shell` | **BLOCKED** — 7 tests require missing admin test credentials |
| Forge workflow | `admin: npm run test:forge-e2e` | **BLOCKED** — no server at `127.0.0.1:3301` |
| Forge workflow | `root: npm run test:forge-e2e` | **BLOCKED** — Docker unavailable |
| PostgreSQL | `npm run test:integration` | **BLOCKED** — Docker unavailable |
| Migrations | `npm run test:migration-consistency` | **PASS** — 2 tests |
| Migrations | `npm run check:migration-history` | **PASS** — 52 historical and 11 forward migrations locked |
| Migrations | `npm run test:migration-history` | **PASS** — 4 tests |
| Topology | `npm run check:production-topology` | **PASS** after correcting two test-fixture paths |
| Topology | `npm run test:production-topology` | **PASS** — 4 tests |
| Backup | `npm run test:backup-migration-safety` | **PASS** — 7 tests |
| Backup | `bash -lc 'export PATH="/c/nvm4w/nodejs:$PATH"; bash scripts/backup/test-backup-framework.sh'` | **PASS** |
| Nginx | `npm run test:nginx-config` | **BLOCKED** — Docker unavailable |
| Nginx | `npm run test:nginx` | **BLOCKED** — Docker unavailable |
| Web | `npm run lint` | **BLOCKED** — incomplete dependency extraction |
| Web | `npm test` | **BLOCKED** — missing `@vitest/mocker` |
| Web | `npm run build` | **BLOCKED** — missing Next `server/require-hook` |
| Web E2E | `npm run test:e2e:chromium` | **BLOCKED** — web application cannot start |
| Web E2E | `npm run test:e2e:cross-browser` | **BLOCKED** — web application cannot start |
| Web performance | `npm run check:performance-budgets` | **BLOCKED** — build/runtime unavailable |
| Web visual | Playwright visual suite without `--update-snapshots` | **BLOCKED** — web server cannot start |
| Browsers | Playwright install for Chromium, Firefox and WebKit | **PASS** |
| Supply chain | TruffleHog | **BLOCKED** — CLI unavailable |
| Supply chain | dependency review | **BLOCKED LOCAL** — GitHub-native gate only; workflow policy passes |
| Containers | web/admin image builds | **BLOCKED** — Docker unavailable |
| Containers | Trivy scans | **BLOCKED** — Docker and Trivy unavailable |
| Containers | SBOM generation | **BLOCKED** — images and Syft unavailable |
| Static analysis | CodeQL | **BLOCKED LOCAL** — CLI unavailable; workflow policy passes |
| Diff hygiene | `git diff --check` | **PASS** except line-ending normalisation notices |

## Forge journey coverage

The existing deterministic API workflow covers project/client creation, structured
intake, research, sitemap, copy rejection/regeneration, design, design system, component
specification, workspace creation, generated site, controlled QA failure, repair,
proposal generation, deployment blocking, fallback-quality approval, activity logs and
artifact provenance. Unit coverage additionally exercises run sequencing, optional
stages, approvals, retries, recovery, budget pauses, idempotency, operational health,
provider correlation and atomic QA/repair rules.

The requested browser-level journeys are **not release-proven**. In particular, no green
end-to-end evidence exists for pause/resume UI, provider fallback UI, affected-stage-only
feedback invalidation, preview approval/deployment preparation, worker restart recovery,
Advanced records, or historical-project compatibility. These remain mandatory release
blockers until run with the Docker-backed fixture.

## Visual evidence

The Playwright shell suite defines the requested six sizes:

- 1920×1080
- 1600×900
- 1440×900
- 1366×768
- 1024×768
- 390×844

It asserts horizontal overflow, clipped controls, responsive global navigation,
reduced-motion usability and persistent/reversible Focus Mode. The current run stopped
at authentication because test credentials were absent, so the generated images under
`admin/test-results/admin-shell/**/test-failed-1.png` are login/error diagnostics, **not**
accepted Forge screenshots. No visual baselines were updated.

Required authenticated captures still include `/dashboard`, `/forge`, `/forge/new` and
an active project in Overview, Build, Preview, Attention and Advanced views. The visual
acceptance criteria therefore remain unverified.

## Database migration and rollback

Pending forward migrations in this release include:

- Web `0010`–`0013`, including verified claims, enquiry intent, local-growth analytics
  and the additive `web_vital` enum value.
- Admin `0042`–`0048`, including historical reconciliation, dependency admission,
  tenant controls, durable operations, Forge Runs, operational health and atomic-stage
  cost fields.

Production sequence:

1. Freeze the candidate at a reviewed commit and record both existing migration ledgers.
2. Produce and verify an encrypted backup of PostgreSQL, environment configuration,
   Nginx state and generated workspaces.
3. Restore that backup into an explicitly isolated PostgreSQL 16 target.
4. Apply **web migrations first**, then **admin migrations**.
5. Run the guarded backup-migration verifier and attach its JSON evidence.
6. Confirm old projects, auth/RBAC, artifacts, jobs and workspaces before touching live
   traffic.

These migrations are primarily additive. Do not attempt ad-hoc down migrations for enum
values or populated Forge tables. Application rollback may use the previous image only
when it is schema-forward-compatible. Otherwise restore the tested pre-release backup.

## Deployment sequence

1. Resolve every blocker above on a clean Linux/CI runner.
2. Create a reviewed commit; rerun clean installs, audits, all app tests/builds,
   PostgreSQL/Forge/Nginx/backup suites, browser journeys and security jobs.
3. Record image digests, SBOMs, Trivy/CodeQL/TruffleHog/dependency-review results and
   inspected screenshots.
4. Verify production secrets, provider budgets, Docker sandbox mode, backup ownership,
   monitoring delivery and the maintenance window.
5. Back up and migrate web then admin.
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

No `.env.example` changes were introduced by this verification pass. Before the release
fixture can run it needs isolated/test values for:

- `TEST_DATABASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `AUTH_SECRET`
- `AUTH_TRUST_HOST=true`
- `FORGE_ENABLE_AI=false`
- `FORGE_DEFAULT_AI_PROVIDER=mock`
- `FORGE_JOB_MODE=inline`
- `FORGE_SANDBOX_RUNNER=local` for the disposable E2E runner only
- `FORGE_E2E_BASE_URL`
- `FORGE_QA_COMMAND_TIMEOUT_MS`

Production must use the Docker sandbox and real secret-manager values. It must also
configure the existing provider, monitoring, R2, Resend, backup, release-manager and
health-check variables documented in the operations runbooks. Never reuse E2E
credentials or local sandbox mode in production.

## Remaining manual production checks

- Inspect the six authenticated viewport captures and keyboard/focus order.
- Verify Focus Mode persistence and reversible global navigation.
- Verify actual production backup ownership, encryption, off-host retention and restore.
- Verify Sentry delivery and alert routing.
- Verify Cloudflare/Nginx origin controls and TLS without changing DNS during rehearsal.
- Confirm provider credentials, budgets and fallback policy with safe non-production
  calls.
- Confirm named deployment, database and rollback operators.
- Record human release approval only after every mandatory automated gate is green.
