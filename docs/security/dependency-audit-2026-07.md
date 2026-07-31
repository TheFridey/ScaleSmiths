# Dependency and CI security audit — July 2026

- Date: 2026-07-29
- Last updated: 2026-07-31 (Dependency Review verification and resolved runtime gates)
- Scope: `web`, `admin`, dependency governance, security CI, and the disposable backup/restore drill
- Baseline: Node.js 22.14.0 and npm 10.9.2

## Outcome

Both production dependency trees now report zero vulnerabilities. Both full trees report zero High and zero Critical findings. The four remaining Moderate findings in each full audit belong to the development-only Drizzle Kit command-line chain (`drizzle-kit` → deprecated `@esbuild-kit/*` → `esbuild`) and are not installed in production.

| Application | Audit | Before | After |
| --- | --- | ---: | ---: |
| web | production | 5 High | 0 |
| web | full | High findings present | 4 Moderate, 0 High, 0 Critical |
| admin | production | 5 High, 2 Critical | 0 |
| admin | full | High and Critical findings present | 4 Moderate, 0 High, 0 Critical |

The retained machine-readable results are:

- `audit-results/web-production.json`
- `audit-results/web-full.json`
- `audit-results/admin-production.json`
- `audit-results/admin-full.json`

## Finding classification and remediation

### Production reachable

- `next` was upgraded in both applications from 15.5.20 to stable 15.5.22, with `eslint-config-next` kept aligned.
- Admin Auth.js was upgraded from `next-auth` 5.0.0-beta.31 to beta.32. Its patched `@auth/core` 0.41.3 is now transitive; the unused duplicate direct `@auth/core` declaration was removed.
- Admin `bcryptjs` was aligned with web at 3.0.3. The obsolete external bcrypt type package was removed because bcryptjs supplies its own declarations.
- Direct `undici` remains required: admin imports it in safe outbound HTTP and Forge E2E code.

### Production transitive

- Next.js 15.5.22 still declares PostCSS 8.4.31 and Sharp below the audited safe release. The `overrides.next` entries narrowly resolve only Next.js's nested dependencies to PostCSS 8.5.25 and Sharp 0.35.0.
- `brace-expansion` is overridden to 5.0.8 because npm's advisory range includes all earlier supported branches and the dependency graph cannot otherwise select a non-vulnerable release.
- Safe npm lockfile remediation also updated vulnerable `fast-uri` transitive resolutions.

### Development and tooling only

The remaining Moderate chain is reachable only through `drizzle-kit`, which is used for migration tooling and is absent from `npm audit --omit=dev`. Upstream currently exposes the deprecated esbuild loader chain and npm's suggested remedy is a breaking downgrade to Drizzle Kit 0.18.1. That downgrade is rejected because it would be incompatible with the current migrations and schema tooling.

Owner: Engineering / platform  
Review or expiry date: 2026-10-31  
Required review: upgrade when Drizzle Kit removes the affected loader chain, then rerun migration consistency and database integration tests.

### Contextually non-exploitable

No High or Critical finding is being accepted as contextually non-exploitable. The remaining Moderate esbuild development-server advisory requires an attacker to interact with the local tooling server and is not present in either production install.

### Breaking-major proposals rejected

`npm audit fix --force` was not run. npm's proposals included an unsupported Next.js 9 downgrade and a breaking Drizzle Kit downgrade; neither is a valid security remediation. No Next.js 16, React 19, canary, alpha, or unsupported framework release was introduced.

## Override register

| Override | Reason | Removal condition |
| --- | --- | --- |
| `next > postcss = 8.5.25` | Next.js 15.5.22 embeds vulnerable PostCSS 8.4.31. | Remove when a supported stable Next.js 15 patch declares an audit-safe PostCSS and both CSS/build/E2E gates pass without it. |
| `next > sharp = 0.35.0` | The Next.js optional Sharp range otherwise resolves below the audited safe release. | Remove when the supported Next.js line declares Sharp 0.35.0 or newer and production audit remains clean. |
| `brace-expansion = 5.0.8` | All earlier dependency branches fall inside the npm advisory range. | Remove when every declared dependency range resolves an audit-safe release without a global override. |

