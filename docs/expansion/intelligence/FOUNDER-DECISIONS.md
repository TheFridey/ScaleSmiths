# Founder decision register (Operation Intelligence)

Columns: blocks recruitment (R), activation (A), financial operations (F). Owner shown is the responsible founder or adviser. No proposed benefit here is binding policy.

| Decision | Why it matters | Options | Owner | R | A | F |
|---|---|---|---|---|---|---|
| Final independent partner agreement | Basis of status and terms | Draft with counsel | Founders, legal | Y | Y | Y |
| Twelve-month terms and eligible payment definitions | Defines earned commission | Adopt `standard-v2` as drafted or amend | Founders, accounting | N | Y | Y |
| Default and flexible payment schedules, limits | Bounds what partners may offer | Fixed list, or founder-approved per deal | Founders | N | Y | Y |
| Bespoke eligibility, existing-customer attribution | Prevents disputes | Documented attribution at registration | Founders | N | Y | Y |
| Discount allowance quantity and eligibility, free-build criteria | Controls margin | Per-partner monthly pool; stays disabled until set | Founders | N | N | Y |
| Achievement qualification, refund impact, payment timing | Avoids unintended liability | Net of refunds after N days | Founders, accounting | N | N | Y |
| Referral qualification | Avoids hierarchy and fraud | As proposed or amended | Founders, legal | N | N | Y |
| Withdrawal frequency, minimum, invoicing, VAT | Payout rules | Monthly, minimum threshold | Founders, accounting | N | Y | Y |
| Refund and clawback semantics | Commission after refunds | Existing review hold, or contractual clawback | Founders, accounting | N | Y | Y |
| Lead protection, prospect allocation, sector exclusivity | Partner conflicts | Defined terms | Founders, legal | N | Y | N |
| Country eligibility, international pricing, currency | Market risk | Start UK-only, approve markets one by one | Founders, legal, tax | Y (claims) | Y | Y |
| Email provisioning, CircleCard, personal pages, Founding Partner | Fulfilment promises | Manual tracking first | Founders | N | N | N |
| Approved service scope, Academy materials | Prevents misselling | Written service catalogue | Founders | N | Y | N |
| AI provider, budget, data-processing agreement | Cost and data risk | Keep disabled | Founders, privacy | N | N | N |
| Audit execution infrastructure | SSRF risk | Isolated egress-restricted runner | Founders, engineering | N | N | N |
| Legal, accounting, privacy approval; recruitment launch; activation; production deployment | Release gates | See hardening release runbook | Founders | Y | Y | Y |
| Enabling each commercial plan (`standard-v2`, `growth-only-v1`, `bespoke-v1`) | Plans start disabled and cannot accept contracts | Enable per plan after agreement and accounting review | Founders, accounting | N | Y | Y |
| Custom payment schedules (e.g. four £500 instalments) | Synthetic example only; custom schedules need a recorded approval reference | Allow per deal, or catalogue approved schedules | Founders | N | Y | Y |
| Pooled-build rounding for new plans | Differs deliberately from historical per-milestone rounding | Confirm before activation | Accounting | N | N | Y |
| Additional-business attribution evidence standard | What counts as documented partner contribution | Introduction record, meeting notes, joint sign-off | Founders | N | Y | Y |
| Withdrawal policy (enable, minimum, invoice requirement, frequency, methods) | No policy exists, so partners cannot request withdrawals | Enable with documented minimum and invoicing | Founders, accounting | N | N | Y |
| Treatment of earned commission after later refunds | Currently held for review, never auto-deducted | Contractual clawback, or retention | Founders, accounting, legal | N | Y | Y |
| Approving each customer market and its permitted plans | Nothing can be accepted in any market until approved | Approve UK first, others one by one | Founders, legal, tax | N | Y | Y |
| Exclusivity vocabulary and recording standard | Matching is string-based and conservative | Controlled sector/area lists | Founders | N | Y | N |
| Geographic area taxonomy for exclusivity matching | Founders define the areas they want matched and how they nest (migration 0088); anything undefined goes to review | Define the real areas and aliases (regions, counties, towns) and confirm sibling areas do not overlap | Founders | N | Y | N |
| Applicant residence versus operating market versus customer market | Modelled (migration 0085). Residence is information only; the operating market gates invitation, activation and progression; the customer market gates progression, scope approval and acceptance. The operating-market default is the UK (GB) but authorises nothing until a founder approves that market | Confirm the rule and which international applicants may be considered | Founders, legal | Y (claims) | Y | N |
| Achievement qualification rules (minimum payment, duration, refund/cancellation effect, common ownership, additional-customer and bespoke treatment) | Defaults are manual review, one count per canonical client | Decide before approving a programme version | Founders, accounting, legal | N | N | Y |
| Approving a programme version and enabling financial or referral rewards | Disabled by default; the database refuses reward approval otherwise | Approve in writing after accounting review | Founders, accounting | N | N | Y |
| Whether to record referrals at application time | Today a founder records attribution before activation | Add a referral code to the public form | Founders, privacy | Y | N | N |
| Sector taxonomy and exclusivity recording standard | Classified sectors decide by id; unclassified fall back to review | Define sectors and aliases before relying on matching | Founders | N | Y | N |
| Toolkit fulfilment standard and external services (email, CircleCard) | Tracked manually; no provisioning exists | Approve providers and costs separately | Founders | N | N | N |
| Researched prospect screening standard and volume per partner | Screening needs a founder's recorded evidence and is never inferred. No cap or promise: the programme intends roughly 20 to 30 researched businesses per partner, subject to availability | Write the screening standard; decide the volume | Founders, privacy | Y | N | N |
| Founding Partner benefits and wording | Founder-controlled; no threshold, no automatic grant; wording that implies equity, ownership, directorship, employment or guaranteed income is refused | Approve the benefit list and the badge wording | Founders, legal | Y | N | N |
| Personal webpage consent wording, privacy notice and publication | Consent text profile-consent-v2 is a draft. Publication is off in both apps unless PARTNER_PROFILE_PUBLICATION_ENABLED and PUBLIC_PARTNER_PROFILES_ENABLED are set. Pages are noindex | Approve consent text and privacy notice; decide indexing; decide the enquiry route | Founders, legal, privacy | Y | N | N |
| Partner photographs on profiles | **Not built**: no secure upload, scanning or storage pipeline exists, so photographs are unsupported rather than approximated | Decide whether to build asset handling | Founders, privacy | N | N | N |
