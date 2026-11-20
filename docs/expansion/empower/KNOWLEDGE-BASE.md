# Knowledge base: approved-content architecture and article inventory

**Status: DRAFT. No entry is approved or published.** Entries restate published wording where it exists; the approval status says which. Engineering design (data model, search, lifecycle) is in [ARCHITECTURE.md](ARCHITECTURE.md).

## 1. How the knowledge base works

**Purpose:** give partners a precise, approved answer to the questions prospects actually ask, with a line they may say to the client, the limit of that answer, and when to hand over.

**Required fields for every entry** (the service refuses review without them):

| Field | Meaning |
|---|---|
| Question | As a client would ask it, plus aliases |
| Answer | Precise partner-facing answer |
| Client-friendly explanation | Wording a partner may say or send. Contains no partner-only information |
| Source | Repository file and key, or an approved founder document. No source, no entry |
| Limitation | What the answer does not cover or must not be stretched to mean |
| Escalation | `always`, `when <condition>`, or `never`, with the meeting type |
| Approval status | One of the package statuses; later, the recorded approval with reviewer and review-by date |

**Source hierarchy** (highest first): signed agreement or founder decision record → published site source (`published-starting-prices.ts`, `faq-library.ts`, `legal-policies.ts`) → B0 system behaviour → this package's drafts.

**Search approach:** deterministic PostgreSQL full-text search over question, aliases, answer and topic, with a founder-managed synonym list, exact alias matching first and stable ordering. No language model, no embeddings. Only published, in-review-window entries for the caller's audience are searchable. See [ARCHITECTURE.md](ARCHITECTURE.md) section 4.

**Review cadence (proposed, `AP-GOV-06`):** commercial entries every 3 months; service entries every 6 months; any entry immediately when its source file changes. A CI check that flags entries whose source key changed is a Phase 3 candidate.

**Topic taxonomy:** hosting, domains, DNS, business email, website security, analytics, SEO, AI search, WordPress migration, redirects, accessibility, e-commerce, booking systems, CRM, custom software, automation, commercial terms, payment schedules, commission, client onboarding.

## 2. Article inventory

`faq:<key>` refers to `web/src/lib/faq-library.ts`. Status `CONFIRMED: PUBLISHED` applies to the published *wording*; the knowledge entry as a whole remains `DRAFT` until approved.

### Hosting

**KB-HOST-01 Do you provide hosting?**
- Answer: Yes. Published work runs on self-hosted Docker Compose and Nginx on a VPS and on managed platforms such as Vercel, chosen around the workload and support model. Hosting can be part of a build or a standalone managed service.
- Client explanation: "Yes. ScaleSmiths can host your site as part of the build or as a managed service, and they'll document exactly what's covered."
- Source: faq:hosting-provided, faq:hosting-location.
- Limitation: no published hosting price, uptime figure or provider list. Do not quote any.
- Escalation: when the client needs a price, a specific provider or a migration → `technical_scoping`.
- Status: `CONFIRMED: PUBLISHED` wording; entry `DRAFT`.

**KB-HOST-02 Is hosting included in a Growth Partnership?**
- Answer: Not automatically. It can be part of a Growth Partnership or a separate managed service; the order states which applications, environments, monitoring, maintenance and backups are covered.
- Client explanation: "It can be. Your agreement will list exactly what's covered."
- Source: faq:hosting-included.
- Limitation: do not imply hosting is bundled.
- Escalation: never.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

**KB-HOST-03 Are websites backed up?**
- Answer: Backups are part of a managed hosting or maintenance arrangement, and the order states coverage and retention. They reduce risk but do not make loss impossible, and the online terms create no restoration guarantee, recovery point or recovery time.
- Client explanation: "Backups are part of managed hosting, and the agreement says exactly what's covered."
- Source: faq:backups.
- Limitation: no recovery-time or recovery-point promise.
- Escalation: when the client has lost data now → `escalation`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

### Domains and DNS

