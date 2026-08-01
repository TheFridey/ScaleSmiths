# Forge V2 release readiness

- Evidence date: 2026-08-01
- Branch: `master`
- Final master SHA: `e79767b655987e84a4dcdaacfc905bf39293295b`
- Formal release verdict: **BLOCKED — DO NOT DEPLOY**

All mandatory automation recorded below passed for the final master tree. Automation is not production validation or human approval. The release remains blocked until an authorised production-derived restore drill, the manual production checklist, admin visual acceptance, and named human approval are evidenced.

## Authoritative scope

| Change | Merged SHA | Scope |
| --- | --- | --- |
| PR #35, Forge V2 release candidate | `5ac4bacd89cffc6bd524dfa527738ac239c961c2` | Forge V2 implementation |
| PR #36, release closure | `a9b4737a2dc4a9c53991086bd38545f426210466` | Release evidence and governance |
| PR #38, agent discovery metadata | `6fe922968bff3fa864b33ea998644dbaaccf3985` | Web metadata; no Forge behaviour change |
| Dependency/CI modernisation | `a977bcf96d2ff2b748ecfb272145197613dbe00a` | Recharts 3, Sentry handlers and immutable Node 24 GitHub Actions; introduced setup-node automatic root-cache failure |
| Setup-node root-cache hotfix | `688c24e8fd2a1d1b946991c7b4a967d9868a40e4` | Explicit application lockfile caches and cache-disabled root jobs; exposed retained Forge browser failures |
| PR #41, Forge E2E isolation and approval journeys | `e79767b655987e84a4dcdaacfc905bf39293295b` | Incident-scoped assertions, guarded manual E2E worker, deterministic cleanup and explicit approval journey semantics |

The final SHA is the authoritative deployable tree. Earlier candidate and merge-test runs are superseded except where a pull-request-only control is explicitly identified.

## Workflow evidence

| Workflow | Run ID | Exact SHA/context | Result |
| --- | --- | --- | --- |
| CI | `30705635955` | master `e79767b655987e84a4dcdaacfc905bf39293295b` | **Passed**; all 9 executed jobs passed, including Admin Forge E2E; PR Metadata skipped on push |
| Security | `30705635964` | master `e79767b655987e84a4dcdaacfc905bf39293295b` | **Passed**; 8 executed jobs passed, Dependency Review skipped on push |
| CodeQL | `30705635970`, job `91384129599` | master `e79767b655987e84a4dcdaacfc905bf39293295b` | **Passed**; JavaScript/TypeScript analysis |
| Dependency Review | Security `30705327839`, job `91383337693` | PR #41 head `021f657ec2abc08c737ff49268adc88a95b218b8` into `688c24e8fd2a1d1b946991c7b4a967d9868a40e4` | **Passed** |

Dependency Review is a pull-request-only control. Its successful PR #41 result covers the final master's latest delta; the master push skip is expected and is not reported as a pass.

### Retained failure and hotfix history

CI run `30699425735` on the setup-node hotfix pull request retained Admin Forge E2E artifact `8818420990` and reported 12 passed, 6 failed, and 1 flaky test. Journeys 8 and 10 used global selectors after incident preservation legitimately retained multiple incident surfaces; journeys 12–16 asserted superseded approval wording; and journey 4 left a real run processing until an accessibility job failed twice after approximately 180 seconds per attempt. The accessibility failure was caused by the uncontained non-fixtured run, not by an application, backup, migration, or production accessibility-gate defect.

PR #41 fixed the release harness without weakening production gates: exact incidents use stable identities, internal and client approval actions remain distinct, generated preview/copy fixtures represent their real persisted states, created runs are cancelled in failure-safe cleanup, and the isolated CI job advances real queued work explicitly. The manual worker mode requires the Forge E2E environment, an isolated/test database name, and the database marker row. Two clean local runs and both PR/master Admin Forge E2E jobs passed all 18 journeys on the first attempt with retries disabled.

### Final master component and test totals

The current pipeline has 9 mandatory CI components, 8 executed Security components on a master push, and 1 CodeQL analysis component. Pull-request Metadata and Dependency Review remain context-specific components and are not counted as master-push passes.

