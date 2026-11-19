# Checkpoint 4 report

**Status: PARTIAL.** Delivered: 4A integrity closure, 4B achievements and referrals, 4C onboarding toolkit and meeting requests, 4D legacy-path and structured gates, restricted-role verification, extended authenticated browser acceptance, original Expansion journey rerun, independent review fixes. **Not started:** researched prospect allocation and its concurrency tests, Founding Partner recognition, personal profiles and publication, and market gating at applicant, partner activation, scope approval and allocation. B0.3 is therefore not complete. Nothing is deployed or merged, no PR was opened, GitHub CI was not run.

## Repository
Start `0d77a4a`. Branch `claude/modest-newton-jo2d95`, pushed. Migrations added: 0078 state integrity, 0079 achievements/referrals, 0080 sector taxonomy, 0081 toolkit/meetings, 0082 review fixes. Draft PR text: `PR-DESCRIPTION.md` (not opened).

## Lock-order findings
A real deadlock was reproduced on real PostgreSQL (refund versus a collection on another contract sharing an invoice; SQLSTATE 40P01) and fixed by one hierarchy (`LOCK-HIERARCHY.md`: admin_users, partner, request/payout, contract, advisory, invoice, ledger). Evidence: repeated shared-invoice race and a ten-pair stress (refund, withdrawal, payout, adjustment, contract cancellation, duplicate collection). Empirical and read-through, not a proof; no automatic retry was added.

## Delivered
- **4A:** withdrawal transitions and exclusivity immutability enforced by the database; supersession for corrections.
- **4B:** versioned programmes, qualification derived from founder decisions on real contracts, conditional rewards that cannot be approved or become payable without an approved programme that enables them, referral codes and attribution, partner Achievement Centre and Referrals, founder administration.
- **4C:** manual toolkit tracking (evidence mandatory, nothing assumed available) and meeting requests with enforced transitions; no provisioning, calendar events or invitations.
- **4D:** legacy `standard-v1` acceptance gets no exemption from market and exclusivity gates (existing contracts grandfathered); founder-defined sector taxonomy.

## Independent review (model reviewer, not a human audit)
No critical or high findings. Nine medium/low items: fixed in 0082 and code: auto-withdrawn rewards no longer block revival; qualification locks the contract against cancellation; referral attribution locks the application row; referrer stage uses real activation and no longer reveals closure; milestone immutability covers old and new versions; exclusivity correction cannot open a gap; toolkit defaults show nothing as available, keep detail, and require an activated partner; partner guards share-lock the user; past alternatives cannot be accepted. **Not fixed (known limits):** qualification is not re-evaluated after later refunds (only manual revoke) and approved rewards survive a revoke (flagged, not payable); a classified prospect against an unclassified exclusivity compares wording only; sector aliases are stored but unused in matching; meeting purpose/context stay editable after closure; raw database text can reach partners on rare constraint errors; foreign-key failures on sector ids surface as a generic 503.

## Verification (exact)
| Check | Result |
|---|---|
| `cd admin && npx vitest run` | 160 of 161 files; 1,172 passed, 1 failed, 4 skipped |
| `cd web && npx vitest run` | 85 files, 464 passed |
| `npm run test:integration` with the concurrency suite as the restricted `scalesmiths_admin` role | 9 files, 135 passed |
| Programme browser journey (production build, disposable DB) | passed twice after the final changes |
| Original `expansion.spec.ts` | passed once on a clean database before the review fixes (calculator selector, scope-review selector and a market-approval step updated; needs `PARTNER_APPLICATION_RETENTION_DAYS` on the admin server); **not re-run after 0082** |
| 21 repository gates | all pass |
| Privilege harness (unmodified script, shim over native PostgreSQL 16) | passed with 83 migrations and 8 drift cases |
| Restricted-role probes | web denied on 13 private tables; admin denied DELETE, CREATE, DROP, TRUNCATE, DISABLE TRIGGER and direct trigger-function execution; read-only denied INSERT |
| Upgrade check | checkpoint-3 database upgraded 78 to 82 migrations (0082 applied separately) with policy, exclusivity, market and partner rows intact; old exclusivity now refuses edits |
| Typecheck, lint, admin and web production builds | clean (one pre-existing lint warning); builds pass |

**Failed or unverified:** `safe-outbound.test.ts` IPv6 rebind (container has no `::1`; unchanged, needs a supported host or CI). Not run: GitHub CI, the privilege harness with real Docker, the full web Playwright suite.

## Browser evidence
UI-driven: plan, allowance, scope, discount, acceptance, market and exclusivity screens, withdrawal journey, additional claim, Achievement Centre and qualification, refused reward, referral code and attribution, toolkit evidence refusal and fulfilment, meeting request, alternative, acceptance. API-driven set-up: applicants, activation, prospect discovery/scope, capacity, invoices, later collections, payout approval and settlement, privilege-denial probes. Screenshots: `evidence/programme/`, `evidence/expansion-original/`. Two earlier "alert" assertions were vacuous (they matched Next's route announcer) and were replaced with real form-error checks.

## Readiness (implemented, tested, configured, approved and operational are different things)
| Feature | Status |
|---|---|
| Lock-order closure, withdrawal and exclusivity integrity | COMPLETE (tested) |
| Achievements and referrals | COMPLETE as software; rewards NOT payable (no approved programme) |
| Onboarding toolkit, meeting requests | COMPLETE as manual tracking; nothing provisioned |
| Legacy-path market/exclusivity gate, sector taxonomy | COMPLETE at acceptance; PARTIAL overall |
| Market gating at applicant, activation, scope approval, allocation | NOT STARTED |
| Researched prospect allocation | NOT STARTED |
| Founding Partner recognition | NOT STARTED |
| Personal profiles and publication | NOT STARTED (public route blocked pending design) |
| Restricted-role verification | COMPLETE for implemented services; no public profile projection exists to verify |
| Independent review | DONE once by a model; no human audit |

None of this is commercially approved or production operational. Founder, legal, accounting and privacy decisions are in `FOUNDER-DECISIONS.md`.

## Next
Prospect allocation with real-PostgreSQL races and market/exclusivity gating at registration and allocation; then Founding Partner and profiles; run CI for the IPv6 test and the Docker privilege harness; rerun the original Expansion journey on a clean database. B1 only after B0 is complete.
