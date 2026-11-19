# Operation Expansion engineering report

18 November 2026. Local implementation and verification; production activation remains blocked by the release decisions below. Final acceptance results and implementation checkpoint are recorded in STATUS.md.

## Executive assessment

The foundation integrates recruitment, independent partner identity, confidential prospect qualification, founder scope/capacity approval and collected-revenue commission accounting into the existing ScaleSmiths applications. The standard entitlement is exactly 70500 pence: 30000 deposit commission, 30000 final-balance commission and 10500 first-retainer commission. Manual payout records reconcile the liability; they do not transfer money.

The broader programme remains PARTIAL. Later intelligence, automation and national-scale phases are explicitly deferred. Legal, privacy, agreement and accounting review are required before admitting real applicants or partners.

## Repository and architecture

- Starting commit: `3db74a091d481e03e5fed9ea7a6837624e317a41`.
- Branch: `feature/operation-expansion`; audit/plan checkpoint: `004d98b`.
- Implementation checkpoint: `d44c158` (`feat: add independent partner commercial foundation`, 66 files). Acceptance-test refinement: `bb4febc`. The final report checkpoint follows these commits in local Git history.
- Existing user modifications to `.entire/agent-guide.md`, `AGENTS.md` and `CLAUDE.md` are preserved and excluded from operation commits.
- Two existing Next.js applications share PostgreSQL. Public recruitment is `/partners` in web; external partner access is `/partner` on the existing admin origin; internal founder management is `/expansion`.
- Existing Auth.js, MFA, RBAC, prospects, clients, contracts, issued invoices, collected-payment records and audit mechanisms are reused. There is no additional application, authentication stack, database or deployment topology.
- Web owns applicant intake migration `0023`; admin owns `0068` through `0070`. The shared planner applies all 95 migrations (24 web, 71 admin) in prerequisite order. No committed migration was rewritten.
- Partner opportunities extend canonical prospects; accepted work links canonical clients and conversion metadata. Financial records use immutable accepted terms and append-oriented ledger events. Published resource content is versioned and immutable.

See ARCHITECTURE.md, DATA-MODEL.md, SECURITY-MODEL.md and REPOSITORY-AUDIT.md for source-level decisions. The existing admin origin avoids introducing new DNS and cross-origin authentication before an accepted topology change.

## Feature inventory

| Capability | Status | Actual boundary |
|---|---|---|
| Recruitment page, calculator and validated application | COMPLETE | Intake closed by default; explicit reviewed privacy version and retention required |
| Founder application review and onboarding prerequisites | COMPLETE | Four confirmations required before invitation; manual business review |
| Invitation, activation, expiry renewal and revocation | COMPLETE | Hashed single-use token; existing Auth.js; persisted identity/session checks |
| External-role isolation | COMPLETE | Partner-only allowlist; internal routes and APIs denied |
| Prospect registration, discovery and scope submission | COMPLETE | Canonical prospect; duplicate/suppression protection; owner-scoped mutations |
| Founder feasibility and capacity approval | COMPLETE | Assessed weekly allocation and transaction-locked reservations |
| Accepted terms and client linkage | COMPLETE | Immutable versioned commission terms; canonical client conversion |
| Verified collection and exact commission | COMPLETE | Authorised manual verification; issued invoice; net collected pence |
| Full collection reversals and contract cancellation | COMPLETE | Approved append-only reversal; future collections denied after cancellation |
| Partial refunds | NOT STARTED | Existing canonical single-reversal constraint retained; no invented partial-refund support |
| Manual payout preparation, approval and settlement | COMPLETE | Ledger locking and reference binding; no bank execution |
| Prepared payout cancellation | NOT STARTED | Do not prepare an incorrect payout; controlled correction workflow still required |
| Commission centre and CSV statement | COMPLETE | Exact ledger totals, immutable invoice client name, formula-safe text export |
| Approved resource library | PARTIAL | Versioned published text, category/search; arbitrary file uploads deliberately unavailable |
| Advanced dashboards, contact/document history and reminders | PARTIAL | Operational summaries exist; broader CRM enhancements remain outstanding |
| Automated recruitment and operational notifications | NOT STARTED | No external messages sent |
| Website audit, Sales Studio, proposals, AI and support workspace | DEFERRED | Phase B; no placeholder presented as functioning AI |
| Provider payment ingestion, matching and automated handover | DEFERRED | Phase C; manual verified collection is authoritative in this foundation |
| National analytics and attribution optimisation | DEFERRED | Phase D after foundation and operational demand |
| Production partner activation | BLOCKED | Reviewed legal/privacy/accounting decisions and deployment approval required |

