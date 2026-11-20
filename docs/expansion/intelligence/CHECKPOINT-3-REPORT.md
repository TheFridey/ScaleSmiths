# Checkpoint 3 report

**Status: PARTIAL.** Delivered: 3A (acceptance gaps), 3B (withdrawals), market/exclusivity acceptance gates, authenticated browser acceptance, and independent review fixes. **Not started:** 3C achievements and referrals, 3D toolkit, prospect allocation, meetings, and Founding Partner, personal profiles. B0.3 is therefore not complete. Nothing is deployed or merged; no PR exists; GitHub CI was not run.

## Repository
Start `48c8931` (checkpoint 2). Commits: 3A 3B `48cbf7b`, 3E gates `ce19aa8`, review fixes (final commit). Branch `claude/modest-newton-jo2d95`, pushed. Migrations added: 0075 withdrawals, 0076 market/exclusivity, 0077 review hardening.

## Delivered (implemented, tested; none commercially approved)
- **3A:** Cases E, F, H persisted on real PostgreSQL (£555; £105 after first £350; additional-customer commission only on its own allocated invoices).
- **3B withdrawals:** ledger-entry reservations, versioned policy (none by default, so unavailable), founder review/revoke/prepare, existing payout approve/settle, refund-dispute gate, negative adjustments always included, DB guards against double allocation both ways, partner-match trigger.
- **Gates:** fail-closed market register (founder-confirmed customer market) and exclusivity decisions at plan-path acceptance; partners see no exclusivity signal.

## Independent review
A fresh model reviewer (not a human audit, read-only, no execution) reported 1 HIGH, 5 MEDIUM, 3 LOW, and no critical findings. All were addressed: matching strengthened (HIGH); founder confirmation of market; partner probe signal and locking read removed; negative adjustments auto-included; approved requests revocable by a founder; decisions conflict instead of silently succeeding; London-date boundaries and real-date validation; partner-match trigger with ledger lock; policy re-checked at approve/prepare. **Not fixed:** DB-level enforcement of request status transitions (service-enforced only) and an immutability trigger on exclusivity terms. Pre-existing: `refundExpansionPayment` locks contract before partner, opposite to withdrawal paths; no deadlock was observed in 11+4 race tests but it is unproven by analysis.

## Verification (exact)
| Check | Result |
|---|---|
| `cd admin && npx vitest run` | 156 of 157 files; 1,141 passed, 1 failed, 4 skipped |
| `cd web && npx vitest run` | 85 files, 464 passed |
| `cd admin && EXPANSION_TEST_DATABASE_URL=…:55444/ss_expansion_hardening_races TEST_DATABASE_URL=… npm run test:integration` | 9 files, 128 passed (native PostgreSQL 16) |
| Authenticated browser: `playwright.programme.config.ts` against a production admin build and a seeded disposable database | 1 journey passed, run twice consecutively |
| `npm run test:postgres-privileges` | passed across 78 migrations, 8 drift cases, **via a test-only `docker` shim over a native PostgreSQL 16 cluster** because Docker is unavailable; the harness script itself is unmodified |
| 17 repository check/test gates (docs, architecture, migration order/history/consistency, authorization, dependency, env, GitHub Actions, topology, branch protection) | all pass |
| admin `tsc`, `eslint`; both production builds | clean; admin build passes (rebuilt after last app change); web build last run at checkpoint 2 |
| Web committed Playwright `partner-programme.spec.ts` | 10 passed |

**Failed/blocked:** `safe-outbound.test.ts` IPv6 rebind fails only because this container cannot bind `::1` (unchanged test; needs an IPv6-capable host or CI). Not run: the full web Playwright suite, the older `expansion.spec.ts` (needs web server and Chrome channel; edited for the new form but not re-run), my services under the restricted admin DB role, GitHub CI.

## Browser evidence
UI-driven: plan enablement, allowance policy, scope approval, discount reservation, plan-based acceptance, blocked/approved market and founder confirmation, first collection form, payout policy, withdrawal request/review/prepare, additional-claim submission and approval, exclusivity record and decision, partner isolation views, responsive checks at 320/390/768/1024/1440. **API-driven:** applicant invitation/activation, prospect discovery/scope submission, capacity, invoice creation and later allocations/collections, payout approve/settle, second-prospect set-up, and privilege-denial probes. Screenshots: `evidence/programme/`.

## Readiness by feature
| Feature | Status |
|---|---|
| Cases E, F, H | COMPLETE (tested) |
| Withdrawal requests | COMPLETE as software; NOT operational (no approved policy) |
| Market eligibility | PARTIAL (acceptance gate only) |
| Sector exclusivity | PARTIAL (acceptance gate only; word-stem matching) |
| Achievements, referrals, toolkit, prospect allocation, meetings, Founding Partner, profiles | NOT STARTED |
| Authenticated browser acceptance | PARTIAL (see API list above; achievements etc. absent) |
| Independent review | DONE once by a model reviewer; no human audit |

Implemented ≠ tested ≠ approved ≠ operational: every item above is implemented and tested; none is commercially approved; none is production operational.

## Next
3C (achievements and referrals, reward activation disabled), then 3D and the rest of 3E; wire market/exclusivity into registration and allocation; run the privilege harness and `safe-outbound` in CI.
