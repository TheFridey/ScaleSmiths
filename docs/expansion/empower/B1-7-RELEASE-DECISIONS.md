# Project Aegis (B1.7): founder release decision package

**Nothing in this document is approved.** It prepares decisions for the founders. A decision exists only when an authorised founder records it, with date, reference and review-by date, in [FOUNDER-APPROVAL-REGISTER.md](FOUNDER-APPROVAL-REGISTER.md) (section G links each item here). A passing test, a green CI run or a model review is never an approval.

Prepared 22 November 2026 against `master` `06d6b4f`. Evidence is in [B1-7-PROJECT-AEGIS-FINAL-REPORT.md](B1-7-PROJECT-AEGIS-FINAL-REPORT.md).

## 1. AP-COM-03: the twelve-month Growth Partnership minimum term

**Why this needs a decision now.** The public partner page already states the term, the admin engine already enforces it, and the register still lists `AP-COM-03` as `FOUNDER DECISION`. Published wording and the commercial engine therefore run ahead of a recorded decision. Nothing was changed to make them agree; the founders decide which is right.

| Field | Current state (verified in code on `06d6b4f`) |
|---|---|
| Proposed term | Twelve-month minimum commitment on the monthly Growth Partnership |
| Scope | New client agreements under `standard-v2` (all schedules) and `growth-only-v1`. The engine refuses any other `minTermMonths` for these plans (`admin/src/lib/expansion-finance.ts`, `STANDARD_V2_MINIMUM_RETAINER_MONTHS`). `bespoke-v1` uses 12 months when it has a recurring fee, otherwise 1 |
| Standard package | £2,000 website plus £350 a month, excluding VAT |
| Minimum contract value | £2,000 + 12 × £350 = **£6,200** excluding VAT (`web/src/lib/partner-programme.ts`; `admin/src/lib/expansion-finance.test.ts` "Case B") |
| Illustrative partner commission | £300 + £300 + £105 = **£705** on a standard acquisition at 30%: deposit, final payment and first retainer, earned only on verified VAT-exclusive collections. An illustration, not a forecast or a guarantee |
| Historical agreements | Earlier client agreements keep the terms under which they were accepted. Accepted terms are snapshotted per contract (commitment, schedule, rate, refund reference) and the ledger is append-only, so no historical six-month (`legacy` / `standard-v1`) contract is re-priced or re-termed by this decision. The Aegis upgrade rehearsal confirmed every pre-existing contract and ledger row byte-identical after the release migrations |
| Public wording today | `/partners` FAQ and body: "a twelve-month minimum commitment, a minimum contract value of £6,200 excluding VAT … earlier agreements keep the terms under which they were accepted" |
| Content depending on it | Resource R04 (Growth Partnership guide), Academy C04-L3 and C11 (all `DRAFT`) |
| Effective date | **To be set by the founders.** Recommended: the date the decision is recorded, applying to client agreements accepted on or after it |

Founder decision fields (to be completed by a founder, not by engineering):

| Decision | Decided by | Date | Reference | Effective from | Review by |
|---|---|---|---|---|---|
| ☐ Approve as stated ☐ Approve with changes ☐ Reject (then the site and engine must change in a reviewed PR) | | | | | |

## 2. Partner agreement: clause checklist for the solicitor (AP-LR-01, AP-LR-02, AP-GOV-01)

There is **no partner agreement text in the repository**. Agreements are founder-authored governed content (kind `agreement`, two-founder approval, source reference `legal:<review>` required) and none has been drafted or published. Engineering therefore cannot verify any clause; it can only state what the agreement must cover and what the platform does.

| Clause | What the platform already does (and must match) | Decision owner |
|---|---|---|
| Independent contractor status | Partner role is `independent_partner`; Academy optional with private progress; no targets | Solicitor (AP-GOV-01, AP-GOV-02) |
| Commission entitlement | 30% of verified, VAT-exclusive collections on qualifying milestones; bespoke rate needs a recorded approval | Founders, accountant (AP-LR-02) |
| Payment conditions | Earned only on verified collection; manual payouts against a reviewed partner invoice | AP-LR-02 |
| Refunds, reversals, chargebacks, cancellations | Refund treatment per payment: manual review, retain, or adjust unpaid, each with an accepted clause reference | AP-LR-02 |
| Territory; exclusivity or non-exclusivity | Exclusivities are founder-recorded against an accepted contractual reference; partners may not claim territory (AP-COM-10) | Solicitor (AP-COM-06, AP-COM-10) |
| Termination | Founder suspension or revocation ends portal access at once; earned history is preserved | Solicitor |
| Confidentiality; intellectual property | Partner-only content is never offered for copying; only client-safe lines are | Solicitor |
| Data protection | Partner data handled per the open privacy decisions (section 3) | Privacy adviser |
| Governing law, disputes, jurisdiction | Not modelled in code | Solicitor (AP-LR-02) |
| Acceptance method | Click-to-accept with typed name, single-use invitation, database timestamp and SHA-256 of the exact text. A simple electronic signature with a tamper-evident record; **not** a qualified electronic signature | Solicitor (AP-LR-01) |

Until AP-LR-01 and AP-LR-02 are decided and an agreement is published, `PARTNER_ACTIVATION_ENABLED` stays off and no partner can be invited.

## 3. Privacy decisions

