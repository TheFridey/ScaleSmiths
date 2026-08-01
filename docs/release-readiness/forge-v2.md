# Forge V2 release readiness

- Evidence date: 2026-08-01
- Branch: `master`
- Final master SHA: `688c24e8fd2a1d1b946991c7b4a967d9868a40e4`
- Formal release verdict: **BLOCKED — DO NOT DEPLOY**

All mandatory automation recorded below passed for the final master tree. Automation is not production validation or human approval. The release remains blocked until an authorised production-derived restore drill, the manual production checklist, admin visual acceptance, and named human approval are evidenced.

## Authoritative scope

| Change | Merged SHA | Scope |
| --- | --- | --- |
| PR #35, Forge V2 release candidate | `5ac4bacd89cffc6bd524dfa527738ac239c961c2` | Forge V2 implementation |
| PR #36, release closure | `a9b4737a2dc4a9c53991086bd38545f426210466` | Release evidence and governance |
| PR #38, agent discovery metadata | `6fe922968bff3fa864b33ea998644dbaaccf3985` | Web metadata; no Forge behaviour change |
| PR #39, dependency and CI modernisation | `a977bcf96d2ff2b748ecfb272145197613dbe00a` | Introduced setup-node v6; root jobs unintentionally inherited automatic npm caching |
| PR #40, setup-node cache hotfix | `688c24e8fd2a1d1b946991c7b4a967d9868a40e4` | Makes every setup-node cache decision explicit |

The final SHA is the authoritative deployable tree. Earlier candidate and merge-test runs are superseded except where a pull-request-only control is explicitly identified.

## Workflow evidence

| Workflow | Run ID | Exact SHA/context | Result |
| --- | --- | --- | --- |
| CI | `30699429842` | final master SHA | **In progress**; completed job results recorded below |
| Security | `30699429845` | final master SHA | **Passed**; 8 executed jobs passed, Dependency Review skipped on push |
| CodeQL | `30699429859` | final master SHA | **Passed**; JavaScript/TypeScript analysis |
| Dependency Review | Security `30699425742`, job `91367653538` | PR #40 head `cd5760e5d54b14e0598c2da9de3a9be524ea49e5` | **Passed** |
| PR Metadata | CI `30699425735`, job `91367653613` | PR #40 head | **Failed**; PR was merged with the template uncompleted |

Dependency Review and PR Metadata are pull-request-only controls. Dependency Review passed. PR Metadata did not: PR #40 was merged at 2026-08-01T12:18:19Z while its workflows were still running, and its body retained the untouched template. The failed governance check cannot be replaced by a master-push result or described as passed.

The previous master `a977bcf96d2ff2b748ecfb272145197613dbe00a` failed root job setup before their commands ran because setup-node v6 detected the root `packageManager` declaration and looked for a nonexistent root lockfile:

```text
Dependencies lock file is not found in the repository root.
Supported patterns: package-lock.json, npm-shrinkwrap.json, yarn.lock.
```

That was cache configuration failure, not an application, Nginx, PostgreSQL, or backup-framework defect. PR #40 disables package-manager caching for Backup and Restore, Root Hygiene, PR Metadata, and Nginx Topology, and gives Forge Workflow E2E both application lockfiles. No root lockfile was added.

### Final master component and test totals

The current pipeline has 9 mandatory CI components, 8 executed Security components on a master push, and 1 CodeQL analysis component. Pull-request Metadata and Dependency Review remain context-specific components and are not counted as master-push passes.

| Area | Result |
| --- | --- |
| Web unit | 30 files, 135 tests passed |
| Public Chromium journeys and visual regression | 47 tests passed |
| Cross-browser smoke | 6 tests passed |
| Admin unit | 83 files, 563 tests passed |
| Admin authenticated browser | 4 tests passed |
| Forge production journeys | 19 tests passed |
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
| Production npm audits | Security run `30644768930` | **Passed**, zero production vulnerabilities in web and admin |
| Full development audits | audit artifacts below | Four Moderate findings per app in the development-only Drizzle Kit chain; accepted temporarily |
| Container build and Trivy | Security run `30644768930` | **Passed**, no unfixed High/Critical findings |
| SPDX SBOM | web artifact `8798999684`; admin artifact `8799008416` | Produced |
| Container reports | web artifact `8799000204`; admin artifact `8799008703` | Produced |
| npm audit reports | web artifact `8798944545`; admin artifact `8798945564` | Produced |
| CodeQL | run `30644768934`, job `91203312203` | **Passed** |
| Secret scan, Dockerfile lint, sandbox fixtures | Security run `30644768930` | **Passed** |

The Auth.js beta remains a documented accepted risk under `docs/security/authjs-beta-risk-acceptance.md`; this ledger does not broaden that acceptance. The four Moderate development findings remain confined to Drizzle Kit's `@esbuild-kit/*`/esbuild tooling path, are absent from production installs, and retain the time-limited acceptance in `docs/security/dependency-audit-2026-07.md`.

## Remaining warnings

The final master logs retain development-only `@esbuild-kit/core-utils` and `@esbuild-kit/esm-loader` deprecations, Node `DEP0040` (`punycode`) and `DEP0169` (`url.parse`) dependency warnings, Sentry source-map upload warnings when CI has no auth token, the upstream Webpack large-string cache diagnostic, and a runner warning that upload-artifact v5 still declares the retiring Node 20 runtime while GitHub forces it to Node 24. CodeQL 3.37.4 likewise remains an upstream Node 20 action.

The previous nine admin unused-code warnings and Recharts 2.x deprecation are removed. Recharts 3.10.1 and the App Router global error handlers remain in place. The four Moderate findings per full application audit remain confined to development-only Drizzle Kit tooling; production audits remain at zero vulnerabilities.

## Backup and recovery evidence

CI run `30699429842`, Backup and Restore job `91367665105`, passed against a synthetic disposable fixture. It proves script safeguards, not recovery of production data. The setup-node regression occurred before this job's commands and did not establish a backup defect.

Production-derived restore status: **Not executed; no evidence supplied.** Follow [the production restore drill](../operations/forge-v2-production-restore-drill.md) and complete [its evidence template](../operations/forge-v2-production-restore-evidence-template.md). Do not replace that gate with the synthetic CI result.

## Manual and human gates

| Gate | Current status | Required evidence |
| --- | --- | --- |
| Production-derived encrypted restore | **Not executed** | Signed restore evidence and migration/integrity reports |
| Manual production validation | **Not executed** | Completed [production validation checklist](../operations/forge-v2-production-validation.md) |
| Authenticated admin visual acceptance | **Not evidenced** | Human-reviewed viewport captures and accessibility observations |
| Human release approval | **Not granted** | Named approver, timestamp, final SHA and linked evidence |

## Formal decision

The final master Security and CodeQL workflows passed, Dependency Review passed in the correct pull-request context, and the setup-node regression is corrected. PR Metadata failed and PR #40 was merged before its final-SHA checks completed. Recovery, production validation, admin visual acceptance, and human approval also remain unevidenced. Forge V2 is therefore **BLOCKED — DO NOT DEPLOY**.
