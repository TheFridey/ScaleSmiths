# Auth.js beta risk acceptance

- Status: accepted with monitoring
- Dependency: `next-auth@5.0.0-beta.32`
- Owner: ScaleSmiths repository owner
- Recorded: 2026-07-30
- Last reviewed: 2026-07-31 (browser authentication evidence added; acceptance unchanged)
- Review by: 2026-10-30

## Why this version is used

The admin application is implemented against the Auth.js v5 API and credentials
provider. Replacing it during the Forge V2 release-unblocking pass would be an
authentication migration rather than a release-evidence fix and would add avoidable
session, cookie and RBAC risk.

## Evidence and current status

The current automated suite covers password authentication helpers, persistent admin
identity, session-version invalidation, protected-route behaviour, RBAC filtering, MFA
policy and recovery-code logic. The production dependency audit reports zero known
vulnerabilities for both applications as of 2026-07-31.

### Browser authentication is now validated

The previously outstanding browser gate has been **executed and passed**. Earlier
revisions of this document recorded that real browser authentication remained untested;
that statement is superseded.

The disposable PostgreSQL 16 browser suite runs against a production-mode admin server in
the CI `Admin Forge E2E` job (`admin/test/e2e/auth.setup.ts` and
`admin/test/e2e/admin-auth.spec.ts`). On merged `master`
`5ac4bacd89cffc6bd524dfa527738ac239c961c2`, CI run `30588532289`, it validated:

| Behaviour | Status |
| --- | --- |
| Real login through the credentials provider with real stored credentials | **Passed** |
| Invalid login rejected by the real credentials provider | **Passed** |
| Protected-route handling for unauthenticated requests | **Passed** |
| Session persistence across navigations via reused browser storage state | **Passed** |
| Logout and server-side session invalidation | **Passed** |
| Role-based navigation and RBAC visibility | **Passed** |
| Authenticated Forge routes reachable under a real session | **Passed** |

The same authenticated session drives all 18 Forge operator journeys, so authenticated
routing and session persistence are exercised continuously rather than only at login.

### What this evidence does and does not establish

Passing these journeys mitigates **implementation risk**: it shows this application's use
of the Auth.js v5 credentials, session and RBAC surfaces behaves correctly under a real
browser against a real database.

It does not change the **supply and support risk** of depending on a pre-release package.
A passing test suite does not make `5.0.0-beta.32` equivalent to a stable release. Beta
releases may still introduce behavioural changes between patch versions, carry weaker
compatibility guarantees, and receive less predictable security and support response.
This acceptance therefore remains in force and is not discharged by the test results.

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
