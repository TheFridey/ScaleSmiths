# Contributing to ScaleSmiths

ScaleSmiths is a small-team repository with two Next.js apps, shared PostgreSQL, Drizzle migrations, Docker deployment, and a private Forge production system. Keep changes practical, reviewable, and aligned with the existing architecture.

## Working Principles

- Keep pull requests scoped to one coherent change.
- Reuse existing patterns before adding new abstractions.
- Preserve public-site normal and interactive experiences unless the change is explicitly about them.
- Keep admin and Forge private. Do not add public admin signup.
- Keep provider credentials, API keys, database URLs, generated workspaces, and client data out of source control.
- Do not rewrite historical commits or force-push shared branches unless the team has explicitly agreed.

## Conventional Commits

Use conventional commit style for new commits:

```text
type(scope): short imperative summary
```

Accepted types:

- `feat`: user-visible feature or capability.
- `fix`: bug fix.
- `test`: tests only, or test infrastructure.
- `docs`: documentation only.
- `refactor`: internal restructuring without behaviour change.
- `security`: security hardening, vulnerability fix, auth/access-control change.
- `perf`: performance improvement.
- `chore`: maintenance, tooling, dependency metadata, non-product housekeeping.

Examples:

```text
feat(forge): add release gate evaluation
fix(web): prevent homepage preference flash
security(admin): enforce MFA challenge after login
test(forge): cover invalid state transitions
docs(ops): document canary rollback flow
```

Keep the subject under roughly 72 characters where possible. Use the body for migration notes, rollout risks, and follow-up work. Use `BREAKING CHANGE:` only when an operator or caller must change behaviour.

## Branches and Pull Requests

Branch names should be descriptive, for example `feat/forge-release-gates` or `fix/web-preference-hydration`.

Before opening a PR:

- Rebase or merge from `master` as appropriate for the team workflow.
- Confirm the PR does not include real `.env` files, generated workspaces, provider keys, database dumps, or client-private exports.
- Complete the PR template honestly, including tests not run.
- Link the relevant issue, prompt, or operational note when there is one.

Small PRs can be reviewed quickly. Large programme stages are acceptable when the change is naturally cross-cutting, but they should include a clear summary and risk section.

Changes touching authentication, MFA, RBAC, migrations, Forge providers, AI budgets, sandboxing, deployment, Nginx, GitHub Actions, environment handling, or financial logic are CODEOWNERS-sensitive. See `docs/operations/protected-areas-and-branch-protection.md`.

## Definition of Done

A change is done when:

- The implementation matches the requested behaviour and preserves existing contracts.
- Security boundaries are not weakened.
- User-facing errors remain safe and internal diagnostics stay server-side.
- Tests have been added or updated in proportion to the risk.
- Relevant lint, tests, builds, and hygiene checks have been run or explicitly marked as not run with a reason.
- Database migrations, environment variables, deployment steps, and rollback notes are documented where applicable.
- Documentation affected by the change is updated.
- Known residual risks or manual QA steps are called out in the PR.

## Testing Expectations

Run the smallest useful checks while developing, then run the relevant full gates before review.

Root checks:

```bash
npm run check:env-hygiene
npm run check:architecture-docs
```

Web checks:

```bash
cd web
npm run lint
npm run test
npm run build
```

Admin checks:

```bash
cd admin
npm run lint
npm run test
npm run build
```

Additional checks when relevant:

```bash
npm run test:integration
npm run test:forge-e2e
npm run test:release-simulation
cd web && npm run test:e2e:chromium
cd web && npm run check:performance-budgets
```

Use integration, Forge E2E, Playwright, performance, security, or release simulation checks when the change touches those systems. Do not skip failing tests to make a PR pass; fix the cause or document a pre-existing failure clearly.

## Migration Expectations

Web migrations live in `web/drizzle`. Admin migrations live in `admin/drizzle`. Both apps target the same PostgreSQL database, so migration changes require extra care.

- Use the existing Drizzle migration flow.
- Keep migrations backward-compatible where possible, especially for canary/rollback deployment.
- Do not hand-create schema in tests instead of applying real migrations.
- Update schema definitions and migration SQL together.
- Document operational order when a migration must run before code.
- Production order is web migrations first, then admin migrations, unless a stage-specific document says otherwise.

Typical production order:

```bash
cd web && npm run db:migrate
cd ../admin && npm run db:migrate
```

When adding shared tables or enums, check both app schemas for drift and note any compatibility risk.

## Documentation Expectations

Update docs when a change affects:

- architecture or data model;
- security boundaries, RBAC, authentication, MFA, monitoring, logging, or analytics;
- deployment, migrations, environment variables, Docker, Nginx, release, or rollback;
- Forge workflow, generated workspace behaviour, AI providers, budgets, QA, or release gates;
- public-site experience, performance, accessibility, or analytics taxonomy.

Prefer concise docs under `docs/architecture`, `docs/operations`, or `docs/testing`. Keep README changes for high-level setup and operational entry points.

## Security and Privacy

- Report vulnerabilities through `SECURITY.md`, not public issues.
- Never commit secrets or client-private data.
- Keep AI provider prompts, credentials, and generated workspaces server-only.
- Do not expose admin, Forge, generated previews, or generated-site workspaces publicly without a reviewed access-control plan.
- Public analytics must remain privacy-conscious, minimised, and consent-aware.

## Local Environment Notes

This repo is often developed on Windows/PowerShell. Use commands that work cross-platform where possible. If a validation step is not available locally, say so in the PR and include the closest check you did run.
