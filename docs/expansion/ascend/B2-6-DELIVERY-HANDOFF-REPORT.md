# Operation ASCEND — B2.6 Sales-to-Delivery Handoff

**Status: engineering draft; not merged, not deployed, feature flag off.**

## Source of truth
- Opportunity and originating partner: `expansion_opportunities`.
- Accepted contract, accepted scope snapshot and agreed scope version: `expansion_contracts`.
- Cancellation: `expansion_contract_cancellations`.
- Actual delivery project: existing `delivery_projects` service; no competing project engine.
- Immutable one-to-one linkage: `expansion_delivery_handoffs` (new additive migration 0102).
- Immutable review and founder decision audit: `expansion_audit`.

## Founder control
`GET /api/expansion/handoffs` lists accepted contracts and explicit readiness blockers.
`POST /api/expansion/handoffs` requires `action=approve`, matching opportunity and expected contract IDs, `confirm=true`, and founder handoff reason (10–1000 chars). The server re-checks active founder capability/session. It locks the opportunity row and re-reads the authoritative accepted contract inside the same database transaction. A successful commit creates one internal delivery project with client visibility off, one immutable handoff and one audit event. Repeated identical requests return the same handoff and project without duplication. A different contract, cancelled agreement, invalid scope snapshot or mismatched client is rejected. Commercial terms, commission balances, partner ownership and Forge execution are untouched.

`/expansion/handoffs` is a founder-only workbench; `/partner/handoffs` and its GET API expose only the current partner's handoffs and **already published** client-facing delivery status. They do not disclose internal owner, founder note, technical details, accepted scope or project IDs.

## Explicit boundaries
No automatic handoff at contract acceptance. No implicit Forge creation, deployment, client portal publication, partner notification or payment/commission mutation. No new AI API or scheduled worker. `DELIVERY_HANDOFF_ENABLED=false` by default; both APIs and pages fail closed.

## Still required before release
- Verify forward-only migration and privilege grants on PostgreSQL 14 and 16; check restricted role access.
- Real-database test for accepted/cancelled/mismatched records, founder role/session refusal, concurrent duplicate approval, rollback on project creation failure, and partner isolation.
- Browser acceptance for founder approve once, repeat request, partner view and disabled flag; capture responsive screenshots and accessibility evidence.
- Full GitHub Actions matrix, CodeQL and security review on final head.
- Human review of handoff scope, required client discovery, delivery owner assignment and notifications policy. No production activation without sign-off.

The current implementation does not create a full project intake checklist or expose detailed project statuses to partners unless the existing delivery project explicitly publishes a client-facing status. These remain future enhancements.
