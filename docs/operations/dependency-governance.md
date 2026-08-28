# Dependency governance

ScaleSmiths keeps separate npm manifests and lockfiles for `web` and `admin`. Framework, authentication, cryptography and database runtime dependencies listed in `scripts/dependency-governance-policy.json` use exact reviewed versions. Other packages may retain compatible ranges, but production and CI always install the committed lockfile with `npm ci`.

Run `npm run check:dependency-governance` whenever either manifest, lockfile or Docker base changes. The check verifies manifest/lock agreement, exact critical pins, Next.js ecosystem alignment, matching React versions and the recorded advisory register. It does not replace `npm audit`.

## Dependabot review

Dependabot runs weekly and keeps web npm, admin npm, web Docker and admin Docker updates separate. Routine patch updates are grouped. Framework and authentication packages are isolated from routine updates so their regression evidence is visible. Dependabot does not merge automatically; every pull request requires normal review and CI.

Major Next.js and React updates are ignored by automated update PRs. They require an explicit migration plan. A Next.js patch must update `next`, `eslint-config-next` and resolved `@next/*` packages together in both applications.

## npm audit review

For each dependency change:

1. Run `npm audit --omit=dev --audit-level=high` separately in `web` and `admin`. High or Critical production findings block merge and release.
2. Save or inspect the full JSON output when a finding exists. Confirm the affected package, dependency path, runtime reachability, exploit conditions and available fixed version.
3. Never run `npm audit fix --force` without reviewing its complete manifest and lockfile diff. Do not accept a framework downgrade merely to make the report empty.
4. Record a lower-severity acceptance in `scripts/dependency-governance-policy.json` with advisory ID, severity, dependency source, reason and review date. Acceptance is temporary and must not suppress the audit output.

The July 2026 review resolved the embedded PostCSS advisory with a scoped npm override while retaining the stable Next.js 15 line. The override and its removal condition are recorded in `docs/security/dependency-audit-2026-07.md`; it must not be replaced with npm's unsafe forced framework downgrade.

## Framework patch process

1. Read the Next.js release and security notes for the exact target patch.
2. Update both application manifests together and regenerate each lockfile independently.
3. Confirm `next`, `eslint-config-next`, `@next/env`, `@next/eslint-plugin-next` and installed `@next/swc-*` versions match.
4. Run the governance check, audits, clean installs, lint, tests and builds for both apps.
5. Run public Playwright coverage when framework runtime behavior changes and Forge/authentication integration tests when admin runtime behavior changes.
6. Rebuild and scan both Docker images when the candidate is prepared; do not deploy from a dependency-review pull request.

## Authentication updates

Admin remains on the reviewed `next-auth` `5.0.0-beta.32`. The npm `latest` tag is the older v4 stable line, so changing tags is not a safe stable migration. The machine-readable pre-release exception in `scripts/dependency-governance-policy.json` must match the exact manifest pin and points to the full API inventory, rationale, test evidence, checklist and exit criterion in `docs/security/authjs-beta-risk-acceptance.md`. Any Auth.js update must be deliberate and prove credentials login, MFA success/failure and recovery code use, middleware protection, secure cookie settings, role/session-version revocation, disabled-user rejection, logout and rate limiting.

## Lockfiles and Docker digests

- Review lockfile root declarations, resolved versions, integrity changes, added/removed packages and lifecycle scripts. Unrelated lockfile churn should be removed before review.
- Use `npm ci`, never an unlocked production install.
- Docker base-image digest updates receive separate Dependabot pull requests. Review upstream Node/Alpine changes, rebuild both images, run Trivy at the documented threshold and record new immutable image IDs/SBOMs in release evidence.
- A digest update must not remove the non-root runtime user or weaken the existing image hardening.