| Area | Result |
| --- | --- |
| Web unit | 29 files, 133 tests passed |
| Public Chromium journeys and visual regression | 47 tests passed |
| Cross-browser smoke | 6 tests passed |
| Admin unit | 84 files, 567 tests passed |
| Admin authenticated browser | 4 tests passed |
| Forge production journeys | 18 journeys plus authenticated setup passed on the first attempt with retries disabled |
| Forge workflow API E2E | Passed for disposable project 1; runner emitted no test count |
| PostgreSQL integration | 3 files, 29 tests passed |
| Forge benchmark | 10 fixtures; schema 100%, consistency 100%, content 99% |
| Migration journals | web 14 entries/14 SQL; admin 49 entries/49 SQL |
| Migration history policy | 52 historical and 11 forward migrations locked |
| Synthetic backup framework | Passed |

Public desktop, tablet, and mobile snapshots passed unchanged. The authenticated six-viewport admin shell suite is not part of this CI run and remains manual evidence.

## Security and supply-chain evidence

| Control | Evidence | Result |
| --- | --- | --- |
| Production npm audits | Security run `30705635964` | **Passed**, zero production vulnerabilities in web and admin |
| Full development audits | audit artifacts below | Four Moderate findings per app in the development-only Drizzle Kit chain; accepted temporarily |
| Container build and Trivy | Security run `30705635964` | **Passed**, no unfixed High/Critical findings |
| SPDX SBOM | web artifact `8820244531`; admin artifact `8820249591` | Produced |
| Container reports | web artifact `8820244653`; admin artifact `8820249697` | Produced |
| npm audit reports | web artifact `8820223340`; admin artifact `8820223881` | Produced |
| CodeQL | run `30705635970`, job `91384129599` | **Passed** |
| Secret scan, Dockerfile lint, sandbox fixtures | Security run `30705635964` | **Passed** |

The Auth.js beta remains a documented accepted risk under `docs/security/authjs-beta-risk-acceptance.md`; this ledger does not broaden that acceptance. The four Moderate development findings remain confined to Drizzle Kit's `@esbuild-kit/*`/esbuild tooling path, are absent from production installs, and retain the time-limited acceptance in `docs/security/dependency-audit-2026-07.md`.

## Remaining warnings

Admin lint now completes with zero warnings. The Recharts 2 deprecation and missing App Router Sentry global-handler findings were removed by the dependency/CI modernisation merge. GitHub Actions use immutable Node 24 action releases, and setup-node caching is explicit for every job, so no job searches for a deliberately absent root lockfile.

Retained warnings are limited to the documented upstream-only Drizzle Kit `@esbuild-kit/*` development-tooling deprecations, expected failure logs from fail-closed tests, and Webpack's large cache-string serialization diagnostic. CodeQL 3.37.4 remains the current official stable release while using its upstream Node 20 runtime. No compatibility override or warning suppression is enabled.

## Backup and recovery evidence

CI run `30705635955`, Backup and Restore job `91384129540`, passed against a synthetic disposable fixture. Artifact `backup-framework-test-log` ID `8820227801` records that framework test. It proves script safeguards, not recovery of production data.

Production-derived restore status: **Not executed; no evidence supplied.** Follow [the production restore drill](../operations/forge-v2-production-restore-drill.md) and complete [its evidence template](../operations/forge-v2-production-restore-evidence-template.md). Do not replace that gate with the synthetic CI result.

## Manual and human gates

| Gate | Current status | Required evidence |
| --- | --- | --- |
| Production-derived encrypted restore | **Not executed** | Signed restore evidence and migration/integrity reports |
| Manual production validation | **Not executed** | Completed [production validation checklist](../operations/forge-v2-production-validation.md) |
| Authenticated admin visual acceptance | **Not evidenced** | Human-reviewed viewport captures and accessibility observations |
| Human release approval | **Not granted** | Named approver, timestamp, final SHA and linked evidence |

## Formal decision

The final master automation is green and Dependency Review passed in the correct pull-request context. Recovery, production validation, admin visual acceptance, and human approval remain unevidenced. Forge V2 is therefore **BLOCKED — DO NOT DEPLOY**.
