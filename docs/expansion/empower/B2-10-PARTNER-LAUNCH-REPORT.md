# Operation EMPOWER B2.10: Partner launch and activation report

**Date:** 24 November 2026 · **Branch:** `feature/operation-empower-b2-10-launch` (from `8cf5c718`, the B2.9 merge) · **Pull request:** TheFridey/ScaleSmiths#179 · **Verdict:** see §22.

## 1. Executive summary

The partner programme's software was much further along than the portal showed. Every onboarding benefit showed **Planned**, including tools that already worked. B2.10 makes the existing investment visible and usable.

What B2.10 delivers:
- **Partner journey.** A persisted, server-derived journey with four required steps and an honest status and working action for each tool.
- **Partner screens.** A redesigned overview with explained empty states, grouped navigation, and a Coming soon page.
- **Account recovery.** Self-service password recovery, and applicant self-withdrawal.
- **Founder tools.**
  - one review queue for all prepared content;
  - an onboarding command centre covering waiting items, the applicant pipeline and the partner checklist;
  - a byte-for-byte importer for the V4.1 agreement.
- **Content accuracy.** Every content item was checked and corrected against the commercial programme.
- **Drift protection.** The release drift check now protects all 13 partner switches.

Everything was verified against real PostgreSQL (including PostgreSQL 14) and a production build in a real browser. That browser run found and fixed four genuine defects that isolated tests could not.

The decisive constraint is outside the code. No partner agreement is published, and the approved V4.1 documents are to be supplied by the founders. Without them no invitation can be issued, so no real partner can be activated.

## 2. Initial state

- Repository: `origin/master` = `8cf5c718` (B2.9).
- The original checkout had uncommitted changes owned by someone else, so all work ran in a separate worktree and those files were left untouched.
- **Production:** read-only HTTP probes show the portal login live, the public `/partners` page live and the application endpoint present.
- The deployed commit was **not verified**: there was no VPS access, and the brief said not to touch production.
- Committed B2.9 evidence records:
  - recruitment on (180-day retention; execution off);
  - Content Studio on;
  - ASCEND engine on, with scheduler, agent API and automation off;
  - 0 agreement acceptances and no published agreement.

## 3. Previously hidden functionality

**Shown as "Planned" despite already working:**
- referral codes;
- joint sales meetings, training, technical scoping, bespoke discovery and escalation requests;
- prospect registration;
- researched-prospect allocation;
- the personal web page workflow.

**Implemented but switched off:** Academy, Resource Centre, Knowledge Base, objection handling, unified guidance, pipeline board, qualification, performance and delivery handoff.

**Drafted but never published:** 13 courses (91 lessons, 65 knowledge checks), 13 resources, 32 knowledge entries (46 with the B2.10 additions) and 12 objection responses. See [PARTNER-CAPABILITY-MATRIX.md](PARTNER-CAPABILITY-MATRIX.md).

## 4. Functionality completed

| Area | What | Key files |
|---|---|---|
| Partner journey | Statuses (Available, Ready to set up, Awaiting setup, In progress, Coming soon, In development, Action required, Completed) derived from records; four required steps saved to the database; partner setup requests | `admin/src/lib/partner-journey.ts`, `admin/src/lib/server/partner-journey.ts`, migration 0105, `PartnerJourney.tsx` |
| Overview and navigation | Journey summary, recommended next action, explained empty states, Start/Sell/Earn/Profile/Learn grouping, Coming soon, meeting-type preselection | `ExpansionWorkspace.tsx`, `journey.css` |
| Password recovery | One-hour single-use link; ends all sessions; activated partners only (staff keep the MFA-protected administrator reset); same reply for every request | `partner-recovery.ts`, migration 0106, `/partner/reset`, `/api/partner/password-reset` |
| Applicant withdrawal | 24-hour single-use link to the application address; lifecycle-guarded; revokes any invitation; record kept for its retention period | `partner-recovery.ts`, `/partner/withdraw`, `/api/partner/withdraw` |
| Founder review queue | Batch submit, approve (with reference, notes and review date) and publish over the existing single-version services, with every rule re-applied per item; agreements never batched | `empower-content-batch.ts`, `ContentReviewQueue.tsx` |
| Founder command centre | Waiting-on-founders queue with direct links, the applicant pipeline (application, confirmations, invitation, agreement, market), partner checklist, toolkit and meeting requests | `partner-journey.ts` (`getOnboardingAdmin`), `ExpansionWorkspace.tsx` |
| Agreement workflow | Byte-for-byte draft importer with database fingerprint check; standalone fingerprint tool | `admin/scripts/import-partner-agreement.mjs`, `agreement-fingerprint.mjs`, [AGREEMENT-PUBLICATION-WORKFLOW.md](AGREEMENT-PUBLICATION-WORKFLOW.md) |
| Release safety | 13 partner switches governed by the drift check; test proves each is fail-closed and documented off | `scripts/check-release-env-drift.mjs` and its test |
| Authorisation | The two new public endpoints are registered in the authorisation policy with scope, allow and deny statements; middleware admits only their exact paths and methods | `authorization-policy.ts`, `middleware.ts`, `middleware-partner.test.ts` |

