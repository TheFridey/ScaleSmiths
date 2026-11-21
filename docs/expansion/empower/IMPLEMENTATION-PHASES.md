# Empower implementation phases (proposed)

**Status: DRAFT.** No phase may start until B0 ([PR #155](https://github.com/TheFridey/ScaleSmiths/pull/155)) is merged with branch protection applied (`AP-B0`). Each phase ships behind its own flag, defaulting off, and needs a separate deployment approval under the existing release runbook. Acceptance criteria are in [ACCEPTANCE-CRITERIA.md](ACCEPTANCE-CRITERIA.md).

## Progress (2026-11-20)

| Slice | Directive name | Status |
|---|---|---|
| Phase 1 content foundation | B1.1 content governance | Implemented and tested (migration 0091); see [B1-STATUS.md](B1-STATUS.md) |
| Phase 3 Academy | B1.2 Partner Academy | Implemented and tested (migration 0092); see [B1-2-ACADEMY-REPORT.md](B1-2-ACADEMY-REPORT.md). Delivered before Phase 2 by founder direction; reuses the Phase 1 model instead of separate course tables |
| Phase 2 Resource Centre | B1.3 Resource Centre | Implemented and tested (migration 0094); see [B1-3-RESOURCE-CENTRE-REPORT.md](B1-3-RESOURCE-CENTRE-REPORT.md). Knowledge search delivered in B1.4 ([report](B1-4-KNOWLEDGE-BASE-REPORT.md)); the objection workspace remains (B1.5) |

Nothing is approved, published or enabled in any real environment.

## Phase 0: B1 planning (this package)

- Deliverable: this folder. No code.
- Exit gate: founders review the package and record initial decisions in [FOUNDER-APPROVAL-REGISTER.md](FOUNDER-APPROVAL-REGISTER.md), at least `AP-GOV-04`, `AP-GOV-06`, `AP-DES-01` and `AP-ENG-01` to `AP-ENG-04`.

## Phase 1: content foundation and founder workspace

**Scope**
- Migration: `empower_content_items`, `empower_content_versions`, `empower_content_approvals`, `empower_content_links`, lifecycle trigger, one-published-version partial unique index, audit events.
- Content service: create item, create version, submit, request changes, approve, publish, supersede, archive; field validation per kind; audience lint; link allow-list.
- Restricted Markdown renderer (server-side, HTML disabled, sanitised).
- Founder Content workspace in `/expansion` (W7), including diff view, pre-flight checks and preview as partner.
- Seed script that loads this package's drafts as `draft` versions only.
- Flag: `EMPOWER_FOUNDER_CONTENT_ENABLED`.

**Not in scope:** any partner-facing route.

**Entry gate:** `AP-B0`; decisions `AP-GOV-04`, `AP-GOV-06`, `AP-ENG-01`, `AP-ENG-02`.
**Exit gate:** acceptance criteria P1 pass in CI; migration reviewed by the `db-migration-reviewer` agent and a founder; deployment approved.

## Phase 2: Resource Centre and knowledge search for partners

**Scope**
- Partner routes `/partner/resources` and `/partner/knowledge` (W4, W5), and the objection workspace (W6).
- PostgreSQL full-text search with synonyms and exact alias match; zero-result logging.
- Read adapter for legacy `expansion_resources`.
- "Request help" from an entry opens the existing meeting request with type and reference.
- Toolkit linking for `brochures`, `pricing_documents`, `commission_documents`.
- Flag: `PARTNER_RESOURCE_CENTRE_ENABLED`.

**Content gate:** at least the client-facing service resources (R03 to R06), R07 to R10, R11 and the non-commercial knowledge entries approved and published. R12, KB-COMM-* and C11 stay unpublished until the financial decisions are made.

**Entry gate:** Phase 1 accepted; `AP-PRIV-01`, `AP-PRIV-02`; partner activation itself is still governed by the B0 gates (`PARTNER_ACTIVATION_ENABLED`).
**Exit gate:** acceptance criteria P2 pass; browser checks on mobile and desktop; deployment approved.

## Phase 3: Partner Academy

**Scope**
- Tables `empower_courses`, `empower_modules`, `empower_lessons`, `empower_progress`.
- Partner routes `/partner/academy` and children (W1 to W3), private progress, optional self-checks.
- Founder course structure editor and aggregate progress view.
- Toolkit `academy` item can then be set to available by a founder, with evidence.
- Flag: `PARTNER_ACADEMY_ENABLED`.

**Content gate:** C01, C02, C08, C09, C10 and C12 approved as a minimum launch set (C12 needs the agreement). C07 and C11 follow when unblocked.

**Entry gate:** Phase 2 accepted; `AP-GOV-02` (solicitor), `AP-GOV-03`, `AP-GOV-05`.
**Exit gate:** acceptance criteria P3 pass; deployment approved; the `/partners` availability label for "Partner Academy" is updated only through a separate founder-approved content change.

## Phase 4: refinements (candidates, not commitments)

- Source-drift check: CI flags knowledge entries whose cited `faq-library.ts` key or `published-starting-prices.ts` value changed.
- Commercial figures rendered from `partner-programme.ts` constants with plan version stamps.
- PDF export of client-facing resources.
- `pg_trgm` typo tolerance.
- Self-hosted Syne in the admin app (`AP-DES-02`) and token clean-up (`AP-ENG-05`).
- Client portal delivery of client-facing resources (separate decision).

## Dependencies at a glance

```
B0 merged ─► P1 founder workspace ─► content approved ─► P2 Resource Centre ─► P3 Academy ─► P4
                                         ▲                       ▲                ▲
                       AP-GOV-04/06, ENG-01/02        AP-PRIV-01/02      AP-GOV-02/03/05, agreement
```
