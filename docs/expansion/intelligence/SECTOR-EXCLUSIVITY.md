# Customer sector exclusivity (checkpoint 3E, acceptance gate)

- `expansion_exclusivities` records accepted contractual exclusivity (customer, sector, area, reference, dates). `expansion_exclusivity_decisions` is append-only founder decisions per (opportunity, exclusivity).
- Matching is deliberately conservative (`expansion-gates.ts`): same sector with an equal or nested area is **restricted**; same sector with an unknown area, or an unknown sector, is **review required**; positively different sector or area is clear; a customer is never restricted by its own exclusivity. Ampersands and "and" are treated alike.
- Restricted: only an **approved exception** releases it. Review required: a founder may record **cleared** or an exception. Decisions cannot be edited.
- Acceptance takes a shared advisory lock; creating, ending or deciding an exclusivity takes the exclusive lock, so a restriction committed first is always seen. Tested on separate connections.
- Partners see only a generic "commercial checks in progress" notice. Customer names, sectors, areas and agreement references stay founder-only (asserted in the service and browser tests).

## Limits

Matching is string-based; it is not a legal determination and nearby-but-differently-worded sectors or areas can slip through, so founders must record exclusivities with the same vocabulary partners use. If any exclusivity is active, any prospect with an unknown sector needs review. Exclusivity is checked at **acceptance** (plan path only), not yet at registration, allocation or scope review.
