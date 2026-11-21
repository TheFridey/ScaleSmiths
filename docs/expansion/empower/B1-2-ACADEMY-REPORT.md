# Operation Empower B1.2: Partner Academy report

Recorded 2026-11-20. Agent work and agent review only; no human review has taken place. "Implemented", "tested", "approved", "enabled", "published" and "production operational" are different states and are reported separately below.

## Baseline and delivery

| Item | Value |
|---|---|
| Branch | `feature/operation-empower` (draft [PR #157](https://github.com/TheFridey/ScaleSmiths/pull/157), base `master` `8950011`) |
| Baseline (B1.1) | `e4dba3b` |
| Migrations | `0092_empower_academy` (course kind, learning records, servability), `0093_empower_academy_partner_lessons` (review fix: partner-only lessons). 0091 untouched |
| New switch | `PARTNER_ACADEMY_ENABLED` (admin, default `false`), independent of `EMPOWER_FOUNDER_CONTENT_ENABLED` |
| New dependencies | `marked` 18.1.2 (MIT, no dependencies; tokeniser only), dev `@axe-core/playwright` 4.14.0 |

## Status

| Capability | Implemented | Tested | Approved | Enabled | Published | Production operational |
|---|---|---|---|---|---|---|
| B1.1 governance (re-verified) | Yes | Yes (unit, PostgreSQL, browser) | Phase 1 decisions only | No | No | No |
| Course model, publication rules | Yes | Yes | No | No | No | No |
| Founder course and knowledge-check editing | Yes | Yes (browser) | No | No | No | No |
| Partner dashboard, catalogue, viewer | Yes | Yes (browser, axe, 5 widths) | No | No | No | No |
| Safe Markdown | Yes | Yes (adversarial unit, browser) | `AP-ENG-02` approved | n/a | n/a | No |
| Optional progress and knowledge checks | Yes | Yes | `AP-ACA-04`, `AP-PRIV-04` open | No | No | No |
| Curriculum importer (13 courses, 91 lessons, 65 checks) | Yes | Yes (parser, two imports, dry-run change) | `AP-ACA-02`, `AP-ACA-03` open | n/a | No | No |

No content item is approved and nothing is published in any real environment. The importer has run only against disposable local databases.

## B1.1 re-verification

- PR #157 CI on `e4dba3b`: 20 of 21 checks passed when inspected, with Web still running; the Empower suite ran (not skipped) in the restricted-role step.
- 0091 upgrade proof: `master` baseline at 0090, seeded with real B0 history by the concurrency suite (89/89), 0091 applied alone; all 58 pre-existing tables identical by row count and content digest; privileges verified; both suites green on the upgraded schema. 0091 → 0092 likewise left all 58 tables unchanged.
- Cross-founder tests: another founder cannot edit or submit a draft (403); the author cannot approve while another founder is active (403); a second founder approves; forged creator or submitter is refused by the database; approvals cannot be updated or deleted.
- Sole founder: a dedicated, freshly migrated `ss_empower_solo_test` database with exactly one active founder (the test refuses to run otherwise). Self-approval needs a recorded reason of at least 10 characters; the two-founder rule returns as soon as a second founder is active. CI creates and migrates this database.

## Academy design

See [ARCHITECTURE.md](ARCHITECTURE.md) section 7b. In short: a course is a versioned B1.1 content item; its ordered modules and lesson references live in the version and are checked by the database; it can be published only when every linked lesson is an independently approved, published, in-date, partner-only lesson; partners always see each lesson's current published version; anything withdrawn or past its review date is "under review" with no content.

**Learning progress semantics.** A completion belongs to the exact lesson version read and is recorded once. Current progress counts lessons whose current version is completed. A revised lesson keeps the earlier completion ("updated since you read it") and is not claimed as complete. Superseded courses recompute against current lessons; withdrawn or expired courses disappear from the catalogue while every record is kept. Progress is reproducible from the stored rows. Nothing reads learning records except the Academy service (static test), so training cannot affect commission, achievements, referrals, allocation or withdrawals.

**Knowledge checks.** Single, multiple and true/false questions are stored in the lesson version and approved with it; a question cannot be submitted without an answer and an explanation. Partners receive questions without answers; the server grades, records the attempt privately, and returns feedback and the explanation. Retries are unlimited.

## Interfaces

- **Founder (Content studio, `/expansion` → Content):** create courses; edit title, Markdown description, category, objectives and learning time; add, rename, reorder and remove modules; add lessons from a list showing each lesson's status, reorder and remove them; build knowledge checks with a form; preview lessons and courses as partners will read them; submit, decide, publish, supersede, withdraw; version history and approval evidence per item; content-type filter.
- **Partner (`/partner/academy`):** welcome, continue learning, suggested starting points, catalogue with search and category filter, recently updated, completed courses, help and escalation; course viewer with module and lesson navigation, Markdown lessons, sources, optional knowledge check, optional mark-as-read, previous and next, escalation guidance. Linked from the partner sidebar, the onboarding toolkit's Academy item and meeting preparation, only when enabled. Resource Centre and Knowledge Base are labelled "coming later".

## Importer

`admin/scripts/import-empower-curriculum.mjs` with parser `admin/src/lib/empower-curriculum.ts`. Reads `CURRICULUM.md`, both lesson files and the new draft `KNOWLEDGE-CHECKS.md`; aborts on any missing or malformed source (unit-tested). Founder-authorised (active owner or administrator becomes the author of every draft), disposable databases only unless `--allow-database` names the target, idempotent (second run: 104 unchanged), version-aware (changed source with an open draft is reported, never overwritten), audited, drafts only. Every imported lesson and question passes submission validation, so a reviewing founder can submit it as is.

## Verification

| Check | Result |
|---|---|
| Admin unit suite (full), typecheck, lint, production build | 167 files, 1,263 passed, 4 skipped (pre-existing); typecheck and lint clean; build passes |
| Web typecheck and production build | Pass |
| Web unit suite (full) | 86 files, 468 tests passed (no web files changed) |
| Real PostgreSQL (local 18; CI 16) | Empower content 9, Academy 8 (incl. publication vs withdrawal race, duplicate completion race, client-facing lesson refusal), sole founder 2, B0 concurrency 89; privilege verification passes |
| Migration gates | history, order, consistency, checksums pass (0091–0093 registered) |
| Browser acceptance (`test/e2e/empower-academy.spec.ts`) | Passes on a production admin build and disposable database; screenshots in `evidence/b1-2/` at 320, 390, 768, 1024 and 1440 px |
| Accessibility | axe (WCAG 2.x A/AA and 2.2 AA tags) shows no serious or critical issue on the dashboard or lesson; contrast unit test for every Academy text and surface pair |
| Independent model review | No critical or high findings. Medium (lessons not restricted to partner-only) fixed by 0093 and service checks; low: date comparison fixed, stray empty file removed; feedback reveals the approved answer after any attempt (intended); importer `--allow-database` accepts any host (documented, drafts only) |

Browser journey steps, with how each was driven: founder login with MFA [UI]; studio [UI]; lesson draft with Markdown and a knowledge check [UI]; second founder sees no edit controls [UI] and is refused by the server [API]; author submits [UI]; author's self-approval refused [API]; second founder approves and publishes [UI]; second lesson [API set-up]; changes requested [UI]; course built from published lessons with reordering [UI]; course approved and published [UI]; partner opens the Academy from the workspace [UI]; search [UI]; Markdown rendered safely, script inert [UI]; knowledge check wrong then right [UI]; mark as read persisted after refresh [UI]; second partner sees none of it [UI, API]; partner refused founder API [API]; replacement lesson version reaches the partner with history kept [UI, SQL check]; withdrawal makes a lesson unavailable [UI]; review date passing hides the course and flags it in the studio [SQL fixture as the operator role, then UI]; revoked partner denied [SQL fixture, API].

Issues the browser found and fixed: the partner identity boundary blocked `/partner/academy` (now admits exactly the Academy pages, with RBAC tests); heading levels skipped from h2 to h4; links in text distinguished by colour only; the admin CSS reset removed lesson heading sizes and list markers.

## Known limitations

- No partner "clear my learning history" control yet (`AP-ACA-04`, `AP-PRIV-04`).
- No founder view of aggregate progress (`AP-GOV-03` undecided).
- Expiry in the browser needs an operator-role fixture, because no runtime role can backdate review dates.
- Lesson sources are shown as plain references, not links. Related resources wait for the Resource Centre (B1.3).
- Single-founder self-approval in the browser is not exercised (covered by the isolated database test).
- The "Continue learning" pointer is updated when a lesson is opened; there is no explicit "resume" button beyond the catalogue.

## Outstanding approvals before any real use

`AP-ACA-01` (switch on), `AP-ACA-02` (populate a real environment), `AP-ACA-03` (each question, with its lesson), `AP-ACA-04` and `AP-PRIV-04` (attempt history and retention), `AP-GOV-02`, `AP-GOV-03`, `AP-PRIV-01`, and approval of every lesson and course through the studio. B1.3 has not started.