The overrides are identical in web and admin so framework behavior remains aligned.

## GitHub Actions remediation

- Removed the duplicate TruffleHog failure flag.
- Pinned security-sensitive third-party actions in `security.yml` to immutable commit SHAs.
- Replaced the invalid Trivy reference with pinned Trivy action v0.36.0.
- Trivy still enforces High/Critical failures, but SARIF and SPDX evidence uploads now run before enforcement.
- Dependency Review now checks the GitHub SBOM endpoint and fails with an actionable instruction when Dependency Graph is unavailable; it cannot silently pass without reviewing dependencies.
- CodeQL and generated-site sandbox security coverage are preserved.
- Repository policy tests now reject mutable security action references, duplicate TruffleHog failure flags, and Trivy enforcement that precedes evidence upload.

## Dependency Review verification

### Dependency Graph is now enabled

GitHub Dependency Graph was previously disabled for this repository. It has now been
enabled under **Settings → Security → Advanced Security**. Direct API probes on
2026-07-31 confirm the endpoints the workflow depends on:

| Endpoint | Result |
| --- | --- |
| `GET /repos/TheFridey/ScaleSmiths/dependency-graph/sbom` | **HTTP 200** — SPDX-2.3 document returned |
| `GET /repos/TheFridey/ScaleSmiths/dependency-graph/compare/{base}...{head}` | **HTTP 200** |

### The previous failure was not a vulnerability finding

Dependency Review failed on PR #35 (Security run `30588518347`, merge-test SHA
`44e7e3a8d5a20e0cd754b66f8e353a71e5013b44`). The job log records:

```text
Dependency Review could not run (GitHub API HTTP 404). Enable Dependency Graph in
Settings > Security > Advanced Security, then rerun this workflow.
```

That is the workflow's own preflight guard failing closed against an **unavailable
Dependency Graph endpoint**. `actions/dependency-review-action` never executed, so it
reported no vulnerable dependency, no disallowed licence and no disallowed dependency
change. The failure must not be read as a security finding, and the guard must not be
weakened or skipped to make the check green.

Dependency Review is skipped by design on `push` events because the action requires a
pull-request context. Branch-push evidence therefore cannot substitute for it.

### Authoritative verification event

