# Operation Ascend (B2): implementation status

Labels: **Implemented** (code + automated tests, switched off) · **Verified** (also browser evidence and green CI on the PR head) · **Not started**. Nothing in B2 is deployed or activated.

## Phase Zero

| Item | Branch / PR | State |
|---|---|---|
| Forge preview approval | `fix/forge-preview-approval-state-race`, [#164](https://github.com/TheFridey/ScaleSmiths/pull/164) | Reviewed by Ascend: server-confirmed status, `useRef` double-click guard, compare-and-set (409 `status_conflict`), failed-request, latency and concurrency E2E. CI 22/22 green. Awaiting human review. |
| Admin hydration marker | `claude/awesome-hawking-ximwzj` (`f3e6f4d`), [#165](https://github.com/TheFridey/ScaleSmiths/pull/165) | Draft PR opened. CI 22/22 green, including Admin Forge E2E. **Not verified locally by repetition:** the local machine could not complete a production build and Playwright loop in reasonable time. The change mirrors the web app's existing marker. |
| B1.7 Project Aegis | `feature/operation-aegis-b1-7`, [#163](https://github.com/TheFridey/ScaleSmiths/pull/163) | CI 22/22 green; PostgreSQL 14.25/16.16 upgrade rehearsal, backup drill and PM2 rehearsal recorded in the PR (at `344cab9`; the PR head has moved since, so re-confirm before merge). Partner switches off. All release gates remain founder decisions. |

Recommended merge order: #164 → #165 → #163. Nothing merged by Ascend.

## B2.1 Advanced partner pipeline: Verified on CI (awaiting human review)

- **Branch:** `feature/operation-ascend-b2` (from master `06d6b4f`). **PR:** [#166](https://github.com/TheFridey/ScaleSmiths/pull/166).
- **Implementation:** `admin/src/lib/partner-pipeline.ts`, `admin/src/lib/server/partner-pipeline.ts`, `admin/src/app/api/partner/pipeline/route.ts`, `admin/src/app/partner/pipeline/page.tsx`, `admin/src/components/ascend/PartnerPipeline.tsx` + `pipeline.css`; navigation link in `AcademyShell` and the partner workspace when switched on; route allow-list in `rbac.ts`; policy rule `ascend.pipeline` in `authorization-policy.ts`.
- **Switch:** `PARTNER_PIPELINE_ENABLED` (default off; not added to production configuration).
- **Database:** migration `0098_ascend_pipeline_interactions` (new append-only table, owner-guard trigger, immutability trigger, one index). Registered in the Drizzle journal, `scripts/shared-migration-plan.json` and `scripts/migration-checksums.json`. Applied cleanly to disposable PostgreSQL 16.14 (admin 99/99); PostgreSQL 14.25 likewise (admin 99/99, both triggers present). `check-migration-history` passes. Rollback: code revert is safe with the table left in place (nothing else reads it); no down-migration (forward-only policy).
- **Financial impact:** none. Reads payment verification dates only; writes no commercial, contract, commission or ledger record.
- **Security controls:** see `B2-SECURITY-MODEL.md`.
- **Tests (local):**
  - `src/lib/partner-pipeline.test.ts` (column mapping, transitions vs `PARTNER_TRANSITIONS`, attention reasons, timeline privacy, filtering): pass.
  - `src/lib/server/partner-pipeline.database.test.ts` (PGlite, 10 cases: off by default, isolation, non-enumeration, suspended partner, timeline privacy, append-only, validation, DB owner guard, follow-up, meetings): pass when run on its own.
  - `src/lib/rbac-authorization.test.ts` + policy tests: 72/72 pass.
  - ESLint on all changed files: clean. `tsc --noEmit`: no project errors.
  - Full admin unit suite: **not completed locally** (machine overloaded, 5 s test timeouts and a session crash); CI's Admin job is the authoritative run.
- **Browser evidence:** `admin/test/e2e/ascend-pipeline.spec.ts`, run by the CI "Empower Browser Acceptance" job on a production build with a disposable database (`PARTNER_PIPELINE_ENABLED=true` on that server only). Passed on CI run 45056332684 (7/7 Empower specs, none skipped). It covers:
  - Journey A: registration (API set-up), correct column, board/table/list, search/stage/needs-action/sort, keyboard (focus into the dialog, Tab contained, Escape closes, focus returns), authorised stage moves with reasons, interaction and follow-up, founder-help request reaching the founder queue, founder confirmation visible to the partner without the founder's note, commission ledger hash unchanged.
  - Journey E: another partner gets 404 on read, interaction, follow-up and a forged stage change; a partner cannot set `approved` (409); partner gets 403 on founder analytics; revoked session refused; anonymous refused; ledger unchanged.
  - axe (WCAG 2.2 A/AA, serious and critical) on board, table and dialog: no violations. No horizontal page overflow at any width.
  - Screenshots (board, table, list, dialog top, dialog history at 320/390/768/1024/1440/1920) in `evidence/b2-1/`, inspected by eye.
- **Fixed after inspecting the evidence:**
  - prospect guidance inside the dialog showed the stage it opened with;
  - meeting rows showed raw keys;
  - the summary touched the hero;
  - the shared partner header clipped the brand between 641 and 1100 px (also visible in the B1.6 evidence).
- **Not covered:** manual screen-reader pass; reduced-motion verified by CSS review only.
- **Outstanding decisions:** FD-ASC-01 to FD-ASC-05 (see `B2-ROADMAP.md`).
- **Deployment status:** not deployed; switch off.

## B2.2 Intelligent prospect qualification: Implemented (browser evidence pending CI)

- **Branch:** `feature/operation-ascend-b2-2`, stacked on B2.1 (`feature/operation-ascend-b2`). The draft PR targets `master` so the full CI runs; review it after #166.
- **Implementation:**
  - `admin/src/lib/partner-qualification.ts`: six equally weighted, declared readiness factors over existing discovery fields, with suggested questions (`discoveryGaps`) and escalation (`guidancePlanFor` plus `technicalReviewFlags`).
  - `admin/src/lib/server/expansion-qualification.ts` and `GET /api/expansion/qualification` (founder inspection).
  - A partner checklist in the pipeline dialog and a founder panel on each opportunity (`QualificationChecklist`, `FounderQualification`).
  - Policy rule `ascend.qualification`.
- **Switch:** `PARTNER_QUALIFICATION_ENABLED` (default off).
- **Not a score:** the panel shows "N of 6 recorded" with each factor's reason. It states that it is not a prediction, it never rejects, nothing writes it, and no rule reads it. Personal fields are ignored (tested). Only approved, in-date content is recommended, through the existing B1.6 guidance panel.
- **Duplicate detection:** migration `0099_ascend_business_name_key` adds the immutable `expansion_business_name_key` (treats `&` as "and"; ignores a leading "The" and trailing legal forms such as Ltd, Limited, PLC and LLP) with expression indexes on `prospects` and `clients`. Registration matches on the new key **or** the previous plain key, so nothing that matched before stops matching. It also refuses an already-held company number with the same confidential response, not a constraint error. Concurrency is unchanged (the existing admission advisory lock). The TypeScript `businessNameKey` and the SQL function are parity-tested over 31 names.
- **Tests (local):** qualification unit (6); SQL/TS parity (3); `expansion.test.ts` 39/39, including the new spelling-variant and company-number case and all 38 existing cases; founder qualification database (3); pipeline database (11); RBAC 72/72.
- **Financial impact:** none.
- **Outstanding decision FD-ASC-06:** scope submission still requires a budget answer (existing rule), whereas the directive treats budget as voluntary. The rule is unchanged pending a founder decision.
- **Not done:** registrable-domain matching across subdomains (needs a public-suffix list); a founder review queue for near-miss names (matches are refused with the existing "contact commercial support" response).

## B2.3 – B2.7: Not started

Designs and dependencies are in `B2-ARCHITECTURE.md` and `B2-ROADMAP.md`. Next step: B2.4 (independent of B2.1) or B2.2.
