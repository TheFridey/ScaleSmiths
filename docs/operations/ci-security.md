# CI security scanning

Security checks are split between `.github/workflows/security.yml` and `codeql.yml`. Existing lint, test and production-build CI remains unchanged.

## Enforcement thresholds

- CodeQL uses the `security-extended` JavaScript/TypeScript suite and uploads results for trusted branches, pushes and schedules.
- Dependency Review blocks newly introduced high or critical dependency vulnerabilities. It does not post PR comments.
- TruffleHog blocks verified secrets. Unverified pattern matches are not universal blockers.
- `npm audit --omit=dev --audit-level=high` blocks high/critical production dependency advisories. Complete JSON reports are retained for review.
- Trivy blocks fixed high/critical application-image vulnerabilities. Unfixed findings remain visible in the retained SARIF rather than blocking every change.
- Hadolint blocks error-level Dockerfile findings; warning/style guidance is reviewable but non-blocking.
- SBOM generation is informational and produces SPDX JSON for both application images.
- Migration checks require journal/file agreement, sequential indices, and successful application to a clean PostgreSQL 16 database.
- Environment hygiene and harmless generated-site sandbox attack fixtures are blocking.

## Fork and secret safety

No job uses `pull_request_target`, production environments, deployment credentials, provider keys, or repository secrets. Fork pull requests receive only read permissions. CodeQL upload is skipped for untrusted fork PRs because its security-event permission is unavailable there; it runs after merge and on the weekly schedule. Container builds use no runtime `.env` file.

## Exceptions

Do not disable an entire scanner to merge a change. A security exception must document the scanner/rule/advisory, affected package or image, exploitability analysis, compensating control, owner, expiry date, and follow-up issue. Prefer the scanner's narrow ignore mechanism pinned to the exact advisory or file. High/critical exceptions require owner or administrator approval and should expire within 30 days. Secret findings are never waived: rotate/revoke and remove the material.

Low-confidence, informational, warning and unfixed findings are reviewed from workflow artifacts during release preparation. Raise thresholds only when a finding is proven exploitable or policy changes; lower them gradually after the repository baseline is clean.

## Local verification

Run `node scripts/check-migrations.mjs`, `npm run check:env-hygiene`, and from `admin`, `npx vitest run src/lib/forge-sandbox-security.test.ts`. Dockerfile, image and CodeQL checks require their respective CI tools or containers.
