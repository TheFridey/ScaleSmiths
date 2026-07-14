# Final production-readiness and security audit

> **Historical report (superseded):** This audit records the repository state on 2026-07-13 and is retained as evidence. It is not the current release decision or production runbook. Use the [release evidence index](../releases/README.md) and its latest report for current status.
>
> **Follow-up on 2026-07-14:** Migration SQL and journal baselines are now checksum-locked, the proven original `0012` was restored, compatibility moved to forward migration `0042`, and clean/upgrade database paths were added. The backup-restore evidence requirement remains open until an operator runs the guarded verifier against an isolated restore of the latest verified production backup. See [migration history and backup verification](../operations/migration-history-and-backup-verification.md).

Audit date: 2026-07-13  
Scope: repository state in this checkout, including uncommitted programme work  
Verdict: **No-go for production until the unresolved High findings are closed or explicitly accepted by the owner with compensating controls.**

## Method and limitations

The audit mapped the requested domains to implementation, migrations, tests, CI and operations documentation; ran static searches for secrets, environment access, subprocess/network boundaries and direct logging; ran dependency audits; applied migrations to disposable PostgreSQL; exercised the deterministic full Forge workflow; and ran application lint, unit tests and production builds.

No live Cloudflare, VPS firewall, Nginx reload, external monitoring provider, provider API, production database, backup store or production browser session was accessed. CI-only CodeQL, TruffleHog, Trivy, Hadolint and dependency-review jobs were reviewed but not reproduced locally. The dirty worktree contains extensive programme changes, so deployment must use a reviewed commit rather than this mutable checkout.

## Executive findings

| Severity | Open | Remediated in this audit |
| --- | ---: | ---: |
| Critical | 0 | 0 |
| High | 5 | 4 |
| Medium | 8 | 1 |
| Low | 4 | 0 |
| Nice to have | 3 | 0 |

Four High findings were safely corrected: missing migration journal entries, production sandbox fail-open behavior, nondeterministic artifact-version reads across implementation prerequisites, and integration/E2E drift from the actual workflow. The remaining High findings require operational infrastructure or a product-stage implementation and are not hidden below.

## Remediated findings

### High — admin migrations `0036`–`0041` were not journaled

Affected: [`admin/drizzle/meta/_journal.json`](../../admin/drizzle/meta/_journal.json), [`scripts/check-migrations.mjs`](../../scripts/check-migrations.mjs).

Drizzle would not apply delivery forecasting, operating brief, analytics, optimisation, deployment-candidate or release-gate migrations. All six entries were added in order. Migration verification now reports 42 SQL files and 42 journal entries, and disposable PostgreSQL migration tests pass.

### High — production generated-code execution could default to the local runner

Affected: [`admin/src/lib/forge-sandbox.ts`](../../admin/src/lib/forge-sandbox.ts), [`.env.example`](../../.env.example), [`docker-compose.dev.yml`](../../docker-compose.dev.yml), [`admin/src/lib/forge-sandbox-security.test.ts`](../../admin/src/lib/forge-sandbox-security.test.ts).

Production now defaults to Docker isolation when the runner is unspecified. The production-oriented environment example selects Docker, while development Compose explicitly selects local execution. Existing non-root, capability, filesystem, process, memory, CPU, network, secret-environment and log bounds remain intact.

### High — downstream generation could read a superseded artifact version

Affected: [`admin/src/lib/server/forge-component-spec-agent.ts`](../../admin/src/lib/server/forge-component-spec-agent.ts), [`admin/src/lib/server/forge-frontend-code-agent.ts`](../../admin/src/lib/server/forge-frontend-code-agent.ts).

Prerequisite queries used `limit(1)` without deterministic ordering. After approval created a new version, component/code generation could read the superseded draft and reject a valid workflow. Both agents now select the highest version/latest update for every prerequisite. The Forge E2E was extended to generate and approve the mandatory design-system artifact.

### High — PostgreSQL integration tests did not reproduce production migration ownership

Affected: [`admin/test/integration/postgres.integration.test.ts`](../../admin/test/integration/postgres.integration.test.ts).

The test applied admin migrations only even though production uses web then admin migrations against one database. It therefore missed the web-owned `experience_events` table declared for admin reads. The test now applies both real histories in production order with separate Drizzle migration tables and passes all seven integration cases.

### Medium — architecture security documentation was stale

Affected: [`docs/architecture/security-boundaries.md`](../architecture/security-boundaries.md).

