# Empower design specification

**Status: DRAFT.** Visual direction for the Academy, Resource Centre and founder publishing interface. Screen-level layouts are in [WIREFRAMES.md](WIREFRAMES.md). Brand changes need founder approval (`AP-DES-01`).

## 1. Direction

**Quiet premium.** Black and charcoal surfaces, metallic gold used sparingly as a signal of quality and of "approved", silver for secondary emphasis, generous spacing, clear typography, minimal navigation. The interface should feel calm and trustworthy: a partner is about to speak to a client and needs the right answer fast. Search comes first; decoration never competes with content.

Principles:

1. **Content first.** Text measures 60 to 75 characters on large screens; nothing decorative inside reading areas.
2. **Gold means something.** Gold marks primary actions, the active item and approval ribbons. It is not used for body text or large fills.
3. **Status is never colour alone.** Every status has a text label and an icon.
4. **Mobile is a first-class target.** Partners will read lessons and look up answers on phones before meetings.
5. **Reuse before invent.** Build on the admin tokens and the `ex-*` portal patterns.

## 2. Reconciling the two existing systems

The Partner Portal is part of the admin app, so Empower uses the **admin token set** as its base and borrows silver from the public site. It does not import the public site's warm palette wholesale, which would make the portal inconsistent with the rest of the admin shell.

| Role | Empower token | Value | Origin | Contrast (measured) |
|---|---|---|---|---|
| Page background | `--bg` | `#131416` | admin | — |
| Raised surface | `--s1` | `#1a1b1e` | admin | — |
| Card surface | `--s2` | `#222428` | admin | — |
| Hover surface | `--s3` | `#2a2d31` | admin | — |
| Primary text | `--t1` | `#f1f5f9` | admin | 16.82:1 on `--bg` |
| Secondary text | `--t2` | `#a6b0be` | admin | 7.85:1 on `--s1`; 7.09:1 on `--s2` |
| Muted text (new) | `--emp-muted` | `#8a93a3` | new | 5.95:1 on `--bg`; 5.02:1 on `--s2` |
| Decorative text only | `--t3` | `#667085` | admin | **3.71:1 on `--bg`: fails AA for body text**; use only for disabled states and decoration |
| Metallic gold (solid) | `--acc` | `#d1b266` | admin | 9.01:1 on `--bg`; 7.60:1 on `--s2` |
| Gold gradient (decoration) | `--emp-gold` | `linear-gradient(135deg,#e6cf8f 0%,#d1b266 45%,#a8873f 100%)` | new, from `--acc` | Dark text `#131416` on it: 5.44:1 at the darkest stop |
| Silver | `--emp-silver` | `#cfc7bc` | public `--silver` | 11.01:1 on `--bg`; 9.29:1 on `--s2` |
| Silver line | `--emp-silver-line` | `rgba(207,199,188,.18)` | new | — |
| Approved | `--grn` | `#10b981` | admin | 6.79:1 on `--s1` |
| Review due / draft | `--amb` | `#f59e0b` | admin | 8.02:1 on `--s1` |
| Blocked / withdrawn | `--red` | `#ef4444` | admin | used with a label |

Contrast values were calculated with the WCAG 2.x relative-luminance formula (the same method as `web/src/lib/color-contrast.ts`). They must be asserted in tests at implementation, as the public site already does.

**Clean-up recommended alongside:** `expansion.css` hard-codes `#131416`, `#18191b`, `#edf0f5` and `#c3a86c`. Empower styles should use tokens only; replacing the hard-coded portal values is a small, separate change (`AP-ENG-05`).

## 3. Typography

| Use | Family | Size / line height | Weight |
|---|---|---|---|
| Display (course titles, page titles) | `--font-syne` (admin resolves this to Arial Black) | 28/34 desktop, 24/30 mobile | 700 |
| Section heading | Inter | 20/28 | 600 |
| Body and lesson text | Inter | 17/28 (lesson), 15/24 (UI) | 400 |
| Labels, overlines | Inter, uppercase, letter-spacing .14em | 11/16 | 600 |
| Data and figures | Inter, `font-variant-numeric: tabular-nums` (as `.ex-money`) | as context | 500 |

Decision `AP-DES-02`: whether to self-host Syne in the admin app (as the public site does) so display type matches the brand. Until decided, the existing fallback stays.

## 4. Layout and spacing

- 8px spacing grid; page gutter 16px mobile, 24px tablet, 36px desktop (matching `.ex-header`).
- Max content width 1200px; reading column 720px.
- Radius: 8px cards (admin `--radius-md`), 12px feature panels (as `.ex-research`), 999px chips.
- Elevation: borders before shadows; `--shadow-raised` only for overlays.
- Breakpoints: 640px, 960px, 1280px.

## 5. Components

| Component | Specification | Reuses |
|---|---|---|
| Portal shell | Existing header and tab navigation. Empower adds three entries: Academy, Resources, Knowledge | `ExpansionWorkspace` items |
| Search bar | Full width, 52px tall, silver 1px border, gold focus ring (3px, `rgba(209,178,102,.28)`), keyboard shortcut `/` | `.field-control` pattern |
| Course card | `--s2` surface, 2px gold-gradient top edge, overline (course number), title, one-line purpose, lesson count and reading time, progress ring (private), status chip | `.ex-panel` |
| Status chip | Pill with icon and text: Approved · v3 · review by 12 Mar 2027; Partner only; Client-facing; Updated since you read it | `.ex-badge` |
| Audience ribbon | Full-width strip above content: silver "Partner only: do not share" or gold-outlined "Client-facing: approved for sharing" | new |
| Lesson body | Reading column, 17px text, callouts for "Say it like this" (gold left rule), "Avoid" (red left rule, labelled), "Escalate when" (silver left rule) | new |
| Knowledge result | Question (heading), client explanation (first), limitation, escalation, source, status chip | new |
| Copy control | Only on client-facing text; announces "Copied" via `aria-live` | new |
| Empty state | One sentence and a next action, as in the existing `Empty` component | `Empty` |
| Founder diff view | Side-by-side or inline diff between versions, additions in green, removals struck through, with labels | new |

## 6. Motion

Subtle and optional: 150 to 200ms fades for panels and chips, no parallax, no animated gradients. Respect `prefers-reduced-motion` (the admin already does for its workspace).

## 7. Accessibility requirements

- WCAG 2.2 AA as the target for these screens (an engineering target, not a public claim).
- Full keyboard operation, visible focus, logical heading order, skip link to search.
- Status conveyed by text and icon as well as colour.
- Lesson text resizable to 200% without horizontal scrolling at 320px width.
- Knowledge checks: answers announced via `aria-live`; no time limits.