**Defects found by the full-stack browser run and fixed:**
1. The journey filtered content by audience values `partner`/`client`; the real values are `partner_only`/`client_facing`. Without this fix, published content would never have shown as Available.
2. Pricing and commission guides were matched on resource categories that cannot exist. The journey now matches each resource's title as well as its category.
3. Review-queue approvals did not send the decision notes and review date that the approval service requires.
4. The reset and withdrawal pages ignored an emailed link opened in a tab already showing that page.

## 5. Functionality activated

**None in production.** Recommended order, dependencies, verification and rollback for each switch: [PRODUCTION-FEATURE-MATRIX.md](PRODUCTION-FEATURE-MATRIX.md).

## 6–9. Academy, resources, knowledge base and objections

All content is prepared for one founder review session. No approval was recorded on anyone's behalf.

**Accuracy review.** Each item was checked against the published prices, the programme terms and the portal code. These all matched:
- prices;
- commission figures (30%, the £705 standard example, the discounted rows, the payment schedules);
- the £250 planned referral reward;
- meeting types and the referral code format;
- every named client.

No invented testimonials or converted prices were found, and no training is presented as compulsory.

**Corrected:** 2 must-fix items (the market gate) and 8 should-fix items. Details are in [CONTENT-PUBLICATION-REGISTER.md](CONTENT-PUBLICATION-REGISTER.md).

**Content added:** 14 partner-programme knowledge entries.

**Still blocked by genuine founder, legal or privacy decisions:**
- courses C07, C11 and C12;
- KB-PROG-04 and KB-PROG-13;
- resource R12.

## 10. Onboarding and dashboard

The "Your toolkit, as it actually stands" list is replaced by **Your ScaleSmiths Partner Journey**. Progress counts only the required steps, so a partner reaches 100% while future capabilities stay unavailable. This is proven in the unit tests and in the browser.

## 11–13. Recruitment, invitation, account setup and agreement

The existing flows pass their integration and browser suites: application, founder review, invitation, activation with explicit acceptance of the exact issued version, and the agreement page with download.

The gaps listed earlier are now closed: password recovery and applicant withdrawal.

## 14. End-to-end simulation

`b2-10-partner-launch.spec.ts` runs against the production build with synthetic identities only. It:

1. Signs in as a partner.
2. Completes the four required steps; progress is saved to the database.
3. Requests email setup and creates a referral code.
4. Opens technical assistance and training with the request type preselected.
5. Checks that every journey link returns 200 and every navigation item opens its section.
6. Signs out and back in; progress persists.
7. Proves isolation: another partner's progress is not visible, invalid steps and items are refused, and founder APIs return 403.
8. Runs the review queue: founder A submits, founder B approves and publishes, and the approval is recorded against founder B. Self-approval is refused.
9. Confirms the partner journey shows the newly published guide as Available.
10. Checks the founder command centre.
11. Exercises password recovery: same reply for every request, single-use link, old session ended, new password works.
12. Exercises applicant withdrawal: emailed-link proof, withdrawn status, link reuse refused, audit recorded.
13. Checks the public endpoints refuse cross-origin (403), oversized (413) and unknown-action (400) requests.

