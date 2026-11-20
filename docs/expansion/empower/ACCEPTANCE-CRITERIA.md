# Empower acceptance criteria (proposed)

**Status: DRAFT.** Each criterion should be verified by an automated test unless marked *(manual)*. Phases are defined in [IMPLEMENTATION-PHASES.md](IMPLEMENTATION-PHASES.md).

## Phase 0: planning package

- [x] Package exists under `docs/expansion/empower/` with architecture, curriculum, lesson content, resource drafts, knowledge inventory, wireframes, approval register, phases, acceptance criteria and security model.
- [x] Every item carries an approval status; no item is marked approved.
- [x] `node scripts/check-documentation-links.mjs` passes.
- [x] Every document read back in full and audited; findings recorded in [CONTENT-REVIEW-REGISTER.md](CONTENT-REVIEW-REGISTER.md) (agent review, not human approval).
- [ ] Founders have reviewed the package and the review register *(manual)*.

## Phase 1: content foundation

**Lifecycle and integrity**
1. A version's title, body, fields, sources, author and creation time cannot be updated once it is submitted; attempts fail at the database. (Drafts are editable until submission; a submitted version is permanent.)
2. Versions cannot be deleted.
3. Only the transitions in [ARCHITECTURE.md](ARCHITECTURE.md) section 3.1 succeed; all others fail at both service and database.
4. `in_review → approved` fails without an approval row by a founder; fails when the approver is the author while two founders are active; succeeds with a recorded override reason when only one founder is active.
5. Publishing a version supersedes the previous published version in the same transaction; at most one published version per item exists, including under concurrent publishes (real-PostgreSQL test on separate connections).
6. An item's audience cannot be changed after creation.
7. Every transition writes an audit row with actor, item, version and event.

**Validation**
8. A knowledge version without question, answer, client explanation, source, limitation or escalation cannot be submitted.
9. A client-facing version containing blocked terms cannot be submitted without an override reason, which is audited.
10. Links outside internal routes and the allow-list are rejected.
11. Rendered output contains no raw HTML from the body; script and event-handler payloads are neutralised (renderer tests with known XSS vectors).

**Access**
12. A partner account receives 403 for every founder content action and the founder Content workspace.
13. An owner or administrator cannot reach any `/partner` route (existing RBAC rule still holds).
13a. A deactivated partner, or one whose session version has been bumped, receives 403 from every Empower read and progress write (real PostgreSQL).
13b. A content editor role, if one is ever added, holds no commission, withdrawal or financial capability (RBAC test); in B1 only founders write content.
14. With `EMPOWER_FOUNDER_CONTENT_ENABLED` off, the Content workspace is not reachable.

**Seeding**
15. The seed script creates only `draft` versions and is idempotent.

### B1.1 evidence (2026-11-20)

Unit: `admin/src/lib/empower-content.test.ts`. Real PostgreSQL as the restricted admin and web roles: `admin/test/integration/empower-content.integration.test.ts` (added to the CI restricted-role step). Migration: `admin/drizzle/0091_empower_content_foundation.sql`.

| Criterion | Status | Evidence |
|---|---|---|
| 1 Immutable after submission | MET | Database refuses a title change after submission; service refuses edits to non-drafts |
| 2 No deletion | MET | Runtime role has no `DELETE`; trigger refuses for any other role |
| 3 Only permitted transitions | MET | Trigger refuses e.g. draft → published; service checks each source state |
| 4 Approval rules | MET in database and unit tests; PARTIAL in integration | DB: approval needs a matching decision row, self-approval needs a reason, review date within cadence. Service: author refused (403) while two founders are active (integration). The single-founder self-approval path is unit-tested only, because the shared test database always contains other active founders |
| 5 Supersede in one transaction, one published version | MET | Integration test: v2 publication supersedes v1; partial unique index. Concurrent revisions: exactly one succeeds. Concurrent publishes are serialised by the item lock and the one-in-progress index; not raced directly |
| 6 Audience fixed | MET | Item rows are immutable (trigger) |
| 7 Audit row per transition | MET | `expansion_audit` rows `empower_*` asserted |
| 8 Knowledge fields required | MET | Unit and integration |
| 9 Client-facing lint with audited override | MET | Unit; override recorded on the version and flagged in the audit row |
| 10 Link allow-list | MET | Unit |
| 11 Renderer XSS | NOT APPLICABLE YET | B1.1 renders plain text only (React-escaped, `white-space: pre-wrap`), as the existing resource library does. The restricted Markdown renderer (`AP-ENG-02`) arrives with the first partner-facing screen |
| 12 Partner refused | MET | Partner capability refused for create and admin read |
| 13 Owner cannot reach `/partner` | MET (unchanged RBAC) | Existing RBAC tests |
| 13a Revoked partner | DEFERRED to B1.2 (no partner read yet); founder session revocation is tested | Integration |
| 14 Switch off | MET | Service returns 404 and the admin read returns `{enabled:false}`; the tab is hidden |
| 15 Seed script | NOT STARTED | Deferred: content is loaded by founders through the studio until the seed script is written |
| Evidence integrity (independent review) | MET | Every lifecycle timestamp and the decision time come from the database clock; evidence owned by one transition cannot be planted by another; review dates compared in UTC (integration) |
| Phase 2.1 / 2.2 serving rule | MET at service level | `servableContent` returns only published, in-date, permitted-audience versions; drafts, approved, superseded, withdrawn and expired content excluded (integration). No partner route exists yet |