**KB-DOM-01 Do you manage domains? Do we have to transfer ours?**
- Answer: The client remains the registrant unless a transfer is agreed in writing. ScaleSmiths needs appropriate access to configure records; a transfer is not automatically required. Registration or renewal administration is scoped explicitly if wanted.
- Client explanation: "You keep your domain. ScaleSmiths just needs the right access to set it up."
- Source: faq:domains.
- Limitation: never ask for registrar passwords.
- Escalation: when nobody knows who controls the domain, or it is close to expiry → `technical_scoping`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

**KB-DNS-01 Do you manage DNS?**
- Answer: Yes, where given appropriate access. Email onboarding includes the required mail and authentication records; website and hosting work includes the DNS changes a launch or migration needs. Delegated or scoped access is used where supported, and registrar passwords are never requested through a public form.
- Client explanation: "Yes. ScaleSmiths handles the DNS changes needed, using delegated access rather than your passwords."
- Source: faq:dns.
- Limitation: DNS for unrelated third-party services is not implied.
- Escalation: when DNS is broken now → `escalation`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

### Business email

**KB-EMAIL-01 Do you provide business email?**
- Answer: Managed Business Email starts at £15 per month for three custom-domain mailboxes with 5GB each; initial mailbox and DNS setup is included. Webmail, desktop and mobile compatibility, aliases and forwarding, spam filtering, TLS transport, and SPF, DKIM and DMARC. Available standalone.
- Client explanation: "Yes, from £15 a month for three mailboxes on your own domain, with setup included."
- Source: faq:business-email, `published-starting-prices.ts`, `managed-business-email.ts`.
- Limitation: extra mailboxes are not included unless agreed.
- Escalation: when migrating existing mailboxes → `technical_scoping`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

**KB-EMAIL-02 Why do our emails go to spam?**
- Answer: Most often missing or wrong SPF, DKIM or DMARC records; also free consumer addresses, poor-reputation servers or no sending history. Correct configuration supports deliverability but cannot guarantee inbox placement.
- Client explanation: "Usually it's missing authentication records on your domain. Fixing those helps a lot, though nobody can guarantee every email lands in the inbox."
- Source: faq:email-spam, faq:spf, faq:dkim, faq:dmarc.
- Limitation: no deliverability guarantee.
- Escalation: when business-critical mail is failing now → `technical_scoping`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

### Website security

**KB-SEC-01 Is the website secure? Do you provide SSL?**
- Answer: HTTPS is a build standard, and certificate provisioning and renewal are part of managed hosting and deployment. Application controls (validation, headers, abuse resistance, safe defaults) are part of the build. ScaleSmiths describes controls it designs, builds and operates, and does not imply certifications or guaranteed compliance it does not hold.
- Client explanation: "Yes. HTTPS is standard, and security is built in rather than added at the end."
- Source: faq:ssl, `web/src/lib/security-page.ts`.
- Limitation: no certification, compliance or "unhackable" claims.
- Escalation: always for security questionnaires, procurement, or a suspected incident → `technical_scoping` or `escalation`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

### Analytics

**KB-ANL-01 How will we know it's working?**
- Answer: ScaleSmiths agrees which signals matter for that business (enquiries, calls, Search Console and analytics where access is given) and reviews them in conversation rather than against invented targets. No universal KPI or guaranteed lift is published.
- Client explanation: "You'll agree which measures matter, and review them together."
- Source: faq:improvement-measurement.
- Limitation: no target figures; no published analytics product.
- Escalation: never.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

### SEO

**KB-SEO-01 Can anyone guarantee first place on Google?**
- Answer: No. Rankings depend on Google's systems, competitors and the searcher. Commitments are to the work and to measurement against a baseline.
- Client explanation: see `AP-OBJ-03` in [R08](resources/R08-objection-handling-playbook.md).
- Source: faq:ranking-guarantees.
- Limitation: never imply a position, traffic or revenue figure.
- Escalation: never.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

