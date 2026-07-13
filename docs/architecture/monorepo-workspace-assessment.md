# Monorepo Workspace Assessment

Date: 2026-07-13

Status: recommendation only; no package-manager, workspace, CI, Docker, or deployment changes were made.

## Verdict

**Do not adopt pnpm or Turborepo now. Keep the current independently installed `web` and `admin` applications for the next delivery cycle. Prepare for a later, low-risk move to plain npm workspaces only after the repository has at least one real shared package.**

The repository has enough duplication to justify extracting shared contracts and configuration, but not enough packages or build-graph complexity to justify changing both package management and task orchestration today. Plain npm workspaces are the best eventual fit because npm is already used throughout local scripts, CI, Dockerfiles, security scans, generated-site tooling, and deployment documentation. Turborepo should be reconsidered only when measured CI timings show that shared task caching would repay its configuration and cache-governance cost.

## Current Evidence

The checkout is a multi-application repository, not a formal JavaScript workspace:

- the root `package.json` is private and contains orchestration and hygiene scripts, but no `workspaces` field and no dependencies;
- `web/package-lock.json` and `admin/package-lock.json` are separate lockfile-version-3 dependency graphs, containing 641 and 646 package entries respectively;
- CI installs, tests, and builds the applications in separate jobs and caches each application from its own lockfile;
- each production Docker image uses its application directory as the build context and runs its own `npm ci`;
- both applications load the repository-root `.env` explicitly with `node --env-file-if-exists=../.env`, while Compose injects that same root file;
- PostgreSQL is shared, but Drizzle schemas and migration histories remain application-owned. The documented production order is web migrations followed by admin migrations;
- the current source footprint is approximately 109 files under `web/src` and 338 under `admin/src`, with two deployable applications rather than a broad package graph;
- generated Forge workspaces are runtime data under `generated-sites`, not repository workspaces, and must not be included in a JavaScript workspace glob.

### Dependency duplication

The applications declare 22 packages in common: nine runtime dependencies and thirteen development dependencies. Twenty-one use identical declared ranges. The exception is `bcryptjs` (`^3.0.3` in web and `^2.4.3` in admin), which is a compatibility decision to resolve before any shared lockfile migration.

Common runtime packages include Next.js, React, Drizzle, PostgreSQL, `clsx`, `lucide-react`, and `tailwind-merge`. The entire TypeScript, ESLint, Tailwind/PostCSS, Drizzle Kit, and Vitest toolchain is repeated. A workspace could reduce lockfile churn and installation duplication, but a shared lockfile also increases the blast radius of dependency updates and makes an application-only rollback less self-contained.

### Configuration duplication

`web/tsconfig.json` and `admin/tsconfig.json` are byte-for-byte identical. The two `eslint.config.mjs` files are also byte-for-byte identical. These are clear candidates for shared base configuration.

Tailwind and Next.js configurations differ and should remain application-specific. PostCSS configuration is similar in purpose but not identical. Both Dockerfiles repeat most install/build stages, although admin has additional standalone-output behavior and a different port.

### Shared domain contracts and schemas

There is meaningful drift risk across application boundaries:

- seven PostgreSQL tables are defined in both Drizzle schema files: quote requests, client requests, client-request messages, client timeline events, monthly reports, experience events, and login rate limits;
- client-request categories, priorities, statuses, and related types are independently declared in both applications;
- the applications communicate through a shared database rather than a versioned package or service API, so schema compatibility is hidden coupling.

A future `packages/contracts` package could own database-independent enums, validation schemas, DTOs, and safe serialisation rules. It should not initially own migrations or server-only database clients. Moving shared Drizzle table definitions is a separate, higher-risk project because the existing migration ownership and web-specific migration table are operational safeguards.

No general shared validation package currently exists. Validation is mostly local to the application or Forge module. Extract only schemas used by both applications; do not turn admin-only Forge schemas into a generic package.

### Shared UI tokens

