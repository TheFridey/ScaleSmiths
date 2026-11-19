# Market eligibility (checkpoint 3E, acceptance gate)

- Table `expansion_markets`, **no rows by default**: every market, including the UK, is closed until a founder approves it. A database check refuses `approved` unless legal, accounting, privacy and operational review are recorded with an approval reference and at least one plan.
- The gate uses the **customer's** commercial market (`expansion_opportunities.customer_country`), not the partner's residence. A partner may propose it at registration, but it counts only once a **founder confirms it** (`customer_country_confirmed_by`, migration 0077). An unknown, unconfirmed country or an unapproved/suspended market, or a plan not listed for the market, blocks plan-based contract acceptance (HTTP 409).
- Currency stays GBP. No international pricing, tax or conversion exists.
- Suspension racing acceptance is serialised by a row share lock; tested on separate connections.

## Not enforced yet

Applicant onboarding, partner activation and scope approval are **not** gated by market. The legacy `standard-v1` acceptance path is intentionally unchanged to preserve historical behaviour, so it is not gated either. Partner-residence eligibility (distinct from customer market) has no data model yet.