| ID | Decision | Current behaviour | Recommendation (not a decision) |
|---|---|---|---|
| `AP-PRIV-01` | Partner and applicant privacy notice | No notice covers Academy progress, help requests or discovery notes | Publish before any partner module is switched on |
| `AP-PRIV-02` | Search-log retention | Guidance and objection search log nothing (verified in code) | Keep no search log; revisit only if analytics are wanted |
| `AP-PRIV-03` | Resource view/download logging | Not logged | As recommended in the register |
| `AP-PRIV-04` | Learning progress retention after partnership ends | Progress kept; no deletion job | Decide a period; build deletion before enabling the Academy |
| `AP-AEGIS-PRIV-05` (new) | Agreement acceptance record retention | Acceptances are immutable by trigger and cannot be deleted | Keep for the limitation period of the agreement; solicitor to confirm |
| `AP-AEGIS-PRIV-06` (new) | Partner suspension and deletion | Suspension/revocation disables the account; financial and agreement records are retained | Define erasure scope that preserves financial and contractual records |
| `AP-AEGIS-PRIV-07` (new) | Partner email | Off; recipient stored only as SHA-256; no bodies or addresses logged | Approve wording (AP-LR-03) and provider (AP-LR-04) before enabling |
| `AP-AEGIS-PRIV-08` (new) | International applicants | Application form open to any country; markets must be approved before activation | Decide lawful basis and transfer position per approved market |

## 4. Go / no-go checklist

States: **PASS**, **PASS WITH LIMITATION**, **BLOCKED**, **FAIL**, **NOT VERIFIED**. Owners are roles. "Approval reference" stays empty until a founder records one.

| Gate | Required evidence | Current state | Owner | Blocker | Approval reference | Release decision |
|---|---|---|---|---|---|---|
| Code review | Human review of the B1.7 PR | NOT VERIFIED (model review only) | Founders | Human review | | |
| CI | All required checks green on the final PR head | See final report §23 | Engineering | | | |
| Database | Fresh and upgrade migrations on PostgreSQL 14 and 16 | PASS (local rehearsal) | Engineering | | | |
| Security | Founder/partner isolation, content governance | PASS WITH LIMITATION (automated; no human penetration test) | Engineering | | | |
| Performance | 900 ms budget unchanged | PASS (budget unchanged; web untouched) | Engineering | | | |
| Accessibility | axe + keyboard checks | PASS WITH LIMITATION (no screen-reader walkthrough) | Engineering | | | |
| Browser acceptance | All Empower journeys, none skipped | PASS (local PG14; CI on PR) | Engineering | | | |
| Backup | Encrypted, off-host, monitored on the VPS | BLOCKED (framework verified; host installation of age, rclone, destination and timer not verified) | Founders, operator | Destination and retention approval | | |
| Restore | Isolated drill with role re-provisioning | PASS WITH LIMITATION (disposable data, not a production bundle) | Operator | Production-bundle drill | | |
| Monitoring | Health checks and failure hooks | NOT VERIFIED on the VPS | Operator | | | |
| Email | Resend key, domain, wording | BLOCKED (AP-LR-03, AP-LR-04) | Founders | | | |
| DNS | `admin.scalesmiths.co.uk` origin | BLOCKED (AP-LR-05) | Founders | | | |
| Authentication | Founder MFA, partner sessions | PASS (browser journeys) | Engineering | | | |
| Support procedures | Incident runbooks | PASS WITH LIMITATION (runbooks written, not exercised) | Founders | | | |
| Agreement terms | Published agreement | BLOCKED (AP-LR-01, AP-LR-02) | Founders, solicitor | | | |
| Commission conditions | Matches agreement | BLOCKED (AP-LR-02) | Founders, accountant | | | |
| Twelve-month policy | AP-COM-03 | BLOCKED (section 1) | Founders | | | |
| Historical contract preservation | Upgrade rehearsal | PASS | Engineering | | | |
| Partner communications | AP-LR-03 | BLOCKED | Founders | | | |
| Privacy notice and retention | Section 3 | BLOCKED | Founders, privacy adviser | | | |
| Content publication | Founder-approved content per module | BLOCKED (nothing published) | Founders | | | |

**Current position: ENGINEERING COMPLETE — RELEASE BLOCKED PENDING APPROVALS** (once the PR's CI is green and human review is done).

## 5. Staged activation (nothing is switched on by this work)

| Wave | What | Switches | Preconditions |
|---|---|---|---|
| 0 | Dormant code release | All partner switches unset | Separately approved release; backup taken; health, migrations, logs and rollback verified |
| 1 | Founder operations | `EMPOWER_FOUNDER_CONTENT_ENABLED` | Founders want to draft content and agreements; no publication or public applications follow automatically |
| 2 | Controlled pilot | `PARTNER_ACTIVATION_ENABLED`, `PARTNER_UNIFIED_WORKSPACE_ENABLED` for named pilot partners only | AP-LR-01, AP-LR-02, an approved market, a published agreement, AP-PRIV-01; pilot partners expressly authorised |
| 3 | Learning and enablement | `PARTNER_ACADEMY_ENABLED`, `PARTNER_RESOURCE_CENTRE_ENABLED`, `PARTNER_KNOWLEDGE_BASE_ENABLED`, `PARTNER_OBJECTION_HANDLING_ENABLED`, one at a time | Each module has approved, published, in-date content (AP-ACA-01, AP-RES-01, AP-KB-01, AP-OBJ-ENABLE). Never switch on an empty module |
| 4 | Wider applications | Public application flow and `PARTNER_EMAIL_ENABLED` | AP-COM-03, privacy, agreements, AP-LR-03/04, monitoring, support capacity and founder sign-off |
