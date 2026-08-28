# Security Policy

ScaleSmiths includes a public website, private admin app, PostgreSQL database, Auth.js authentication, Forge AI workflows, generated workspaces, Docker sandboxing, and deployment tooling. Please report security issues privately.

Sensitive repository areas and recommended branch-protection settings are documented in `docs/operations/protected-areas-and-branch-protection.md`.

Security-sensitive changes to `master` require a pull request, successful required security and CodeQL checks where applicable, resolved review conversations, and CODEOWNER approval. An administrator may bypass those controls only to contain a genuine active security or production emergency; the bypass must be documented and followed by retrospective review and any validation that could not safely run first.

## Reporting a Vulnerability

Do not open a public GitHub issue for suspected vulnerabilities.

Send a private report to the repository owner or the internal ScaleSmiths security contact. If a private GitHub security advisory is available for this repository, use that route.

Include:

- affected app or component;
- clear reproduction steps;
- impact and likely severity;
- whether secrets, client data, generated workspaces, admin access, Forge actions, deployment, or billing could be affected;
- logs or screenshots with secrets removed.

Do not include real API keys, passwords, provider prompts, private client exports, database dumps, or generated workspace archives unless the team explicitly requests them through a private channel.

## Response Process

For credible reports, the team will:

1. Acknowledge receipt privately.
2. Triage severity and affected systems.
3. Prepare a fix or mitigation on a private branch.
4. Validate the fix with relevant tests and deployment checks.
5. Release the fix.
6. Publish public details only when doing so does not increase user or client risk.

## Scope

In scope:

- public web quote, portal, analytics, and preference flows;
- admin authentication, MFA, RBAC, sessions, and audit logs;
- Forge provider calls, task execution, artifact provenance, budgets, approvals, release gates, and generated workspaces;
- Docker sandboxing and generated-site preview/QA isolation;
- deployment scripts, Nginx routing, Cloudflare Access assumptions, and release rollback;
- secret handling and environment hygiene.

Out of scope unless chained to a real vulnerability:

- low-impact missing security headers already documented as accepted risk;
- denial-of-service tests that disrupt production;
- social engineering;
- attacks requiring physical access to a developer machine;
- dependency warnings without an exploitable path in this repo.

## Safe Testing Rules

- Do not access, modify, delete, or exfiltrate real client data.
- Do not run destructive payloads against generated workspaces or production services.
- Do not attempt to bypass Cloudflare, Nginx, Auth.js, MFA, or RBAC controls on production without explicit written approval.
- Do not spend AI provider credits or trigger deployment actions while testing.

## Secrets

If a secret is accidentally committed, treat it as compromised. Remove it from history only through a coordinated incident response, rotate the credential, and document the operational impact. Routine contribution work must not rewrite historical commits.