The document incorrectly described CI scanning and AI budget enforcement as absent/process-local. It now reflects the security workflow and database-authoritative reservation implementation while retaining the real residual gaps.

## Unresolved findings

### High — generated dependency admission and per-site SBOM are absent

Affected: [`admin/src/lib/forge-release-gates.ts`](../../admin/src/lib/forge-release-gates.ts), [`admin/src/lib/server/forge-deployment-candidates.ts`](../../admin/src/lib/server/forge-deployment-candidates.ts), [`docs/security/generated-code-threat-model.md`](../security/generated-code-threat-model.md).

The release gate expects dependency-policy evidence, but there is no package allowlist/blocklist, version/licence policy, vulnerability evaluator, human override audit implementation or generated-site SBOM producer. The current gate fails closed when evidence is missing, but an owner may override it. **Required before generated-site production deployment:** implement the previously specified dependency-admission stage and remove routine reliance on overrides.

### High — no production monitoring adapter is registered

Affected: [`admin/src/lib/server/monitoring.ts`](../../admin/src/lib/server/monitoring.ts), [`web/src/lib/server-monitoring.ts`](../../web/src/lib/server-monitoring.ts), [`docs/operations/error-monitoring.md`](../operations/error-monitoring.md), [`.env.example`](../../.env.example).

The abstraction, redaction and integrations exist, but production remains a no-op until a vendor adapter is installed and registered. This prevents reliable exception alerting and incident correlation. Configure and staging-test an adapter before launch; do not send prompts, provider bodies, generated code or client forms.

### High — backup restore is documented but not evidenced or automated

Affected: [`docs/operations/canary-release-and-rollback.md`](../operations/canary-release-and-rollback.md), [`docs/operations/production-security-checklist.md`](../operations/production-security-checklist.md).

PostgreSQL, `.env`, Nginx and `generated-sites` backups are required, but the repository has no scheduled backup/restore verification and no recorded RPO/RTO. Establish encrypted off-host backups, retention, alerts and a recurring isolated restore drill before production.

### High — database isolation is application-level only

Affected: [`web/src/lib/db.ts`](../../web/src/lib/db.ts), [`admin/src/lib/db.ts`](../../admin/src/lib/db.ts), [`docs/architecture/security-boundaries.md`](../architecture/security-boundaries.md).

Both applications use one database credential and can access other clients’ and the other application’s tables. Query scoping exists, but PostgreSQL roles/RLS do not contain an application bug. Before higher-risk multi-client analytics or broader staff access, introduce least-privilege roles and evaluate row-level security with migration and operational testing.

### High — applied migration history appears mutable

Affected: [`admin/drizzle/0009_known_iron_monger.sql`](../../admin/drizzle/0009_known_iron_monger.sql), [`admin/drizzle/0012_client_request_threads.sql`](../../admin/drizzle/0012_client_request_threads.sql).

The worktree modifies older migration files to add idempotency/shared-table creation. This may be intentional for clean installs, but editing migrations already applied in production destroys checksum/history confidence. Confirm whether these exact files have ever run on production. If yes, freeze them and move corrective SQL to new forward-only migrations; do not deploy until clean- and upgraded-database paths are both proven.

### Medium — Forge E2E repair cycle did not complete locally

Affected: [`admin/scripts/forge-workflow-e2e.mjs`](../../admin/scripts/forge-workflow-e2e.mjs), [`scripts/run-forge-e2e-tests.mjs`](../../scripts/run-forge-e2e-tests.mjs), [`admin/src/lib/server/forge-qa-agent.ts`](../../admin/src/lib/server/forge-qa-agent.ts).

The corrected E2E passed authentication, client/project creation, approvals, design-system and component generation, workspace generation and the controlled QA failure. Its repair-stage dependency install exceeded the configured timeout; a test-owned npm child remained alive and was terminated. The Docker Desktop engine then became unavailable during cleanup. Treat the E2E as failed until it passes cleanly in CI/Linux or a healthy local Docker environment. Add child-tree termination coverage for timed-out Windows installs.

### Medium — monitoring and logs are not durable by themselves

Affected: [`admin/src/lib/server/logging.ts`](../../admin/src/lib/server/logging.ts), [`admin/src/lib/server/monitoring.ts`](../../admin/src/lib/server/monitoring.ts).

Structured production JSON, request IDs, redaction and safe error normalization are implemented and tested. Container stdout and the no-op monitoring default do not provide retention. Configure central log shipping, access controls, retention and alerts.

### Medium — SSRF defenses do not pin the validated DNS result

