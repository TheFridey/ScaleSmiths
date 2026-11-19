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
| Achievements | Planned, conditional | Versioned programme, derived qualification | Achievement Centre | Programme, qualification, rewards | IMPLEMENTED and tested; rewards NOT payable | Qualification rules, written terms | service, race, browser |
| Referral £250 | Planned, conditional | Codes, attribution, conditional reward | Referrals view | Attribution, reward review | IMPLEMENTED and tested; NOT payable | Written terms | service, race, browser |
| Withdrawal requests | Planned (label unchanged: no approved payout policy) | Versioned policy, disabled until approved | Commission Centre request/cancel | Policy, review, payout prep | IMPLEMENTED and tested, NOT operational | Frequency, minimum, invoicing, VAT | 31 service, 11 race, browser |
| Dedicated email, CircleCard, Academy | Planned labels | No | No | No | PLANNED / NOT STARTED | Provisioning | none |
| Researched business prospects | Planned, subject to availability and screening; no fixed number or interest guaranteed | Candidates, history, canonical prospect and opportunity | Allocated prospects with authorised research | Research and allocation tab | IMPLEMENTED and tested; nothing is contacted | Screening standard, volume per partner | service, real-PostgreSQL race, browser |
| Personal ScaleSmiths webpage | Planned | Consent-bound versions, publications, restricted public view | My web page | Web pages tab | IMPLEMENTED; **publication disabled by default** | Consent wording, privacy notice, photograph handling, publication approval | service, real-PostgreSQL as admin and web roles, browser |
| Founding Partner | Planned | Nominations, evidence, benefits, fulfilment, corrections | Badge and approved benefits | Recognition tab | IMPLEMENTED; founder-controlled, no thresholds | Benefit list, wording | service, race, browser |
| Sector exclusivity | Explained | Acceptance, progression, scope approval, candidate review, allocation | One generic notice | Register, decide, candidate review | IMPLEMENTED across the lifecycle | Legal | service, race, browser |
| International eligibility | Disclosed | Fail-closed market register; residence, operating and customer markets separate | Customer-country field | Markets panel, operating market | IMPLEMENTED across invitation, activation, progression, scope approval, allocation, acceptance | Per-market review | service, race, browser |
| Future employment | Qualified | n/a | n/a | n/a | DONE (copy) | None | none |
| Digital agreements, invoicing, payment links, AI assistance | Not claimed as available | No | No | No | NOT STARTED | Provider, legal | none |
