# Operation Empower B1.6: unified partner operations report

Status words are used precisely: **Implemented**, **Tested**, **Approved**, **Enabled**, **Published**, **Deployed**, **Production verified**. They are not interchangeable. Everything in this report is at most *Implemented and Tested*.

## 1. Starting repository state (verified 2026-11-21)

- `master` `a436712`.
- The main checkout has another agent's uncommitted edits to `AGENTS.md`, `CLAUDE.md` and `.entire/agent-guide.md`; they were left untouched. All work happened in separate worktrees.
- Production runs release `37995d2` (web and admin canaries). Every partner switch is unset. `RESEND_API_KEY` is unset. Production holds 0 content items, 0 partner applications and 0 partners (read-only checks).

## 2. PR #159 (Operation Launch Ready)

Open; head `1e61412`; 21 of 21 checks pass. It introduces admin `0095_partner_agreements` and `0096_partner_notifications`, plus web `0024`. Its agreement, activation, lifecycle and email controls were re-verified on the integrated rehearsal: the onboarding suite passed (section 5). Not merged.

## 3. PR #160 (public website UX)

Open; head `6db8c0b`; 21 of 21 checks pass.

- **Performance budget evidence:** the 900 ms main-thread budget is unchanged. The PR changes no workflow, test, spec, snapshot or route, and adds no skips. The earlier 1,110 ms failure came from a slower runner, not a code change: identical page bytes; that runner benchmarked about 38% slower; `master` itself varies from 0 to 1,125 ms; and alternating local runs showed no regression. This is recorded in `docs/launch-ready/PHASE-5-WEB-UX.md`.
- **Separation:** the PR is kept apart from B1.6 and was not folded in.

## 4. PR #161 (B1.5 objection handling)

Draft; head `ab1c3f2`; 22 of 22 checks pass, including **Empower Browser Acceptance**, which ran four journeys and passed them all (B1.1–B1.2, B1.3, B1.4 and B1.5; none skipped). Since the last report:

- the Root Hygiene contract was fixed;
- the objection partner-only constraint is now `NOT VALID`, so legacy rows cannot abort the migration.

Not merged.

## 5. Migration reconciliation

- **The clash:** #159 and #161 both add admin `0095`.
- **Final order:** 0091–0094 (merged), then `0095_partner_agreements`, `0096_partner_notifications`, `0097_empower_objections`.
- **Integration branch:** that order is prepared on the pushed, rehearsal-only branch `integration/b159-b15-rehearsal` (no PR). It is B1.5 on top of #159, with objections renumbered to `0097` and the journal, checksums, shared plan, privilege grants, CI suites and Playwright configuration reconciled.
- **When to use it:** once #159 merges through review, #161 should be updated to this ordering. Neither PR was merged here.

Rehearsal results on disposable PostgreSQL 18, with restricted roles provisioned and verified each time:

| Check | Result |
|---|---|
| Fresh install of the integrated history | web 25/25, admin 98/98, privileges verified |
| Upgrade from a pristine LF export of `master`, holding legacy client-facing and partner-only objection drafts in the old field format | upgraded to web 25/25, admin 98/98; legacy rows preserved byte-for-byte (content hash identical); the new constraint is present and `NOT VALID`; a new client-facing objection item is refused |
| Schema equality, fresh versus upgraded | identical (7,051 lines; `pg_dump` session tokens excluded) |
| Checksums | every committed migration's LF content matches `migration-checksums.json` |
| Real PostgreSQL suites on the integrated code | B1.1–B1.5 plus partner onboarding: 43 passed; concurrency including B0 financial invariants and the £705 ledger: 89 passed; `tsc` clean |

- **Found in passing:** Windows CRLF checkouts change migration hashes. Recorded checksums are, correctly, computed from the LF content git stores. Migrations should always run from an LF checkout or export, which is what CI and the release tree use.
- **Not run:** PostgreSQL 14 (no local binary, and downloading one needs approval) and PostgreSQL 16 locally (Docker unavailable). CI runs `postgres:16-alpine`. The new SQL needs PostgreSQL 11 or later (`sha256`, `\m\M` word boundaries, `NOT VALID` checks). Production compatibility therefore rests on CI's PostgreSQL 16 plus that static review. A rehearsal on a PostgreSQL 14 restore of the production backup is recommended before release.

## 6. B1.6 implemented components

Branch `feature/operation-empower-b1-6` from `master` `a436712`. It does not depend on #159 or #161. Everything is behind `PARTNER_UNIFIED_WORKSPACE_ENABLED` (default **off**), and each module still needs its own switch. There are no new tables, no new state and no migration.

