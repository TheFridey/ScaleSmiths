# Operation Intelligence: architecture

Baseline: master `4c399b8` (PR #154, Expansion hardening, already merged). Branch `claude/modest-newton-jo2d95`. The `entire` Graph CLI was not installed, so discovery used direct source inspection (recorded as a failed query path, not retired).

## Decisions

1. **No second stack.** The public site (`web`) and admin/partner portal (`admin`) are reused. Partner sign-in stays in the admin app (`/login`), served at its canonical origin `https://partners.scalesmiths.co.uk`; the public site links to it through `partnerLoginUrl()` (`NEXT_PUBLIC_ADMIN_URL`, production fallback `https://partners.scalesmiths.co.uk`). No separate partner app.
2. **One commission engine.** `admin/src/lib/expansion-finance.ts` remains the only place commission is computed. Plan versions are immutable snapshots: `standard-v1` (six-month, historical, untouched), `standard-v2` (twelve-month), `growth-only-v1`. Flexible payment schedules are expressed as milestone amounts (`scheduleCommissionTerms`), so they reuse cumulative rounding and cannot raise total entitlement.
3. **Public figures share one module.** `web/src/lib/partner-programme.ts` drives the recruitment page tables, hero figures and calculator with the same 30% / cumulative-rounding rule as the admin engine. A test asserts each required example.
4. **Planned features stay labelled.** `FEATURE_AVAILABILITY` is the single public register; nothing planned is shown as operational.
5. **Intake stays closed.** Application intake is still gated by `PARTNER_APPLICATIONS_ENABLED` plus privacy version and retention settings.

## Not yet built (see FINAL-REPORT.md)

Achievements, referrals, withdrawals, toolkit fulfilment, prospect allocation, exclusivity, market eligibility, discount allowances, Academy, knowledge base, Website Intelligence, Sales Studio, proposals, Ask ScaleSmiths and support are not implemented. Each needs schema, authorisation and founder decisions first; the audit-fetch, AI-provider and shared-database designs need their own security review before any code.

## Known risks

- Discount-allowance and withdrawal concurrency need real PostgreSQL row-locking tests, as in the existing expansion concurrency suite.
- Website audit fetching (SSRF) must not ship without network-level egress enforcement, which this environment cannot verify.
- Live AI needs an approved provider, budget and data-processing arrangement.
