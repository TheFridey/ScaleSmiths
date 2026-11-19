# Commercial acceptance matrix (checkpoint 2)

"Persisted" means the real production service SQL and migrations ran against PostgreSQL (PGlite for ledger journeys, real PostgreSQL 16 for races). "UI" is not claimed anywhere below: the new founder and partner screens were type-checked, linted and built, but not driven in a browser against an authenticated session.

| Case | Status | Evidence |
|---|---|---|
| A historical standard-v1 | PASS, persisted | Existing £705 journey and hardening tests still pass; v1 terms unchanged by `expansion-finance.test.ts` |
| B standard-v2 | PASS, persisted | £30,000 + £30,000 + £10,500 pence; stored £6,200 commitment |
| C £750/£1,250 | PASS, persisted | £225 + £375 + £105; replay idempotent |
| D growth-only | PASS, persisted | £105, then second payment rejected, no build milestone |
| E discounted (£1,500) | PASS: unit and acceptance path; persisted ledger for the equal-halves schedule is covered by unit totals only | £555 |
| F free build | PASS: acceptance persisted (£0 build, £350 fee, £4,200 value) | first-retainer ledger covered by the unit total (£105) |
| G bespoke £25,000 | PASS, persisted | £0 at acceptance; £3,000, then £1,500, then £3,000 per collection, reaching £7,500 only after all three |
| H additional customer sale | PARTIAL, persisted | Claim, review, canonical client reuse, attributed-client enforcement, ordinary duplicate still blocked. No end-to-end commission run on the additional contract |
| I withdrawal | NOT STARTED | |
| J achievement | NOT STARTED | |
| K referral | NOT STARTED | |
| L exclusivity | NOT STARTED | |
| M international eligibility | NOT STARTED | |
| N discount concurrency | PASS, real PostgreSQL | three race tests |
| O refund/payout regression | PASS | existing hardening suite plus new pooled £200 partial refund = −£60 held for review |
| P four £500 instalments | PASS, persisted and real-PostgreSQL concurrent | £150 × 4 + £105 = £705; concurrent interim collections serialise; over-allocation admits one |

Rounding fragmentation: unit and persisted tests show 5p × 4 pays 6p (cumulative) rather than 7p.
