# Protected areas and branch protection

This repository has a CODEOWNERS file at `.github/CODEOWNERS`. It is a review-routing aid; it does not protect the branch by itself. GitHub branch protection must be configured manually in repository settings.

## CODEOWNERS setup

The current CODEOWNERS file uses the proven repository owner `@TheFridey`. Confirm GitHub recognises this owner on a test pull request before enabling required CODEOWNER review.

Examples:

```text
* @TheFridey
* @TheFridey @trusted-maintainer
```

Use a team only if the repository belongs to an organisation with teams available. For a personal repository or small team, one or two usernames are enough.

## Sensitive repository areas

| Area | Paths | Why review is required |
| --- | --- | --- |
| Authentication | `admin/auth.ts`, `admin/auth.config.ts`, `admin/src/app/api/auth/`, `web/src/lib/portal-auth.ts`, portal API routes | A mistake can allow unauthorised admin or client access. |
| MFA | `admin/src/lib/server/mfa.ts`, `admin/src/app/api/security/`, MFA migrations | A mistake can weaken privileged account protection or recovery controls. |
| RBAC | `admin/src/lib/rbac.ts`, `admin/src/lib/server/rbac.ts`, `admin/src/middleware.ts` | Hidden UI is not sufficient; access must be enforced server-side. |
| Database migrations | `web/drizzle/`, `admin/drizzle/`, schema files and Drizzle configs | Both apps share PostgreSQL, so migration drift can break production or rollback. |
| Forge provider layer | provider adapters, provider health, Forge AI server modules | Provider failures, prompts, and model metadata must not leak secrets or bypass validation. |
| AI budgets | budget reservation/economics/cost modules | Cost controls are safety boundaries against uncontrolled provider spend. |
| Sandbox | Forge sandbox, workspace, QA and generated-site runner modules | Generated code must not escape workspaces, host secrets, resource limits, or network controls. |
| Deployment and release | Docker Compose files, Dockerfiles, release scripts | Bad deployment changes can expose private services or break rollback. |
| Nginx and Cloudflare routing | `nginx/`, Cloudflare update scripts | Routing controls public/admin boundaries and origin hardening. |
| GitHub Actions | `.github/workflows/` | CI must not expose secrets to fork PRs or silently drop security gates. |
| Environment handling | `.env.example`, env hygiene script, env docs | Misclassified variables can expose secrets or cause unsafe production defaults. |
| Billing and financial logic | Forge economics, cost-quality, lead scoring, estimators, finance-facing dashboards | Pricing, margin, budgets, and billing-adjacent reports affect business decisions. |

## Recommended branch protection for `master`

Configure this manually in GitHub:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Branches`.
3. Add or edit a branch protection rule for `master`.
4. Enable `Require a pull request before merging`.
5. Require at least one approving review. Use two approvals for high-risk changes when the team has enough reviewers.
6. Enable `Require review from Code Owners` after CODEOWNERS contains real users or teams.
7. Enable `Require conversation resolution before merging`.
8. Enable required status checks.
9. Enable `Require branches to be up to date before merging` if it does not slow a small team too much.
10. Disable force pushes for `master`.
11. Disable branch deletion for `master`.
12. Consider signed commits where practical. Do not block urgent small-team operations if signing is not yet set up for every maintainer.

Do not enable settings that depend on unavailable GitHub plan or organisation features. If a feature is missing, document the manual substitute in the PR process.

## Suggested required checks

Use the exact check names shown by GitHub after the workflows have run at least once. Based on the current workflows, the useful required checks are:

- `CI / Web`
- `CI / Cross-browser Smoke`
- `CI / Admin`
- `CI / Database and Migrations`
- `CI / Root Hygiene`
- `Security / TruffleHog`
- `Security / npm Audit (web)`
- `Security / npm Audit (admin)`
- `Security / Hadolint (web)`
- `Security / Hadolint (admin)`
- `Security / Image Security (web)`
- `Security / Image Security (admin)`
- `Security / Generated-site Sandbox`
- `CodeQL / Analyze JavaScript and TypeScript`

The cross-browser suite is deliberately limited to four functional tests (two paths in each browser), so it remains a pull-request gate. If image scans or CodeQL later prove too slow for routine pull requests, changing their trigger requires a documented review; never move web/admin builds, database integration, Chromium journeys/visual regression, root hygiene, npm audits, secret scanning or sandbox security off the pull-request path. Do not weaken checks for changes touching CODEOWNERS sensitive areas without recording the reason in the PR.

## Review policy for sensitive areas

For a PR touching sensitive paths:

- request a reviewer who understands that area;
- include migration, rollback, and operational notes when relevant;
- run the focused tests for the area and the standard app gates;
- do not merge while review threads about security, migrations, or deployment safety remain unresolved;
- document any accepted residual risk in the PR.

For urgent production fixes, use the smallest possible PR, keep required checks on where possible, and follow up with a normal review/retrospective issue if emergency process was used.

## Manual setup checklist

1. Confirm every owner named in `.github/CODEOWNERS` exists and has repository access.
2. Commit and merge CODEOWNERS.
3. Confirm GitHub recognises the CODEOWNERS file on a test PR.
4. Configure `master` branch protection.
5. Select required checks only after the workflows have appeared in GitHub.
6. Open a small documentation-only PR touching a CODEOWNERS path to confirm owner review is requested.
7. Record any unavailable GitHub features and the chosen manual workaround.
