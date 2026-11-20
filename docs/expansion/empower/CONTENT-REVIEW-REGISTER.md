# B1 content review register

**Status: DRAFT. Agent review, not human approval.** This register records a full read-back of every document in this package on 2026-11-20, against the repository on branch `claude/empower-b1-planning` (B0 head `4e713e5`). Nothing here approves any item. A finding marked VERIFIED means the statement matches its cited source; it does not mean the statement is approved for publication.

## 1. Method and sources of authority

All 27 documents were read in full: the 13 package documents, `resources/README.md` and the 13 resource drafts. No section was sampled. Each statement was checked against the highest available authority:

| Authority | Used for |
|---|---|
| `admin/src/lib/expansion-finance.ts` (`buildAcceptedTerms`, `commissionAt`, `STANDARD_V2_MINIMUM_RETAINER_MONTHS`, `APPROVED_STANDARD_SCHEDULES`) | Plans, rates, terms, schedules, rounding |
| `web/src/lib/partner-programme.ts` | Public programme figures, achievement schedule, `FEATURE_AVAILABILITY` |
| `docs/expansion/COMMISSION-RULES.md`, `intelligence/COMMERCIAL-INTEGRATION.md`, `intelligence/ARCHITECTURE.md`, `intelligence/COMMERCIAL-ACCEPTANCE-MATRIX.md` | Verification, refunds, historical `standard-v1` |
| `intelligence/FOUNDER-DECISIONS.md`, `intelligence/PROGRAMME-ALIGNMENT.md` | What is decided, pending or disabled |
| `web/src/lib/published-starting-prices.ts`, `web/src/lib/legal-policies.ts`, `web/src/lib/engagement-models.ts` | Client prices, boundary text, VAT, scoped work |
| `web/src/lib/faq-library.ts` (63 keys) | Client-facing service explanations |
| `admin/src/lib/rbac.ts`, `admin/src/lib/expansion-operations.ts`, `admin/src/lib/server/expansion-operations.ts`, `admin/src/lib/server/expansion.ts`, migrations 0068 and 0070 | Platform audit facts |
| `admin/src/app/globals.css`, `admin/src/components/expansion/expansion.css` | Design and contrast |

Automated checks run during the review:

- Every `faq:<key>` cited anywhere in the package (61 distinct keys) exists in `faq-library.ts`. None is missing.
- The package's `ownerReview` labels match the source exactly: `wordpress`, `seo-rebuild` and `crm` are the only flagged keys.
- Every repository file cited in the package exists (29 paths checked).
- Platform-audit line references (`rbac.ts:26-28, 53, 99`, `expansion-operations.ts:7-26`, `0068:46-51`, `0070:8-15`, `expansion.ts:118, 278-288`, `ExpansionWorkspace.tsx:67`) match the cited code.
- Every contrast ratio in DESIGN-SPECIFICATION was recomputed with the WCAG 2.x formula; all published values are correct to two decimal places.
- `node scripts/check-documentation-links.mjs` passes.

## 2. Findings

Classifications: VERIFIED, CORRECTED, UNSUPPORTED, REQUIRES FOUNDER DECISION, REQUIRES LEGAL REVIEW, REQUIRES ACCOUNTING REVIEW, REQUIRES PRIVACY REVIEW, DEFERRED.

