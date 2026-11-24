# Content publication register (Operation EMPOWER B2.10)

**Nothing in this register is approved or published by this operation.** Every item is a draft for founder review in the Content Studio (`EMPOWER_FOUNDER_CONTENT_ENABLED`, on in production). Publication requires a second founder's approval (or a recorded sole-founder reason). Published content is served from the database, so updating it needs no deployment.

**Import.** Drafts are loaded by `admin/scripts/import-empower-curriculum.mjs` (drafts only; requires `EMPOWER_IMPORT_DATABASE_URL`, `--founder-email`, `--confirm-import`; refuses non-test databases without `--allow-database`). Whether the drafts are already imported in production is **not verified**. Run the importer's dry run first (runbook step 5).

## Academy (13 courses, 91 lessons, 65 knowledge checks)

Source: [CURRICULUM.md](CURRICULUM.md), [LESSONS-FOUNDATIONS.md](LESSONS-FOUNDATIONS.md), [LESSONS-PRACTICE.md](LESSONS-PRACTICE.md), [KNOWLEDGE-CHECKS.md](KNOWLEDGE-CHECKS.md).

| Course | Covers brief topics | Status | Publishable now? |
|---|---|---|---|
| C01 Welcome to ScaleSmiths | 1, 2, 3 | Draft | Yes, after review |
| C02 Professional Website Development | 4 | Draft | Yes |
| C03 SEO and Digital Growth | 5, 6, 7 | Draft | Yes |
| C04 Growth Partnerships | 3, 8 | Draft | Yes |
| C05 Website Migration | 4 | Draft | Yes |
| C06 Bespoke Software and Automation | 3 | Draft | Yes |
| C07 Finding Prospects | 9 | Draft, **BLOCKED** (marketing process) | No |
| C08 Discovery Meetings | 10, 11, 18 | Draft | Yes |
| C09 Presenting ScaleSmiths | 12, 19 | Draft | Yes |
| C10 Objection Handling | 13 | Draft | Yes |
| C11 Commercial Policies | 14, 15, 16 | Draft, **BLOCKED** (agreement, terms) | No |
| C12 Professional Conduct | 21, 22 | Draft, **BLOCKED** (agreement) | No |
| C13 Advanced and Enterprise Opportunities | 17, 20, 23 | Draft | Yes |

Brief topics 16 (registering opportunities), 17 (technical assistance) and 20 (handover) are also answered by KB-PROG-03, -08 and -12. Training stays optional; no course is compulsory.

## Resource centre (13 drafts)

Source: [resources/](resources/README.md).

| Resource | Brief item | Status |
|---|---|---|
| R01 Company brochure | company overview, service catalogue | Draft |
| R02 Partner handbook | partner programme overview | Draft (check against the agreement) |
| R03 Website development guide | website brochure | Draft |
| R04 Growth partnership guide | Growth Partnership | Draft |
| R05 Bespoke software guide | service catalogue | Draft |
| R06 SEO and AEO guide | SEO and AI search brochures | Draft |
| R07 Discovery questionnaire | discovery questionnaire, qualification checklist | Draft |
| R08 Objection handling playbook | objection guide | Draft |
| R09 Meeting preparation checklist | sales meeting guide | Draft |
| R10 Technical escalation guide | technical assistance guide | Draft |
| R11 Commercial pricing reference | pricing guide | Draft; prices must match `published-starting-prices.ts` |
| R12 Commission and payment reference | commission guide | Draft, **BLOCKED** (payment terms) |
| R13 Follow-up templates | email and follow-up templates | Draft |

**Not drafted (founder input needed, not invented here):** Growth Audit brochure (the published £395 audit is covered in R01 and R11), proposal request guide (KB-PROG-05 covers the process), client onboarding overview (KB-ONB-01/02), brand guidelines, approved logos, approved case studies, demonstration websites. No testimonials, results or case studies were written.

## Knowledge base (46 drafts)

Source: [KNOWLEDGE-BASE.md](KNOWLEDGE-BASE.md). 32 service and commercial entries from B1.4, plus **14 new partner-programme entries (KB-PROG-01–14)** written in B2.10. Each new entry cites the code that enforces the behaviour or a published fact. Three are `BLOCKED` on founder decisions (KB-PROG-04, KB-PROG-13 and, via the reward, KB-PROG-10/11 as `PROPOSED POLICY`). The new topic `partner-programme` is partner-only and uses the 3-month commercial review cadence.

| Brief question | Entry |
|---|---|
| What does ScaleSmiths do? / What services can I sell? | KB-PROG-01 |
| Who is an ideal client? | C01/C09 lessons; no separate entry (founder input on ideal-client profile welcome) |
| How do I register a prospect? | KB-PROG-03 |
| How does prospect ownership work? | KB-PROG-04 (BLOCKED) |
| How do I request a quote? | KB-PROG-05 |
| What can I promise? | KB-PROG-02 |
| How does commission work? / When payable? / Withdrawals? | KB-COMM-01, KB-COMM-02 (BLOCKED) |
| What if a client cancels? | KB-PROG-13 (BLOCKED), KB-COMM-03 |
| Referrals / achievements | KB-PROG-10, KB-PROG-11 |
| International / approved markets | KB-PROG-09 |
| Discounts | KB-PROG-06 |
| Joint meetings / technical assistance | KB-PROG-07, KB-PROG-08 |
| After a client accepts | KB-PROG-12 |
| Contact ScaleSmiths | KB-PROG-14 |

## Objection handling (12 drafts)

Parsed from R08. All drafts.

## Agreement

No final agreement document is in the repository. See [FOUNDER-LAUNCH-CHECKLIST.md](FOUNDER-LAUNCH-CHECKLIST.md) item 1. No agreement wording was generated.
