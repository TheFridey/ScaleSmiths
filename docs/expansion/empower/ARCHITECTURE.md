# Empower architecture (proposed)

**Status: DRAFT.** This is a design proposal for engineering review after B0 merges. No table, route or migration described here exists. Migration numbers are not reserved.

## 1. Goals and non-goals

**Goals**

1. Partners can find approved answers, resources and training quickly, and can tell at a glance what is approved, for whom, and until when.
2. Founders can draft, review, approve, publish, supersede and retire every content item, with evidence and an audit trail.
3. Partner-only and client-facing material can never be confused or cross-published by accident.
4. The Academy is optional and voluntary, and progress never affects commission, allocation, recognition or standing.

**Non-goals for B1 and the first build**

- No AI generation, AI answers, embeddings or paid AI APIs.
- No assessment that gates anything, no certification, no leaderboard.
- No file uploads, video hosting or third-party learning platform.
- No change to commission, markets, exclusivity or any B0 financial path.
- No client portal delivery of client-facing resources (a later, separate decision).

## 2. Building blocks

```
            Founder administration (/expansion → Content)                Partner Portal (/partner)
  ┌──────────────────────────────────────────────────┐      ┌─────────────────────────────────────────┐
  │ Draft editor → Review → Approve → Publish        │      │ Academy   Resources   Knowledge search  │
  │ Supersede / Archive / Review-due queue           │      │ Objection workspace   My progress       │
  └───────────────┬──────────────────────────────────┘      └───────────────────┬─────────────────────┘
                  │ expansion.founder (writes)                                  │ expansion.partner (reads)
                  ▼                                                             ▼
        content service (server only)  ──────────── published, partner-audience, in-review-window rows only
                  │
                  ▼
  PostgreSQL: content_items · content_versions · content_approvals · content_links
              academy_courses · academy_modules · academy_lessons · academy_progress
              knowledge_entries · search documents (tsvector)
```

All reads and writes go through server functions in the admin app, following the existing `requireCapability` and `partnerGuard` pattern in `admin/src/lib/server/expansion-operations.ts`. There is no client-supplied filter on audience or status.

## 3. Proposed data model

The model generalises `expansion_resources` (immutable versions, database-enforced lifecycle) and adds approval evidence modelled on the public-claims registry (`verifiedAt`, `reviewExpiresAt`, permitted placement).

### 3.1 Content families and versions

| Table | Purpose | Key columns |
|---|---|---|
| `empower_content_items` | A stable identity for one piece of content across versions (for example "Objection: too expensive") | `id`, `kind ∈ {resource, lesson, knowledge, objection, template}`, `slug` (unique), `audience ∈ {partner_only, client_facing}`, `owner_role`, `created_at` |
| `empower_content_versions` | Immutable content. Never updated except `status`; never deleted | `id`, `item_id`, `version` (unique per item), `title`, `body` (restricted Markdown), `fields jsonb` (kind-specific, validated), `source_refs jsonb` (list of repository paths or approved documents), `status ∈ {draft, in_review, approved, published, superseded, archived}`, `created_by`, `created_at` |
| `empower_content_approvals` | Append-only approval evidence | `id`, `version_id`, `decision ∈ {approved, changes_requested, rejected}`, `decided_by`, `decided_at`, `reference` (founder decision reference), `review_by date`, `notes` |
| `empower_content_links` | Typed relationships | `from_item`, `to_item`, `relation ∈ {supports_lesson, see_also, escalates_to, replaces}` |

Lifecycle, enforced by a trigger like `expansion_resource_lifecycle`:

```
draft ──► in_review ──► approved ──► published ──► superseded
  │           │                         │
  └──► archived ◄──────── changes ──────┴──► archived
```

- `in_review → approved` requires an `empower_content_approvals` row with `decision='approved'` by a user holding `expansion.founder`, and it must be a **different** founder from the version's author when two founders are active (founder decision `AP-GOV-04`).
- `approved → published` is a separate action, so approval and release can be scheduled apart.
- Publishing version N of an item moves the previously published version to `superseded` in the same transaction. There is at most one published version per item (partial unique index).
- A published version whose `review_by` date has passed is **not served to partners** (fail closed) and appears in the founder "review due" queue. This mirrors `reviewExpiresAt` in `web/src/lib/public-claims.ts`.
- `audience` belongs to the item, not the version, so a new version cannot quietly change who sees it. Changing audience means creating a new item.

### 3.2 Academy

| Table | Purpose |
|---|---|
| `empower_courses` | Course identity, order, summary, `content_item_id` for its description |
| `empower_modules` | Ordered modules within a course |
| `empower_lessons` | Ordered lessons; each points at a lesson `content_item` (so lesson text uses the same versioning and approval) |
| `empower_knowledge_checks` | Optional questions per lesson, stored in the lesson version's `fields` |
| `empower_progress` | `partner_id`, `lesson_item_id`, `version_id` read, `opened_at`, `completed_at`, `check_attempted bool` |

Rules:

- **Progress is private to the partner** and visible to founders only in aggregate (counts per course), unless the partner chooses to share it (founder decision `AP-GOV-03`). Progress has no foreign key to, or query from, any commission, allocation, recognition or achievement table, matching the meetings design in [PARTNER-OPERATIONS.md](../intelligence/PARTNER-OPERATIONS.md).
- Knowledge-check answers are not stored, only "attempted". No score is persisted.
- When a lesson is superseded, progress stays attached to the version that was read, and the lesson shows "updated since you read it".

