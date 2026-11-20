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
1. A version's title, body, fields, sources, author and creation time cannot be updated; attempts fail at the database.
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

## Content release criteria (every content version)

- Status is approved by a founder with a reference and review-by date.
- Every factual statement traces to a source in its `source_refs`.
- No guaranteed outcome, invented proof, unpublished price or unapproved commercial term.
- Partner-only material contains nothing marked client-facing, and the reverse.
- Proposed policy is labelled as proposed.