Pull request [#36](https://github.com/TheFridey/ScaleSmiths/pull/36), opened from
`chore/forge-v2-release-closure`, is the authoritative verification event for Dependency
Review. It has now run in its native pull-request context and **passed**.

| Field | Value |
| --- | --- |
| Pull request | [#36](https://github.com/TheFridey/ScaleSmiths/pull/36) |
| Workflow | Security, run `30619638107`, job `91120844879` |
| Branch head SHA | `a8d93656beaff245994cc3971911932cd9817953` |
| Checked SHA | `b24c5800b1f215ede4c32af0b8944dfa8b6f356f` — merge of `a8d93656` into `5ac4bacd` |
| Dependency Graph preflight | **HTTP 200** (previously HTTP 404) |
| Dependency Review conclusion | **Passed** |

Findings, quoted from the job log:

```text
Dependency review did not detect any vulnerable packages with severity level "high" or higher.
Dependency review did not detect any denied packages
```

This is a confirmation of **no disallowed dependency change**. The pull request changes no
dependency manifest or lockfile, so the reviewed diff contains no added, removed or
upgraded package; the check nevertheless executed against the real Dependency Graph rather
than failing closed on an unavailable endpoint, which is exactly what needed proving.

No finding was suppressed, and the preflight guard in `security.yml` was not weakened or
skipped. Had the check reported a real finding it would have been investigated and fixed,
not waived without a documented, time-limited and separately reviewed risk decision.

The commit that records this result re-triggers CI, Security, CodeQL, Dependency Review
and PR metadata validation against a new merge SHA. That is expected: the table above
pins the first successful verification event rather than chasing each subsequent merge
SHA. The pull request must not be merged until the checks on its final commit pass.

### Dependency posture at verification time

- Production audits remain **zero-vulnerability** for both `web` and `admin`
  (`npm audit --omit=dev`), confirmed by Security run `30588532278` on merged `master`
  `5ac4bacd89cffc6bd524dfa527738ac239c961c2`.
- The four Moderate development-only Drizzle Kit/esbuild findings per application remain
  **accepted temporarily** under the owner and expiry recorded above (Engineering /
  platform, review by 2026-10-31). They are absent from both production installs.
- `npm audit fix --force` is **not authorised**. Its proposals remain an unsupported
  Next.js downgrade and a breaking Drizzle Kit downgrade; neither is a valid security
  remediation.

## Backup diagnostics

The disposable backup framework now:

- records the exact failed command, line, and exit status through an `ERR` trap;
- redacts PostgreSQL credentials and secret/password/passphrase/token assignments without case sensitivity;
- copies redacted internal logs and JSON restore evidence to `ci-artifacts`;
- copies diagnostics before the existing `EXIT` cleanup removes decrypted temporary data;
- uploads the complete diagnostics directory from CI even when the drill fails.

## Commands and evidence

Completed successfully in a clean Ubuntu/WSL ext4 checkout unless noted:

- `npm ci` — passed for web and admin.
- `npm audit --omit=dev --json` — web 0 findings; admin 0 findings.
- `npm audit --json` — web/admin each 4 Moderate, 0 High, 0 Critical.
- `npm run lint` — passed for web and admin.
- `npm run test` — web: 27 files, 124 tests passed; admin: 69 files, 499 tests passed.
- `npm run build` — web and admin production builds passed on Next.js 15.5.22; Tailwind/PostCSS compilation completed and existing Sentry instrumentation loaded.
- `npm run forge:benchmark` — 10 fixtures passed; schema 100%, consistency 100, content 99.
- `npm run test:integration` — 3 files, 24 tests passed against disposable PostgreSQL.
- `npm run check:github-actions` — passed.
- `npm run test:github-actions` — 6 tests passed.
- `npm run check:dependency-governance` — passed.
- `npm run test:dependency-governance` — 3 tests passed.
- `git diff --check` — passed.

## Incomplete runtime gates

The Forge E2E rerun reached the controlled QA stage after successful migrations, owner bootstrap, authentication, client creation, and Forge intake/research/sitemap/copy/design/design-system/component/workspace/site-generation API stages. At that point the local WSL service suffered a host-level I/O failure (`Wsl/Service/E_UNEXPECTED` and failed `/etc/passwd` lookups) twice. The application log contained no server exception before the subsystem failed.

That host failure also made the PostgreSQL-backed backup/restore drill and ShellCheck unavailable for the final rerun. These gates were therefore **not claimed as passed** at the time of that local run.

### Resolved on GitHub Actions (2026-07-31)

Those gates have since been rerun on Linux GitHub Actions runners and **passed** on merged `master` `5ac4bacd89cffc6bd524dfa527738ac239c961c2`, CI run `30588532289` and Security run `30588532278`:

| Gate | Job | Status |
| --- | --- | --- |
| `npm run test:forge-e2e` | CI `Forge Workflow E2E` | **Passed** |
| `shellcheck -x scripts/backup/*.sh` | CI `Backup and Restore` | **Passed** |
| `npm run test:backup-framework` | CI `Backup and Restore` | **Passed** — synthetic fixture only |
| Public browser E2E and visual regression | CI `Web`, `Cross-browser Smoke` | **Passed** |
| Container image build, Trivy scan and SBOM | Security `Image Security (web)`, `Image Security (admin)` | **Passed** |

The backup drill is synthetic: it creates a disposable PostgreSQL source inside the runner. It proves the framework, encryption, redaction and verifier logic, and proves nothing about production data. An authorised production-derived encrypted backup restore is **not executed** and remains a release blocker.

No production deployment should be approved until that restore, the documented manual production checks, and the Dependency Review verification above are complete. See `docs/release-readiness/forge-v2.md`.