### 3.3 Knowledge entries

A knowledge entry is a `content_item` of kind `knowledge`. Its version `fields` hold the required structure from [KNOWLEDGE-BASE.md](KNOWLEDGE-BASE.md):

```json
{
  "question": "string",
  "answer": "string (partner-facing, precise)",
  "client_explanation": "string (safe to say to a client)",
  "sources": ["web/src/lib/faq-library.ts#hosting-provided"],
  "limitations": "string",
  "escalation": { "required": "always | when | never", "condition": "string", "route": "technical_scoping | commercial_assistance | escalation | …" },
  "aliases": ["other ways people ask it"],
  "topic": "hosting"
}
```

The service validates the shape on write. A knowledge version without a source, limitation or escalation rule cannot move to `in_review`.

## 4. Search: deterministic first

**Recommendation: PostgreSQL full-text search with curated synonyms and exact alias matching. No embeddings, no language model.**

Why:

- Every answer a partner sees must be approved text. Retrieval that returns approved items verbatim is auditable; generated answers are not.
- No AI provider, budget or data-processing agreement is approved ([FOUNDER-DECISIONS.md](../intelligence/FOUNDER-DECISIONS.md)).
- The corpus is small (hundreds of items). PostgreSQL search is fast at that size, already in the stack, and adds no dependency.
- Results are reproducible, so they can be tested.

Design:

1. On publish, the service writes a search document for the version: `setweight(to_tsvector('english', title || question), 'A') || setweight(to_tsvector('english', aliases), 'A') || setweight(to_tsvector('english', answer || body), 'B') || setweight(to_tsvector('english', topic), 'C')`. A generated column or a row written in the same transaction keeps it consistent.
2. A founder-managed synonym list (`empower_search_synonyms`: term → canonical term, for example "ssl" → "https certificate", "aeo" → "ai search", "wp" → "wordpress") expands the query before `websearch_to_tsquery`. This is deterministic and reviewable.
3. Ranking: exact alias match first, then `ts_rank_cd` with weights, then topic order. Ties broken by slug, so ordering is stable.
4. Filtering in SQL, never in the browser: `status='published' AND review_by >= current_date AND audience` permitted for the caller.
5. Zero-result queries are logged (query text only, partner id hashed) so founders can see gaps and add aliases. Retention for this log is a founder decision (`AP-PRIV-02`).
6. Optional later step: `pg_trgm` for typo tolerance. It is still deterministic.

What would justify revisiting: a corpus of thousands of items, evidence from zero-result logs that synonyms cannot keep up, and an approved AI provider and data-processing agreement. Even then, the answer shown should be an approved entry, with retrieval-only assistance.

## 5. Rendering

- Bodies are a **restricted Markdown subset**: headings, paragraphs, lists, emphasis, tables, block quotes and links to internal routes or approved external domains. Raw HTML is disabled. Rendering happens on the server, with a sanitising pass as defence in depth.
- Client-facing items render with a visible "Client-facing: approved for sharing" ribbon. Partner-only items render with "Partner only: do not share".
- Every rendered item shows version, approval date and review-by date.
- Copy-to-clipboard is offered only for client-facing items and templates.

## 6. Integration with B0

| B0 system | Integration |
|---|---|
| `expansion_resources` | Keep as is. Migrate existing published rows into `empower_content_items` as `kind='resource'` in Phase 1, or leave them read-only and stop creating new ones. Decision `AP-ENG-01` |
| Onboarding toolkit | Link published handbook, brochure, pricing and commission references to `brochures`, `pricing_documents`, `commission_documents` and `academy` items. Requires the toolkit join to accept Empower items (small change) or the content to remain mirrored in `expansion_resources` |
| Meetings | Every escalation rule names a meeting type. "Request help" in the knowledge viewer opens the existing meeting request form pre-filled with the type and a reference to the entry |
| Audit | Every content write calls the existing `audit()` helper with an `empower_*` event name |
| RBAC | No new role. Reads: `expansion.partner`. Writes and approvals: `expansion.founder`. Founder preview uses the partner renderer with a "preview" banner |
| `partner-programme.ts` | Commercial lessons and the commission reference embed figures by **reference** to the programme constants, rendered with the plan version they come from, so they cannot drift from the engine |

## 7. Feature flags

Following the B0 pattern (everything defaults off):

| Flag | Default | Gates |
|---|---|---|
| `PARTNER_RESOURCE_CENTRE_ENABLED` | `false` | Partner-side Resource Centre and knowledge search |
| `PARTNER_ACADEMY_ENABLED` | `false` | Partner-side Academy |
| `EMPOWER_FOUNDER_CONTENT_ENABLED` | `false` in production until Phase 1 is accepted | Founder content workspace |

With a flag off, partner routes return 404 and the tab is hidden. The founder workspace can be enabled first so content can be loaded and approved before partners see anything.

## 8. Open engineering decisions

| ID | Question | Recommendation |
|---|---|---|
| `AP-ENG-01` | Migrate or freeze `expansion_resources` | Freeze: keep it for toolkit links, create new content in Empower tables, add a read adapter |
| `AP-ENG-02` | Markdown renderer | A small, maintained renderer with HTML disabled; justify the dependency in the PR |
| `AP-ENG-03` | Separate routes or tabs | Separate route segments under `/partner/academy`, `/partner/resources` and `/partner/knowledge`, sharing the portal shell |
| `AP-ENG-04` | Content seeding | A reviewed seed script that loads drafts from this folder as `draft` versions only, never as published |
