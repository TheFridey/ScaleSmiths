# AGENTS.md

Two Next.js apps (`web/` port 3000, `admin/` port 3001) share one PostgreSQL database and deploy via Docker Compose + Nginx. The repo is developed primarily on Windows/PowerShell; prefer cross-platform commands. `admin/` also hosts Forge, the private AI site-generation system.

## Toolchain

- Node `>=22 <23`, npm `~10.9` (pinned).
- Next.js is **15.5.22**.
- Unit tests: Vitest.
- E2E: Playwright.
- Database: Drizzle, with separate migration ownership under `web/drizzle` and `admin/drizzle`.
- Critical dependencies are exact-pinned and governed by `scripts/dependency-governance-policy.json`.
- `check:dependency-governance` fails if `package.json`, app lockfiles, or governed versions drift.
- Do not bump Next, React, or other governed dependencies without updating the governance policy and relevant lockfiles.

## Command contexts

There are three separate npm execution contexts. Do not treat this repo as an npm workspace.

- Repo root (`ss/`): repo-wide policy, CI, integration, topology, migration-safety, documentation, and release gates.
- `web/`: public Next.js app and web-owned Drizzle migrations.
- `admin/`: private admin/Forge Next.js app and admin-owned Drizzle migrations.

Installing at the root does **not** install dependencies for both apps. Each app has its own lockfile and must be installed independently.

```powershell
cd web
npm ci

cd ../admin
npm ci
```

Next.js and Drizzle scripts inside `web/` and `admin/` load the shared root `.env` via:

```text
node --env-file-if-exists=../.env
```

Keep local runtime environment values in the root `.env`.

## App commands

Run these from the relevant app directory.

### Web

```powershell
cd web

npm run dev
npm test
npm run lint
npm exec tsc -- --noEmit
npm run build
```

### Admin / Forge

```powershell
cd admin

npm run dev
npm test
npm run lint
npm exec tsc -- --noEmit
npm run build
```

Neither app has a `typecheck` script. Use:

```powershell
npm exec tsc -- --noEmit
```

Do not invent `npm run typecheck`.

### Focused unit verification

Vitest accepts a test-file path through the app's existing `npm test` script. Prefer focused tests while iterating rather than repeatedly running an entire suite.

```powershell
cd web
npm test -- path/to/file.test.ts

cd ../admin
npm test -- path/to/file.test.ts
```

Run broader relevant gates before finishing a task.

## Database-backed commands

DB-backed scripts such as:

- `test:db:*`
- `db:migrate`
- `admin:bootstrap`
- `portal:seed`

resolve database URLs from the configured app-specific variables, including `WEB_DATABASE_URL`, `MIGRATION_DATABASE_URL`, and `DATABASE_URL`.

Set at least `DATABASE_URL` in the root `.env` for normal local development unless a more specific URL is intentionally required.

## Root verification gates

Run these from the repository root. They are executable policy and CI sources of truth.

A real local `.env` is fine because it is gitignored. Environment-hygiene checks inspect the Git surface, not arbitrary untracked working-tree files.

### Fast / pure Node gates

These do not require external services:

```bash
npm run check:env-hygiene
npm run check:architecture-docs

npm run check:forge-v2-release-docs
npm run test:forge-v2-release-docs

npm run check:dependency-governance
npm run test:dependency-governance

npm run check:production-topology
npm run test:production-topology

npm run check:migration-history
npm run test:migration-history
npm run test:migration-consistency

npm run check:github-actions
npm run test:github-actions

npm run test:backup-migration-safety
npm run test:release-simulation

npm run test:pr-metadata
npm run check:pr-metadata
```

Use the actual root `package.json` as the authoritative script list if this section and executable scripts ever diverge.

### Docker / PostgreSQL-backed gates

These are slower and should be run when the change touches the relevant infrastructure or workflow.

```bash
npm run test:integration
npm run test:forge-e2e
npm run test:nginx-config
npm run test:nginx
```

`test:integration` brings up Docker Compose/PostgreSQL and runs admin integration coverage after applying the canonical shared migration plan.

`test:forge-e2e` exercises the complete Forge workflow and also depends on web migrations being applied before admin migrations.

`test:nginx-config` builds/tests Nginx configuration syntax.

`test:nginx` exercises the host-Nginx production topology.

Backup framework verification requires Bash and PostgreSQL CLI tooling:

```bash
npm run test:backup-framework
```

## Shared database and migration ownership

`web/` and `admin/` use the same PostgreSQL database but maintain separate Drizzle migration journals.

### Web-owned schema

Web owns quote and portal-facing tables, including:

- `quote_requests`
- `portal_client_accounts`
- shared client-facing structures such as `client_requests`
- `monthly_reports`

### Admin-owned schema

Admin owns dashboard, CRM, internal operations, prospect pipeline, and Forge schema, including:

- clients/dashboard structures
- kanban structures
- `prospects`
- `outreach_activities`
- `proposal_trackings`
- all Forge-owned tables

Admin may **read** web-owned tables.

Reading another app's table does **not** grant migration ownership.

**Schema ownership is strict:** never generate an admin migration for a web-owned table or a web migration for an admin-owned table.

## Migration order

Migration order matters because both apps share one database.

Always apply through the repository root:

```powershell
cd ..
npm run db:migrate
```

The shared planner preserves each history and interleaves cross-history prerequisites.

Do not run either Drizzle batch in isolation when provisioning or validating the shared schema. Integration and Forge E2E use the same shared runner as production.

