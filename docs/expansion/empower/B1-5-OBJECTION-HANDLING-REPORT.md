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
