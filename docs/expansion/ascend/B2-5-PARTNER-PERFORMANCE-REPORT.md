# B2.5 Partner Performance — implementation checkpoint

**Status:** In progress; draft review only. Not merged, not deployed, not enabled.

## Grounding
- Baseline: master at `e48967bf8fcf45d2c329023843ac89c8ba6f9518`.
- Flag: `PARTNER_PERFORMANCE_ENABLED=false` by default.
- New read-only page `/partner/performance` and API `GET /api/partner/performance?period=30d`.
- Authentication: existing expansion.partner page capability and active-partner/session guard. The service derives its partner id server-side.
- Financial figures: `getPartnerFinance` (Commission Centre); no new commission or reward calculations.
- Recognition: `getProgrammeOverview`; a reached milestone is not represented as a paid or approved reward.
- No new DB tables, migrations, paid APIs, background work, learning reads or writes.

## Known limitations — MUST resolve before ready for review
- Performance events use bounded samples (up to 5,000 each) and mark truncated opportunity datasets; large datasets need aggregate queries to guarantee complete historical metrics.
- Pipeline summary is **current-state distribution**, not a historical conversion funnel. Recorded audit history is not yet sufficient for a verified stage cohort.
- Current snapshot and financial services use separate database transactions; a consistent cross-service instant has not yet been demonstrated.
- Date periods are rolling UTC windows; alignment to Europe/London reporting boundaries needs final product review.
- Full 6-width screenshot inspection, Playwright browser acceptance and PostgreSQL 14/16 real-DB tests have not run in this environment.
- The available Desktop Commander session is not a verified ScaleSmiths development machine; no local build or production stack has been used.
- CI on this PR must be examined after push; do not claim green until it actually is.

## Completed source work
- Pure `partner-performance.ts` helpers with Vitest tests, including periods, event dating, exact pence sums, no invented percentages and labelled state distributions.
- Server-only read projection from owned opportunities, meetings and contracts plus the existing finance and recognition services.
- Feature-gated API, page, period selector and responsive CSS.
- Explicit RBAC page admission, documented API authorisation rule, partner navigation and environment flag.

## Prohibited
No founder learning-progress visibility, compulsory activity targets, partner rankings, new rewards, commission mutations, production activation or deployment.

## Next engineering work
1. Review and resolve CI failures.
2. Add real PostgreSQL partner-isolation, contract/ledger equality and negative authorisation tests.
3. Add browser journeys to the required Empower Browser Acceptance job, with viewport and axe evidence.
4. Replace bounded event sampling with precise aggregate queries or pagination plus coverage.
5. Test snapshot semantics and period boundaries, then perform an independent review.