Both global stylesheets use some similarly named variables, including background, accent, status colours, and font families, but the values and visual roles differ. The public site and internal admin intentionally have different presentation systems. Share semantic primitives or brand constants only when there is an actual cross-application contract; do not introduce a shared component library or force token values to converge.

### Build caching and CI

GitHub Actions already runs web and admin in parallel. It caches npm downloads, but not lint/test/build results or `.next` outputs. Turborepo can fingerprint task inputs and restore outputs locally or from a remote cache, but its largest benefit here would require:

- consolidating or coordinating the currently separate CI jobs;
- defining complete environment-variable inputs so builds are not restored against the wrong configuration;
- deciding whether and where remote cache data may be stored;
- excluding database integration tests, live-provider evaluations, release simulations, and other stateful tasks from unsafe caching.

With only two build targets, this should be driven by measured cold and warm CI duration, not assumed savings. npm workspaces alone provide command fan-out and local-package linking, not content-aware task caching.

## Option Comparison

| Option | Benefits | Costs and risks | Fit now |
| --- | --- | --- | --- |
| Keep current structure | Lowest migration risk; independent lockfiles, Docker contexts, deploys, and rollbacks; current CI and operational docs remain accurate | Duplicate installs/config; shared contracts can drift; root orchestration remains manual | **Best immediate choice** |
| npm workspaces | Familiar tooling; one root lockfile; automatic local-package linking; workspace-targeted commands; natural path to `packages/contracts` and shared config | Rewrites both locks; changes Docker build contexts and cache keys; dependency changes affect both apps; requires careful Next.js standalone tracing and migration-script checks | **Best eventual workspace choice** |
| pnpm workspaces | Single workspace lockfile by default; strict declared-dependency access; content-addressable store; explicit `workspace:` protocol; strong filtering | New package manager and lockfile; strict resolution can expose hidden hoisting assumptions; every CI, Docker, security, SBOM, release, and generated-site assumption needs review; team onboarding cost | Do not proceed without a separate measured reason to change package manager |
| Turborepo with npm | Keeps familiar package manager while adding task graph, affected execution, local/remote caching, and consistent root commands | Adds task/output/env configuration; remote cache policy; limited payoff with two apps; Docker pruning changes current isolated contexts | Reassess after npm workspaces and timing evidence |
| Turborepo with pnpm | Strong workspace filtering and dependency discipline plus task caching; suitable for a larger package graph | Combines two migrations, maximising lockfile, module-resolution, Docker, CI, and operational risk; hardest rollback | Do not proceed at current scale |

