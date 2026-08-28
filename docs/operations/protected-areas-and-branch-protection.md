# Protected areas and branch protection

This repository has a CODEOWNERS file at `.github/CODEOWNERS`. It routes review, but GitHub only enforces that review when branch protection or a ruleset requires CODEOWNER approval. Repository settings therefore remain a required manual control.

## CODEOWNERS setup

The CODEOWNERS file uses the repository owner `@TheFridey`, has a fail-safe default owner, and explicitly repeats security, migration, finance, deployment, release, environment and governance paths so those boundaries remain visible and testable. Confirm GitHub recognises the owner and requests review on a test pull request.

## Sensitive repository areas

| Area | Paths | Why review is required |
| --- | --- | --- |
| Repository governance | `.github/`, `CONTRIBUTING.md`, `SECURITY.md`, branch-policy and GitHub Actions checks | A change can weaken review or required automation. |
| Authentication and portal access | admin auth, middleware, security APIs, portal auth and portal APIs | A mistake can allow unauthorised admin or client access. |
| MFA and RBAC | MFA, RBAC and admin-user modules | Hidden UI is insufficient; access must be enforced server-side. |
| Database migrations | both Drizzle histories, schema/config files, checksums and migration checks | Both apps share PostgreSQL; history and ownership order are safety invariants. |
| Forge providers, budgets and sandbox | Forge AI/provider, economics, reservation, workspace, QA and deploy modules | These paths control secrets, provider spend, generated code and deployment authority. |
| Finance and billing | invoice APIs, protected finance pages, finance components and invoice modules | Money, document and delivery behaviour is business-critical. |
| Deployment, release and recovery | Compose, Dockerfiles, Nginx, release scripts and backup scripts | Bad changes can expose private services, lose data, or break rollback. |
| Environment handling | environment examples, hygiene checks and topology policy | Misclassified variables can expose secrets or create unsafe defaults. |

## Required protection policy for `master`

`scripts/branch-protection-policy.json` is the in-repository source of truth. GitHub must be configured to:

- require a pull request and at least one approving review;
- dismiss stale approvals and require approval of the most recent reviewable push;
- require CODEOWNER approval when a changed path matches `.github/CODEOWNERS`;
- require every conversation to be resolved;
- require every status check below and require the branch to be up to date before merge;
- prohibit direct pushes by non-bypass actors, force pushes, and deletion of `master`;
- allow administrator bypass only for a genuine security or production emergency.

An emergency bypass is not a routine fast path. The administrator must make the smallest safe change, record why the normal pull-request path could not contain the incident, and promptly create a retrospective PR or incident record containing the diff, validation, review, and follow-up actions.

The repository contract is checked by `npm run check:branch-protection-policy` and its tests run inside `CI / Root Hygiene`. This detects workflow/job renames, missing checks, weakened recorded settings, documentation drift, and loss of explicit CODEOWNERS coverage. It cannot inspect or change GitHub repository settings.

## Required status checks

Configure these exact check-run contexts after each has run on a pull request. GitHub's Settings UI may qualify them as `Workflow / Job`; both forms are shown:

- `Web` (`CI / Web`)
- `Cross-browser Smoke` (`CI / Cross-browser Smoke`)
- `Admin` (`CI / Admin`)
- `Admin Forge E2E` (`CI / Admin Forge E2E`)
- `Database and Migrations` (`CI / Database and Migrations`)
- `Backup and Restore` (`CI / Backup and Restore`)
- `Root Hygiene` (`CI / Root Hygiene`)
- `PR Metadata` (`CI / PR Metadata`)
- `Nginx Topology` (`CI / Nginx Topology`)
- `Forge Workflow E2E` (`CI / Forge Workflow E2E`)
- `Dependency Review` (`Security / Dependency Review`)
- `TruffleHog` (`Security / TruffleHog`)
- `npm Audit (web)` (`Security / npm Audit (web)`)
- `npm Audit (admin)` (`Security / npm Audit (admin)`)
- `Hadolint (web)` (`Security / Hadolint (web)`)
- `Hadolint (admin)` (`Security / Hadolint (admin)`)
- `Image Security (web)` (`Security / Image Security (web)`)
- `Image Security (admin)` (`Security / Image Security (admin)`)
- `Generated-site Sandbox` (`Security / Generated-site Sandbox`)
- `Analyze JavaScript and TypeScript` (`CodeQL / Analyze JavaScript and TypeScript`)

All 20 contexts are mandatory. `Dependency Review` and `PR Metadata` intentionally run only for pull requests. CodeQL runs for same-repository pull requests; its job is intentionally skipped for untrusted fork pull requests where GitHub does not permit the security-event upload. Do not rename a workflow or job without updating the contract, this document, the GitHub protection rule, and the policy tests in the same change.

## Exact GitHub configuration still required

The repository files do not enable branch protection. A repository administrator must configure it at `Settings` -> `Branches` -> `Add branch protection rule`, using branch pattern `master`, then enable every setting above and select all 20 exact contexts.

For API configuration, authenticate GitHub CLI as a repository administrator and run the following from this checkout. Review the generated request file before sending it:

```powershell
$policy = Get-Content -LiteralPath scripts/branch-protection-policy.json -Raw | ConvertFrom-Json
$body = [ordered]@{
  required_status_checks = @{ strict = $true; contexts = @($policy.requiredStatusChecks) }
  enforce_admins = $false
  required_pull_request_reviews = @{
    dismiss_stale_reviews = $true
    require_code_owner_reviews = $true
    required_approving_review_count = 1
    require_last_push_approval = $true
  }
  restrictions = $null
  required_conversation_resolution = $true
  allow_force_pushes = $false
  allow_deletions = $false
}
$requestPath = Join-Path ([IO.Path]::GetTempPath()) 'scalesmiths-master-protection.json'
$body | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $requestPath -Encoding utf8
gh api --method PUT repos/TheFridey/ScaleSmiths/branches/master/protection --input $requestPath
gh api repos/TheFridey/ScaleSmiths/branches/master/protection
Remove-Item -LiteralPath $requestPath
```

`enforce_admins = false` supplies the explicit emergency administrator bypass. Repository policy, not the classic branch-protection API, limits that bypass to emergencies. If the repository uses rulesets instead, configure an equivalent administrator bypass actor in `Settings` -> `Rules` -> `Rulesets`; do not leave a general maintainer bypass.

## Review policy for sensitive areas

For a pull request touching sensitive paths:

- request a reviewer who understands that area;
- include migration, rollback, and operational notes when relevant;
- run focused tests for the area and the standard app gates;
- do not merge while security, migration, finance or deployment conversations remain unresolved;
- document any accepted residual risk in the pull request.

For urgent production fixes, use the normal pull-request path whenever it can contain the incident safely. If administrator bypass is unavoidable, follow the emergency process above.

## Manual verification checklist

1. Confirm every owner named in `.github/CODEOWNERS` exists and has repository access.
2. Commit and merge CODEOWNERS and the branch-policy contract.
3. Confirm GitHub recognises CODEOWNERS on a test pull request.
4. Run `npm run check:branch-protection-policy` and confirm all 20 contexts have appeared on a pull request.
5. Configure `master` branch protection through Settings or the API request above.
6. Read the protection API response back and verify strict status checks, reviews, conversations, force-push and deletion settings.
7. Open a small pull request touching a sensitive CODEOWNERS path; confirm owner review is requested and a stale approval is dismissed after a new push.
8. Confirm a non-administrator cannot push directly, force-push, delete, or merge an out-of-date branch.
9. Record the administrator(s) authorised for emergency bypass and the retrospective process.
