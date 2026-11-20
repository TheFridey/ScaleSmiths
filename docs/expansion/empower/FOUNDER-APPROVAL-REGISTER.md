# Empower founder approval register

**Nothing in this register is approved.** Every item starts as listed. When a founder decides, record the decision, date, decider, reference and review-by date in the last columns; never edit the original status, add the decision beside it. Where an item resolves a row in [FOUNDER-DECISIONS.md](../intelligence/FOUNDER-DECISIONS.md) or [CONTENT-APPROVAL-REGISTER.md](../intelligence/CONTENT-APPROVAL-REGISTER.md), update that register too.

Blocking columns: **P1** blocks Phase 1 (founder content workspace), **P2** blocks partner release of the Resource Centre, **P3** blocks the Academy. See [IMPLEMENTATION-PHASES.md](IMPLEMENTATION-PHASES.md).

## A. Decisions and approvals required

| ID | Decision | Owner | Recommendation | P1 | P2 | P3 | Status | Decision / date / ref |
|---|---|---|---|---|---|---|---|---|
| `AP-GOV-01` | Partner role wording matches the final agreement | Founders, solicitor | Write agreement first, then align C01, C12 and R02 | N | Y | Y | `BLOCKED` (agreement) | |
| `AP-GOV-02` | The Academy as optional and voluntary, with private progress, does not create employment indicators | Founders, employment solicitor | Keep optional, no targets, no scoring, no link to commission | N | N | Y | `FOUNDER DECISION` | |
| `AP-GOV-03` | Founder visibility of partner progress | Founders, privacy adviser | Aggregates only; individual view only with partner opt-in | N | N | Y | `FOUNDER DECISION` | |
| `AP-GOV-04` | Two-person rule for approval | Founders | Author cannot approve while two founders are active; recorded override otherwise | Y | Y | Y | `FOUNDER DECISION` | APPROVED as recommended by repository owner (TheFridey), 2026-11-20, in-session instruction 'Accept, start B1.1'; review by 2027-05-20 |
| `AP-GOV-05` | Approved partner title and sign-off | Founders, solicitor | "Independent partner of ScaleSmiths" | N | Y | Y | `FOUNDER DECISION` | |
| `AP-GOV-06` | Review cadence | Founders | Commercial 3 months; service 6 months; on source change | Y | Y | Y | `FOUNDER DECISION` | APPROVED as recommended by repository owner (TheFridey), 2026-11-20, in-session instruction 'Accept, start B1.1'; review by 2027-05-20 |
| `AP-PRIV-01` | Privacy notice covers Academy progress, search logs and discovery notes | Founders, privacy adviser | Update partner privacy notice before P2 | N | Y | Y | `FOUNDER DECISION` | |
| `AP-PRIV-02` | Search-log retention | Founders, privacy adviser | 90 days, hashed partner id | N | Y | N | `FOUNDER DECISION` | |
| `AP-LEG-03` | Approved marketing process (channels, screening, opt-outs) | Founders, privacy adviser | Already open in [COMMERCIAL-ACTIVATION-GATES.md](../hardening/COMMERCIAL-ACTIVATION-GATES.md) | N | N | Y (C07) | `BLOCKED` | |
| `AP-COM-03` | Whether and how a Growth Partnership minimum term is presented to clients | Founders, accountant | Decide with `standard-v2` terms | N | Y (R04) | Y (C04, C11) | `FOUNDER DECISION` | |
| `AP-COM-05` | Discount rules partners are told | Founders | "None available to partners; founder-reserved only" | N | Y | Y | `FOUNDER DECISION` | |
| `AP-COM-06` | Lead protection term, expiry, disputes | Founders, solicitor | Already open in B0 | N | N | Y (C07) | `BLOCKED` | |
| `AP-COM-07` | VAT wording for client prices | Founders, accountant | One approved sentence | N | Y (R11) | Y | `FOUNDER DECISION` | |
| `AP-CNT-01` | Company description and service list | Founders | As drafted in C01-L1, R01 | N | Y | Y | `DRAFT` | |
| `AP-CNT-06` | AI search (AEO) wording | Delivery founder | As drafted in C03-L7, R06, KB-AIS-01 | N | Y | Y | `DRAFT` | |
| `AP-CNT-07` | Accessibility standard to state | Delivery founder | State target only per proposal | N | Y | Y | `FOUNDER DECISION` | |
| `AP-CNT-08` | Hosting price guidance | Founders | Keep unpublished; escalate | N | N | N | `FOUNDER DECISION` | |
| `AP-CNT-09` | Client analytics standard | Delivery founder | Define tool and consent approach | N | N | N | `FOUNDER DECISION` | |
| `AP-PROOF-01` | Partner use of each published project and any verified claim | Founders | Approve per project; descriptions only by default | N | Y | Y | `FOUNDER DECISION` | |
| `AP-DES-01` | Visual direction | Founders | As in [DESIGN-SPECIFICATION.md](DESIGN-SPECIFICATION.md) | Y | Y | Y | `DRAFT` | |
| `AP-DES-02` | Self-host Syne in admin | Founders, engineering | Yes, reuse the public WOFF2 files | N | N | N | `FOUNDER DECISION` | |
| `AP-ENG-01` | Freeze or migrate `expansion_resources` | Engineering | Freeze, add read adapter | Y | N | N | `FOUNDER DECISION` | APPROVED as recommended by repository owner (TheFridey), 2026-11-20, in-session instruction 'Accept, start B1.1'; review by 2027-05-20 |
| `AP-ENG-02` | Markdown renderer dependency | Engineering | Small maintained renderer, HTML disabled | Y | N | N | `FOUNDER DECISION` | APPROVED as recommended by repository owner (TheFridey), 2026-11-20, in-session instruction 'Accept, start B1.1'; review by 2027-05-20 |
| `AP-ENG-03` | Route structure | Engineering | Child routes under `/partner` | Y | N | N | `DRAFT` | |
| `AP-ENG-04` | Content seeding as drafts only | Engineering | Reviewed seed script, draft status only | Y | N | N | `DRAFT` | |
| `AP-ENG-05` | Replace hard-coded colours in `expansion.css` | Engineering | Separate small change | N | N | N | `DRAFT` | |
| `AP-B0` | B0 (PR #155) merged with branch protection applied | Founders | Prerequisite for any implementation | Y | Y | Y | `BLOCKED` | |
| `AP-DES-03` | Admin-wide `--t3` contrast fix (68 `var(--t3)` uses in 36 files, 72 `text-t3` uses in 15 files) | Founders, engineering | Separate reviewed change to `#939cac` with screenshot comparison; not inside an Empower PR | N | N | N | `FOUNDER DECISION` | |
| `AP-COM-08` | Service scope boundaries partners may describe: maintenance, hosting, SEO/AEO, analytics, support (none is unlimited) | Founders | Written service catalogue, as already required by B0 "Approved service scope, Academy materials" | N | Y | Y | `FOUNDER DECISION` | |
| `AP-COM-09` | Approved earnings illustrations for partners (which worked examples, with which caveats) | Founders, accountant, solicitor | Only the R12 arithmetic, labelled illustrative and gross, never as a forecast | N | Y (R12) | Y (C11) | `FOUNDER DECISION` | |
| `AP-COM-10` | Territory and exclusivity wording partners may use | Founders, solicitor | Only the generic "commercial checks in progress" notice; no territory claims | N | N | Y (C07) | `FOUNDER DECISION` | |
| `AP-COM-11` | Description of achievement and referral rewards in training | Founders, solicitor | "Planned and conditional, not payable" until a programme version is approved in writing | N | Y (R12) | Y (C11) | `FOUNDER DECISION` | |
| `AP-COM-12` | Bespoke scoping and rate authority: who may scope, and who approves a non-30% rate | Founders | Founders only; recorded approval reference, as the engine already requires | N | Y | Y (C06, C13) | `FOUNDER DECISION` | |
| `AP-PRIV-03` | Resource view and download logging | Founders, privacy adviser | Do not log individual views or downloads in B1; aggregate counts only if needed | N | Y | N | `FOUNDER DECISION` | |
| `AP-PRIV-04` | Retention of learning progress, including after a partner leaves | Founders, privacy adviser | Delete progress a fixed period after the partnership ends; partner can clear it at any time | N | N | Y | `FOUNDER DECISION` | |
| `AP-PUB-01` | Withdrawal and correction procedure for published content | Founders | Withdraw (archive with reason) at once when wrong; publish a corrected new version through review; tell partners via "updated since you read it" | Y | Y | Y | `FOUNDER DECISION` | |
| `AP-PUB-02` | Publication priority order for the Resource Centre | Founders | As recommended in [CONTENT-REVIEW-REGISTER.md](CONTENT-REVIEW-REGISTER.md) section 5 | N | Y | N | `DRAFT` | |

## B. Package documents

| Item | Status | Reviewer |
|---|---|---|
| [PLATFORM-AUDIT.md](PLATFORM-AUDIT.md) | `DRAFT` | Engineering |
| [ARCHITECTURE.md](ARCHITECTURE.md) | `DRAFT` | Engineering, founders |
| [SECURITY-MODEL.md](SECURITY-MODEL.md) | `DRAFT` | Engineering, privacy adviser |
| [DESIGN-SPECIFICATION.md](DESIGN-SPECIFICATION.md) | `DRAFT` | Founders |
| [WIREFRAMES.md](WIREFRAMES.md) | `DRAFT` | Founders |
| [IMPLEMENTATION-PHASES.md](IMPLEMENTATION-PHASES.md) | `DRAFT` | Founders, engineering |
| [ACCEPTANCE-CRITERIA.md](ACCEPTANCE-CRITERIA.md) | `DRAFT` | Engineering |

## C. Academy courses and lessons

Every lesson inherits its course status until approved individually. Each lesson is approved as its own content version.

| Course | Lessons | Status | Blocking items |
|---|---|---|---|
| C01 Welcome to ScaleSmiths | C01-L1 to L7 | `DRAFT` | `AP-CNT-01`, `AP-GOV-01` |
| C02 Professional Website Development | C02-L1 to L8 | `DRAFT` (L6 source is owner review) | `AP-PROOF-01` |
| C03 SEO and Digital Growth | C03-L1 to L8 | `DRAFT` | `AP-CNT-06` (L7) |
| C04 Growth Partnerships | C04-L1 to L7 | `DRAFT` | `AP-COM-03` (L3) |
| C05 Website Migration | C05-L1 to L6 | `DRAFT` (L3 source is owner review) | — |
| C06 Bespoke Software and Automation | C06-L1 to L7 | `DRAFT` (L2 source is owner review) | `AP-PROOF-01` |
| C07 Finding Prospects | C07-L1 to L7 | `DRAFT`, `BLOCKED` | `AP-LEG-03`, `AP-COM-06` |
| C08 Discovery Meetings | C08-L1 to L7 | `DRAFT` | `AP-PRIV-01` |
| C09 Presenting ScaleSmiths | C09-L1 to L6 | `DRAFT` | `AP-PROOF-01` |
| C10 Objection Handling | C10-L1 to L8 | `DRAFT` | `AP-OBJ-*`, `AP-COM-05` |
| C11 Commercial Policies | C11-L1 to L7 | `DRAFT`, `BLOCKED`; figures `PROPOSED POLICY` | Agreement, terms, withdrawal, refund, VAT, markets |
| C12 Professional Conduct | C12-L1 to L7 | `DRAFT`, `BLOCKED` | `AP-GOV-01`, `AP-GOV-02`, `AP-GOV-05`, `AP-PRIV-01` |
| C13 Advanced and Enterprise Opportunities | C13-L1 to L6 | `DRAFT`; L4 `PROPOSED POLICY` | Attribution evidence standard |

Knowledge checks: all `DRAFT`, approved with their lesson.

## D. Resource Centre drafts

| ID | Resource | Status | Blocking items |
|---|---|---|---|
| R01 | Company brochure | `DRAFT` | `AP-CNT-01`, `AP-PROOF-01` |
| R02 | Partner handbook | `DRAFT`, `BLOCKED` | Agreement, `AP-LEG-03`, `AP-COM-06`, `AP-PRIV-01` |
| R03 | Website development guide | `DRAFT` | Owner-review sources |
| R04 | Growth Partnership guide | `DRAFT` | `AP-COM-03` |
| R05 | Bespoke software guide | `DRAFT` | `AP-PROOF-01` |
| R06 | SEO and AEO guide | `DRAFT` | `AP-CNT-06` |
| R07 | Discovery questionnaire | `DRAFT` | `AP-PRIV-01` |
| R08 | Objection-handling playbook | `DRAFT` | `AP-OBJ-01` to `AP-OBJ-12` |
| R09 | Meeting preparation checklist | `DRAFT` | — |
| R10 | Technical escalation guide | `DRAFT` | — |
| R11 | Commercial pricing reference | `DRAFT` (figures `CONFIRMED: PUBLISHED`) | `AP-COM-07` |
| R12 | Commission and payment reference | `DRAFT`, `BLOCKED`, `PROPOSED POLICY` | Agreement and all financial decisions |
| R13 | Follow-up templates T1 to T6 | `DRAFT` | `AP-GOV-05`, `AP-LEG-03`, `AP-PRIV-01` |

## E. Objection responses

`AP-OBJ-01` to `AP-OBJ-12` in [R08](resources/R08-objection-handling-playbook.md): each `DRAFT`, approved individually. `AP-OBJ-10` is also `BLOCKED` on `AP-GOV-05`.

## F. Knowledge entries

| Entry | Status |
|---|---|
| KB-HOST-01, KB-HOST-02, KB-HOST-03 | `DRAFT` (wording `CONFIRMED: PUBLISHED`) |
| KB-DOM-01, KB-DNS-01 | `DRAFT` (wording `CONFIRMED: PUBLISHED`) |
| KB-EMAIL-01, KB-EMAIL-02 | `DRAFT` (wording `CONFIRMED: PUBLISHED`) |
| KB-SEC-01 | `DRAFT` (wording `CONFIRMED: PUBLISHED`) |
| KB-ANL-01 | `DRAFT` (wording `CONFIRMED: PUBLISHED`) |
| KB-SEO-01 to KB-SEO-04 | `DRAFT` (wording `CONFIRMED: PUBLISHED`) |
| KB-AIS-01 | `DRAFT`, `FOUNDER DECISION` (`AP-CNT-06`) |
| KB-MIG-01, KB-RED-01 | `DRAFT` (`CONFIRMED: PUBLISHED, OWNER REVIEW`) |
| KB-ACC-01 | `DRAFT`, `FOUNDER DECISION` (`AP-CNT-07`) |
| KB-ECOM-01, KB-BOOK-01 | `DRAFT` (wording `CONFIRMED: PUBLISHED`) |
| KB-CRM-01 | `DRAFT` (`CONFIRMED: PUBLISHED, OWNER REVIEW`) |
| KB-SW-01, KB-SW-02, KB-AUTO-01 | `DRAFT` (wording `CONFIRMED: PUBLISHED`) |
| KB-TERMS-01, KB-TERMS-02, KB-PAY-01 | `DRAFT` (wording `CONFIRMED: PUBLISHED`; internal schedules `FOUNDER DECISION`) |
| KB-COMM-01 | `PROPOSED POLICY`, `BLOCKED` |
| KB-COMM-02, KB-COMM-03 | `FOUNDER DECISION`, `BLOCKED` |
| KB-ONB-01, KB-ONB-02, KB-COM-01 | `DRAFT` (wording `CONFIRMED: PUBLISHED`) |