Affected: [`admin/src/lib/server/forge-site-crawler.ts`](../../admin/src/lib/server/forge-site-crawler.ts), [`admin/src/lib/server/forge-url-autofill.ts`](../../admin/src/lib/server/forge-url-autofill.ts).

Protocol, credentials, domain, redirect, private/link-local/metadata ranges, response size and timeout are checked at every hop. DNS is resolved for validation and then resolved again by `fetch`, leaving residual rebinding/TOCTOU risk. Run crawler egress through a restricted proxy/resolver or connect to a validated address while preserving TLS hostname verification.

### Medium — process-local operational controls do not scale across replicas

Affected: [`admin/src/middleware.ts`](../../admin/src/middleware.ts), [`admin/src/lib/server/forge-preview.ts`](../../admin/src/lib/server/forge-preview.ts), [`admin/src/lib/server/forge-job-runner.ts`](../../admin/src/lib/server/forge-job-runner.ts).

Forge request rate limits, attached previews and in-process background execution use process memory. They reset on restart and are not coordinated across replicas. Current single-admin-container deployment limits exposure; do not scale horizontally without durable queues/rate limits and preview reconciliation.

### Medium — prompt injection remains a semantic risk

Affected: [`admin/src/lib/server/forge-site-crawler.ts`](../../admin/src/lib/server/forge-site-crawler.ts), [`admin/src/lib/server/forge-ai.ts`](../../admin/src/lib/server/forge-ai.ts), [`admin/src/lib/forge-prompt-registry.ts`](../../admin/src/lib/forge-prompt-registry.ts).

Crawled content is treated as data, scripts are not executed, structured schemas are enforced and approvals/provenance are retained. A page can still influence semantically valid output. Keep canonical approved facts authoritative, label untrusted source blocks, require human review for claims and never allow model output to alter approvals or deployment directly.

### Medium — moderate production dependency advisories remain

Affected: [`web/package-lock.json`](../../web/package-lock.json), [`admin/package-lock.json`](../../admin/package-lock.json).

`npm audit --omit=dev` reports the PostCSS `GHSA-qx2v-qp2m-jg93` advisory through Next.js, plus the resulting Next/NextAuth chain. There are no high or critical findings, and npm proposes an unsafe major downgrade rather than an applicable fix. Track upstream patched releases and retest before upgrading.

### Medium — Auth.js remains a beta dependency

Affected: [`admin/package.json`](../../admin/package.json), [`admin/auth.ts`](../../admin/auth.ts), [`admin/auth.config.ts`](../../admin/auth.config.ts).

Persistent users, bcrypt, rate limits, MFA, secure/HTTP-only/SameSite cookies, eight-hour JWT expiry and per-request session-version revocation are implemented. `next-auth` is still `5.0.0-beta.31`; pin updates deliberately and regression-test login, middleware and revocation.

### Medium — host Nginx security behavior lacks automated integration tests

Affected: [`nginx/host-scalesmiths.conf`](../../nginx/host-scalesmiths.conf), [`nginx/cloudflare-access-admin.example.conf`](../../nginx/cloudflare-access-admin.example.conf).

Configuration documents trusted forwarding and origin restriction, but CI does not run Nginx routing/header/TLS tests. Add containerised config and request tests without embedding Cloudflare IP ranges in application code.

### Low

- The public health endpoint exposes environment and optional release metadata by design; keep it minimal and do not add dependency/database detail. Affected: [`web/src/app/api/health/route.ts`](../../web/src/app/api/health/route.ts).
- Admin/Forge mutation rate limiting uses actor email in an in-memory key. Logs are redacted, but use stable user IDs consistently where practical. Affected: [`admin/src/middleware.ts`](../../admin/src/middleware.ts).
- The root environment example contains conspicuous placeholder passwords. Hygiene checks allow examples, but operators must prove placeholders were replaced. Affected: [`.env.example`](../../.env.example).
- Public analytics uses first-party events, minimised metadata, duplicate suppression and GPC/DNT handling, but retention/deletion operations need production ownership. Affected: [`web/src/lib/experience-analytics.ts`](../../web/src/lib/experience-analytics.ts), [`docs/operations/experience-choice-analytics.md`](../operations/experience-choice-analytics.md).

### Nice to have

- Add automated backup restore and Nginx integration simulations to CI on a schedule.
- Add a repository-wide environment-variable ownership check that distinguishes runtime, build, test and host-only variables.
- Add external browser smoke checks for the production Cloudflare/Nginx path after manual release.

