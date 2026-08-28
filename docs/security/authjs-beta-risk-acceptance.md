# Auth.js beta risk acceptance

- Status: accepted with monitoring
- Dependency: `next-auth@5.0.0-beta.32`
- Owner: ScaleSmiths repository owner
- Recorded: 2026-07-30
- Last reviewed: 2026-08-28 (API inventory, upgrade checklist and regression coverage reviewed)
- Review by: 2026-10-30

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
vulnerabilities as of 2026-08-28.

Focused contract tests now also execute the shared Auth.js cookie/session callbacks and
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

Review sooner if a security, correctness or support defect affects the exact pin. A new
beta alone may be adopted only to address a confirmed issue or after the same compatibility
and regression review; it does not satisfy the stable-version exit criterion.

## Rollback strategy

Retain the previous known-good admin image and its compatible environment configuration.
If an authentication regression is detected before schema-incompatible changes, switch
traffic back through the release manager. Preserve authentication diagnostics, invalidate
affected sessions when required, and do not downgrade or rewrite admin identity data
without a separately reviewed migration and verified backup.