**KB-SEO-02 Is SEO included in a website build?**
- Answer: Search foundations are part of the build. Ongoing SEO is separate, as a project or through a Growth Partnership.
- Client explanation: "The foundations are built in. Ongoing SEO is a separate, scoped service."
- Source: faq:seo-in-build.
- Limitation: do not describe foundations as "full SEO".
- Escalation: never.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

**KB-SEO-03 How long does SEO take?**
- Answer: Varies with the starting point. Technical fixes can change indexation quickly; content and authority work is measured over months.
- Client explanation: "Technical fixes can help quickly; the bigger gains build over months."
- Source: faq:seo-timeline.
- Limitation: no fixed timescale.
- Escalation: never.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

**KB-SEO-04 Why isn't our website on Google?**
- Answer: Usually not indexed (robots rules, noindex, a staging setting), not matching searches, or competing above its authority. Search Console separates these; the audit starts there.
- Client explanation: "There are a few usual causes, and an audit can tell which one quickly."
- Source: faq:not-on-google, faq:seo-existing-site.
- Limitation: do not diagnose from outside.
- Escalation: when suspected de-indexing of a live business site → `technical_scoping`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

### AI search

**KB-AIS-01 Can you get us recommended by ChatGPT or AI search?**
- Answer: ScaleSmiths builds pages that answer buyer questions directly, keep facts consistent and use structured data and FAQ content ("SEO/AEO landing pages"). Nobody controls or can guarantee what third-party AI systems say or cite.
- Client explanation: "Clear, well-structured answers help AI tools understand your business, but nobody can guarantee what they'll say."
- Source: `web/src/lib/service-pages.ts` (SEO/AEO landing pages). No FAQ answer exists.
- Limitation: no inclusion, citation or ranking claims for any AI product.
- Escalation: never.
- Status: `DRAFT`, `FOUNDER DECISION` (`AP-CNT-06`: new wording).

### WordPress migration

**KB-MIG-01 Can you move us off WordPress (or Shopify, Wix)?**
- Answer: Often, after a technical review of the current code, licences, data, deployment and connected services. ScaleSmiths first reviews what the current site does well, then recommends a rebuild, repair or migration. Pinkys Prints (Shopify to custom, self-hosted) is a published example.
- Client explanation: "Usually, yes. ScaleSmiths reviews what you have first, then recommends the right route."
- Source: faq:website-migration, faq:rebuilds, faq:wordpress (*owner review*).
- Limitation: no price or timeline; not every migration is advisable.
- Escalation: always → `technical_scoping`.
- Status: `CONFIRMED: PUBLISHED, OWNER REVIEW`; entry `DRAFT`.

### Redirects

**KB-RED-01 Will we lose rankings if we rebuild?**
- Answer: Any rebuild carries some risk and nobody can guarantee rankings. Risk is reduced by URL mapping with redirects, carrying over performing content, preserving metadata and structured data, and checking indexing after launch.
- Client explanation: see `AP-OBJ-06`.
- Source: faq:seo-rebuild (*owner review*).
- Limitation: no "no loss" promise.
- Escalation: always for migrations → `technical_scoping`.
- Status: `CONFIRMED: PUBLISHED, OWNER REVIEW`; entry `DRAFT`.

### Accessibility

**KB-ACC-01 Will the website be accessible?**
- Answer: Accessibility and clarity are treated as delivery requirements, and the Business Growth Audit reviews accessibility fundamentals. No published statement commits to a specific WCAG conformance level.
- Client explanation: "Accessibility is part of how ScaleSmiths builds. If you need a specific standard, ScaleSmiths will confirm it in the proposal."
- Source: `web/src/lib/enterprise-websites-page.ts`, `web/src/lib/business-growth-audit.ts`.
- Limitation: do not claim WCAG 2.2 AA conformance or legal compliance.
- Escalation: when a client requires a conformance level or an accessibility statement → `technical_scoping`.
- Status: `DRAFT`, `FOUNDER DECISION` (`AP-CNT-07`: whether to publish a standard).

### E-commerce