## Phase 2: Resource Centre and knowledge search

**Serving**
1. Partners receive only versions that are `published`, within `review_by`, and permitted for their audience; drafts, approved-but-unpublished, superseded, archived and expired versions are never returned (service and browser tests).
2. Audience filtering happens in SQL; no request parameter can widen it.
3. Every rendered item shows audience ribbon, version, approval date and review-by date.
4. Copy controls appear only on client-facing content.
5. With `PARTNER_RESOURCE_CENTRE_ENABLED` off, partner routes return 404 and navigation hides them.

**Search**
6. Identical queries over identical content return identical ordering.
7. Exact alias matches rank above full-text matches.
8. Synonyms expand queries as configured (for example "ssl" finds the HTTPS entry).
9. A search never returns unpublished, expired or other-audience content, and a zero-result response is identical whether matching content is hidden or absent.
10. Query input over 200 characters is rejected; search is rate-limited per partner.
11. Zero-result queries are logged with a hashed partner id and purged after the approved retention period.
12. p95 search latency under 200ms with 1,000 published entries on CI hardware.

**Integration**
13. "Request help" opens a meeting request pre-filled with the entry's escalation type and reference; nothing is booked automatically.
14. Legacy published `expansion_resources` appear in the library through the read adapter, labelled as legacy.

**Experience** *(manual plus automated accessibility checks)*
15. Knowledge search, resource library and objection workspace are usable at 320px width without horizontal scrolling.
16. Automated accessibility checks report no serious or critical violations; colour-contrast tokens meet the values in [DESIGN-SPECIFICATION.md](DESIGN-SPECIFICATION.md).
17. All functions are keyboard operable; `/` focuses search.

## Phase 3: Partner Academy

1. Courses, modules and lessons appear only when their content versions are published and within review.
2. Progress is visible only to the partner who created it; founders see aggregate counts only, unless the partner has opted in (if `AP-GOV-03` allows it).
3. No query from commission, allocation, recognition, achievements, referrals or withdrawals reads progress tables (static test over the server modules).
4. Knowledge-check answers are not persisted; only `check_attempted` is stored.
5. No course is marked required, and no UI text uses "must complete", "deadline" or "score" (copy test).
6. When a lesson is superseded, partners who read the old version see "Updated since you read it".
7. With `PARTNER_ACADEMY_ENABLED` off, Academy routes return 404.
8. Lesson pages meet the same width, keyboard and contrast criteria as Phase 2.

### B1.2 evidence (2026-11-20)

Real PostgreSQL: `admin/test/integration/empower-academy.integration.test.ts`, `empower-solo-founder.integration.test.ts`. Unit: `empower-content.test.ts`, `empower-curriculum.test.ts`, `SafeMarkdown.test.tsx`, `academy-contrast.test.ts`, `empower-academy-isolation.test.ts`, `rbac-authorization.test.ts`. Browser: `admin/test/e2e/empower-academy.spec.ts` (production build, disposable database). Migrations 0092, 0093.

| Criterion | Status | Evidence |
|---|---|---|
| 1 Only published, in-date courses and lessons appear | MET | Integration (withdrawn, superseded, revised, expired via the serving rule); browser (withdrawn lesson "under review", expired course gone) |
| 2 Progress private to the partner; founders see none | MET | Integration (partner two sees none of partner one's records); browser; no founder progress view exists yet (`AP-GOV-03` undecided) |
| 3 No commercial code reads progress | MET | Static isolation test |
| 4 Knowledge-check answers | CHANGED | Attempts now store the answer given and the result, privately (directive requirement); answers are never sent before an attempt (integration) |
| 5 Nothing required; no "must complete", "deadline" or "score" copy | MET by inspection | Copy says optional and voluntary throughout; no automated copy test yet |
| 6 "Updated since you read it" | MET | Integration and browser |
| 7 Switch off returns 404 | MET | Integration (service); pages call `notFound()` |
| 8 Width, keyboard, contrast | MET for tested screens | Browser at 320/390/768/1024/1440 with no horizontal overflow and axe (WCAG 2.2 AA tags) clean of serious/critical issues on dashboard and lesson; contrast unit test |
| Revoked / never-activated / signed-out partners denied | MET | Integration and browser |
| Duplicate completion, concurrent publication vs withdrawal | MET | Integration races |
| Course needs independently approved partner-only lessons | MET | Integration; 0093 |

## Content release criteria (every content version)

- Status is approved by a founder with a reference and review-by date.
- Every factual statement traces to a source in its `source_refs`.
- No guaranteed outcome, invented proof, unpublished price or unapproved commercial term.
- Partner-only material contains nothing marked client-facing, and the reverse.
- Proposed policy is labelled as proposed.