Current tool behavior supporting this comparison is documented by [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces/), [pnpm workspaces and their shared lockfile](https://pnpm.io/workspaces), [Turborepo caching](https://turborepo.dev/docs/crafting-your-repository/caching), and [Turborepo's Docker guidance](https://turborepo.dev/docs/guides/tools/docker).

## Operational Impact of a Future Workspace

### Docker and deployment

The current `./web` and `./admin` Docker build contexts cannot access a root lockfile or sibling shared package. A workspace migration would require root build contexts with app-specific Dockerfiles, carefully pruned copy inputs, and verification of Next.js standalone output paths. This can weaken cache efficiency or accidentally copy sensitive/unnecessary repository content unless `.dockerignore` is reviewed.

Runtime topology should remain unchanged: two images, two loopback-bound services in the host-Nginx variant, one PostgreSQL service, and the private admin-only `generated-sites` mount. A workspace is a build-time source layout and must not merge the deployable applications.

### Migrations

Keep `web/drizzle` and `admin/drizzle` as separate ordered histories during an initial workspace adoption. Root convenience scripts may call application migration commands explicitly, but neither parallel execution nor a generic recursive workspace command is safe because both histories target one database and order matters. Integration-test safety checks must continue to reject development and production database URLs.

### Environment loading

Preserve the root `.env` ownership model and server-only credential boundaries. Workspace commands can change working-directory behavior, so every script using relative paths must be tested from both the root and its application directory. Turborepo cache keys would need an explicit, minimal environment allowlist; secrets must not be placed in configuration or cache artifacts.

### CI and security tooling

A single lockfile would simplify dependency review but cause dependency changes for either app to invalidate the shared install layer. Existing CodeQL, audit, migration, sandbox, Playwright, benchmark, environment-hygiene, and release-simulation jobs must retain their current trust and secret boundaries. Pull requests from forks must remain secret-free regardless of any remote-cache provider.

## Future Team and Scale Triggers

Re-open the npm-workspace decision when at least two of these are true:

1. A real `packages/contracts` or shared-config package is ready and imported by both applications.
2. A third maintained deployable application or shared library is added.
3. Duplicate-contract incidents or dependency drift create recurring maintenance work.
4. The team grows beyond the current small-team workflow and needs one reproducible root install.
5. Measured CI install time is a material bottleneck.

Re-open the Turborepo decision only after npm workspaces exist and measurements show repeated deterministic lint, test, or build work worth caching. Re-open pnpm only for a separately approved package-management objective such as strict dependency isolation, materially faster installs, or storage pressure—not merely because a monorepo exists.

## Recommended Migration Sequence

This is a future plan, not work authorised by this assessment.

1. **Baseline:** record clean web/admin install, lint, test, build, image-size, Docker-build, integration-test, and CI timings. Resolve the `bcryptjs` version difference deliberately.
2. **Extract without workspaces:** identify the exact shared client-request/analytics contracts and add drift-detection tests or generated fixtures. Keep database migrations in their current owners.
3. **Pilot npm workspaces:** create a short-lived migration branch; add `workspaces: ["web", "admin", "packages/*"]`; pin the Node/npm toolchain; generate and review one root lockfile; do not include `generated-sites`.
4. **Add minimal packages:** introduce only `packages/contracts` and/or shared TypeScript/ESLint configuration. Give each explicit exports and prohibit client imports of server-only modules.
5. **Adapt automation:** replace per-app installs with a root frozen install while retaining explicit app-targeted checks. Keep migration order sequential. Update dependency review, audit, SBOM, and cache paths.
6. **Adapt Docker:** use a root context with app-specific, reproducible builds; verify standalone bundles contain workspace dependencies and no unrelated app, environment file, or generated workspace.
7. **Prove parity:** run all existing CI/security gates, PostgreSQL integration tests, Forge end-to-end tests, release simulation, and local Compose smoke tests. Compare timings and image contents to the baseline.
8. **Decide on caching separately:** add Turborepo only if the measured data justifies it. Start with local caching; classify environment inputs and cacheable outputs before considering remote caching.

## Rollback Strategy

Keep the workspace conversion as an isolated change with no simultaneous product, schema, or dependency upgrades. Before merging, preserve the two application lockfiles on the pre-migration commit and tag the last independently installable revision.

Rollback consists of reverting the workspace commit set, restoring `web/package-lock.json` and `admin/package-lock.json`, restoring app-local Docker contexts and CI cache paths, and rerunning `npm ci` independently in both apps. Shared packages must be copied back behind their prior application contracts or kept behind temporary compatibility modules; no database rollback should be necessary because workspace adoption must not alter schema or migration history.

Abort the migration before merge if either standalone image needs undeclared repository content, application-only installs cease to be reproducible, migration order becomes ambiguous, generated workspaces enter package-manager scope, or any secret/environment boundary becomes less explicit.

## Final Recommendation

**Do not proceed with a formal workspace migration now.** Approve preparatory contract/config extraction and drift tests as normal refactoring. When a genuine shared package exists, trial **plain npm workspaces** in an isolated stage. Do not combine that trial with pnpm or Turborepo. This sequence captures the repository's real sharing needs while preserving the independent build and deployment boundaries that currently reduce operational risk.