**KB-ECOM-01 Do you build online shops?**
- Answer: Yes. Pinkys Prints is a custom e-commerce platform with catalogue variants and a tailored product admin. Custom commerce is recommended only when its operational value justifies owning it; otherwise configuring an established platform is usually better.
- Client explanation: "Yes, and ScaleSmiths will tell you honestly whether a custom shop or an established platform suits you better."
- Source: faq:ecommerce-builds.
- Limitation: no price; payment handling stays with the provider.
- Escalation: always → `technical_scoping`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

### Booking systems

**KB-BOOK-01 Can you add online booking?**
- Answer: Published work includes a Salon Tracker booking integration for Glow Tanning and booking and quote workflows in custom web development. ScaleSmiths checks the existing system's API, data and ownership before committing.
- Client explanation: "Often, yes. ScaleSmiths checks what your current booking system allows first."
- Source: faq:integrations, faq:custom-web-development.
- Limitation: not every tool exposes what an integration needs.
- Escalation: always → `technical_scoping`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

### CRM

**KB-CRM-01 Can you build us a CRM?**
- Answer: Yes, where an off-the-shelf CRM does not fit. Confirm-A-Kill runs on a private PostgreSQL-backed CRM; CSDS has a quote management admin. If an existing CRM fits, connecting the website to it is often the better investment.
- Client explanation: "Yes, if your workflow needs it. Sometimes connecting your existing CRM is the better option, and ScaleSmiths will say so."
- Source: faq:crm (*owner review*).
- Limitation: no price or timeline.
- Escalation: always → `bespoke_discovery`.
- Status: `CONFIRMED: PUBLISHED, OWNER REVIEW`; entry `DRAFT`.

### Custom software

**KB-SW-01 When is custom software worth it?**
- Answer: When the workflow differentiates the business, existing tools cause material friction, or integration and data-ownership needs cannot be met by configuration. Otherwise buy and integrate.
- Client explanation: "When it genuinely fits how you work better than anything you can buy."
- Source: faq:custom-software.
- Limitation: never sold against a starting price.
- Escalation: always → `bespoke_discovery`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

**KB-SW-02 Can it be done in phases?**
- Answer: Yes. Essential launch scope is separated from later improvements, so the first release is dependable and further work follows evidence.
- Client explanation: "Yes. Start with what matters most, then build on it."
- Source: faq:phases, faq:software-scaling.
- Limitation: phase boundaries are set in the proposal.
- Escalation: never.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

### Automation

**KB-AUTO-01 Can you automate our processes? Do you use AI?**
- Answer: Yes, starting with one bounded workflow. High-consequence steps keep a human review point and a record. Deterministic rules and integrations are often safer and cheaper than a language model; AI is used where interpretation is genuinely required.
- Client explanation: "Yes, one workflow at a time, keeping people in control of the important decisions."
- Source: faq:process-automation.
- Limitation: no promise of savings or headcount reduction.
- Escalation: always → `bespoke_discovery`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

### Commercial terms

**KB-TERMS-01 How much does a website cost?**
- Answer: From £2,000, as a starting point for an agreed scope. Audit £395; Growth Partnership from £350 per month; email from £15 per month. GBP. Always with the starting-price boundary.
- Client explanation: the published wording in [R11](resources/R11-commercial-pricing-reference.md).
- Source: faq:cost, faq:project-pricing, `published-starting-prices.ts`.
- Limitation: no estimates beyond the starting prices.
- Escalation: when the client wants a price → quote request or `commercial_assistance`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

**KB-TERMS-02 Who owns the website and code?**
- Answer: Per the signed project documents; transfer once agreed fees are paid. Clients keep their materials, trademarks and data; ScaleSmiths keeps pre-existing tools and know-how; open-source stays under its licences.
- Client explanation: see `AP-OBJ-08`.
- Source: faq:website-ownership, faq:code-ownership.
- Limitation: do not interpret contract clauses.
- Escalation: when specific contract terms are asked → `commercial_assistance`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

### Payment schedules

