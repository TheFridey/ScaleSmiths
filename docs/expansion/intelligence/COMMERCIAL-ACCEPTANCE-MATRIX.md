# Commercial acceptance matrix (checkpoint 2)

"Persisted" means the real production service SQL and migrations ran against PostgreSQL (PGlite for ledger journeys, real PostgreSQL 16 for races). "UI" is not claimed anywhere below: the new founder and partner screens were type-checked, linted and built, but not driven in a browser against an authenticated session.

| Case | Status | Evidence |
|---|---|---|
| A historical standard-v1 | PASS, persisted | Existing £705 journey and hardening tests still pass; v1 terms unchanged by `expansion-finance.test.ts` |
| B standard-v2 | PASS, persisted | £30,000 + £30,000 + £10,500 pence; stored £6,200 commitment |
| C £750/£1,250 | PASS, persisted | £225 + £375 + £105; replay idempotent |
| D growth-only | PASS, persisted | £105, then second payment rejected, no build milestone |
| E discounted (£1,500) | PASS, persisted on real PostgreSQL (checkpoint 3A) | allowance → reservation → accepted terms → £225 + £225 + £105 = £555; plus browser run |
| F free build | PASS, persisted on real PostgreSQL (3A) | £0 build, £4,200 commitment, capacity reserved, £105 after first £350, second retainer rejected |
| G bespoke £25,000 | PASS, persisted | £0 at acceptance; £3,000, then £1,500, then £3,000 per collection, reaching £7,500 only after all three |
| H additional customer sale | PASS, persisted (3A) and browser | claim → approval → new accepted terms → allocated invoice → £3,000 commission; old invoice unclaimable; no client duplicated; historical contract ledger unchanged |
| I withdrawal | PASS: 31 service tests, 11 real-PostgreSQL races, browser | request/replay/reject/cancel/approve/prepare/settle; over-withdrawal and double allocation impossible; refund dispute gate; no transfer |
| J achievement | PASS (service, real PostgreSQL, browser) | derived progress, conditional rewards, no automatic liability, duplicates and bypasses refused in the database, ledger unchanged |
| K referral | PASS (service, real PostgreSQL, browser) | code, attribution, vetting unchanged, five-client conditional £250, no payable liability, no recurring commission, privacy-limited view |
| L exclusivity | PASS at acceptance (plan and legacy paths) and structured classification: service, race, browser. NOT enforced at registration or allocation (allocation not built) | classified/unclassified, review, exception, supersession, confidentiality |
| M international eligibility | PARTIAL: acceptance gate PASS for plan and legacy paths (unknown, unconfirmed, unapproved, suspended, wrong-plan, approved; grandfathering; race; browser). Applicant, activation, allocation and scope-approval gating NOT implemented | |
| N discount concurrency | PASS, real PostgreSQL | three race tests |
| O refund/payout regression | PASS | existing hardening suite plus new pooled £200 partial refund = −£60 held for review |
| P four £500 instalments | PASS, persisted and real-PostgreSQL concurrent | £150 × 4 + £105 = £705; concurrent interim collections serialise; over-allocation admits one |

Rounding fragmentation: unit and persisted tests show 5p × 4 pays 6p (cumulative) rather than 7p.
