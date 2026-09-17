# Auth.js beta risk acceptance

- Status: **renewed** — stable Auth.js / next-auth v5 migration remains unavailable
- Dependency: `next-auth@5.0.0-beta.32` (transitive `@auth/core@0.41.3`)
- Owner: ScaleSmiths repository owner (`@TheFridey`)
- Recorded: 2026-07-30
- Last reviewed: 2026-09-17 (GitHub issue #59: stable-release check, advisory review, pin and lockfile inspection)
- Review by: 2027-01-30
- Decision: **renew** the time-limited acceptance. Do not migrate to `next-auth@latest` (v4) and do not rewrite onto Better Auth in this review.

## Why this version is used

The admin application is implemented against the Auth.js v5 API and credentials
provider. Replacing it during the Forge V2 release-unblocking pass would be an
authentication migration rather than a release-evidence fix and would add avoidable
session, cookie and RBAC risk.

The repository is on `5.0.0-beta.32`, not beta.30. Beta.32 is the current npm `beta`
tag and patches the security issues affecting beta.30 and beta.31. npm's `latest` tag
is the v4 line, which is not API-compatible with this v5 App Router implementation.
There is no stable v5 release to adopt at this review date. The exact pin is therefore
retained deliberately; the beta label alone is not a reason to perform a backwards or
speculative authentication migration.

## 2026-09-17 review (issue #59)

This review answers the scheduled 2026-10-30 acceptance deadline early. The question
was whether a compatible **stable** Auth.js / next-auth release exists that can replace
the beta pin without weakening credentials, MFA, RBAC or session-version invalidation.

### Registry evidence (queried 2026-09-17)

| Channel | Resolved version | Meaning for ScaleSmiths |
| --- | --- | --- |
| npm `latest` | `4.24.15` (published 2026-07-20) | v4 LTS. Not API-compatible with `admin/auth.ts`, middleware `NextAuth()`, or the App Router credentials provider. Adopting it would be a backwards migration. |
| npm `beta` | `5.0.0-beta.32` (published 2026-07-20) | Current v5 line. Matches the existing exact pin. |
| npm `next-auth@5` / `5.0.0` | **404 — no such version** | There is still no stable v5 release. Published v5 versions are `5.0.0-beta.0` through `5.0.0-beta.32` only. |
| `@auth/core` | `0.41.3` (exact dependency of beta.32) | Already the lockfile resolution. |

Lockfile inspection was deliberate and produced **no change**:

- `admin/package.json` already exact-pins `next-auth@5.0.0-beta.32`.
- `admin/package-lock.json` resolves `next-auth` to `5.0.0-beta.32` with integrity `sha512-CGlChIEWZ6LltNVxrE5yiySMID+Idpmry47JYA5lLwgD8Sx02a8M65VL0TWVz9nbnOioS/tCW/rP/0+mE7Qp4Q==`, matching the npm registry tarball.
- Transitive `@auth/core` remains `0.41.3` with integrity `sha512-sJ3JMHHkXMD3aOjopv7mOBTO1Ocw4b0fAEXJBz6k7YHLpYQI6C40jCUPc5fNvUKxXRXNE1/sRISA15UrwWJBTw==`.
- Peer range on this pin is `next@^14 \|\| ^15 \|\| ^16` and `react@^18.2 \|\| ^19`, which covers the governed Next.js 15.5.25 / React 18.3.1 runtime.

Upstream still documents v5 installation as `next-auth@beta`. The GitHub release for `next-auth@5.0.0-beta.32` is marked pre-release. Maintainer discussion (`nextauthjs/next-auth#13382`) continues to describe v5 as production-used but not stably tagged.

### Advisory evidence

The July 2026 Auth.js cycle is the latest published advisory set for this pin. All four items are **patched in `5.0.0-beta.32` / `@auth/core@0.41.3`**. No newer Auth.js advisory requiring a later pin was listed against this exact version at review time.

| Advisory | Severity | Reachable in ScaleSmiths? | Status on current pin |
| --- | --- | --- | --- |
| [GHSA-7rqj-j65f-68wh](https://github.com/advisories/GHSA-7rqj-j65f-68wh) (CVE-2026-73420) — email normalizer homoglyph `@` bypass | High | No. Admin uses the credentials provider, not Auth.js email/magic-link. | Patched |
| [GHSA-xmf8-cvqr-rfgj](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-xmf8-cvqr-rfgj) (CVE-2026-73418) — `getToken()` throws on malformed Bearer headers | High | No. The inventory below does not call `getToken`. | Patched |
| [GHSA-x445-f3h2-j279](https://github.com/advisories/GHSA-x445-f3h2-j279) — OAuth check cookies not bound to the issuing provider | Medium | No. No OAuth provider is configured. | Patched |
| [GHSA-8fpg-xm3f-6cx3](https://github.com/advisories/GHSA-8fpg-xm3f-6cx3) — auth checks fail open on provider configuration errors | Low | Yes in principle: admin middleware uses `auth` / `!!session`. Beta.32 fails closed (non-OK session yields no session). | Patched |

Production `npm audit --omit=dev --audit-level=high` remains a required release gate. This acceptance does not waive High/Critical production findings.

### Alternatives considered and rejected

- **Migrate to `next-auth@4.24.15` (`latest`).** Rejected. It would replace the v5 App Router `NextAuth()` / `handlers` / middleware-`auth` contract with the v4 Pages Router API and drop the beta.32 fail-closed middleware fix that exists only on the v5 line.
- **Rewrite onto Better Auth.** Rejected for this review. Auth.js maintainers now recommend Better Auth for *new* projects except where stateless sessions without a database are required. ScaleSmiths uses exactly that model: JWT sessions, no Auth.js adapter, application-owned MFA, RBAC and `sessionVersion` revocation. A rewrite would be a new authentication programme, not a pin migration, and would risk weakening those boundaries.
- **Reject the risk and remove Auth.js without a replacement.** Rejected. Admin authentication cannot be left without a reviewed session implementation.

### Decision

**Renew** the acceptance on the existing exact pin through **2027-01-30**. Owner remains the ScaleSmiths repository owner. Review sooner if a stable suitable v5 (or compatible successor) is published, or if a security, correctness or support defect affects `5.0.0-beta.32`.

The machine-readable exception in `scripts/dependency-governance-policy.json` must keep `version`, `decision`, `reviewBy` and `record` aligned with this document. Governance now fails CI if `reviewBy` is missing, malformed, or in the past.

## Auth.js API inventory

ScaleSmiths uses these package exports and configuration surfaces:

| Import or surface | ScaleSmiths use |
| --- | --- |
| `NextAuth` from `next-auth` | Builds the full server auth instance in `admin/auth.ts` and the middleware-safe instance in `admin/src/middleware.ts`. |
| `NextAuthConfig` from `next-auth` | Statically checks the shared configuration in `admin/auth.config.ts`. |
| `Credentials` from `next-auth/providers/credentials` | Supplies email, password, TOTP and recovery-code fields and the custom `authorize` callback. |
| `signIn` from `next-auth/react` | Submits the credentials provider from the client login page with `redirect: false` and `redirectTo`. |
| `signOut` from `next-auth/react` | Ends browser sessions from the admin shell and forces reauthentication after MFA activation. |
| `handlers` returned by `NextAuth` | Serves Auth.js route handlers from `admin/src/app/api/auth/[...nextauth]/route.ts`. |
| `auth` returned by `NextAuth` | Wraps middleware and supplies `req.auth`; server helpers also use the full instance's `auth`. |
| `signIn` and `signOut` returned by `NextAuth` | Exported by `admin/auth.ts` for server-side availability. |
| `callbacks.jwt` | Adds role, session version and active state at login, then reloads the persisted user on later JWT processing and sets `accessRevoked`. |
| `callbacks.session` | Projects id, role, session version and effective active/revoked state onto `session.user`. |
| JWT session configuration | Eight-hour JWT/session lifetime with a custom session-token cookie. No Auth.js database adapter is used. |
| `pages.signIn` | Routes interactive sign-in to `/login`. |
| `trustHost`, `useSecureCookies`, `secret`, `cookies.sessionToken` | Trusts the deployed proxy host and enforces HTTP-only, SameSite=Lax, path `/`, eight-hour, secure-in-production cookies. |
| Type augmentation for `next-auth` and `next-auth/jwt` | Declares the custom user, session and JWT authorization claims. |

No OAuth, email, WebAuthn, Auth.js adapter, `SessionProvider`, `useSession`, `getToken`,
or legacy `withAuth` API is used.

## Custom authentication behaviour

- Credentials login normalises email, checks a durable per-IP/per-email rate limit,
  verifies the bcrypt-backed active admin identity, then verifies TOTP or atomically
  consumes a one-time recovery code. Failures return the same public invalid-credentials
  result and monitoring excludes credential/MFA material.
- Sessions are stateless Auth.js JWT sessions, but authorization state is not trusted
  for eight hours unchanged. Each JWT refresh reloads the admin user; disabled, deleted
  or session-version-mismatched accounts are marked revoked. Middleware independently
  reloads and validates the user before serving a protected request.
- RBAC is application-owned. Middleware passes the persisted current role to
  `authorizeRequest`; unauthenticated APIs receive 401, forbidden APIs receive 403, and
  forbidden pages redirect safely. Auth.js transports identity and claims but does not
  define the capability matrix.
- Middleware excludes only immutable Next.js assets, allows Auth.js handlers and narrowly
  documented health endpoints, redirects authenticated users away from `/login`, applies
  private/no-store response headers, and performs Forge rate limiting after authentication
  and RBAC.
- MFA is application-owned rather than an Auth.js plug-in. Enrolment, encrypted secrets,
  TOTP verification, recovery-code hashing/consumption, production role policy and audit
  records live under `admin/src/lib/server`; successful activation increments the session
  version and signs the current browser out.
- Client portal authentication is separate. The public `web` app uses its own database
  accounts, bcrypt verification and `jose`-signed eight-hour `ss-client-session` JWT cookie.
  It does not import or share Auth.js admin sessions.

## Evidence and current status

The current automated suite covers password authentication helpers, persistent admin
identity, session-version invalidation, protected-route behaviour, RBAC filtering, MFA
policy and recovery-code logic. The admin production dependency audit reports zero known
vulnerabilities as of 2026-08-28. This 2026-09-17 review does not claim a new empty
audit artifact; High/Critical production audit remains a merge/release gate.

Focused contract tests execute the shared Auth.js cookie/session callbacks and
the real `admin/auth.ts` composition with controlled dependencies. They verify credential
normalisation, rate-limit short-circuiting, MFA success/failure hand-off, successful-login
recording, authorization claims, persisted-role refresh and session-version revocation.

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
| Real password-only login through the credentials provider with real stored credentials | **Passed** |
| Invalid login rejected by the real credentials provider | **Passed** |
| Protected-route handling for unauthenticated requests | **Passed** |
| Session persistence across navigations via reused browser storage state | **Passed** |
| Logout and server-side session invalidation | **Passed** |
| Role-based navigation and RBAC visibility | **Passed** |
| Authenticated Forge routes reachable under a real session | **Passed** |

The same authenticated session drives all 18 Forge operator journeys, so authenticated
routing and session persistence are exercised continuously rather than only at login.

The browser suite does not currently exercise a TOTP-enabled account or recovery-code
login. Those paths are covered by production-code unit/integration tests, including the
Credentials provider hand-off and atomic recovery-code logic. A real browser MFA journey
is an explicit upgrade gate below; it must not be represented as already passed.

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

## Upgrade readiness checklist

Before changing the pin:

- [ ] Identify an upstream version that is stable/supported and suitable for the deployed
  Next.js and React versions; record its release notes, security advisories and peer ranges.
- [ ] Diff the target's documented and typed contracts for every API in the inventory above,
  including Credentials `authorize`, client `signIn`/`signOut`, returned `handlers`/`auth`,
  callbacks, middleware request augmentation, cookie names/options and redirect semantics.
- [ ] Confirm there is no required adapter/schema/session migration. If one is required,
  design it separately with rollback and session-invalidation handling.
- [ ] Update the exact manifest pin, admin lockfile, governance policy and this exception in
  one reviewed change; inspect transitive `@auth/core` changes and install scripts.
- [ ] Run `npm audit --omit=dev --audit-level=high` and review Auth.js advisories for the
  precise old and target versions.
- [ ] Run the focused Auth.js config/integration tests, admin identity/session lifecycle,
  MFA, middleware and full RBAC policy suites.
- [ ] Run real PostgreSQL integration coverage and production-mode Playwright journeys for
  password login, invalid password, TOTP success/failure, one-time recovery-code use,
  disabled-user rejection, session-version revocation, persistence, logout, middleware
  401/403/redirect behaviour and representative role restrictions.
- [ ] Verify production cookie flags/name/lifetime and that logs, monitoring and browser
  responses contain no password, token, cookie, TOTP secret or recovery code.
- [ ] Run admin lint, TypeScript, production build, dependency governance, environment
  hygiene, architecture, production-topology and relevant release gates.
- [ ] Complete protected-area security review and record rollback/deployment evidence.

## Exit criterion

This exception may be removed only when all four conditions hold: a supported stable and
suitable Auth.js/next-auth version is available; compatibility with every relied-upon API
and custom boundary above is confirmed; the login, MFA, session, RBAC and end-to-end suite
passes against production code; and the protected-area security review is completed.

The 2026-09-17 review found the first condition still false, so the exception is renewed
rather than removed. Review sooner if a security, correctness or support defect affects
the exact pin. A new beta alone may be adopted only to address a confirmed issue or after
the same compatibility and regression review; it does not satisfy the stable-version exit
criterion.

## Rollback strategy

Retain the previous known-good admin image and its compatible environment configuration.
If an authentication regression is detected before schema-incompatible changes, switch
traffic back through the release manager. Preserve authentication diagnostics, invalidate
affected sessions when required, and do not downgrade or rewrite admin identity data
without a separately reviewed migration and verified backup.

This renewal does not change runtime authentication code, cookies, secrets or identity
data. Reverting the documentation and governance `reviewBy` date restores the previous
acceptance record if the written decision must be withdrawn.
