# Customer sector exclusivity (checkpoint 3E, acceptance gate)

- `expansion_exclusivities` records accepted contractual exclusivity (customer, sector, area, reference, dates). `expansion_exclusivity_decisions` is append-only founder decisions per (opportunity, exclusivity).
- Matching is deliberately conservative (`expansion-gates.ts`): an identical sector in an equal or nested area is **restricted**; a similar sector (shared word stem, e.g. dental/dentistry), an overlapping but non-nested area, an unknown or uncomparable sector or area (either side) is **review required**; only a positively different sector or area is clear; a customer is never restricted by its own exclusivity. Ampersands and "and" are treated alike.
- Restricted: only an **approved exception** releases it. Review required: a founder may record **cleared** or an exception. Decisions cannot be edited.
- Acceptance takes a shared advisory lock; creating, ending or deciding an exclusivity takes the exclusive lock, so a restriction committed first is always seen. Tested on separate connections.
- Partners see only a generic "commercial checks in progress" notice. Customer names, sectors, areas and agreement references stay founder-only (asserted in the service and browser tests).

## Limits

Matching is word-stem based, not semantic; it is not a legal determination and a synonym with no shared stem can still be cleared, so founders should record exclusivities in the vocabulary partners use. Dates use Europe/London and the expiry date is the first unprotected day. Exclusivity terms rows have no immutability trigger (only decisions do). If any exclusivity is active, any prospect with an unknown sector needs review. Exclusivity is checked at **acceptance** (plan path only), not yet at registration, allocation or scope review.