## Financial integrity

Amounts use validated integer decimal strings and BigInt arithmetic. Contract terms bind plan version, basis points and milestone limits. Cumulative partial-payment rounding prevents splitting payments from increasing commission. VAT-inclusive gross collection is recorded separately from the qualifying VAT-exclusive amount. Subsequent retainers have no entitlement under the initial standard plan.

Immutable external references and canonical event fingerprints bind replay to exact parameters. Identical replay returns the original event; changed reuse is rejected. Separate-connection PostgreSQL tests exercise concurrent collection replay, last-slot capacity reservations and invitation consumption. Accepted agreement, invoice and partner ownership are checked within the financial service boundary.

Commission is earned only from verified collected revenue. Conditional maximum entitlement is separate. Full approved reversals append negative entries; cancellation prevents new collection accrual without erasing historical events. Payout preparation locks eligible entries, approval validates the prepared record, and manual settlement records a reference. The system does not execute a transfer or imply money actually moved in the isolated demonstration.

Prepared-payout cancellation and partial refunds require additional forward design. Production accounting must confirm partner VAT/invoice treatment, refund/clawback entitlement, disputes and the final agreement.

## Security evidence and limitations

Founder APIs require existing authenticated, active owner/administrator authority. The external identity has only `expansion.partner`; it cannot become an internal administrator through generic user management. Middleware checks persisted role, active status and session version. A revoked cookie is denied protected access and can render the login screen without a redirect loop.

Every partner query/mutation scopes records to its authenticated partner identity. Partner B tests attempt to mutate A's prospect and request founder financial administration. Application intake accepts no lifecycle fields, enforces origin/body/field/rate limits and fails closed on persistence errors. Monitoring uses a generic error without the raw database error, which can contain applicant details.

The public database principal has INSERT and required sequence access for applications, without applicant SELECT/UPDATE. The real PostgreSQL privilege harness verifies runtime grants, all migrations and five injected drift scenarios. Published-resource triggers work with direct trigger-function execution revoked. No arbitrary uploaded document path or public Forge preview was added.

These results establish tested boundaries, not universal security assurance. Independent protected-area review, deployment configuration, production grants, backup/restore and operational monitoring must be checked before release. The tmpfs test database proves neither crash durability nor production backup readiness.

## Verification record

Full commands, counts and final browser acceptance are consolidated in STATUS.md. Raw local logs are retained under ignored `.tmp/expansion-baseline/`; screenshots and downloaded statement are under ignored `.tmp/expansion-evidence/`. These contain only clearly identified demonstration records.

Relevant executed commands (each app command runs in its own directory):

```text
web: npm test
web: npm test -- src/lib/partner-applications.test.ts src/app/api/partner-applications/route.test.ts --maxWorkers=1
admin: npm test -- src/lib/expansion-finance.test.ts src/lib/server/expansion-finance.test.ts src/lib/server/expansion.test.ts --maxWorkers=2
admin: npm exec tsc -- --noEmit
admin: npm test -- --maxWorkers=1
admin: npm test -- src/lib/server/forge-runs/architecture-policy.test.ts --maxWorkers=1
root: npm run test:postgres-privileges
root: node --test scripts/expansion-privilege-policy.test.mjs
root: npm run check:env-hygiene
root: npm run check:architecture-docs
root: npm run check:forge-v2-release-docs
root: npm run check:dependency-governance
root: npm run check:production-topology
root: npm run check:migration-history
root: npm run test:migration-history
root: npm run test:migration-consistency
root: npm run check:migration-order
root: npm run check:github-actions
root: npm run check:domain-boundaries
root: npm run check:database-environment-boundaries
root: npm run check:branch-protection-policy
root: docker build --progress=plain -f .tmp/expansion-build-context/Dockerfile.expansion-admin -t ss-expansion-admin:test-20261118 .tmp/expansion-build-context
root: docker build --progress=plain -f .tmp/expansion-build-context/Dockerfile.expansion-web -t ss-expansion-web:test-20261118 .tmp/expansion-build-context
admin: node node_modules/@playwright/test/cli.js test --config playwright.expansion.config.ts
```

The browser command requires explicit `EXPANSION_ADMIN_BASE_URL=http://localhost:3103` and `EXPANSION_WEB_BASE_URL=http://localhost:3102`; tests refuse mutation outside those local demo origins. The PostgreSQL race test uses its dedicated integration configuration and explicit disposable test URL. Privilege verification used the harness's explicit disposable tmpfs option. No production database URL or secret belongs in a reproduction command. Repository metadata unit tests passed; `check:pr-metadata` cannot validate a real PR without the GitHub event context, and no PR was created.

