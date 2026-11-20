# Empower wireframe descriptions

**Status: DRAFT.** Low-fidelity descriptions for design and engineering. Tokens and components are in [DESIGN-SPECIFICATION.md](DESIGN-SPECIFICATION.md). All partner screens sit inside the existing portal shell at `/partner`, behind the `expansion.partner` capability and the feature flags in [ARCHITECTURE.md](ARCHITECTURE.md). Labels such as "Approved · v2" in the sketches are illustrative placeholders showing where approval metadata appears; they do not mean any item is approved.

## W1 Academy dashboard (`/partner/academy`)

```
┌ Portal header ─────────────────────────────────────────────────────────┐
│ Overview  Prospects  Resources  Knowledge  [Academy]  Commission  …   │
├────────────────────────────────────────────────────────────────────────┤
│ PARTNER ACADEMY                                                        │
│ Learn at your own pace. Optional and voluntary.                        │
│ [ Search lessons…                                              / ]     │
│                                                                        │
│ Continue where you left off   ┌──────────────┐                         │
│                               │ C04 · L3     │  (only if any progress)  │
│                               └──────────────┘                         │
│ Courses                                                                │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐                              │
│ │▔▔ gold ▔▔ │ │           │ │           │   3 columns ≥960px,          │
│ │ C01       │ │ C02       │ │ C03       │   2 at ≥640px, 1 on mobile   │
│ │ Welcome…  │ │ Website…  │ │ SEO…      │                              │
│ │ 7 lessons │ │ 8 lessons │ │ 8 lessons │                              │
│ │ ◔ 2 of 7  │ │ Not opened│ │ Updated   │                              │
│ └───────────┘ └───────────┘ └───────────┘                              │
└────────────────────────────────────────────────────────────────────────┘
```

- Header copy states the Academy is optional. No completion percentages across the whole Academy, no leaderboard, no "required" badges.
- Progress ring and "continue" card are private and can be hidden by the partner.
- Courses not yet published do not appear (no "coming soon" teasers that imply a promise).
- Empty state: "Courses will appear here when ScaleSmiths publishes them."

## W2 Course page (`/partner/academy/[course]`)

- Breadcrumb: Academy › C04 Growth Partnerships.
- Title, purpose and learning objectives (bulleted).
- Modules as collapsible groups (all expanded on desktop, first expanded on mobile). Each lesson row: number, title, reading time, private state (Not opened, Read, Updated since you read it).
- Right column (desktop) or below (mobile): supporting resources with audience chips, and "Need help? Request a training meeting".
- Footer: version and approval line for the course description.

## W3 Lesson viewer (`/partner/academy/[course]/[lesson]`)

```
┌ Breadcrumb · Lesson 3 of 7 ───────────────────────── [Contents ☰] ─┐
│ ░ PARTNER ONLY: DO NOT SHARE ░  Approved · v2 · review by 03/2027   │
│                                                                     │
│ C04-L3 Price and term                                               │
│ ─────────────────────────────                                       │
│ Reading column, 720px max                                           │
│ ┃ Say it like this   (gold rule, copy button only if client-facing) │
│ ┃ Avoid              (red rule, labelled)                           │
│ ┃ Escalate when      (silver rule, link opens meeting request)      │
│                                                                     │
│ Optional self-check  [Show question]                                │
│ Sources: published-starting-prices.ts                               │
│ [← Previous]                                   [Mark as read] [Next →]│
└─────────────────────────────────────────────────────────────────────┘
```

- Contents drawer on mobile; sticky side contents on desktop at ≥1280px.
- "Mark as read" is a private bookmark; nothing else depends on it.
- Self-check reveals the answer immediately with an explanation; nothing is scored.
- If the lesson changed since last read, a banner offers "What changed" (summary written by the founder at publication).

## W4 Resource library (`/partner/resources`)