Screenshots at 320 to 1920 px are in `evidence/b2-10/browser/`.

## 15. Visual evidence

See [evidence/b2-10/README.md](evidence/b2-10/README.md): component renders, full-stack screenshots, and the log of every run.

## 16. Security and regression results

All databases were disposable loopback containers using the repository's CI test credentials. No `.env` was read and nothing touched production.

| Check | Result |
|---|---|
| PostgreSQL 14 rehearsal (all migrations incl. 0105/0106; ASCEND disabled by default; least-privilege on new tables; notification kinds a strict superset) | pass (14.25) |
| Integration: main suite | 91 passed, 0 failed (the rest skip by design and run in the steps below, as in CI) |
| Integration: Empower and onboarding suites | 53/53 |
| Integration: Expansion concurrency and ASCEND engine (inside the test database's network namespace; no guard relaxed) | 109/109 |
| Integration: sole founder, golden path | 2/2, 5/5 |
| Least-privilege role tests | exit 0 |
| Migration history, order, consistency | pass (132 migrations) |
| Release drift tests, ASCEND ops tests | 6/6, 17/17 |
| Playwright Empower suites against the production build | **12/12** on a freshly migrated and seeded database (the nine existing Empower/ASCEND specs plus `b2-10-partner-launch.spec.ts`). A re-run on a database reused across many earlier runs failed three existing specs because of leftover data; they pass on fresh state, as in CI. |
| `tsc --noEmit`, `eslint .` | `tsc` clean; `eslint` 0 errors, 2 warnings (both in the untouched `ascend-review-queue.database.test.ts`) |
| `vitest run` (unit, full) | **197 files, 1450 passed**, 4 skipped, 0 failed; the earlier full-suite load timeouts did not recur |

**Database test timeouts.** These were resolved by giving the five PGlite tests that lacked one the same explicit 30-second setup allowance the repository already uses. No assertion changed.

**Docker Desktop note.** Locally, the databases needed `tmpfs` with `fsync` off, because Docker Desktop's disk I/O otherwise exceeds hook budgets. This is test-only tuning, and CI's Linux runners do not need it.

## 17. Remaining external dependencies

- **Approved V4.1 agreement documents** (to be supplied).
- **Resend credentials** on the VPS. Application, invitation, activation, reset and withdrawal emails need them.
- **Manual fulfilment:**
  - CircleCard (no integration exists);
  - a mailbox provider for partner email addresses.
- **Demonstration websites** (none exist).

## 18. Founder decisions

[FOUNDER-LAUNCH-CHECKLIST.md](FOUNDER-LAUNCH-CHECKLIST.md) sets out:
- 4 launch blockers;
- one consolidated content review;
- 5 commercial decisions;
- the optional enhancements.

## 19. Exact production configuration

[PRODUCTION-FEATURE-MATRIX.md](PRODUCTION-FEATURE-MATRIX.md).

## 20. Deployment status

**Not deployed.** The deployment needs founder approval of the merged release, then the steps in [PARTNER-ACTIVATION-RUNBOOK.md](PARTNER-ACTIVATION-RUNBOOK.md):
1. Take a fresh backup.
2. Synchronise the canonical `.env` (the drift check now enforces the 13 partner switches).
3. Migrate 0105 and 0106.
4. Re-provision grants.
5. Cut over.
6. Verify with a synthetic partner.

## 21. Git and pull request

Branch `feature/operation-empower-b2-10-launch`, PR TheFridey/ScaleSmiths#179. Commit history is on the branch.

## 22. Final onboarding readiness verdict

**NOT READY today**, for two reasons:
- no partner agreement is published, so no invitation can be issued;
- this release is not deployed.

**READY WITH SPECIFIC RESTRICTIONS** once the founders:
1. publish the supplied V4.1 agreement by following the workflow;
2. approve and deploy this release with the recommended switches;
3. confirm the Resend credentials;
4. confirm GB as the approved market.

The restrictions at that point:
- UK contracts only;
- commission figures visible, but withdrawal timing and payment policy still a founder decision;
- Academy, resources and knowledge base live only as far as founders publish them;
- no demonstration library;
- branded toolkit items fulfilled manually.
