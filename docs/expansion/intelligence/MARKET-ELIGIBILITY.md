# Market eligibility (checkpoint 3E, acceptance gate)

- Table `expansion_markets`, **no rows by default**: every market, including the UK, is closed until a founder approves it. A database check refuses `approved` unless legal, accounting, privacy and operational review are recorded with an approval reference and at least one plan.
- The gate uses the **customer's** commercial market (`expansion_opportunities.customer_country`), not the partner's residence. A partner may propose it at registration, but it counts only once a **founder confirms it** (`customer_country_confirmed_by`, migration 0077). An unknown, unconfirmed country or an unapproved/suspended market, or a plan not listed for the market, blocks plan-based contract acceptance (HTTP 409).
- Currency stays GBP. No international pricing, tax or conversion exists.
- Suspension racing acceptance is serialised by a row share lock; tested on separate connections.

## Enforcement points (checkpoint 5)
- **Applicant residence** (`partner_applications.residence_country`): recorded for information at review. It never authorises anything. International applicants can be reviewed and taken to onboarding.
- **Partner operating market** (`expansion_partners.operating_country`, default GB): must be an approved market before an invitation is issued and again, under advisory lock 7102, at the moment of activation. A refused activation consumes nothing. A founder can change it. If it later becomes unapproved, the partner's new progression stops while accepted contracts and the ledger are untouched.
- **Customer commercial market** (`expansion_opportunities.customer_country`): gates partner progression, founder scope approval, researched allocation and contract acceptance. Registration is a preliminary record and is not blocked.
- Everything fails closed on an unknown or unapproved market. The default operating market (GB) authorises nothing until it is approved with every review.
- Partner-facing refusals are one generic sentence; founders see specific reasons.
- No international pricing, tax or currency conversion exists. Currency stays GBP.
