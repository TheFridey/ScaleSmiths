# Operation Intelligence: final report (checkpoint 1 of a multi-checkpoint operation)

## Executive summary

This checkpoint delivers **B0.1 (public recruitment alignment)** in full and the **pure-rules core of B0.2 (commercial alignment)**. It does **not** deliver B0.3 or B1 to B6. The overall operation is **PARTIAL**; most of the specification is NOT STARTED. Nothing was deployed, merged, emailed or mutated in production, and no real partner or applicant data was used.

## Repository state

- Baseline: master `4c399b8`. PR #154 had **already merged**, so the stacked-branch strategy was unnecessary; work sits on `claude/modest-newton-jo2d95` (the session-designated branch, not `feature/operation-intelligence`).
- `AGENTS.md`, `CLAUDE.md`, `.entire/agent-guide.md` were unmodified in this working tree and untouched.
- The `entire` Graph CLI was not installed; source was inspected directly.
- No PR created, nothing merged, nothing deployed. Master branch-protection concern is unchanged and undocumented here beyond this note.

## Delivered

**Public site (web):**
- Gold "Become a Partner" button in the shared `Nav` (desktop bar; compact button in the mobile bar; top of the mobile drawer), keyboard focus ring, reduced-motion safe. Existing Client Portal link is icon-only between 768 and 1023px (accessible name retained) to avoid header overflow; "Start a Project" is unchanged.
- Footer: "Become a Partner" and "Partner Login" (existing admin origin `/login`, via `partnerLoginUrl()`; no new subdomain or auth).
- `/partners` rebuilt around *Scale Your Future*: hero, twelve-month standard package, equal and £750/£1,250 payment tables, discount table (marked not yet approved), Growth Partnership-only, additional customer sales, bespoke examples, achievements and referral (planned, conditional), Founding Partner, toolkit and availability register, international eligibility, future employment qualification, FAQ, important information, gated application form. Intake remains closed unless the existing env gate is configured.
- Calculator covers standard, discounted, free-build, retainer-only and bespoke, with build/retainer breakdown, annual equivalent and disclosures. Achievement and referral rewards are excluded from it.
- The previous six-month / £4,100 public copy is removed.

**Commercial rules (admin):** `standard-v2`, `growth-only-v1` and `scheduleCommissionTerms` added alongside the untouched `standard-v1`. Regression cases A to G pass (including £705 on £6,200, £225 + £375 + £105, retainer-only no repeat commission, discounted/free-build totals, bespoke £25,000).

## Not delivered (honest inventory)

COMPLETE: header button, footer links, Partner Login, recruitment page, public calculator.
PARTIAL: twelve-month terms, flexible schedules, retainer-only, bespoke commission, discount arithmetic (rules and tests only: **not wired into contract acceptance, database or admin UI**); international eligibility (disclosure only).
NOT STARTED: existing-customer attribution workflow, discount allowances and concurrency (Case N), achievements and referrals as features, withdrawals, toolkit, prospect allocation, exclusivity, Founding Partner, profiles, Academy, resources, knowledge base, Website Intelligence, Sales Studio, proposals, agreements, Ask ScaleSmiths, support, handover, founder administration. Cases H to O not implemented except the existing historical refund/payout tests, which still pass.

## Verification

| Check | Result |
|---|---|
| `cd web && npx vitest run` | 85 files, 464 passed (458 before, plus 6 new) |
| `cd admin && npx vitest run` | 155 of 156 files; 1086 passed, 1 failed, 4 skipped (up from 1079 with 7 new). The failure, `safe-outbound.test.ts` IPv6 rebind, is environmental (`EAFNOSUPPORT ::1`) and identical without these changes |
| `tsc --noEmit` and eslint (web, touched files) | Clean |
| `check:documentation-links`, `check:architecture-docs`, `check:migration-order` | Pass (no migrations added) |
| Browser (Playwright, dev server, not a production build) | No document or header overflow at 320, 390, 768, 1024, 1440; calculator 10 sales shows £7,050; footer links verified. Screenshots in `evidence/` |
| Not run | Production builds, PostgreSQL integration and privilege harness, nginx tests, full browser E2E suite, remaining repo policy gates, CI |

Screenshots were taken with the cookie banner partly visible, and only header, mobile and full-page desktop views were captured; the other screenshots in the brief were not produced. The browser checks were ad hoc scripts, not committed tests.

## Operational readiness

Everything here is locally verified only. The page copy needs founder, legal and accounting review before publication (see CONTENT-APPROVAL-REGISTER.md and FOUNDER-DECISIONS.md). Production intake and activation stay closed.

## Next

Wire `standard-v2` into scope approval and contract acceptance with a migration and PostgreSQL concurrency tests, then B0.3 gated features, one vertical slice at a time. Do not start Phase C.