Production images use the canonical pinned Dockerfiles with isolated build-context-only CPU limiting. The web build additionally uses the explicit local public origin. No repository Dockerfile, dependency version or lockfile was changed for verification. Builds execute Next.js compilation, lint and TypeScript checks. The unchanged Sentry import deprecation remains a warning.

The host admin full suite reported 154 passed files and one unchanged Forge architecture-policy filesystem-scan timeout (1067 passed, one failed, four skipped tests). The focused unchanged policy repeated the same 15-second scan timeout without a forbidden-import assertion. No timeout or policy was weakened; the Linux filesystem rerun is reported separately in STATUS.md.

The final Linux run passed all 155 files: 1068 tests passed, four skipped, zero failed. The unchanged Forge policy's three tests passed, including the filesystem scan in 11.509 seconds. Both final production builds passed their integrated lint and TypeScript checks (web 162 static pages, admin 24); all 33 changed runtime source files matched the frozen build context by SHA-256. The final 13 repository policies passed. The complete 30-step browser/API journey passed in 37.6 seconds (50.8-second runner duration), including real form submissions and persisted monetary records. No later runtime change was made after this acceptance.

Browser evidence includes public desktop/laptop/tablet/mobile screens, clean application confirmation, founder applicant review, invitation activation, partner command centre, approved resource library, saved discovery, commission centre and downloaded statement, plus founder financial/resource/capacity workspaces. The 30-step test combines browser form interactions with authenticated HTTP commands for founder scope, contract, collection and payout operations; it does not claim that every founder control was clicked. Screenshot-only follow-ups wait for loaded data. Additional visual-login attempts reached the existing shared five-attempt login throttle; it was allowed to expire naturally. The passing commercial journey was independent of those later capture attempts.

## Operational and deployment preparation

Safe local demonstration uses loopback web port 3102 and admin port 3103, isolated `ss_expansion_test` PostgreSQL on loopback 55440, fake `.invalid` identities, dedicated test MFA encryption and no provider credentials. The demo database is ephemeral. Real admin MFA remains required. Seed execution is guarded against a nonlocal or incorrectly named database.

Before release:

1. Approve applicant notice, retention duration, independent-status review, partner agreement, lead-protection terms, commission/refund terms and accounting treatment. Publish genuinely approved resource versions.
2. Configure existing production Auth.js/MFA/database secrets through the established root environment workflow. Do not copy demonstration secrets or relax encryption. Keep Forge AI disabled unless separately authorised.
3. Set `PARTNER_APPLICATIONS_ENABLED`, `PARTNER_APPLICATION_PRIVACY_VERSION` and `PARTNER_APPLICATION_RETENTION_DAYS` only after approval. The latter accepts 1 through 730 days and has no fallback.
4. Verify production backup/restore and canonical runtime grants; apply through root `npm run db:migrate`, never either app migration batch alone. Recheck migration history, planner and privilege policy.
5. Build/review both applications and test the deployed origin/session/cookie/HTTPS/Nginx boundaries. Canonical checkout remains `/var/www/scalesmiths/ScaleSmiths` and admin origin remains `https://admin.scalesmiths.co.uk`.
6. Establish manual application review, approved invitation delivery, retention purge, client collection evidence, payout approval/reconciliation and incident ownership.

Rollback closes intake first and revokes affected partner access if required. Redeploy only a compatible application version; preserve agreements, audit and financial history. Do not drop expansion tables or edit committed migrations. Use new forward migrations for correction. An existing Docker runtime reports UID 1001 with GID 65533; this operation does not change that inherited runtime or establish Forge filesystem proof.

Monitor application 429/503 responses, overdue retention, invitation expiry/revocation, denied access, capacity exhaustion, unmatched/duplicate collection attempts, earned versus allocated/paid liabilities and aged prepared payouts. Avoid logging applicant bodies, activation tokens or credentials.

## Next operation

Complete independent protected-area review and settle legal/accounting decisions first. Add prepared-payout cancellation and approved partial-refund semantics before operational use that requires them. Then strengthen retention scheduling, notifications, contact/document history and handover. Begin Phase B only after this foundation's deployment acceptance and agreed support ownership; introduce website fetching with SSRF controls and AI with existing provider/budget/sandbox gates. Provider events and automated matching belong to Phase C; national analytics follows validated demand.

No push, merge, deployment, production data mutation, external email, paid provider request or live transfer was performed by this operation.
