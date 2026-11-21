# Operation Empower B1.5: objection handling report

| Item | Value |
|---|---|
| Branch | `feature/operation-empower-b1-5`, from verified `master` `a436712` (not based on PR #159 or #160) |
| Pull request | Draft; see the PR for the head commit |
| Switch | `PARTNER_OBJECTION_HANDLING_ENABLED`, default **off**; not set in any real environment |
| Content | 12 objection responses importable as **drafts**; none approved, published or visible to partners |
| Production | **Not deployed** |

## What was built

- **Founder Content studio:** objection editor with category, source ID, the customer concern, other phrasings, the client-safe response, the partner-only explanation, discovery questions, limitations, escalation (rule, condition, meeting type) and related resources, Academy lessons and Knowledge Base entries. It reuses the B1.1 lifecycle: draft, submit, approve or request changes, publish, supersede, withdraw, with history and approval evidence. The author cannot approve their own submission while another founder is active.
- **Partner workspace** `/partner/objections`: search-first with `/` to focus; category chips with counts, only for categories that have approved responses; recently approved responses when idle. Each card shows the concern, the client-safe response with **Copy response**, then a clearly marked partner-only panel (why it works, discovery questions, limitations, when to escalate). Related material links only when it is approved, in date and its module is switched on. **Request help** files an ordinary meeting request that founders confirm. There are loading, empty and error states, and every search press refreshes. The workspace is linked from the other partner pages only when its switch is on.
- **Knowledge Base deep links:** `/partner/knowledge?q=…` opens with that question searched.

## Database changes (`admin/drizzle/0095_empower_objections.sql`)

- Objection items must be partner-only (check constraint).
- Trigger `empower_objection_guard`: no review, approval or publication without a valid category, concern, client-facing line, explanation, limitation and escalation. The client-facing line can never contain partner-only terms (commission, payout, withdrawal, referral reward, founder-only, internal only, partner only, achievement bonus, basis points). Related links must be existing resources, lessons or knowledge entries. Applies to direct SQL as the runtime role.
- Two helper functions granted to the admin runtime role. No new table and no new search index (the B1.3 index already covers concern, phrasings, client line and category).
- **Numbering:** PR #159 also adds admin `0095` and `0096`. Whichever merges second must renumber its migrations and checksums.

## Content safety

Submission is blocked for possible guarantees, ranking positions, traffic, lead or sales figures, discounts or special prices, delivery times, competitor comparisons, "any integration" promises, security guarantees and financial-return claims. A founder can still submit by recording why the wording is safe (for example a sentence that *refuses* a guarantee); the reason is stored with the version for the approving founder. The limitation field is excluded because it lists what must not be promised. Partner-only terms in the client line are refused outright, with no override.

## Importer

`admin/scripts/import-empower-curriculum.mjs` now also imports the twelve `R08` responses as drafts (161 drafts in total). It is idempotent: a second run reported 161 unchanged. It refuses non-test databases unless founders explicitly allow one. Each draft keeps its source ID, category (a default for founders to review), concern, client line, guidance, discovery question, limitation, escalation, sources (R08 anchor plus cited `faq:` keys) and related links resolved from the limitations table.

Reported, not guessed:

| Entry | Issue |
|---|---|
| `AP-OBJ-01` | Guidance refers to a proposed discount policy that is not approved |
| `AP-OBJ-05` | Escalation names two routes (joint sales or technical scoping); left blank |
| `AP-OBJ-08` | No discovery question in the source |
| `AP-OBJ-10` | No discovery question; source status BLOCKED on `AP-GOV-05` |

## Search

PostgreSQL full-text search on the B1.3 index with active founder synonyms (sanitised, no operators). An exact concern or phrasing match ranks first, then `ts_rank_cd`, ties by slug; at most 20 results (100 per category, 6 recent). Queries are parameterised, text is limited to 200 characters, and categories are checked against the approved list. Drafts, submitted, expired and withdrawn responses are never returned.

## Permission enforcement

Partner guard on every request (active partner, active user, partner role, current session). The switch gives a 404 when off. Founders, viewers and anonymous users are refused. The page path is admitted explicitly in `rbac.ts`, with a policy rule for the API. The public web role has no access to any content table.

## Evidence

Fill-in sections below record the actual runs.

### Tests run (local, Windows 11, PostgreSQL 18 with the restricted roles, 2026-11-21)

| Check | Result |
|---|---|
| Admin typecheck, lint, production build | clean, clean, pass |
| Admin unit (full) | 168 files, 1,279 passed, 4 skipped |
| New B1.5 unit tests (rules, claims, client-copy boundary, all 12 entries parsed, review fixes) | pass |
| Migrations and privileges (`provision` → `migrate` → `provision` → `verify`) | web 24/24, admin 96/96; verification passed |
| Real PostgreSQL: B1.5 (9 tests covering the 16 required cases) and B1.1–B1.4 | 37 passed |
| Real PostgreSQL: expansion concurrency, including B0 financial invariants and the £705 acquisition ledger (`70500`) | 89 passed |
| Web typecheck and unit (web unchanged by this branch) | clean; 86 files, 468 passed |
| Importer on the disposable DB | 161 drafts created (12 objections); a second run reported 161 unchanged |
| Playwright on a production build and disposable DB | 4 passed: three B1 journeys and the twenty-step B1.5 journey |
| Repository checks (migration history, shared plan, GitHub Actions, env hygiene, documentation links, local state, dependency governance, domain boundaries, production topology, authorization policy) | pass |

Required database cases: 1–3 visibility of drafts, submitted and published responses; 4 response expiry; 5 withdrawal; 6 invalid category in service, API and database; 7 the client-copy boundary in service and database, including hyphen and tab variants; 8 unapproved related resources hidden and unknown links refused; 9 an expired related article hidden while the response is valid; 10 founder, viewer and partner permissions; 11 deterministic ranking with exact phrasing first; 12 synonyms; 13 concurrent publication leaves one live version; 14 forged or self approval refused; 15 switch off, non-partners and suspended partners refused; 16 the web role cannot read content tables.

Browser journey (`admin/test/e2e/empower-objections.spec.ts`): all twenty directive steps, axe WCAG 2.2 AA with no serious or critical findings on the search result and empty state, 320/390/768/1024/1440 px with no horizontal overflow, and console errors checked. Screenshots are in `evidence/b1-5/`.

Not run locally: the Docker golden-path suite (Docker is unavailable; it runs in CI) and PostgreSQL 16 (CI uses `postgres:16-alpine`). The new CI job "Empower Browser Acceptance" runs for the first time on the draft PR.

### Independent model review (not human review)

No critical or high findings. Fixed: the database partner-only term check now matches hyphen and whitespace variants, as the studio does; the unsupported-claim check now also covers discovery questions and alternative phrasings. Recorded:

- **Constraint and trigger on existing objection rows:** the new partner-only constraint and field guard would refuse an existing client-facing or incomplete objection row. Production holds 0 content items (read-only check on 2026-11-21), so there is nothing to migrate. Recheck before release.
- **Low:** the results section uses `aria-busy` alongside a live status line; announcements may repeat on some screen readers.
- **Low:** the unsupported-claim check is enforced in the service only. The database guards the client-copy boundary and the required fields, not wording.

### Outstanding founder approvals

`AP-OBJ-ENABLE`, `AP-OBJ-05-ROUTE`, `AP-OBJ-QUESTIONS`, `AP-OBJ-CLAIMS`, `AP-GOV-05` (blocks `AP-OBJ-10`), `AP-PRIV-01` (help requests), and `AP-COM-03`: the live site and `master` advertise a twelve-month minimum commitment, with no six-month offer and no deployment drift (release `37995d2`), yet the register still lists the minimum term as an open founder decision. Historical plans are immutable (`expansion_plans_immutable`).

### Feature flags and deployment

`PARTNER_OBJECTION_HANDLING_ENABLED` defaults to off and is unset in production; no partner switch is enabled anywhere. **Not deployed.**
