# Operation EMPOWER B2.10: Partner launch and activation report

**Date:** 24 November 2026 · **Branch:** `feature/operation-empower-b2-10-launch` (from `8cf5c718`, the B2.9 merge and `origin/master` tip) · **Verdict:** see §22.

## 1. Executive summary

The partner programme's software was much further along than the partner portal showed. A partner with no founder records saw every onboarding benefit as **Planned**, including tools that already worked. B2.10 replaces that page with a persisted, server-derived **ScaleSmiths Partner Journey**: four required steps, honest per-tool statuses with working actions, founder support, and a separate Coming soon showcase. It adds a founder **onboarding command centre**, regroups partner navigation, adds 14 partner-programme knowledge-base drafts, and extends the release drift check so a release cannot silently switch the partner portal off.

The decisive constraint is outside the code: **there is no final partner agreement in the repository**, and production has no published agreement. Without one, no invitation can be issued, so no real partner can be activated. Everything else needed for launch is built and tested, or is founder content approval that the existing Content Studio supports.

## 2. Initial production and repository state

- Repository: `origin/master` = `8cf5c718` (B2.9). The original checkout had uncommitted changes to `.entire/agent-guide.md`, `AGENTS.md` and `CLAUDE.md` that this operation did not own, so the work ran in a separate worktree (`D:/tmp/ss-b210`) and left them untouched.
- Production (read-only HTTP probes, [evidence](evidence/b2-10/README.md)): the partner portal redirects to login, the public `/partners` page is live and the application endpoint exists. **The deployed commit was not verified**, because there was no VPS access.
- Committed evidence (B2.9 reconciliation): recruitment on (180-day retention, execution off), Content Studio on, ASCEND engine on with scheduler, agent API and automation off, 0 agreement acceptances. Academy, resources, knowledge, objections, activation, pipeline and performance switches were off at B1.7, and their live values are not recorded since.

## 3. Previously hidden functionality discovered

Every toolkit item was `builtIn: false`. These items already existed in code but showed as Planned:

- referral codes (`createReferralCode`)
- joint sales meetings, optional training, technical scoping, bespoke discovery and escalation (`requestMeeting`)
- prospect registration
- researched-prospect allocation
- the personal web page workflow

These are implemented and tested but switched off:

- Academy
- resource centre
- knowledge base
- objection handling
- unified guidance
- pipeline board
- qualification
- performance
- delivery handoff

Drafted but never published: 13 courses (91 lessons, 65 checks), 13 resources, 32 knowledge entries and 12 objection responses. See [PARTNER-CAPABILITY-MATRIX.md](PARTNER-CAPABILITY-MATRIX.md).

## 4. Functionality completed

| Change | Files |
|---|---|
| Pure journey model: statuses (Available, Ready to set up, Awaiting setup, In progress, Coming soon, In development, Action required, Completed), required steps, per-tool derivation, upcoming capabilities | `admin/src/lib/partner-journey.ts` |
| Server facts and writes: journey, acknowledge step (idempotent, audited), request toolkit item (records intent only; never overwrites a founder record), founder checklist | `admin/src/lib/server/partner-journey.ts` |
| Persisted progress: append-only `expansion_onboarding_progress` (CHECK-listed steps, update/delete refused by trigger) | `admin/drizzle/0105_partner_onboarding_progress.sql`, journal, checksum manifest, shared plan |
| Lesson counts routed through the Academy service, so the learning-record isolation invariant holds | `admin/src/lib/server/empower-academy.ts` |
| API wiring | `admin/src/app/api/partner/route.ts`, `admin/src/app/api/expansion/route.ts` |
| Journey UI, overview summary with empty states, Coming soon page | `admin/src/components/expansion/PartnerJourney.tsx`, `journey.css` |
| Workspace: grouped navigation (Start, Sell, Earn, Profile, Learn), meeting-type preselection, founder "Partner onboarding" command centre, legacy resource tab hidden when the Resource Centre is on | `admin/src/components/expansion/ExpansionWorkspace.tsx` |
| Drift check governs 13 partner switches | `scripts/check-release-env-drift.mjs` (+ test) |
| Knowledge base: new `partner-programme` topic and 14 drafts | `docs/expansion/empower/KNOWLEDGE-BASE.md`, `admin/src/lib/empower-curriculum.ts`, `empower-content.ts`, importer, test |

Progress counts the **required** steps only: agreement accepted, how you earn, commercial boundaries, approved markets. Optional tools, training and future capabilities are never in the denominator, so 100% is reachable today. No training is compulsory.

## 5. Functionality activated

**None in production.** No switch was changed, because there was no VPS access and activation needs approval. The recommended order, with dependencies, verification and rollback for each switch, is in [PRODUCTION-FEATURE-MATRIX.md](PRODUCTION-FEATURE-MATRIX.md).

## 6–8. Academy, resources and knowledge base

No content was approved or published; founder approval cannot be recorded on the founders' behalf. The existing drafts cover 20 of the brief's 23 Academy topics; three courses stay BLOCKED on genuine founder, solicitor or privacy decisions. Fourteen new knowledge entries answer the brief's partner questions, each citing the code or published fact behind it. See [CONTENT-PUBLICATION-REGISTER.md](CONTENT-PUBLICATION-REGISTER.md) for what is publishable now, what is blocked and what was deliberately not written (testimonials, case studies, demonstrations, brand pack).

## 9. Onboarding redesign

"Your toolkit, as it actually stands" is gone. The page is now "Your ScaleSmiths Partner Journey", with:

- a personal welcome and a progress ring
- three facts (required steps, tools ready, capabilities on the way)
- the required steps with one-click acknowledgements
- four tool groups, each with a status pill, benefit, detail, who acts next and a working action
- founder support
- the Coming soon showcase, with no dates and no percentages

## 10. Dashboard improvements

The overview now leads with journey progress and a single **recommended next action**. New partners get explained empty states instead of zeros: no prospects yet (Register prospect), no commission yet (how commission works) and, when the Academy is live, a suggestion to start with "Welcome to ScaleSmiths". The existing metrics, Today panel and activity list are unchanged. Announcements are not built: there is no announcement source, and none was invented.

## 11–13. Recruitment, invitation, account setup and agreement

These were verified by source inspection and the existing tests, not exercised against production:

- **Application:** gated on switch, privacy version and retention days; origin check; rate limits of 3 per hour per IP hash and per email hash; validation; honeypot; persistence with `retention_until`; confirmation email.
- **Founder lifecycle:** enforced by a database transition guard.
- **Invitation:** 32-byte token, 48-hour expiry, only the hash stored; requires activation on, a published current agreement, all four onboarding confirmations and an approved market.
- **Activation:** re-checks the market and the exact accepted version.

Gaps:

- **no published agreement exists** (this blocks activation)
- no partner self-service password reset (founders reset)
- no applicant self-withdrawal

The agreement stack itself is in place: versioned, SHA-256 fingerprinted and audited, with acceptance timestamps.

## 14. End-to-end partner simulation

**Executed at database level** (PGlite, `partner-journey.database.test.ts`, 6 tests):

- acknowledge all steps, reaching 100%
- re-read as a fresh session: progress persists
- partner isolation
- append-only enforcement
- toolkit request without founder overwrite
- only published, in-date content counted
- founder-only checklist, with partners refused

Invitation, activation and agreement acceptance are covered by the existing suites, which pass. **A full browser simulation against a running stack was not executed:** Docker was not running, and the local PostgreSQL would have needed `.env` credentials, which were not read. The production procedure with a synthetic partner is in [PARTNER-ACTIVATION-RUNBOOK.md](PARTNER-ACTIVATION-RUNBOOK.md) §7.

## 15. Visual evidence

There are 18 captures (journey, completed journey and new-partner overview at 320, 390, 768, 1024, 1440 and 1920 px), with no overflow and no undersized controls. Two defects found this way were fixed: gold-on-gold primary links, and duplicated request wording. These are component renders, not screenshots of a running server; see the [evidence README](evidence/b2-10/README.md).

## 16. Security and regression results

| Check | Result |
|---|---|
| `tsc --noEmit` (admin) | pass |
| `eslint .` (admin) | 0 errors; 2 warnings in an untouched file (`ascend-review-queue.database.test.ts`) |
| `vitest run` (admin, 196 files, 1445 tests) | 1440 passed, 4 skipped. One PGlite test timed out under full-suite load (`partner-invitations.database.test.ts`) and passes alone (15/15). An earlier full run showed the same pattern in four other PGlite files, which also pass alone. These are load-sensitive hook timeouts, not caused by this change. |
| New tests | 10 unit + 6 PGlite + 1 drift: all pass |
| Academy isolation invariant | pass (after routing counts through the Academy service) |
| Migration history, order, consistency | pass (131 migrations) |
| Release drift tests, ASCEND ops tests | 5/5, 16/16 |
| Architecture, env hygiene, local state, domain boundaries, authorisation policy | pass |
| Documentation links | pass |

Not run locally: integration tests (need PostgreSQL credentials), Playwright suites, PostgreSQL 14 rehearsal, CodeQL and dependency audit. These run in CI on the pull request. No dependency was added.

Authorisation is unchanged:

- Partner endpoints use `requireCapability('expansion.partner')` plus `partnerGuard` (active, activated, current session, partner role).
- The founder checklist re-checks `expansion.manage` under a share lock.
- The new partner actions are rate-limited by the existing route limiter.

## 17. Remaining external dependencies

- the final partner agreement document
- Resend credentials on the VPS
- CircleCard (no integration; manual fulfilment)
- a mailbox provider for partner email addresses (manual)
- demonstration websites (none exist)

## 18. Founder decisions

See [FOUNDER-LAUNCH-CHECKLIST.md](FOUNDER-LAUNCH-CHECKLIST.md): 4 launch blockers, 4 content approvals, 5 commercial decisions and the optional enhancements.

## 19. Exact production configuration

See [PRODUCTION-FEATURE-MATRIX.md](PRODUCTION-FEATURE-MATRIX.md).

## 20. Deployment status

**Not deployed.** Repository-side work is complete on the branch. Deployment needs founder approval and VPS access ([runbook](PARTNER-ACTIVATION-RUNBOOK.md)): a fresh backup, then synchronise the canonical `.env`, migrate 0105, re-provision grants, cut over and verify.

## 21. Git commits and pull request

See the branch history and the pull request created from it (if created).

## 22. Final onboarding readiness verdict

**NOT READY** to onboard real partners **today**, because:

- no partner agreement is published, so no invitation can be issued
- this release is not deployed

**READY WITH SPECIFIC RESTRICTIONS** once Founder checklist items 1–4 are done (agreement published, release deployed with the recommended switches, email credentials confirmed, GB market confirmed). The restrictions at that point:

- UK contracts only
- commission figures visible, but withdrawals and payment timing still a founder decision
- Academy, resources and knowledge base live only as far as founders have published content
- no demonstration library
- branded toolkit items fulfilled manually
- no partner self-service password reset
