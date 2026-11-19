# Commercial integration design (checkpoint 2A/2B)

## Findings that shaped the design

1. **The milestone model could not carry multi-instalment builds.** The database constrained collections to `deposit`, `final`, `first_retainer`, with commission rounded separately per milestone.
2. **Per-milestone rounding is exploitable across milestones.** Odd-penny payments split over several milestones each round up independently (e.g. 5p+10p+5p pays 7p where one cumulative rounding of 20p pays 6p). Historical `standard-v1` behaviour is left exactly as it was; the new model closes this for new plans.
3. **One plan version cannot cover several schedules.** Accepted plan versions are immutable and compared on acceptance, so a flexible schedule under `standard-v2` would have been rejected as "different terms". Each schedule therefore gets its own deterministic version (`standard-v2`, `standard-v2.deposit-completion`, `standard-v2.d150000`, `standard-v2.c<instalments>`, `bespoke-v1.<…>`).
4. **Ordinary registration's one-domain lead protection also blocks legitimate additional projects.** It is kept for ordinary registrations (partial unique index) and relaxed only for founder-approved additional claims.

## Model

- Milestones: `deposit`, `interim` (new, aggregates middle instalments), `final`, `first_retainer`. Migration 0073 widens the check constraint only; no data is rewritten.
- `commissionModel: "pooled-build-v1"`: commission on all build milestones is computed on one cumulative total (`commissionAt(groupTotal)`); the first retainer is its own group. Absent for historical plans, which keep per-milestone rounding.
- `commitment` snapshot stored inside the immutable contract terms: currency, build value, recurring fee, minimum term, minimum contract value, schedule id and instalments, approval and refund references. `parseCommissionTerms` validates it is internally consistent (schedule sums to build, contract value = build + fee × term, twelve months for `standard-v2`/`growth-only-v1`).
- Approval actor and timestamp come from the existing contract row (`created_by`, `accepted_at`) plus audit.
- **Terms are built server-side** (`buildAcceptedTerms`). Founders choose a plan, schedule and (for discounts) a reserved fee. Client-supplied pricing, rate and the server-only `approvedDiscountFeePence` are ignored or overwritten.
- Plans are **disabled by default** (`expansion_plan_settings`). Acceptance share-locks the setting row, so disabling and accepting serialise.
- Growth-only has no build milestones and records a £4,200 commitment; first £350 earns £105; further collections exceed the milestone cap and are rejected.
- Bespoke: founder-entered instalments; 30% unless a different rate is entered with an approval reference; first-retainer eligibility defaults to none.
- Refunds use the same pooled group, so a £200 partial refund on a £2,000 standard-v2 build calculates −£60 and, under the default `manual_review` treatment, is held without touching the ledger.

## Not integrated yet

Gating acceptance on market eligibility and unresolved exclusivity (2E), withdrawal allocation (2C), and achievement/referral counting (2D) have no implementation. The market and exclusivity gates the specification lists for contract acceptance are therefore **not enforced**.
