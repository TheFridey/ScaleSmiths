# Checkpoint 2 report: commercial integration (2A, 2B) 

Classification: **B0.2 PARTIAL-TO-COMPLETE (integrated, tested, not approved). B0.3 NOT STARTED.** The wider operation is not complete, and nothing is deployed or merged.

## Baseline and repository

- Verified: PR #154 merged at `4c399b8`; checkpoint 1 `4428cb1` was on the remote; this checkpoint adds 2A `13931fe`, 2B `991551a` and a final docs/tests commit on `claude/modest-newton-jo2d95`.
- No PR created; GitHub CI was **not** run or checked (the GitHub connector was unavailable and no PR exists). The `entire` Graph CLI was still unavailable.
- Master branch protection is still unenforced and undocumented beyond the earlier concern.

## Delivered

**2A:** plan versions with immutable accepted commitment snapshots; server-built terms; `interim` milestone; pooled-build rounding; per-plan availability gates (default disabled); founder plan selector and plan settings; growth-only and bespoke journeys; migration 0073.
**2B:** per-partner discount allowances (default none), reservations consumed at acceptance, immutable history; founder-reviewed additional-business claims reusing canonical clients; partner allowance and claim UI; migration 0074.
**Verification gap closures:** both production builds; committed browser tests; the real-PostgreSQL integration and concurrency suites.

## Not delivered

2C withdrawal requests, 2D achievements and referrals, 2E toolkit, prospect allocation, meetings, market eligibility, exclusivity, Founding Partner and profiles, and the market/exclusivity acceptance gates. Matrix cases I to M are therefore not started. Public availability labels were not changed.

## Verification (exact)

| Command | Result |
|---|---|
| `cd admin && npx vitest run` | 155 of 156 files; 1,113 passed, 1 failed, 4 skipped |
| `cd web && npx vitest run` | 85 files, 464 passed |
| `cd admin && EXPANSION_TEST_DATABASE_URL=…:55444/ss_expansion_hardening_races TEST_DATABASE_URL=…:5432/scalesmiths_integration_test npm run test:integration` | 9 files, 108 passed, 0 skipped (local PostgreSQL 16, not Docker) |
| Playwright `tests/e2e/partner-programme.spec.ts` (dev server) | 10 passed |
| `npm run build` in `admin` and `web` | both exit 0 |
| `tsc --noEmit`, `eslint` (admin) | clean |
| migration order/history/consistency, docs links, architecture docs, authorization policy | pass |

The single admin failure is `safe-outbound.test.ts` (DNS rebind to IPv6 loopback). It is environmental: this container cannot bind `::1` (`EAFNOSUPPORT`). The test is unchanged and still enforces its assertions; it fails identically on the original checkpoint-1 code. Run it in CI or on an IPv6-capable Linux host to confirm.

**Not run:** the PostgreSQL privilege harness (needs Docker, unavailable), the full web Playwright suite, the remaining repository policy gates, and GitHub CI. By source, runtime roles get SELECT/INSERT/UPDATE on new tables through default privileges, and the new code never deletes.

## Findings

- Real-database testing caught a defect PGlite hid: an invalid `prospects.source` value in additional-claim approval. Fixed.
- Per-milestone rounding permits cross-milestone penny gain; closed for new plans, deliberately unchanged for history.
- PGlite fixtures use simplified prerequisites; service-level SQL there is genuine, but enum and constraint behaviour of canonical tables is only proven by the real-PostgreSQL suite.
- No independent reviewer was used; no external audit result is claimed. The author's own review checked financial arithmetic, authority and concurrency paths.

## Remaining risks and approvals

Everything in FOUNDER-DECISIONS.md still stands, plus enabling each plan, approving custom schedules, and confirming pooled rounding. The UI for 2A and 2B has not been exercised in a browser with an authenticated session. Accepted contracts could not yet be blocked by an unapproved market or an exclusivity restriction.

## Recommended next operation

2C first (withdrawals reusing the ledger and payout claims, with a real-PostgreSQL race against payout preparation and refunds), then 2D, then 2E. Add an authenticated founder/partner browser journey once a seeded disposable stack exists.