## Control-area assessment

| Area | Assessment | Primary evidence |
| --- | --- | --- |
| Authentication, MFA, sessions | Implemented; operational production MFA verification required | `admin/auth.ts`, `admin/auth.config.ts`, `admin/src/lib/server/mfa.ts`, `admin/src/middleware.ts` |
| RBAC and audit logs | Central policy and middleware enforcement with tests; not exhaustive across every route/client | `admin/src/lib/rbac.ts`, `admin/src/lib/rbac.test.ts`, `admin/src/middleware.ts` |
| Secrets/environment | Server-only separation, encryption keys and env hygiene exist; production placeholder review remains manual | `.env.example`, `scripts/check-env-hygiene.mjs` |
| Database/migrations | Shared DB, separate ordered histories; journal and integration topology repaired; historical mutation needs resolution | `web/drizzle`, `admin/drizzle`, integration suite |
| Forge workflow/provenance/registry | Central transitions, quality separation, version hashes/lineage and prompt/schema registry exist; latest-version reads repaired | Forge workflow/artifact/registry modules and tests |
| Providers/budgets | Adapter contracts, safe diagnostics, retries/circuit health and transactional reservations exist | provider, usage and reservation modules/tests |
| Sandbox/dependencies | Sandbox is strong and now production-fail-safe; dependency admission/SBOM is missing | sandbox modules/tests; release gates |
| CI/tests | Broad CI/security coverage and 475 passing unit tests; E2E repair remains failed locally | workflows and validation section |
| Performance/accessibility | Public route budgets, Chromium journeys/visual baselines, focused Firefox/WebKit smoke, and Forge accessibility/visual gates exist; production-origin measurement remains operational evidence | web test/config docs; Forge gate modules |
| Logging/monitoring/error handling | Structured/redacted logs and safe errors exist; production monitoring/log retention not configured | logging/monitoring modules and docs |
| Deployment/rollback/backups | Atomic blue-green simulation and fail-closed release gates exist; backup restoration lacks evidence | release manager/tests and runbooks |
| Client isolation/privacy | Query-level scoping and analytics minimisation exist; shared DB credential/RLS gap remains | portal/admin query modules and privacy docs |
| Prompt injection/SSRF | Layered defenses and approvals exist; semantic injection and DNS rebinding remain residual | crawler and AI boundary modules |
| Migration workflows | Analysis/execution artifacts, immutable mappings, approvals and conflict blocks exist | migration modules/tests and release gates |

## Validation evidence

Passed:

- `npm run check:env-hygiene`
- `npm run check:architecture-docs`
- `node scripts/check-migrations.mjs` — web 10 journal entries / 10 SQL files; admin 42 journal entries / 42 SQL files
- web `npm run lint`
- web `npm run test` — 61 tests
- web `npm run build`
- web `npm run test:e2e:chromium` — 23 Chromium journey and desktop/tablet/mobile visual-regression tests
- web `npm run test:e2e:cross-browser` — 4 focused Firefox/WebKit functional and hydration checks
- web `npm run check:performance-budgets` — 2 route budgets
- admin `npm run lint`
- admin `npm run test` — 414 tests
- admin `npm run build`
- admin `npm run test:forge-benchmark` — 10 deterministic fixtures, 100% schema pass, consistency 100, content 99
- root `npm run test:integration` — 7 real PostgreSQL tests
- root `npm run test:release-simulation` — 7 release/rollback simulations
- web/admin production dependency audits — zero high or critical findings

Failed/incomplete:

- `npm run test:forge-e2e` — mandatory stages and artifact-version bugs were repaired, but the final local repair cycle timed out during dependency installation and Docker Desktop became unavailable during cleanup.
- Browser journeys deliberately mock analytics and form submission boundaries, so browser success is not evidence that analytics persistence passed end to end; database persistence remains covered separately.
- Lighthouse route budgets and focused Firefox/WebKit coverage passed in the local Linux test containers. A production-origin Lighthouse run remains post-deployment evidence.
- CI-hosted CodeQL, TruffleHog, Trivy, Hadolint, SBOM and dependency-review jobs were inspected only.

## Deployment decision

Do not deploy generated client sites or treat this checkout as production-ready until generated dependency admission/SBOM, monitoring, backup restoration and applied-migration immutability are resolved, and the full Forge E2E passes in a clean Linux/CI environment. Public/admin application code compiles and its unit/database gates are healthy, but the unresolved High operational controls make an unconditional production approval unsafe.
