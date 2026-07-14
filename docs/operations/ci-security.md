# CI and security checks

ScaleSmiths uses three least-privilege GitHub Actions workflows. All cancel superseded runs for the same ref, set explicit job timeouts, and run without deployment or production credentials.

## Pull request and master gates

`.github/workflows/ci.yml` runs on pull requests to and pushes to `master`, plus manual dispatch:

- `Web`: installs from `web/package-lock.json`, then runs lint, unit tests, the production build, route performance budgets, Chromium journeys, and desktop/tablet/mobile Chromium visual regression. Performance runs before the dev-server browser suite so Next development output cannot replace the production manifest being measured;
- `Cross-browser Smoke`: installs from `web/package-lock.json` and runs only the focused functional chooser/preference suite in Firefox and WebKit;
- `Admin`: installs from `admin/package-lock.json`, then runs lint, unit tests, the deterministic Forge benchmark, and the production build;
- `Database and Migrations`: validates both migration journals, starts disposable PostgreSQL 16, and runs the real integration suite that applies both histories to an empty database;
- `Root Hygiene`: runs environment, architecture, dependency-governance, production-topology and workflow-policy checks, plus the harmless release/rollback simulation.

The root has no dependencies or lockfile. Root checks use Node directly and must not configure an npm cache against a nonexistent root `package-lock.json`. Web and admin npm caches remain isolated and keyed only by their respective lockfiles.

Failure evidence is retained for Playwright screenshots/traces/videos and reports, performance results, Forge benchmark reports, and migration/integration logs. Required commands run directly; jobs do not treat absent scripts as a successful skip.

## Security coverage

`.github/workflows/security.yml` runs on pull requests, `master`, the weekly schedule, and manual dispatch:

- Dependency Review blocks newly introduced high or critical dependency vulnerabilities on pull requests and does not post comments.
- TruffleHog blocks verified secrets across repository history.
- `npm audit --omit=dev --audit-level=high --json` blocks high/critical production advisories for each app while retaining the complete JSON output. Moderate advisories follow the documented dependency-governance review process rather than being hidden.
- Hadolint checks `web/Dockerfile` and `admin/Dockerfile` independently and blocks error-level findings.
- Trivy scans both built application images and blocks fixed high/critical findings.
- Anchore creates SPDX JSON SBOMs from each successfully built application image.
- The generated-site sandbox attack fixtures remain a blocking security job.

`.github/workflows/codeql.yml` runs the JavaScript/TypeScript `security-extended` query suite. JavaScript extraction does not need a synthetic root autobuild: the web and admin production builds are independent required CI jobs. CodeQL SARIF upload is skipped on untrusted fork pull requests because their token cannot receive `security-events: write`; it runs on trusted branches, pushes and schedules.

## Permissions and fork safety

All workflows default to `contents: read`, do not use `pull_request_target`, and receive no production environments, provider keys, database credentials or deployment credentials. CodeQL alone grants `security-events: write` to its analysis job. The PostgreSQL credentials are fixed ephemeral CI-only values.

## Enforcement and exceptions

Do not disable an entire scanner to merge a change. A security exception must document the scanner/rule/advisory, affected package or image, exploitability analysis, compensating control, owner, expiry date, and follow-up issue. Prefer a narrow ignore pinned to the exact advisory or file. High/critical exceptions require owner or administrator approval and should expire within 30 days. Secret findings are never waived: rotate/revoke and remove the material.

Low-confidence, informational, warning and unfixed findings remain reviewable in workflow output and artifacts. Hard gates are limited to established application checks, high-confidence secrets, migration/integration correctness, and the documented high/critical vulnerability thresholds.

## Local validation

Run the repository-owned structural checks first:

```sh
npm run check:github-actions
npm run test:github-actions
npm run test:migration-consistency
node scripts/check-migrations.mjs
```

Validate workflow YAML and GitHub expressions with Actionlint when Docker is available:

```sh
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7
```

The remaining application commands are documented in the public Playwright, PostgreSQL integration, performance-budget and dependency-governance runbooks. CodeQL upload, Dependency Review and GitHub token permission behaviour can only be proven by an actual GitHub-hosted workflow run. Trivy, Hadolint and SBOM steps can be reproduced locally with their pinned containers/actions, but local YAML validation is not evidence that those hosted jobs passed.