Committed migration files and journal entries are checksum-locked.

**Never edit an already-committed migration to correct schema history.**

Corrections must be new forward migrations.

Before proposing migration changes, run the relevant history/consistency gates:

```bash
npm run check:migration-history
npm run test:migration-history
npm run test:migration-consistency
```

## Environment and secrets

Only `*.env.example` files belong in Git.

Real environment files are gitignored and must never be committed.

`check:env-hygiene` enforces this.

Provider credentials are server-only, including:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`

Never expose provider credentials through `NEXT_PUBLIC_*`.

`AUTH_SECRET` is secret.

MFA, analytics, and other encrypted data paths require their dedicated encryption keys; do not reuse unrelated secrets or weaken encryption configuration to make local tests pass.

## Forge

Forge lives inside `admin/`; it is not a separate public application.

It is the private AI-assisted site-generation system and owns its own admin-side database structures, providers, budgets, generation workflows, and sandboxing boundaries.

Forge AI is intentionally disabled by default:

```text
FORGE_ENABLE_AI=false
FORGE_DEFAULT_AI_PROVIDER=mock
```

Do not assume live AI providers are enabled in development or tests.

Do not bypass provider/budget/sandbox controls to make a Forge workflow pass.

## Generated sites

`generated-sites/` is gitignored except for its own `.gitignore`.

In Docker it is bind-mounted into the admin container running as UID/GID `1001`.

Do not:

- commit generated site output
- expose `generated-sites/` directly through Nginx
- make Forge previews publicly reachable
- weaken filesystem isolation merely to solve a local permission issue

## Enforced architecture documentation

`check:architecture-docs` requires these exact files:

```text
docs/architecture/system-overview.md
docs/architecture/forge-workflow.md
docs/architecture/security-boundaries.md
docs/architecture/deployment-topology.md
docs/architecture/data-model.md
docs/architecture/rbac-policy.md
```

These documents require specific `## `-prefixed sections and Mermaid diagrams.

Editing architecture documentation can therefore break CI even when the prose is otherwise valid. Preserve enforced headings/structure unless intentionally updating the corresponding gate.

Forge V2 release documentation is also executable policy.

`check:forge-v2-release-docs` enforces:

```text
docs/release-readiness/forge-v2.md
docs/operations/forge-v2-*
```

including required structure and the expected single final SHA semantics.

Do not casually reorganize these files.

## Security invariants

Do not weaken these to make development easier.

- There is no public admin signup.
- Admin routes remain private.
- Forge routes (`/forge`, `/api/forge/*`) remain behind Auth.js + middleware.
- The public website must not gain a public admin route.
- Generated-site previews must not become publicly exposed.
- Provider API keys remain server-only.
- Authentication, MFA, authorization, and RBAC failures must not be converted into permissive fallback behaviour.

Security-sensitive behaviour is also covered by CODEOWNERS/protected-area policy.

## Production topology

Canonical production paths are enforced by `check:production-topology`.

Canonical checkout root:

```text
/var/www/scalesmiths/ScaleSmiths
```

Canonical admin origin:

```text
https://admin.scalesmiths.co.uk
```

Do not reintroduce legacy or alternative assumptions such as:

```text
/srv
/scalesmiths
a path-based `/admin` URL on the public website domain
```

unless the production-topology policy itself is intentionally being migrated.

Treat the executable topology checks as authoritative over stale prose or comments.

## Workflow and protected areas

Use Conventional Commits. Supported types include `security`.

CI runs PR metadata policy on every PR.

The PR template must be completed honestly.

Docs-only changes do not require Evidence/Rollback sections. Dependabot and emergency-rollback flows have documented exemptions; see `CONTRIBUTING.md`.

CODEOWNERS/protected areas include:

- authentication
- MFA
- RBAC
- migrations
- Forge AI/providers
- Forge budgets
- Forge sandboxing
- deployment
- Nginx
- GitHub Actions
- environment configuration
- financial/business-critical logic

See:

```text
docs/operations/protected-areas-and-branch-protection.md
```

before making broad changes in those areas.

## Agent scope and verification discipline

Establish the relevant baseline before changing shared infrastructure or security-sensitive code.

Do not fix unrelated pre-existing failures unless the task explicitly asks for them. Record unrelated failures separately.

Do not weaken:

- schemas
- validation
- authentication
- authorization
- security boundaries
- migration safety
- financial/business rules

merely to make tests pass.

When a test fails, first determine whether the failure:

1. existed before the task,
2. was caused by the current changes, or
3. exposes a legitimate requirement of the task.

Repair failures caused by the current change. Do not silently broaden scope to repair unrelated repository debt.

Before finishing any non-trivial implementation:

- inspect the final diff
- identify every modified file
- revert unrelated changes introduced during investigation
- run focused tests for the changed behaviour
- run the relevant lint/typecheck/build gates
- run repo-level policy gates when the affected area requires them
- report pre-existing failures separately from regressions caused by the task

Passing tests are evidence, not proof by themselves. Prefer tests that execute production code and real behavioural boundaries over tests that simply duplicate implementation logic inside the test.

## Source-of-truth rule

When documentation and executable configuration disagree, trust the executable source unless the task is specifically to change that source of truth.

Highest-value sources are typically:

1. root/app `package.json` scripts
2. CI workflows
3. Drizzle schema and migration history
4. executable policy/check scripts
5. application configuration
6. enforced architecture/operations docs
7. general prose documentation

Do not preserve a stale architectural claim merely because it already appears in documentation.