- `admin/src/lib/partner-guidance.ts`:
  - a deterministic rule table mapping recorded discovery to Knowledge Base topics, Academy course categories and a fixed resource vocabulary, each rule with a stated reason;
  - prompts for discovery fields not yet recorded;
  - meeting-type guidance;
  - plain-language explanations for every real opportunity and meeting status (tested against the database's own status lists).
- `admin/src/lib/server/empower-guidance.ts`: unified search, opportunity guidance, meeting preparation, the partner's day, the founder operations queue, and the single server-side client-copy decision.
- **API** `GET /api/partner/workspace` (`view=today`, `opportunity`, `meeting`, or `q` and `type`), **page** `/partner/guidance`, the path allow-list entry and the policy rule.

## 7. Founder workflow changes

The founder overview gains **Needs your attention**:

- open partner meeting and help requests;
- scopes to review;
- content awaiting a decision or publication;
- published content due for review within 30 days.

Each list opens the existing workspace where the action lives (partner operations, prospects and scope, Content studio). No new founder powers were added, and private Academy progress is never read. If the queue cannot load, only that panel says so; the rest of the dashboard is unaffected.

## 8. Partner workflow changes

- **Today:** own open prospects with plain-language status and an Open action; own meetings and requests (a request is shown as *Meeting requested*, never as booked, and past bookings drop off); continue-learning from the Academy's existing pointer; recently approved guidance.
- **Quick actions:** register a prospect, find an answer, prepare for a meeting, request founder help, view commission status. Each goes somewhere real. Objection handling joins once #161 merges.
- **Prospect panel:** why each piece of guidance appears, questions still to cover, approved material, meetings for that prospect, and a request-help action using the suggested route.
- **Meeting preparation:** on demand per meeting, showing status, booked time where confirmed, recorded scope, topics to cover, and approved material by meeting type.

## 9. Search integration

One search across Knowledge Base answers, resources, Academy lessons and courses, using the existing PostgreSQL index and founder synonyms. Ranking: an exact title or question match first, then aliases, then full-text rank with synonyms, then a stable tie-break by type and slug. Results are capped at 30. Only published, in-date content from switched-on modules appears. Lessons appear only if partner-only and inside a published course. Each result shows type, title, summary, approval freshness, category, audience, destination and, where allowed, copyable text.

## 10. Meeting integration

Built on the existing meeting requests and founder decisions. No booking, calendar or new state. Statuses use the real states (requested, under review, information required, new time proposed, confirmed, completed, declined, cancelled).

## 11. Visual changes

Shared guidance cards and workspace panels: charcoal surfaces, restrained gold, silver detail, client-safe wording in a green-edged block, status pills that always carry text, a subtle hover lift, skeleton loading, recoverable errors and 44 px touch targets. Motion is disabled under `prefers-reduced-motion`. Links inside notes are now underlined (they previously relied on colour alone).

## 12–15. Accessibility, PostgreSQL, browser and financial evidence

See section 23.

## 16. Security review

Independent model review (not human review): no critical or high findings. Fixed:

- founder dashboard resilience;
- the meeting-preparation region announcement;
- duplicate list keys;
- search under-fill;
- past bookings lingering on Today.

Recorded as accepted:

- the workspace API answers 404 before authentication when switched off (middleware already requires sign-in);
- the founder note is shown to the partner in meeting preparation, as the existing meetings view already does.

## 17. Remaining defects and limitations

- Objection responses (#161) and agreement status (#159) are not yet in the workspace. They join once those PRs merge, through the guidance service and Today panel.
- `empower-workspace.spec.ts` runs in CI only once the Empower Browser Acceptance job from #161 is on `master`. Until then it runs locally.
- PostgreSQL 14 is not executed (section 5).

## 18. Remaining approvals

Founder decisions, none made here:

| Area | Decision |
|---|---|
| Commercial | `AP-COM-03`: the site shows a twelve-month minimum term that the register still lists as open |
| Agreements | `AP-LR-01` (is click-to-accept legally sufficient?), `AP-LR-02` (commercial specification) |
| Email | `AP-LR-03` (wording), `AP-LR-04` (Resend key and domain; still unset in production) |
| Privacy | `AP-PRIV-01`, `AP-PRIV-02` |
| Objections | `AP-OBJ-*` items |
| Enabling switches | `AP-KB-01`, `AP-OBJ-ENABLE`, and a new decision to enable `PARTNER_UNIFIED_WORKSPACE_ENABLED` |
| Content | every content item still needs founder approval |

## 19–21. Final commit, draft PR, deployment status

Recorded in section 23 and on the PR. **Not deployed.** Nothing is published or enabled.

## 22. Recommended next actions

1. Founders review and merge #159 under the release process.
2. Update #161 to the reconciled order (`0097`) from `integration/b159-b15-rehearsal`, re-run its full CI and merge after review.
3. Rebase B1.6 on the merged `master`, add objections and agreement status to the workspace, and let the Empower Browser Acceptance job run `empower-workspace.spec.ts`.
4. Rehearse the full migration on a PostgreSQL 14 restore of the production backup.
5. Founders work through the approval register; only then consider enabling switches.

## 23. Evidence (local, Windows 11, PostgreSQL 18 with the restricted roles, 2026-11-21)

| Check | Result |
|---|---|
| Admin typecheck, lint, production build | clean, clean, pass |
| Admin unit (full) | 168 files, 1,280 passed, 4 skipped |
| B1.6 unit: mapping, privacy, statuses against the database's own status lists | 7 passed |
| Real PostgreSQL: B1.6 workspace (8) and B1.1–B1.4 (28) | 36 passed |
| Real PostgreSQL: concurrency, including B0 financial invariants and the £705 acquisition ledger (`70500`) | 89 passed |
| Repository checks (migration history, shared plan, GitHub Actions, env hygiene, documentation links, local state, dependency governance, domain boundaries, production topology, branch protection, authorization policy) | pass |
| Academy isolation rule: learning records are read only by the Academy service | holds (the continue-learning read lives in `empower-academy.ts`) |
| Playwright, production build and disposable DB: B1.1–B1.4 journeys and B1.6 journeys A–D | 4 passed on the final code (B1.1–B1.2, B1.3, B1.4, B1.6 A–D); none skipped |

Browser coverage for B1.6:

- **A (daily workflow):** the day view loads real data; the partner opens a prospect; contextual guidance appears with reasons; client-safe wording copies exactly, and a partner-only answer offers no copy; related technical guidance opens; a help request is recorded as *requested* and shown as *Meeting requested*; prospect context returns; the commission ledger is unchanged.
- **B (meeting preparation):** after a founder confirms, preparation shows *Meeting confirmed*, the recorded scope and approved material; the Academy course opens; the status stays accurate.
- **C (founder response):** "Needs your attention" lists the request with its prospect; the founder confirms through the existing meeting command; the audit trail records it; the partner sees the update.
- **D (security):** another partner gets 404 for the prospect and the meeting and never sees the business in their own day view; a suspended partner is refused; drafts and withdrawn content are excluded; partner-only results carry no copy text; partners are refused founder APIs; anonymous requests are refused; the ledger is unchanged throughout.
- **Accessibility and layout:** axe (WCAG 2.2 AA) shows no serious or critical findings on Today, prospect guidance, meeting preparation, founder operations and guidance search; 320, 390, 768, 1024 and 1440 px with no horizontal overflow. Screenshots are in `evidence/b1-6/`; full-page captures of the founder and partner workspace show the viewport only, because the workspace scrolls an inner container.
- **Fixed along the way:** an accessibility defect in the existing meetings view (a link distinguished by colour alone).

Financial regression: no B1.6 code writes to any table. The guidance suite hashes the commission ledger, payouts, withdrawals, contracts and opportunity statuses before and after repeated use and finds them unchanged; the browser journeys check the ledger hash at every stage. Academy completion has no commercial path (isolation test).

## 24. Consolidated release checklist (nothing here is authorised yet)

| Item | State |
|---|---|
| PR merge SHAs | None merged. Heads: #159 `1e61412`, #160 `6db8c0b`, #161 `ab1c3f2`, B1.6 on its draft PR |
| Migration ordering | admin 0095 agreements, 0096 notifications, 0097 objections; web 0024 repair (rehearsed, section 5) |
| Production-equivalent upgrade proof | Rehearsed from `master` on PostgreSQL 18; **still needed:** a PostgreSQL 14 restore of the production backup |
| Backup and restore | Local `pg_dump -Fc` as `postgres` (pre-Empower pattern); no encrypted off-host copy (age, rclone and jq absent); a restore drill on a scratch database is required before release |
| Environment flags | All partner switches unset in production; B1.6 adds `PARTNER_UNIFIED_WORKSPACE_ENABLED` (default off) |
| Commercial approval | `AP-COM-03` open (twelve-month term shown on the site) |
| Privacy approval | `AP-PRIV-01`, `AP-PRIV-02` open |
| Agreement approval | `AP-LR-01`, `AP-LR-02` open; no agreement drafted or published |
| Founder content approval | Nothing approved or published |
| Real email readiness | `RESEND_API_KEY` unset; partner email off; manual invitation link remains the route |
| Portal authentication | Unchanged: Auth.js with MFA for founders; canonical origin `partners.scalesmiths.co.uk` |
| Public website regression | PR #160 green, with the 900 ms budget intact |
| Partner workflow smoke tests | The browser journeys above, on a disposable stack only |
| Rollback | Leave switches unset (code paths are dormant); B1.6 has no migration; previous release tree kept for PM2 rollback; schema rollback means restoring the pre-release dump |

Platform readiness for a global launch is **not** claimed: the approvals above are outstanding and no partner has been activated.
