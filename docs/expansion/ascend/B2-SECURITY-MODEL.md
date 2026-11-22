# Operation Ascend (B2): security model

Applies to B2.1 as implemented; later slices must extend this file before they ship.

## Boundaries

| Boundary | Enforcement (server-side) | Test |
|---|---|---|
| Feature off | `PARTNER_PIPELINE_ENABLED !== "true"` → page `notFound()`, API 404 before any query | `partner-pipeline.database.test.ts` "is off by default" |
| Identity | Middleware + `routeAccess` allow-list adds only `/partner/pipeline` (GET/HEAD) for `independent_partner`; API under existing `/api/partner/*` rule | `rbac.test.ts` |
| Active partner | `partnerGuard`: activated profile, active user, current `session_version`, partner role; failures → 403 | "refuses suspended partners and non-partner roles" |
| Ownership | Every read and write filters `partner_id = <own>`; research-allocated prospects only when allocated to that partner | "shows a partner only their own…", "treats another partner's opportunity exactly like a missing one" |
| Non-enumeration | Another partner's id, an unallocated research id, a random id and a malformed id all return the same 404 message | same test |
| Database ownership | `expansion_interaction_owner_guard` trigger rejects an interaction whose partner does not own the opportunity | "the database refuses…" |
| Append-only | `commercial_history_immutable` trigger on interactions | "records interactions append-only…" |
| Stage integrity | UI offers only `PARTNER_TRANSITIONS`; changes go through `partnerMutation('stage')`, which re-checks transition and commercial clearance | `partner-pipeline.test.ts` transitions |
| Timeline privacy | Whitelist projection drops founder notes, pricing, terms, sector/market/exclusivity, discount and suppression events; payment rows give dates only | "builds a partner-safe timeline" |
| Audit hygiene | `interaction_recorded` audit stores kind and id, never the note text | "audits without the text" |
| CSRF / size | `expansionBody`: same-origin, JSON only, 64 KiB cap | existing `expansion-http` coverage |
| Abuse | Durable rate limit 60 writes/min per partner on the pipeline API; meeting requests keep their own 10-open cap | code review |
| Rendering | Notes rendered as React text (no HTML), `white-space: pre-wrap` | "records interactions…" stores `<script>` verbatim; React escapes |
| Query bounds | Pipeline ≤ 500 opportunities, meetings ≤ 1000, detail timeline ≤ 200 audit rows, interactions ≤ 100 | code review |

## B2.2 additions

| Boundary | Enforcement | Test |
|---|---|---|
| Feature off | `PARTNER_QUALIFICATION_ENABLED` gates the partner field (null) and the founder API (404) | both database suites |
| Founder only | `ascend.qualification` policy rule (`expansion.manage`), re-checked against the live session (role, active, session version) | `expansion-qualification.database.test.ts` |
| No protected characteristics | Factors read only declared `DISCOVERY_FIELDS`; extra keys change nothing | `partner-qualification.test.ts` |
| No authority | Display only; nothing writes or reads it for decisions | code review, database test asserts no state change |
| Duplicate confidentiality | Name-variant and company-number matches return the existing generic 409, never which record matched | `expansion.test.ts` |

## B2.3 additions

| Boundary | Enforcement | Test |
|---|---|---|
| Founder only | `/expansion/command` page guard and `ascend.command` policy rule (`expansion.manage`), re-checked against the live session | database test "is off by default and founder-only"; browser Journey B |
| Concurrent assignment | Compare-and-set on the current assignment, plus unique `supersedes_id` and one root per opportunity | "admits exactly one of two simultaneous assignments" |
| No entitlement change | Assignment never writes `expansion_opportunities.partner_id`; no partner notification | database and browser tests assert ownership unchanged |
| No ranking or private data | Partners alphabetical; no Academy or learning tables read | "lists partners alphabetically…" |
| Bounded queries | Each queue source ≤ 200 rows, partners ≤ 1000, one repeatable-read snapshot | code review |

## B2.4 additions

| Boundary | Enforcement | Test |
|---|---|---|
| Founder with finance access | `ascend.revenue` policy rule (`expansion.manage`) plus a live `finance.read` check | "refuses partners, finance-only staff and revoked founders" |
| Ledger untouched | Forecasting writes only `expansion_forecast_assumptions` (append-only); fingerprint of payments, invoices, contracts, ledger and payouts unchanged | database test C7-C8; browser Journey C |
| No invented figures | Historical rate and average shown only from 10 closed outcomes; no default assumptions | "C6 never invents a conversion rate" |
| Tampered values | Assumptions validated server-side (integer basis points, whole pence, bounded horizon) and by CHECK constraints | `revenue-forecast.test.ts`, "validates assumptions" |

## Threats considered

IDOR (covered by ownership + 404), SQL injection (parameterised `sql` template throughout; malformed id test), forged transitions (server-side `assertPartnerTransition`), tampered monetary values (B2.1 reads no amounts and writes none), unsafe note rendering (text only), information in logs (no logging added), notification abuse (no notifications sent by B2.1).

## Not covered yet

- Journey E runs in the browser acceptance suite (`ascend-pipeline.spec.ts`); applicant and anonymous page access rely on the existing middleware tests.
- Founder visibility of interactions — none exists; FD-ASC-04.
