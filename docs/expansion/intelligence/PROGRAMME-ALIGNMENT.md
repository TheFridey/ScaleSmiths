# Programme consistency matrix

Status values: DONE, PARTIAL, PLANNED (public label only), NOT STARTED.

| Commitment | Public page | Config / engine | Portal | Founder admin | Status | Approval needed | Test |
|---|---|---|---|---|---|---|---|
| Become a Partner header, footer, Partner Login | Yes | `partnerLoginUrl` | n/a | n/a | DONE | None | partner-programme.test.ts; browser checks (manual) |
| Twelve-month standard, £6,200 minimum | Yes | `standard-v2` (disabled until a founder enables it) | Via founder acceptance | Plan selector | PARTIAL: integrated and tested, not approved or enabled | Founder: agreement, terms | expansion-finance.test.ts Case B |
| £705 standard commission | Yes | engine | Existing | Existing | DONE | Accounting | Cases A, B |
| Flexible £750/£1,250 schedule | Yes | `buildAcceptedTerms` | Via acceptance | Schedule selector | PARTIAL: integrated, not approved | Plan limits | Case C |
| Growth Partnership-only £105 | Yes | `growth-only-v1` | Via acceptance | Plan selector | PARTIAL: integrated, not approved | Suitability criteria | Case D |
| Bespoke 30% | Yes | engine (per-quote terms) | Existing scope review | Existing | PARTIAL | Eligibility definition | Case G |
| Discretionary discounts | Table, "not yet approved" | Allowance policies (none by default) | Remaining count | Policy, reserve, release | PARTIAL: integrated, no allowances approved | Allowance amounts (default disabled) | Cases E, F; no concurrency (Case N) |
| Existing-customer additional sales | Explained | Claims table | Request and status | Review | PARTIAL: workflow persisted, no commission run | Attribution rules | none |
| Achievements | Planned, conditional | Schedule constants only | No | No | PLANNED | Qualification rules | partner-programme.test.ts |
| Referral £250 | Planned, conditional | No | No | No | PLANNED | Written terms | none |
| Withdrawal requests | Planned | No | No | No | PLANNED | Frequency, minimum, invoicing | none |
| Dedicated email, CircleCard, prospects, Academy, personal page, Founding Partner | Planned labels | No | No | No | PLANNED / NOT STARTED | Provisioning, screening | none |
| Sector exclusivity | Explained | No | No | No | NOT STARTED | Legal | none |
| International eligibility | Disclosed | No eligibility register | No | No | PARTIAL (disclosure only) | Per-market review | none |
| Future employment | Qualified | n/a | n/a | n/a | DONE (copy) | None | none |
| Digital agreements, invoicing, payment links, AI assistance | Not claimed as available | No | No | No | NOT STARTED | Provider, legal | none |