| ID | Document | Identifier | Statement under review | Authority | Classification | Risk | Correction | Done | Remaining approval |
|---|---|---|---|---|---|---|---|---|---|
| F01 | PR #156 description; package summary | Lesson count | "first-draft text for all 94 lessons" | CURRICULUM course map and lesson files | CORRECTED | Low: misstated scope | Count is 91 lessons in 38 modules; 91 unique IDs, no gaps, no duplicates, every ID has a body. Totals line added to CURRICULUM; PR description corrected | Yes | None |
| F02 | CURRICULUM | C10 objective 2 | "respond to the eight most common objections" | C10 has five objection lessons; R08 has twelve | CORRECTED | Low: objective does not match lessons | Reworded to five in the course, twelve in R08 | Yes | None |
| F03 | LESSONS-PRACTICE C11-L3; R12 | Rounding | "calculated once on the cumulative amount, so splitting payments cannot change the total" | `COMMISSION-RULES.md` ("cannot increase entitlement"); `COMMERCIAL-INTEGRATION.md` (historical `standard-v1` keeps per-milestone rounding) | CORRECTED | Medium: overstated for historical agreements | Scoped to current plans; historical per-milestone rounding disclosed | Yes | Accounting (`Pooled-build rounding` decision in B0) |
| F04 | C11, R12, KB-COMM-01 | Historical terms | Package never mentions earlier six-month agreements | B0 `ARCHITECTURE.md` (`standard-v1` six-month, historical), `FINAL-REPORT.md` (£4,100 copy removed), `/partners` ("earlier agreements keep the terms under which they were accepted") | CORRECTED | Medium: partners could misdescribe existing clients' terms or quote six months | Added historical-agreement notes to C11-L4, R12, KB-COMM-01 and PLATFORM-AUDIT; never quote six months for new work | Yes | Founders, accounting |
| F05 | C11-L3, R12 | Refunds | "held for founder review; nothing deducted automatically" | `COMMISSION-RULES.md`: refunds append approved reversals with reasons; no automatic recovery | CORRECTED (clarified) | Low | Added that any reversal is a recorded, approved entry with a reason | Yes | Legal, accounting (refund and clawback) |
| F06 | C11-L5, R12, PLATFORM-AUDIT | Markets | "No market is approved yet, including the UK" stated as current fact | `MARKET-ELIGIBILITY.md`, fail-closed register; production database not inspected | CORRECTED | Medium: becomes false the day a founder approves the UK | Reworded as the software's default, with "check with ScaleSmiths" | Yes | Founders, legal, tax (market approval) |
| F07 | LESSONS-FOUNDATIONS C01-L2 | Boundary quote | Partial quotation presented as "The published boundary reads" | `STARTING_PRICE_BOUNDARY` | CORRECTED | Low: R11 says "quote it as written" | Full text quoted; VAT note added | Yes | `AP-COM-07` (VAT wording) |
| F08 | R11 header | VAT | "VAT treatment per proposal" | `legal-policies.ts`: VAT treatment must appear in agreed project documents | VERIFIED | — | — | — | `AP-COM-07` for partner wording |
| F09 | DESIGN-SPECIFICATION | `--emp-muted #8a93a3` | Proposed accessible muted text | Recomputed: 4.47:1 on `--s3` | CORRECTED | Medium: fails AA on hover surfaces | Changed to `#939cac` (6.66 / 5.62 / 5.00:1 on `--bg` / `--s2` / `--s3`) | Yes | `AP-DES-01` |
| F10 | DESIGN-SPECIFICATION | `--t3 #667085` | "3.71:1 on `--bg`" | Recomputed; also 3.46 / 3.12 / 2.78:1 on `--s1` / `--s2` / `--s3` | VERIFIED, extended | Medium: admin-wide | Recorded all surfaces and the blast radius (68 `var(--t3)` uses in 36 files; 72 `text-t3` uses in 15 files). Global change deferred to a separate reviewed change | Yes (record) | `AP-DES-03` |
| F11 | DESIGN-SPECIFICATION | `--red` | "used with a label" | Recomputed: 4.13:1 on `--s2` | CORRECTED | Low | Red limited to icons, rules and large text | Yes | `AP-DES-01` |
| F12 | SECURITY-MODEL, ACCEPTANCE-CRITERIA | Revoked partners | Not explicitly covered | `partnerGuard` requires an activated profile, active user, partner role and current session version | CORRECTED (gap closed) | Medium | Control and acceptance criteria 13a, 13b added | Yes | None |
| F13 | ARCHITECTURE | Lifecycle | Directive names *submitted*, *changes requested*, *withdrawn*; the model names `in_review`, approval decisions and `archived` | Directive section 15 | CORRECTED (mapping added) | Low | Mapping and correction rule documented; no new state needed | Yes | `AP-PUB-01` |
| F14 | CURRICULUM | Knowledge checks | "Optional knowledge check: five questions" | No question or answer text exists for any course (one example question in C01) | DEFERRED | Medium: quiz answers cannot be audited | Write questions with the lesson they test, after the lesson is approved, so the answer is supported by approved text | No | Approved with each lesson |
| F15 | R08 | Structure | Rows lacked limitations and supporting resources | Directive section 12 | CORRECTED | Low | Added a limitations and resources table for all twelve | Yes | `AP-OBJ-*` |
| F16 | R13 | T6 | Sending a message after an opt-out | PECR/UK GDPR practice; no approved process | REQUIRES LEGAL REVIEW, REQUIRES PRIVACY REVIEW | Medium | Note added: do not send T6 without ScaleSmiths' agreement | Yes (note) | `AP-LEG-03`, `AP-PRIV-01` |
| F17 | LESSONS-PRACTICE C07-L5 | ICO guidance summary | TPS/CTPS checks for B2B calls; electronic marketing rules vary | External ICO guidance (not fetched in this review) | REQUIRES LEGAL REVIEW | Medium | None; lesson already `BLOCKED` | No | `AP-LEG-03` |
| F18 | C01-L4, C12-L1, R02 §2 | Independent status | "No salary, guaranteed income, compulsory hours or targets" | `/partners` page (draft, not approved) | REQUIRES LEGAL REVIEW | High if wrong | None; already labelled `PROPOSED POLICY` | — | `AP-GOV-01`, `AP-GOV-02` |
| F19 | C06-L5, KB-AUTO-01 | AI position | "Deterministic rules … often safer and cheaper than a language model" | Not in `faq:process-automation` wording; consistent with it and with B0 "AI provider: keep disabled" | UNSUPPORTED as published wording | Low | None; keep as `DRAFT` until founders approve the AI position | No | `AP-CNT-01` |
| F20 | C03-L7, R06, KB-AIS-01 | AEO | AI search wording | `service-pages.ts` lists "SEO/AEO landing pages" only | REQUIRES FOUNDER DECISION | Medium | None; already `AP-CNT-06` | — | `AP-CNT-06` |
| F21 | KB-ACC-01 | Accessibility | "No published statement commits to a WCAG level" | `enterprise-websites-page.ts` ("delivery requirements"), `business-growth-audit.ts` ("accessibility fundamentals") | VERIFIED | — | — | — | `AP-CNT-07` |
| F22 | R12 | Discounted and free builds | Illustrations at £1,500 / £1,000 / £500 / £0 | `DISCOUNT_BUILD_FEES_PENCE`, `approvedDiscountFeePence` guard; no allowance approved | CORRECTED (caveat) | Medium: could read as an available option | Caveat added: arithmetic only, nothing approved | Yes | `AP-COM-05`, accounting |
| F23 | C11-L4 | Worked examples | Could be read as earnings forecasts | Directive section 6 | CORRECTED | Medium | "Illustrations, not earnings forecasts" added | Yes | `AP-COM-09`, accounting |
| F24 | FOUNDER-APPROVAL-REGISTER | Missing decisions | No rows for service scope boundaries, earnings examples, territory wording, reward descriptions, bespoke authority, download logging, progress retention, withdrawal and correction | Directive section 13 | CORRECTED | Medium | `AP-COM-08` to `AP-COM-12`, `AP-PRIV-03`, `AP-PRIV-04`, `AP-PUB-01`, `AP-PUB-02`, `AP-DES-03` added, all unapproved | Yes | Each row |
| F25 | Whole package | Approval labels | No item may be marked approved | — | VERIFIED | — | No item is approved; the only `[x]` marks are Phase 0 checks about the package itself | — | — |
| F26 | KB, lessons | Proof | No invented testimonials, statistics or client names | `data.ts`, `public-claims.ts` | VERIFIED | — | Only published project names appear, describing what was built; partner use still needs `AP-PROOF-01` | — | `AP-PROOF-01` |

