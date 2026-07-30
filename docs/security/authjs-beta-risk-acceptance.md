# Auth.js beta risk acceptance

Status: accepted with monitoring  
Dependency: `next-auth@5.0.0-beta.32`  
Owner: ScaleSmiths repository owner  
Recorded: 2026-07-30  
Review by: 2026-10-30

## Why this version is used

The admin application is implemented against the Auth.js v5 API and credentials
provider. Replacing it during the Forge V2 release-unblocking pass would be an
authentication migration rather than a release-evidence fix and would add avoidable
session, cookie and RBAC risk.

## Evidence and current status

The current automated suite covers password authentication helpers, persistent admin
identity, session-version invalidation, protected-route behaviour, RBAC filtering, MFA
policy and recovery-code logic. The production dependency audit reports zero known
vulnerabilities for both applications as of 2026-07-30.

The remaining release gate requires the real browser login, invalid-login, session
persistence, logout, role visibility and protected-route redirect journeys to pass
against the disposable PostgreSQL fixture. This acceptance does not waive that gate.

## Risks and monitoring

- A beta release can change behaviour or receive less predictable compatibility fixes.
- Authentication failures, credential-provider errors, session invalidation failures
  and unexpected protected-route responses must be captured by the existing monitoring
  stack without recording credentials, cookies or MFA material.
- Production dependency and advisory scans remain mandatory on every release candidate.

## Migration trigger

Review migration when Auth.js publishes a stable v5 release compatible with Next.js 15
and the existing credentials/session model, or sooner if an observed security,
correctness or support defect affects this pinned beta. Migration requires dedicated
login, RBAC, MFA, cookie, callback and session regression evidence.

## Rollback strategy

Retain the previous known-good admin image and its compatible environment configuration.
If an authentication regression is detected before schema-incompatible changes, switch
traffic back through the release manager. Preserve authentication diagnostics, invalidate
affected sessions when required, and do not downgrade or rewrite admin identity data
without a separately reviewed migration and verified backup.
