# Operation Ascend (B2): acceptance criteria

A criterion is met only with evidence recorded in `B2-IMPLEMENTATION-STATUS.md`.

## B2.1 Advanced partner pipeline

1. With `PARTNER_PIPELINE_ENABLED` unset, `/partner/pipeline` is 404, `/api/partner/pipeline` is 404 and no navigation link appears.
2. A partner sees only their own opportunities (and research prospects allocated to them); every authoritative status appears in exactly one column.
3. Board, table and compact list views show the same filtered set; search, stage, meeting, needs-action and sort controls all change the result and announce the count.
4. Only `PARTNER_TRANSITIONS` targets are offered; each is sent to `POST /api/partner {action:"stage"}`; a server refusal is shown verbatim; other stages are listed with a reason.
5. A partner can record an interaction (append-only) and set or clear a private follow-up date; neither changes the opportunity status, contract or commission.
6. "Ask a founder for help" creates a real meeting request linked to the opportunity that appears in the founder meetings queue.
7. The history shows only events that occurred, with partner-safe wording, and no founder notes, pricing, classification, market, exclusivity or payment amounts.
8. Another partner's opportunity, a random id and a malformed id are indistinguishable (404).
9. Suspended or revoked partners and non-partner roles cannot read or write.
10. Layout works at 320, 390, 768, 1024, 1440 and 1920 px; dialog is keyboard operable (focus moves in, Tab is contained, Esc closes and focus returns); reduced motion is respected.

## Journeys from the directive

| Journey | Covered by B2.1? |
|---|---|
| A Partner pipeline (steps 1–8, 11) | Yes, once browser-verified; step 9–10 (founder responds, partner sees outcome) use existing meeting flows |
| B Founder operations | B2.3 (not started) |
| C Revenue | B2.4 (not started) |
| D Delivery handoff | B2.6 (not started) |
| E Security steps 1–7 | Server-side covered by database tests; browser version not yet written |
