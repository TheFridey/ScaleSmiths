# Operation Ascend (B2): architecture

Status: B2.1 implemented on `feature/operation-ascend-b2` (draft, switched off). B2.2 to B2.7 are designed here and **not started**.

## Reconciliation with the existing roadmap

`docs/expansion/intelligence/IMPLEMENTATION-PLAN.md` labels a different "B2" (Website Intelligence, "not started, security design required first"), followed by B3 Sales Studio, B4 meeting prep/proposals/handover, B5 Ask ScaleSmiths and B6 Support. That table is a roadmap label, not an approved specification, so Ascend adopts the B2 name as directed. Overlaps:

| Earlier label | Ascend slice that touches it | Treatment |
|---|---|---|
| B2 Website Intelligence | none | Stays separate and not started. Ascend makes no website fetches (no SSRF surface). |
| B3 Sales Studio | B2.2 qualification | B2.2 is deterministic qualification over existing discovery fields; no generated content. |
| B4 Meeting prep, proposals, handover | B2.1 (meeting visibility), B2.6 (handoff) | B2.6 replaces the "handover" part of B4 if the founder agrees. |
| B5 Ask ScaleSmiths | B2.7 extension points | No live AI in B2. |
| B6 Support and operations | B2.3 command centre | B2.3 extends the B1.6 founder operations queue. |

**Founder decision FD-ASC-01:** confirm that Ascend's B2 supersedes the earlier B2–B6 numbering, or rename Ascend. Until then both labels are documented.

## Principles

1. **One source of truth per fact.** Opportunity stage: `expansion_opportunities.status`. Money: `expansion_payment_events`, `expansion_contracts`, commission ledger (`expansion-finance`). History: `expansion_audit` (append-only). Meetings: `expansion_meeting_requests`. Ascend reads these; it adds new tables only for genuinely new facts.
2. **No new authority paths.** Stage changes keep using `partnerMutation('stage')` (ownership + `PARTNER_TRANSITIONS` + commercial clearance). Founder decisions keep using `founderMutation`. Assistance requests use `requestMeeting`. UI gestures can only call these.
3. **Switched off by default**, one switch per slice (`PARTNER_PIPELINE_ENABLED`, then `FOUNDER_SALES_COMMAND_ENABLED`, `REVENUE_INTELLIGENCE_ENABLED`, `DELIVERY_HANDOFF_ENABLED`, `ASCEND_AUTOMATION_ENABLED`).
4. **Derived before stored.** Columns, attention reasons, meeting state and timeline are computed per request from existing rows.

## Dependency graph

```text
B0–B1.6 (master) ──┬─ B2.1 pipeline ──┬─ B2.2 qualification ── B2.5 performance
                   │                  ├─ B2.3 command centre ─┬─ B2.6 delivery handoff
                   │                  │                        └─ B2.7 automation (needs B2.3 + B2.6)
                   └─ expansion-finance ── B2.4 revenue + forecast (needs only finance; independent of B2.1)
B1.7 (#163, unmerged) ── B2.3 (its founder queue additions should land first to avoid conflicts)
```

B2.4 can start in parallel with B2.1. B2.3 should wait for #163, which extends `founderOperations`.

## B2.1 design (implemented)

| Concern | Implementation |
|---|---|
| Pure model | `admin/src/lib/partner-pipeline.ts`: columns, meeting state, attention reasons, permitted/blocked transitions with reasons, partner-safe timeline projection, filtering and sorting |
| Server | `admin/src/lib/server/partner-pipeline.ts`: `partnerPipeline`, `partnerOpportunityDetail`, `recordInteraction`, `scheduleFollowUp` |
| API | `GET/POST /api/partner/pipeline` (same-origin JSON, durable rate limit 60/min) |
| Page | `/partner/pipeline` (board, table, compact list; detail dialog) |
| Storage | Migration `0098`: `expansion_opportunity_interactions` (append-only, owner-guard trigger). Follow-up uses the existing `prospects.next_follow_up_at`. |
| Reused | `PARTNER_TRANSITIONS`, `OPPORTUNITY_STATUS` copy, `partnerGuard`, `requestMeeting`, `ProspectGuidance` (B1.6, when its switch is on) |

Columns: New (registered, contacted) · Discovery (discovery, qualified, deferred) · Information required (more_information, bespoke_required) · With ScaleSmiths (scope_submitted) · Approved · Contract accepted · Closed (closed_lost, withdrawn). Every status maps to exactly one column (unit-tested).

Timeline sources: `expansion_audit` rows for the opportunity and its meetings, plus verification dates from `expansion_payment_events`. A whitelist maps actions to partner-safe labels; everything else (classification, market, exclusivity, discount, notes, amounts) is dropped.

## B2.2–B2.7 designs (not started)

- **B2.2 qualification:** extend `guidancePlanFor`/`discoveryGaps`; add an explainable checklist (factors shown, no weights hidden, no auto-reject). Duplicate detection: add a normalised-name trigram check behind the existing advisory lock (`pg_advisory_xact_lock(621908148)`); response stays the existing non-revealing 409.
- **B2.3 command centre:** extend `founderOperations` with derived counts and deep links into `/expansion`; reassignment would need a new audited command and an ownership-history table, and must not move commercial entitlement without an explicit founder decision (FD-ASC-03).
- **B2.4 revenue:** read-only views over `expansion_payment_events` and the commission ledger; forecasts in a separate `expansion_forecast_scenarios` table that the finance engine never reads. No invented conversion rates: show "insufficient history" below a threshold the founder sets.
- **B2.5 performance:** partner-only counts from B2.1 data; no partner comparison, no Academy data to founders (privacy decision outstanding).
- **B2.6 handoff:** new `expansion_delivery_handoffs` table keyed by `expansion_contracts.id` (only after contract acceptance), founder approval, partner-visible status projection. Forge integration only through a documented contract (none exists today; see ROADMAP).
- **B2.7 automation:** deterministic scheduled checks writing to a findings table, idempotent per (check, entity, day), no outbound client messages, no money, no status changes.