**KB-PAY-01 Do you need a deposit? Can we pay in instalments?**
- Answer: Payment terms, including any staged or upfront payment, are set in each proposal and signed order. There is no published blanket policy.
- Client explanation: "Payment terms are set out in your proposal before anything is committed."
- Source: faq:deposit.
- Limitation: partners must not describe schedules. The draft programme schedules (equal instalments; deposit and completion) are `PROPOSED POLICY` and internal.
- Escalation: always when a client asks for a specific schedule → `commercial_assistance`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`. Internal schedules: `FOUNDER DECISION`.

### Commission (partner only)

**KB-COMM-01 How is my commission calculated?**
- Answer: Proposed: 30% of eligible, verified, collected payments (ex VAT); build fee plus first Growth Partnership payment for standard plans; bespoke per approved terms. See [R12](resources/R12-commission-and-payment-reference.md).
- Client explanation: none. Partner only; never discuss with clients.
- Source: `partner-programme.ts`, [COMMISSION-RULES.md](../COMMISSION-RULES.md).
- Limitation: not an entitlement until the agreement and plan are approved and enabled.
- Escalation: when a partner disputes a figure → `commercial_assistance`.
- Status: `PROPOSED POLICY`, `BLOCKED`.

**KB-COMM-02 When and how do I get paid?**
- Answer: Not decided. Withdrawal requests are built but not operational; frequency, minimum, invoicing and VAT are open decisions.
- Client explanation: none.
- Source: [PROGRAMME-ALIGNMENT.md](../intelligence/PROGRAMME-ALIGNMENT.md), [FOUNDER-DECISIONS.md](../intelligence/FOUNDER-DECISIONS.md).
- Limitation: no date or method may be stated.
- Escalation: `commercial_assistance`.
- Status: `FOUNDER DECISION`, `BLOCKED`.

**KB-COMM-03 What happens to commission if a client gets a refund?**
- Answer: Currently held for founder review; nothing deducted automatically. Final treatment is an open legal and accounting decision.
- Client explanation: none.
- Source: [COMMERCIAL-INTEGRATION.md](../intelligence/COMMERCIAL-INTEGRATION.md).
- Limitation: do not speculate.
- Escalation: `commercial_assistance`.
- Status: `FOUNDER DECISION`, `BLOCKED`.

### Client onboarding

**KB-ONB-01 What happens after the client enquires?**
- Answer: The founders review it and reply with a next step: questions, the Business Growth Audit or a proposal. Sending a form takes no payment and creates no contract.
- Client explanation: "ScaleSmiths will review it and come back with a sensible next step. Nothing is committed until you sign a proposal."
- Source: faq:after-enquiry.
- Limitation: no response-time promise.
- Escalation: never.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

**KB-ONB-02 What do you need from us to start?**
- Answer: What they sell, who buys, how customers choose, what the current site does well, available evidence; content, imagery, brand assets; access to domain, hosting and integrated systems.
- Client explanation: as answer.
- Source: faq:project-inputs.
- Limitation: never collect passwords.
- Escalation: never.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

**KB-COM-01 Do you work with businesses outside Nottingham?**
- Answer: Yes, across the UK; published work includes CSDS in Pennsylvania. Remote delivery with an agreed review cadence. No overseas offices claimed. GBP.
- Client explanation: "Yes. ScaleSmiths works with businesses across the UK, remotely where needed."
- Source: faq:outside-nottingham.
- Limitation: partner-introduced customers outside an approved market cannot be contracted.
- Escalation: when the customer is outside the UK → `commercial_assistance`.
- Status: `CONFIRMED: PUBLISHED`; entry `DRAFT`.

## 3. Gaps found (no published source yet)

| Topic | Gap | Register item |
|---|---|---|
| AI search | No FAQ answer | `AP-CNT-06` |
| Accessibility | No stated conformance level | `AP-CNT-07` |
| VAT on client prices | No partner-facing wording | `AP-COM-07` |
| Hosting price | None published | `AP-CNT-08` |
| Analytics setup | No standard (which tool, consent) for client sites | `AP-CNT-09` |