## 3. Lesson inventory (91 lessons)

Generated from CURRICULUM.md and checked against both lesson files: 91 unique identifiers, no gaps, no duplicates, each with a body. "Sources cited" is the lesson's own source line, shortened. A lesson with no source line is classified by its content.

| Lesson | Title | Sources cited | Review result |
|---|---|---|---|
| C01-L1 | The ScaleSmiths story in plain words | faq:outside-nottingham, faq:established-businesses, faq:wordpress, `web/src/lib/data.ts`. | VERIFIED against cited sources |
| C01-L2 | What we sell | `web/src/lib/published-starting-prices.ts`, `web/src/lib/engagement-models.ts`. | CORRECTED (full boundary text, VAT note) |
| C01-L3 | How we work | faq:after-enquiry, faq:timeline, faq:phases, faq:improvement-measurement. | VERIFIED against cited sources |
| C01-L4 | What an independent partner does | `/partners` page copy (`web/src/app/partners/page.tsx`, draft, not approved), [PARTNER-OPE | REQUIRES LEGAL REVIEW (`AP-GOV-01`) |
| C01-L5 | What is live, proposed and planned | `FEATURE_AVAILABILITY` in `web/src/lib/partner-programme.ts`. | VERIFIED against cited sources |
| C01-L6 | Finding answers fast | none (draft guidance) | DEFERRED (describes B1 software not yet built) |
| C01-L7 | Getting help | none (draft guidance) | VERIFIED (meeting types and one-to-five slots: `expansion-operations.ts`) |
| C02-L1 | What a website project includes | faq:website-included, faq:seo-in-build. | VERIFIED against cited sources |
| C02-L2 | What is separate | none (draft guidance) | VERIFIED (traced to faq:hosting-included) |
| C02-L3 | Price and proposal | none (draft guidance) | VERIFIED (traced to faq:cost, published price) |
| C02-L4 | Timelines | faq:timeline | VERIFIED against cited sources |
| C02-L5 | Ownership and editing | faq:website-ownership, faq:code-ownership, faq:self-editing. | VERIFIED against cited sources |
| C02-L6 | Technology and WordPress | faq:wordpress (*owner review flagged*) | VERIFIED; source `ownerReview` |
| C02-L7 | Good-fit signals | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C02-L8 | When it is not a standard website | none (draft guidance) | VERIFIED (faq:ecommerce-builds cited inline) |
| C03-L1 | What SEO is | faq:what-is-seo | VERIFIED against cited sources |
| C03-L2 | Local SEO | faq:what-is-local-seo | VERIFIED against cited sources |
| C03-L3 | Technical SEO | faq:technical-seo | VERIFIED against cited sources |
| C03-L4 | Timescales and guarantees | faq:seo-timeline, faq:ranking-guarantees. | VERIFIED against cited sources |
| C03-L5 | Build versus ongoing | none (draft guidance) | VERIFIED (traced to faq:seo-in-build) |
| C03-L6 | SEO and paid search | faq:seo-and-google-ads | VERIFIED against cited sources |
| C03-L7 | What AI search and AEO mean | service listing "SEO/AEO landing pages" (`web/src/lib/service-pages.ts`), `web/src/lib/age | REQUIRES FOUNDER DECISION (`AP-CNT-06`, new wording) |
| C03-L8 | Diagnosing "not on Google" | faq:not-on-google | VERIFIED against cited sources |
| C04-L1 | What a Growth Partnership is | `web/src/app/digital-growth-partnership/page.tsx`, faq:support-included. | VERIFIED against cited sources |
| C04-L2 | What it is not | none (draft guidance) | VERIFIED (traced to faq:support-included) |
| C04-L3 | Price and term | none (draft guidance) | REQUIRES FOUNDER DECISION (`AP-COM-03`) |
| C04-L4 | Roadmap and priorities | faq:request-priority | VERIFIED against cited sources |
| C04-L5 | Hosting, email and monitoring | faq:hosting-included, faq:monitoring | VERIFIED against cited sources |
| C04-L6 | After a build | faq:support | VERIFIED against cited sources |
| C04-L7 | Existing websites | faq:manage-external-site | VERIFIED against cited sources |
| C05-L1 | Types of migration | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C05-L2 | WordPress and Shopify moves | faq:website-migration, faq:rebuilds | VERIFIED against cited sources |
| C05-L3 | Redirects and search risk | faq:seo-rebuild (*owner review flagged*) | VERIFIED; source `ownerReview` |
| C05-L4 | What to collect | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C05-L5 | Red flags | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C05-L6 | Escalation | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C06-L1 | Custom versus off the shelf | faq:custom-software | VERIFIED against cited sources |
| C06-L2 | What we have built | faq:crm (*owner review flagged*), faq:customer-portals, faq:stripe, faq:integrations, faq: | VERIFIED; `crm` source `ownerReview`; `AP-PROOF-01` |
| C06-L3 | Automating a workflow | faq:process-automation | VERIFIED against cited sources |
| C06-L4 | Spreadsheets and manual processes | faq:replace-spreadsheets | VERIFIED against cited sources |
| C06-L5 | AI, honestly | none (draft guidance) | UNSUPPORTED as published wording (no FAQ key); consistent with faq:process-automation |
| C06-L6 | Phases and scoping | faq:phases, faq:software-scaling, `engagement-models.ts` | VERIFIED against cited sources |
| C06-L7 | Bespoke discovery requests | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C07-L1 | Good-fit businesses | none (draft guidance) | BLOCKED (`AP-LEG-03`, `AP-COM-06`) |
| C07-L2 | Warm introductions | none (draft guidance) | BLOCKED (`AP-LEG-03`, `AP-COM-06`) |
| C07-L3 | Registering a prospect | none (draft guidance) | BLOCKED (`AP-LEG-03`, `AP-COM-06`) |
| C07-L4 | Researched prospects | none (draft guidance) | BLOCKED; "nothing is contacted" VERIFIED (`PROGRAMME-ALIGNMENT.md`) |
| C07-L5 | Contact rules | none (draft guidance) | REQUIRES LEGAL REVIEW (ICO/PECR summary) |
| C07-L6 | Suppression and objections | none (draft guidance) | BLOCKED (`AP-LEG-03`, `AP-COM-06`) |
| C07-L7 | Sectors and exclusivity | none (draft guidance) | BLOCKED (`AP-LEG-03`, `AP-COM-06`) |
| C08-L1 | Preparing | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C08-L2 | Setting the agenda | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C08-L3 | The core questions | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C08-L4 | Listening for fit | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C08-L5 | What not to say | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C08-L6 | Writing up | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C08-L7 | Next steps | none (draft guidance) | VERIFIED (£395 published price) |
| C09-L1 | Problem first | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C09-L2 | The ScaleSmiths approach | none (draft guidance) | VERIFIED (traced to faq:phases, faq:improvement-measurement) |
| C09-L3 | Using published work | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C09-L4 | Proof you must not use | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C09-L5 | Presenting price | none (draft guidance) | VERIFIED (audit credit wording matches `published-starting-prices.ts`) |
| C09-L6 | A respectful close | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C10-L1 | The pattern | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C10-L2 | When to stop | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C10-L3 | "It is too expensive" | none (draft guidance) | VERIFIED; discounting rule `AP-COM-05` |
| C10-L4 | "We already have a website or agency" | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C10-L5 | "Can you guarantee results?" | none (draft guidance) | VERIFIED (reuses C03-L4) |
| C10-L6 | "We use WordPress, Wix or Shopify" | none (draft guidance) | VERIFIED (traced to faq:wordpress, faq:ecommerce-builds) |
| C10-L7 | "We need to think about it" | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C10-L8 | Using the objection workspace | none (draft guidance) | DEFERRED (describes B1 software not yet built) |
| C11-L1 | Published starting prices | none (draft guidance) | BLOCKED (agreement, terms); `PROPOSED POLICY` |
| C11-L2 | Proposals and payment terms | faq:deposit | BLOCKED (agreement, terms); `PROPOSED POLICY` |
| C11-L3 | How commission is proposed to work | none (draft guidance) | CORRECTED (rounding scope, refund reversal) |
| C11-L4 | Worked examples | none (draft guidance) | CORRECTED (historical terms; illustration caveat); REQUIRES ACCOUNTING REVIEW |
| C11-L5 | What is not decided | none (draft guidance) | CORRECTED (market default wording) |
| C11-L6 | What you may and may not agree | none (draft guidance) | BLOCKED (agreement, terms); `PROPOSED POLICY` |
| C11-L7 | Markets | none (draft guidance) | BLOCKED (agreement, terms); `PROPOSED POLICY` |
| C12-L1 | Independent, not employed | none (draft guidance) | REQUIRES LEGAL REVIEW (employment status) |
| C12-L2 | How to describe yourself | none (draft guidance) | REQUIRES FOUNDER DECISION (`AP-GOV-05`) |
| C12-L3 | Truthful representation | none (draft guidance) | BLOCKED (agreement, `AP-GOV-02`) |
| C12-L4 | Pressure and vulnerability | none (draft guidance) | BLOCKED (agreement, `AP-GOV-02`) |
| C12-L5 | Personal data | none (draft guidance) | REQUIRES PRIVACY REVIEW (`AP-PRIV-01`); faq:dns claim VERIFIED |
| C12-L6 | Confidentiality | none (draft guidance) | BLOCKED (agreement, `AP-GOV-02`) |
| C12-L7 | Complaints and mistakes | none (draft guidance) | BLOCKED (agreement, `AP-GOV-02`) |
| C13-L1 | Established business transformation | `engagement-models.ts` | VERIFIED against cited sources |
| C13-L2 | Custom platforms and enterprise | none (draft guidance) | VERIFIED (traced to `engagement-models.ts`) |
| C13-L3 | Scoped after discovery | none (draft guidance) | VERIFIED (traced to `engagement-models.ts`) |
| C13-L4 | Existing clients and additional work | none (draft guidance) | REQUIRES FOUNDER DECISION (attribution standard) |
| C13-L5 | Preparing a bespoke discovery request | none (draft guidance) | DRAFT guidance; no factual claim needing a source |
| C13-L6 | Joint meetings | none (draft guidance) | DRAFT guidance; no factual claim needing a source |

Tally: 40 VERIFIED, 22 draft guidance with no factual claim, 4 CORRECTED, 14 BLOCKED with their course, 4 REQUIRES FOUNDER DECISION, 3 REQUIRES LEGAL REVIEW, 1 REQUIRES PRIVACY REVIEW, 1 UNSUPPORTED (F19), 2 DEFERRED (they describe software that does not exist yet and must be rechecked against the built screens).

## 4. Course-by-course validation

| Course | Objectives match lessons | Sequence | Technical accuracy | Knowledge check | Resources relevant | Escalation | Commercial claims | Voluntary | Publication |
|---|---|---|---|---|---|---|---|---|---|
| C01 | Yes | Logical | VERIFIED | Not written (F14) | R01, R02 yes | C01-L7 | Published prices only | Yes | Pending |
| C02 | Yes | Logical | VERIFIED; WordPress `ownerReview` | Not written | R03, R11 yes | C02-L8 | Published prices only | Yes | Pending |
| C03 | Yes | Logical | VERIFIED; L7 founder decision | Not written | R06 yes | KB entries | No guarantees | Yes | Pending |
| C04 | Yes | Logical | VERIFIED | Not written | R04 yes | Via KB | L3 term pending (`AP-COM-03`) | Yes | Pending |
| C05 | Yes | Logical | VERIFIED; L3 `ownerReview` | Not written | R03, R10 yes | L6 always | None | Yes | Pending |
| C06 | Yes | Logical | VERIFIED; L5 unsupported wording (F19) | Not written | R05 yes | L7 | Bespoke eligibility pending | Yes | Pending |
| C07 | Yes | Logical | L5 legal review | Not written | R02 yes | L6 | Lead protection pending | Yes | `BLOCKED` |
| C08 | Yes | Logical | n/a | Not written | R07, R09, R13 yes | L7 | Published prices only | Yes | Pending |
| C09 | Yes | Logical | n/a | Not written | R01, R11 yes | — | Published prices only | Yes | Pending |
| C10 | Corrected (F02) | Logical | VERIFIED | Not written | R08 yes | L2 | No discounting | Yes | Pending |
| C11 | Yes | Logical | n/a | Not written | R11, R12 yes | KB-COMM | Corrected (F03 to F06, F23) | Yes | `BLOCKED` |
| C12 | Yes | Logical | n/a | Not written | R02 yes | L7 | None | Yes, stated in L1 | `BLOCKED` |
| C13 | Yes | Logical | VERIFIED | Not written | R05, R10 yes | L6 | Attribution pending | Yes | Pending |

No lesson makes training compulsory or links it to commission, allocation or standing. The curriculum structure is unchanged.

## 5. Resource Centre audit and publication priority

| ID | Audience correct | Commercial | Technical | Privacy | Current vs historical terms | Version / review date | Related modules | Usefulness | Readiness |
|---|---|---|---|---|---|---|---|---|---|
| R01 | Client-facing, no partner terms | Published prices only | VERIFIED | n/a | Current | None yet (assigned at publication) | C01, C09 | High | Needs project selection (`AP-PROOF-01`) and contact route |
| R02 | Partner only | Refers to R12 | n/a | `AP-PRIV-01` | n/a | None yet | C01, C07, C12 | High | `BLOCKED` on agreement |
| R03 | Client-facing | Published price only | VERIFIED; `ownerReview` sources | n/a | Current | None yet | C02, C05 | High | Ready for founder review |
| R04 | Client-facing | Published price; term pending | VERIFIED | n/a | Current; no term stated | None yet | C04 | High | Needs `AP-COM-03` |
| R05 | Client-facing | Scoped after discovery | VERIFIED | n/a | Current | None yet | C06, C13 | Medium | Needs examples (`AP-PROOF-01`) |
| R06 | Client-facing | £395 audit | VERIFIED; AEO new wording | n/a | Current | None yet | C03 | High | Needs `AP-CNT-06` |
| R07 | Partner only | n/a | n/a | Data minimisation review | n/a | None yet | C08 | High | Needs `AP-PRIV-01` |
| R08 | Partner only, client lines marked | No discounting | VERIFIED | n/a | Current | None yet | C10 | High | Each entry approved individually |
| R09 | Partner only | Published prices only | n/a | n/a | n/a | None yet | C08 | High | Ready for founder review |
| R10 | Partner only | n/a | Meeting types VERIFIED | Incidents involving personal data escalate | n/a | None yet | C05, C13 | High | Ready for founder review |
| R11 | Partner only | VERIFIED against source | n/a | n/a | Current | None yet | C02, C09, C11 | High | Needs `AP-COM-07` |
| R12 | Partner only | Corrected (F03 to F06, F22) | n/a | n/a | Historical terms now stated | None yet | C11 | High | `BLOCKED` on financial decisions |
| R13 | Client-facing templates | Published prices only | n/a | F16 | n/a | None yet | C08, C10 | Medium | Needs `AP-LEG-03`, `AP-PRIV-01`, `AP-GOV-05` |

Recommended publication priority (`AP-PUB-02`), adjusted from the suggested order by actual readiness:

1. **R01 Company brochure**: once projects and contact route are chosen.
2. **R03 Website development guide**: ready for founder review.
3. **R04 Growth Partnership guide**: after `AP-COM-03`.
4. **R07 Discovery questionnaire**: after the privacy check.
5. **R09 Meeting preparation checklist**: ready for founder review.
6. **R08 Objection-handling playbook**: entry by entry.
7. **R05 Bespoke software guide**: after example selection.
8. **R10 Technical escalation guide**: ready for founder review.
9. **R11 Commercial pricing reference**: after `AP-COM-07`. R12 stays unpublished until the financial decisions are recorded.
10. **R06, R13, R02**: after `AP-CNT-06`, the marketing process and the partner agreement respectively.

None of these is published by this review.

## 6. Knowledge base audit (33 entries)

Counted: 33 entries across all 20 taxonomy topics (hosting 3, domains 1, DNS 1, business email 2, security 1, analytics 1, SEO 4, AI search 1, migration 1, redirects 1, accessibility 1, e-commerce 1, booking 1, CRM 1, custom software 2, automation 1, commercial terms 2, payment schedules 1, commission 3, client onboarding 3).

| Result | Entries |
|---|---|
| Wording VERIFIED against the cited FAQ answer | KB-HOST-01 to 03, KB-DOM-01, KB-DNS-01, KB-EMAIL-01, KB-EMAIL-02, KB-SEC-01, KB-ANL-01, KB-SEO-01 to 04, KB-ECOM-01, KB-BOOK-01, KB-SW-01, KB-SW-02, KB-TERMS-01, KB-TERMS-02 (also `faq:code-ownership`), KB-PAY-01, KB-ONB-01, KB-ONB-02, KB-COM-01 (CSDS in Pennsylvania confirmed) |
| VERIFIED, source `ownerReview` | KB-MIG-01, KB-RED-01, KB-CRM-01 |
| REQUIRES FOUNDER DECISION | KB-AIS-01 (`AP-CNT-06`), KB-ACC-01 (`AP-CNT-07`) |
| Partly UNSUPPORTED wording | KB-AUTO-01 (F19) |
| CORRECTED | KB-COMM-01 (no ongoing commission; historical terms) |
| REQUIRES ACCOUNTING AND LEGAL REVIEW | KB-COMM-02, KB-COMM-03 (correctly show an unresolved state) |

Every entry has a question, answer, client explanation (or "none" for partner-only entries), source, limitation and escalation rule. Unresolved entries display an accurate unresolved state rather than an invented answer.

Recommended additions (only these three; each has a published source and answers a common partner question):

| Proposed ID | Question | Source |
|---|---|---|
| KB-SUP-01 | "What happens if something breaks?" | `faq:something-breaks` (already a source of R04 and R10) |
| KB-SUP-02 | "Can you take over an unfinished project?" | `faq:unfinished-project` (already a source of R10) |
| KB-PERF-01 | "Will the new site be fast?" | `faq:website-speed` (already a source of R06) |

Not added in this review; they need founder agreement that they improve the first release.

## 7. Objections and follow-up templates

All twelve objection responses were checked: truthful, respectful, no invented proof, no competitor disparagement, no discount, no hidden-term pressure. Each now shows the customer concern, clarifying question, partner guidance, client-facing line, limitation, escalation and supporting resource (F15). `AP-OBJ-10` correctly stays `BLOCKED` on the partner title.

The six templates use no false urgency, quote only the published £395 audit price, limit follow-up to one agreed check-in (T4, then T5) and stop on request. T6 needs legal and privacy review (F16). Every template still needs the approved sign-off (`AP-GOV-05`).

## 8. Commercial claims review

| Claim area | Package position | Authority | Result |
|---|---|---|---|
| Standard website build price | From £2,000 | `published-starting-prices.ts`; `STANDARD_BUILD` | VERIFIED |
| Growth Partnership price | From £350/month | same; `STANDARD_RECURRING` | VERIFIED |
| Twelve-month minimum term | `standard-v2`, disabled, `PROPOSED POLICY`; not stated to clients | `STANDARD_V2_MINIMUM_RETAINER_MONTHS = 12` | VERIFIED |
| Historical six-month terms | Now stated as historical only | B0 ARCHITECTURE, FINAL-REPORT | CORRECTED (F04) |
| Total contractual commitment | £6,200 = £2,000 + 12 × £350 | `minimumContractValuePence` | VERIFIED |
| £705 standard commission | £600 + £105 | `commissionAt`, 3,000 bps | VERIFIED |
| Growth Partnership-only commission | £105 on the first payment | `growth-only-v1` | VERIFIED |
| Bespoke commission | 30% unless an approved different rate | `bespoke-v1`, `rateApprovalReference` | VERIFIED |
| Flexible deposits | £1,000/£1,000 or £750/£1,250; others need an approval reference | `APPROVED_STANDARD_SCHEDULES` | VERIFIED; partners must not describe schedules |
| Discount allowances | Founder-reserved, none approved | `approvedDiscountFeePence` guard | VERIFIED; caveat added (F22) |
| Existing-customer additional work | Founder-reviewed claim; attribution standard open | PROGRAMME-ALIGNMENT | VERIFIED; founder decision |
| Commission eligibility | Verified, collected, VAT-exclusive; acquisition only | COMMISSION-RULES | VERIFIED |
| Ongoing monthly commission | None | `saleCommission` comment; engine | VERIFIED; now explicit in R12 and KB-COMM-01 |
| Refunds | Held for review; recorded reversals | COMMISSION-RULES | CORRECTED (F05) |
| Withdrawals | Built, not operational; no minimum or frequency invented | PROGRAMME-ALIGNMENT | VERIFIED |
| Achievement rewards | Planned, conditional, not payable | `ACHIEVEMENTS`; FOUNDER-DECISIONS | VERIFIED |
| Referral reward | £250, planned, conditional, not payable | PROGRAMME-ALIGNMENT | VERIFIED |
| Partner exclusivity | Generic "commercial checks" notice only | SECTOR-EXCLUSIVITY | VERIFIED; `AP-COM-10` |
| Market eligibility | Fail-closed default | MARKET-ELIGIBILITY | CORRECTED (F06) |
| Founding Partner recognition | Not mentioned in lessons | FOUNDER-DECISIONS | VERIFIED (absent by design) |
| Earnings guarantees | None; illustrations labelled | `/partners` | VERIFIED; caveat added (F23) |
| Contract, employment status, VAT, tax | Labelled for solicitor and accountant | FOUNDER-DECISIONS | REQUIRES LEGAL REVIEW, REQUIRES ACCOUNTING REVIEW |

## 9. Technical claims review

| Area | Package claim | Result |
|---|---|---|
| Next.js, React, Astro, Node.js, PostgreSQL | Published work uses them (C01-L1) | VERIFIED (`faq:wordpress`) |
| Responsive design, performance, SEO foundations | Part of the build | VERIFIED (`faq:seo-in-build`, `faq:website-included`) |
| Rankings, traffic, enquiries, conversions | Never guaranteed | VERIFIED (`faq:ranking-guarantees`) |
| AI search | No control over third-party systems | REQUIRES FOUNDER DECISION (`AP-CNT-06`) |
| Accessibility | No conformance level claimed | VERIFIED; `AP-CNT-07` |
| Hosting | Self-hosted VPS or Vercel; no price, uptime or provider promise | VERIFIED (`faq:hosting-provided`) |
| DNS and domains | Delegated access; client stays registrant | VERIFIED (`faq:dns`, `faq:domains`) |
| Email | £15/month, three 5GB mailboxes; no inbox guarantee | VERIFIED (`faq:business-email`, `faq:email-spam`) |
| Security | HTTPS standard; no certification or immunity claims | VERIFIED (`faq:ssl`) |
| Backups | No recovery-time or recovery-point promise | VERIFIED (`faq:backups`) |
| Analytics | Agreed signals; no standard tool | VERIFIED; `AP-CNT-09` |
| WordPress migration and redirects | Risk reduced, not removed; always technical scoping | VERIFIED (`ownerReview`) |
| E-commerce, booking, CRM | Published examples; integration depends on the vendor's API | VERIFIED |
| Automation and AI | One bounded workflow; human review on high-consequence steps | VERIFIED; deterministic-first wording F19 |
| Mobile applications | Not claimed anywhere in the package | VERIFIED (absent; no published mobile-app service) |
| Bespoke enterprise software | Scoped after discovery; never against a starting price | VERIFIED (`engagement-models.ts`) |
| Unlimited maintenance, support or hosting | Explicitly excluded | VERIFIED |

Where feasibility depends on discovery, each lesson and KB entry names the escalation route (`technical_scoping` or `bespoke_discovery`).

## 10. Accessibility review

| Check | Finding |
|---|---|
| Muted text | `--t3 #667085` fails AA on every admin surface (F10). Empower uses `--emp-muted #939cac` (F09). Admin-wide fix is `AP-DES-03` |
| Red status | Fails as normal text on `--s2` (F11) |
| Keyboard, focus, headings, labels | Specified in DESIGN-SPECIFICATION §7 and ACCEPTANCE-CRITERIA P2 15 to 17; to be tested at implementation |
| Reduced motion | Specified (§6) |
| Mobile | 320px requirement in acceptance criteria; 390px should be added to the browser checks at implementation |
| Status by colour alone | Prohibited (§1 principle 3) |
| Rendered verification | **Not done.** No B1 screen exists. Contrast is calculated from tokens, not measured from rendered pages |

## 11. What this review did not do

- No human, legal, accounting or privacy review took place. Nothing is approved.
- The ICO guidance link and other external sources were not fetched.
- Production configuration (markets, plans, flags) was not inspected.
- Knowledge-check questions do not exist yet, so no quiz answer could be audited (F14).
