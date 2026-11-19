# Draft PR: Operation Intelligence B0 (Scale Your Future programme foundation, complete)

**Status: DRAFT. Not opened, not merged, not deployed.** Base: master `4c399b8` (Expansion Hardening, PR #154). Branch `claude/modest-newton-jo2d95`. Intake and partner activation stay closed; every commercial reward, withdrawal and market is disabled or approval-gated by default.

## What this contains
- **B0.1 Public site:** Become a Partner header CTA, footer and Partner Login (existing admin origin), rebuilt `/partners` (twelve-month terms, calculator, honest availability labels, disclosures).
- **B0.2 Commercial integration:** `standard-v2`, `growth-only-v1`, `bespoke-v1` plans with immutable commitment snapshots, interim milestone, pooled rounding, discount allowances (none by default), additional-customer claims, withdrawal requests over the existing ledger, fail-closed market and exclusivity gates (also for legacy `standard-v1` acceptance), canonical sector classification.
- **B0.3 Programme:** achievements and referrals (conditional, never payable), onboarding toolkit tracking, founder meeting requests.
- **B0 finalisation (checkpoint 5):** refund-raised qualification review and reward withdrawal; researched prospect allocation; applicant, operating-market and customer-market enforcement with generic partner messaging; founder-controlled Founding Partner recognition; consent-bound personal partner webpages behind a restricted public projection (publication off by default). Founder and partner screens for all of it.
- **Integrity:** one documented lock hierarchy (a real refund-vs-collection deadlock was reproduced and fixed), database-enforced withdrawal transitions, immutable exclusivity history with supersession.

## Migrations (forward-only, 0073 to 0087)
0073 plans · 0074 allowances and claims · 0075 withdrawals · 0076 market/exclusivity · 0077 gate hardening · 0078 state integrity · 0079 achievements/referrals · 0080 sector taxonomy · 0081 toolkit/meetings · 0082 review fixes · 0083 review flags, reward withdrawal, meeting history · 0084 research allocation · 0085 market enforcement · 0086 Founding Partner recognition · 0087 partner profiles and the public view. Upgrade from the Expansion Hardening state was verified with historical rows preserved. No migration deletes or rewrites existing data.

## Financial changes
Standard commission stays £705. New plans round once on the cumulative build total. Withdrawals reserve existing ledger entries and create ordinary payouts; nothing moves money. Achievement, referral and withdrawal activation are off until an approved programme/policy exists.

## Security
Partner isolation and founder-only actions verified in service tests, real PostgreSQL and a production-build browser run. The full concurrency suite passes **as the restricted admin runtime role**; the web role was denied on every private table; admin DELETE/DDL/TRUNCATE/trigger-disable were denied. Two independent model reviews (not human audits) found no critical issues; all high/medium findings were remediated.

## Verification (see CHECKPOINT-4-REPORT.md for exact commands and counts)
Admin unit/service tests, web tests, 135 PostgreSQL integration tests, production builds, committed public browser tests, authenticated programme journey (run twice), original Expansion journey, 21 repository gates, privilege harness via a native-PostgreSQL shim.

## Known gaps and approvals
B1 to B6 are not started. Partner photographs are not built (no secure asset pipeline). Public profile publication is off in both apps and real partner pages remain a separate release gate. Unverified here: GitHub CI, the unchanged IPv6 `safe-outbound` test (this container cannot bind `::1`), real Docker (a native PostgreSQL 16 cluster and a command shim were used). All commercial, legal, accounting, privacy and production approvals are outstanding (FOUNDER-DECISIONS.md). See B0-FINALISATION-REPORT.md.

## Deployment prerequisites and rollback
Deploy only after protected-area review, legal/accounting/privacy approval and production recovery verification. Migrations are additive; rollback is by restoring the pre-migration backup (the new tables are unreferenced by older code). Enable plans, withdrawal policy, markets and programme versions only through the founder UI after approval. **Master branch protection is still not enforced** (governance concern, unchanged).