- Search bar at top; filter chips: All · Client-facing · Partner only · by category (Guides, Checklists, Templates, References).
- List view (default on mobile) or grid of cards (desktop). Each item: title, one-line description, audience chip, version, approval and review date.
- Resource view: ribbon, body, "Copy" only for client-facing templates, "Download PDF" (Phase 3, client-facing only), related lessons and knowledge entries.
- Replaces the current `details`-based list in the Resource library tab; existing published `expansion_resources` appear here via the read adapter.

## W5 Knowledge search (`/partner/knowledge`)

```
┌──────────────────────────────────────────────────────────────┐
│  What is the client asking?                                  │
│  [ do you do hosting                                    ⏎ ]  │
│  Topics: Hosting · Domains · Email · SEO · AI search · …     │
├──────────────────────────────────────────────────────────────┤
│  Do you provide hosting?                 Approved · v1       │
│  ┌ Say to the client ───────────────────────── [Copy] ┐      │
│  │ "Yes. ScaleSmiths can host your site as part…"     │      │
│  └────────────────────────────────────────────────────┘      │
│  The precise answer  ▸                                       │
│  Limitation: no published hosting price…                     │
│  Escalate when: client needs a price → [Request technical    │
│  scoping]                                                    │
│  Source: faq:hosting-provided                                │
├──────────────────────────────────────────────────────────────┤
│  Also matching: Is hosting included in a Growth Partnership? │
└──────────────────────────────────────────────────────────────┘
```

- Search-first: the input is focused on load. Results update on submit (deterministic search, no streaming).
- The top result is expanded; the rest are collapsed rows.
- No-results state: "No approved answer yet. Ask ScaleSmiths" with a pre-filled escalation request; the query is logged for founders (privacy notice applies).
- Partner-only entries (commission) show the silver ribbon and no copy button.

## W6 Objection-handling workspace (`/partner/knowledge/objections`)

- Two-pane layout on desktop: list of objections (searchable, grouped: Price, Trust, Timing, Platform, Fit) on the left; the selected objection on the right.
- Selected objection shows four stacked steps: Acknowledge, Clarify (suggested question), Answer (partner guidance), Confirm (client-facing line with copy), plus "Escalate when" and "Never say".
- "Practice mode": hides the answer and shows the objection only, so a partner can rehearse aloud, then reveal. Nothing is recorded.
- "Suggest a new objection" opens a short form that creates a founder task, not content.

## W7 Founder publishing interface (`/expansion` → Content)

```
┌ Content ─────────────────────────────────────────────────────────────────┐
│ [Drafts 12] [In review 3] [Approved 1] [Published 40] [Review due 2]     │
│ Filter: kind ▾ audience ▾ owner ▾   [ Search ]          [+ New item]     │
├──────────────────────────────────────┬───────────────────────────────────┤
│ KB-HOST-01 Do you provide hosting?   │  Version 2 (draft) vs v1 (live)   │
│ knowledge · client-facing · v2 draft │  ── diff view ──                  │
│ KB-COMM-01 Commission… · partner     │  Sources ✓  Limitation ✓          │
│ C04-L3 Price and term · lesson       │  Escalation ✓  Audience lint ✓    │
│ …                                    │  Review by: [ 2027-03-01 ]        │
│                                      │  Approval reference: [ FD-… ]     │
│                                      │  [Request changes] [Approve]      │
│                                      │  [Publish] (after approval)       │
│                                      │  [Preview as partner]             │
└──────────────────────────────────────┴───────────────────────────────────┘
```

- Queue tabs reflect lifecycle states; "Review due" lists published items past their review date (already hidden from partners).
- Editor: title, audience (fixed after creation), kind-specific fields (knowledge entries show the seven required fields), restricted Markdown body with preview, source references (repository path picker or document reference).
- Pre-flight checks shown as a checklist: required fields present, sources present, audience lint passed (or overridden with a reason), links on the allow-list.
- Approve requires a reference and review-by date; the approver cannot be the author when two founders are active.
- Every action shows who did it and when, from the audit trail.
- "Preview as partner" renders exactly what a partner would see, with a "Preview" banner.
