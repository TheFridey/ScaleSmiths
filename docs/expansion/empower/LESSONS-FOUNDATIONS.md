# Initial lesson content: courses 1 to 6

**Status: DRAFT. Not approved, not published, not for use with partners or clients.** Every lesson needs founder approval before publication (see [FOUNDER-APPROVAL-REGISTER.md](FOUNDER-APPROVAL-REGISTER.md)). Lesson structure is in [CURRICULUM.md](CURRICULUM.md).

Conventions:

- **Sources** lists the repository files a lesson relies on. `faq:<key>` means the entry with that key in `web/src/lib/faq-library.ts`.
- **Say it like this** gives client-safe phrasing taken from published wording.
- Text marked *[PROPOSED POLICY]* or *[FOUNDER DECISION]* must keep that label until the decision is recorded.

---

## C01 Welcome to ScaleSmiths

### C01-L1 The ScaleSmiths story in plain words

**Sources:** faq:outside-nottingham, faq:established-businesses, faq:wordpress, `web/src/lib/data.ts`.

ScaleSmiths is a web and software studio based in Hucknall, Nottinghamshire. It works with businesses across the UK and, remotely, with some businesses overseas. Its published work is custom-built: websites and platforms using technologies such as Next.js, React, Astro, Node.js and PostgreSQL rather than WordPress themes.

Most of its client work is with established businesses: organisations that already have customers, a reputation and some evidence (search rankings, enquiries, existing systems) worth protecting. The work usually starts by understanding what already performs before changing anything.

What makes ScaleSmiths different is less about technology and more about honesty and accountability. It writes scope down, it does not promise rankings or results it cannot control, and it says plainly when a cheaper or simpler option would serve the client better.

**Say it like this:** "ScaleSmiths is a Nottinghamshire web and software studio. They build custom websites and systems for established businesses, and they are very clear about what is included and what is not."

**Avoid:** "the best agency", "guaranteed results", "we" (you are not ScaleSmiths staff; see C12), any claim of offices or regional expertise outside what is published.

### C01-L2 What we sell

**Sources:** `web/src/lib/published-starting-prices.ts`, `web/src/lib/engagement-models.ts`.

ScaleSmiths publishes four starting points:

| Offer | Published price |
|---|---|
| Website design and development | From £2,000 |
| Growth Partnership | From £350 per month |
| Business Growth Audit | £395 |
| Managed Business Email | From £15 per month (three 5GB mailboxes, setup included) |

It also takes on established-business transformation and custom platforms. These are **never** sold against a website starting price and are scoped after discovery.

A starting price is exactly that. The published boundary reads: "A starting price is the entry point for an agreed scope. It is not unlimited development, marketing, support, integrations or a guaranteed result." Prices are in GBP only. ScaleSmiths does not bill in other currencies or publish converted prices.

**Rule:** quote only these four figures, always with the boundary. Anything else is a ScaleSmiths proposal.

### C01-L3 How we work

**Sources:** faq:after-enquiry, faq:timeline, faq:phases, faq:improvement-measurement.

1. **Enquiry.** The founders review what is sent and reply with a sensible next step: questions, a recommendation to start with the Business Growth Audit, or a proposal. Sending a form takes no payment and creates no contract.
2. **Discovery.** What the business sells, who buys, how they choose, what the current site does well, and what evidence exists.
3. **Written proposal.** Scope, deliverables, delivery range and assumptions, and payment terms.
4. **Phased delivery.** A dependable first release; later work follows evidence.
5. **Measurement.** Agreed signals, reviewed in conversation, not invented targets.

### C01-L4 What an independent partner does

**Sources:** `/partners` page copy (`web/src/app/partners/page.tsx`, draft, not approved), [PARTNER-OPERATIONS.md](../intelligence/PARTNER-OPERATIONS.md).

As an independent partner you introduce suitable businesses, have early conversations, register prospects in the Partner Portal and support the relationship. ScaleSmiths scopes, prices, contracts and delivers the work.

You decide how, when and whether you work. There is no salary, guaranteed income, compulsory working hours or sales target. *[PROPOSED POLICY: the final partner agreement defines the relationship. This lesson must be checked against it.]*

You do **not**: issue quotes, agree discounts, promise timelines, sign anything on ScaleSmiths' behalf, or handle client payments.

### C01-L5 What is live, proposed and planned

**Sources:** `FEATURE_AVAILABILITY` in `web/src/lib/partner-programme.ts`.

The programme uses four labels: **Available subject to approval**, **Planned**, **In development** and **Not available in this market**. Read them literally:

- *Available subject to approval* means designed but dependent on the final agreement and approvals.
- *Planned* means not built or not operational, with no date.
- *In development* means being built, not yet available.

In the portal, content carries its own status: only approved, published items are shown, each with a version and review date. If you remember something from a conversation that is not in an approved item, it is not policy.

### C01-L6 Finding answers fast

Start with knowledge search. Type the question as the client asked it ("do you do hosting?"). Results show approved answers with three parts: the precise answer for you, a client-friendly explanation you may use, and the limitation. If an entry says **Escalate**, follow the route it names.

Ribbons tell you what you may share: **Client-facing: approved for sharing** or **Partner only: do not share**.

### C01-L7 Getting help

Use a meeting request in the portal. The types are joint sales, technical scoping, bespoke discovery, commercial assistance, proposal review, training and escalation. Give one to five preferred times and your time zone. ScaleSmiths confirms, proposes an alternative or asks for information. Nothing is booked until it is confirmed.

Send: the business name, what they asked, what you have already said, and any deadline the client mentioned.

---

## C02 Professional Website Development

### C02-L1 What a website project includes

**Sources:** faq:website-included, faq:seo-in-build.

A typical project covers agreed messaging, page structure, a responsive build, on-page search foundations (metadata, canonicals, structured data, headings, internal links, indexation controls, page speed) and a route from visitor to enquiry, plus launch support for that scope. **The proposal is the list of what is included.**

### C02-L2 What is separate

Hosting, ongoing SEO, content programmes, integrations and open-ended support are separate unless the proposal includes them. Managed Business Email is separate unless a combined arrangement is written in. This is not a trick; it is what keeps prices honest.

**Say it like this:** "The build includes the search foundations. Ongoing SEO and support are separate, and the proposal spells out exactly what's in."

### C02-L3 Price and proposal

Website design and development starts **from £2,000**. A quote is calculated from requirements, the complexity of journeys and systems, and the deliverables written into the proposal. Never estimate a final price yourself. If a prospect pushes for a number, say the published starting price, explain the boundary and offer a proper quote or the Business Growth Audit.

### C02-L4 Timelines

**Source:** faq:timeline. Timing is confirmed after discovery because content readiness, integrations, review cycles and technical risk change the schedule more than page count. The proposal records the range and its assumptions. **Do not give a timeline.**

### C02-L5 Ownership and editing

**Sources:** faq:website-ownership, faq:code-ownership, faq:self-editing.

Ownership of the bespoke deliverable is set out in the signed project documents and transfers once agreed fees are paid. Clients keep their own materials, trademarks and data. ScaleSmiths keeps its pre-existing tools and know-how, and open-source components stay under their own licences.

Self-editing is a scoping decision: an editable content layer is worth building when content changes often. Ask the client what they expect to change, and how often.

### C02-L6 Technology and WordPress

**Source:** faq:wordpress (*owner review flagged*). Published work is custom-built rather than WordPress themes. If a client runs WordPress, ScaleSmiths looks at what it does well before recommending whether a rebuild is justified. Never criticise a client's current platform or supplier.

### C02-L7 Good-fit signals

An established business with clear services; a site that no longer reflects the business; enquiries that matter commercially; evidence worth protecting; an owner willing to engage with discovery. Weaker fit: wants the cheapest possible page, wants guaranteed rankings, or cannot give time to review.

### C02-L8 When it is not a standard website

Route these to ScaleSmiths before saying anything about price: e-commerce (faq:ecommerce-builds: custom commerce only where its value justifies owning it), booking or quote workflows, customer portals, payments, integrations, migrations and anything with user accounts. Request **technical scoping**.

---

## C03 SEO and Digital Growth

### C03-L1 What SEO is

**Source:** faq:what-is-seo. SEO makes a website findable, understandable and worth choosing in search results. It has three parts: technical foundations that let search engines crawl and index pages, content that answers what people actually search for, and an on-page experience that turns a click into an enquiry. It is ongoing work, not a setting.

### C03-L2 Local SEO

**Source:** faq:what-is-local-seo. Local SEO targets people looking for a provider in a place. It depends on clear service and area descriptions, consistent business details across the web, a Google Business Profile that supports the site, and visible local proof.

### C03-L3 Technical SEO

**Source:** faq:technical-seo. Crawlability and robots rules, canonical URLs, sitemaps, redirects, structured data, heading hierarchy, mobile rendering, Core Web Vitals and HTTPS. It rarely wins attention on its own, but content cannot perform if the technical layer works against it.

### C03-L4 Timescales and guarantees

**Sources:** faq:seo-timeline, faq:ranking-guarantees.

Technical fixes can change indexation quickly. Content and authority work is measured over months. **No one can guarantee first place on Google**, because rankings depend on Google's systems, competitors and the searcher.

**Say it like this:** "No honest agency can promise a position. What ScaleSmiths commits to is the work: technical health, content that matches real searches, credible proof, and measuring progress against a recorded baseline."

### C03-L5 Build versus ongoing

Search foundations are part of every build. Ongoing SEO (content, authority, measurement and iteration) is separate, scoped as a project or through a Growth Partnership.

### C03-L6 SEO and paid search

**Source:** faq:seo-and-google-ads. Ads buy visibility immediately and stop when the budget does; SEO compounds slowly. The right mix depends on urgency, margin and competition. ScaleSmiths will say when paid search is the more honest answer.

### C03-L7 What AI search and AEO mean

**Sources:** service listing "SEO/AEO landing pages" (`web/src/lib/service-pages.ts`), `web/src/lib/agent-discovery.ts`. *[FOUNDER DECISION `AP-CNT-06`: no published FAQ answer covers AI search yet. This lesson is new wording.]*

People increasingly ask AI assistants and AI-generated search summaries for recommendations. Answer engine optimisation (AEO) means making a site's content easy for those systems to understand and cite: pages that answer a buyer's real question directly, consistent facts, structured data and FAQ content, and clear service and location pages. ScaleSmiths builds pages this way and describes its own capabilities accurately in machine-readable form.

What you must not say: that ScaleSmiths can get a business "into ChatGPT", guarantee being cited, or control what any AI system says. Those systems are run by third parties and change often.

**Say it like this:** "Clear, well-structured answers help both search engines and AI assistants understand a business. Nobody can guarantee what an AI tool will say, but we can make sure your site gives it accurate, useful answers to work from."

### C03-L8 Diagnosing "not on Google"

**Source:** faq:not-on-google. The usual causes, in order: pages not indexed (robots rules, a noindex tag or a staging setting left on); indexed but not matching what people search for; or competing for terms far above the site's authority. Search Console usually separates these quickly, which is why the Business Growth Audit starts there.

---

## C04 Growth Partnerships

### C04-L1 What a Growth Partnership is

**Sources:** `web/src/app/digital-growth-partnership/page.tsx`, faq:support-included.

An ongoing partnership that can cover SEO, conversion, content, analytics, automation and technical support, whether or not ScaleSmiths built the current site. The proposal defines priorities, working cadence, responsibilities and commercial terms.

### C04-L2 What it is not

It is not an unlimited marketing package, not just maintenance, and not a promise of results. Maintenance protects dependable operation; SEO, content, design changes and integrations are improvement work and are scoped as such.

### C04-L3 Price and term

The published price is **from £350 per month**. The proposal sets the final scope and price. *[PROPOSED POLICY: the draft programme models a twelve-month minimum term (`standard-v2`, disabled). Whether, and how, a minimum term is presented to clients is founder decision `AP-COM-03`. Until then, do not mention a term.]*

### C04-L4 Roadmap and priorities

**Source:** faq:request-priority. Work follows an agreed roadmap and a prioritised backlog, not a first-come queue. Incidents affecting a live service come first. Clients raise and track requests in the ScaleSmiths client portal.

### C04-L5 Hosting, email and monitoring

**Sources:** faq:hosting-included, faq:monitoring. Hosting can be part of a Growth Partnership or a separate managed service; the order states what is covered. Monitoring is scoped to the actual stack. Business email is separate unless combined in writing.

### C04-L6 After a build

**Source:** faq:support. Launch is a measurement point, not the end. The production site is verified, measurement connected and ownership of accounts agreed. A Growth Partnership can then continue the work.

### C04-L7 Existing websites

**Source:** faq:manage-external-site. ScaleSmiths can often manage a site it did not build, after reviewing its code, hosting, access and update path. That review may identify prerequisite repairs, or show the platform needs its original specialist. It will not take on an unknown system blind.

---

## C05 Website Migration

### C05-L1 Types of migration

A platform rebuild (for example WordPress or Shopify to custom), a hosting move, a domain change, or a content-management change. Each has different risks. Many projects combine several.

### C05-L2 WordPress and Shopify moves

**Sources:** faq:website-migration, faq:rebuilds. ScaleSmiths reviews current code, licences, data, deployment and connected services first, then recommends a rebuild, a focused repair or a migration, whichever the evidence supports. Pinkys Prints is a published example: a Shopify store rebuilt as a custom platform and moved onto self-hosted infrastructure.

### C05-L3 Redirects and search risk

**Source:** faq:seo-rebuild (*owner review flagged*). Any rebuild carries some search risk and nobody can honestly guarantee rankings. Risk is reduced by mapping old URLs to new ones with redirects, carrying over content that performs, preserving metadata and structured data, and checking indexing after launch.

### C05-L4 What to collect

Who controls the domain and registrar; current hosting; access to the site's admin; Google Search Console and analytics access (if any); a list of integrations (forms, booking, payments, email marketing); any plugin or theme licences; and the business's deadline (for example a hosting contract ending).

### C05-L5 Red flags

Nobody knows who controls the domain; the domain is close to expiry; the previous supplier holds all access; unlicensed or abandoned plugins; data held only in the old platform; a hard deadline within weeks. None of these is a reason to walk away, but every one is a reason to escalate early.

### C05-L6 Escalation

Every migration goes to **technical scoping** before any price or timeline is discussed. Share what you collected in C05-L4.

---

## C06 Bespoke Software and Automation

### C06-L1 Custom versus off the shelf

**Source:** faq:custom-software. Custom software is justified when the workflow genuinely differentiates the business, when existing tools create material friction, or when integration and data-ownership needs cannot be met by configuration. If a proven product already fits, buying and integrating it is usually better, and ScaleSmiths will say so.

### C06-L2 What we have built

**Sources:** faq:crm (*owner review flagged*), faq:customer-portals, faq:stripe, faq:integrations, faq:internal-admin-systems.

Published examples, described as the FAQ library describes them:

- a private PostgreSQL-backed CRM for Confirm-A-Kill (enquiries, customers, properties, quotations, appointments, jobs, visits);
- a quote management admin behind the CSDS website;
- Stripe subscription billing for The Business Circle; plans, seats and credits for Prymal;
- booking integration and review aggregation for Glow Tanning;
- product and catalogue administration for Pinkys Prints;
- member and admin applications for VeteranFinder;
- ScaleSmiths' own client portal, with tenant isolation enforced on the server.

Describe what was built. Do not quote outcomes, figures or client opinions unless an approved resource contains them (`AP-PROOF-01`).

### C06-L3 Automating a workflow

**Source:** faq:process-automation. Start with one bounded workflow whose owner, inputs, exceptions and useful outcome can be defined. Good automation removes repeated handling while keeping the decisions people still need to make; high-consequence steps keep a human review point and a record.

### C06-L4 Spreadsheets and manual processes

**Source:** faq:replace-spreadsheets. Replace gradually, beginning with the highest-friction workflow. Rebuilding everything at once is the common failure.

### C06-L5 AI, honestly

Deterministic rules and integrations are often safer and cheaper than a language model. AI is used where interpretation is genuinely required. Do not sell "AI" as a feature in itself.

### C06-L6 Phases and scoping

**Sources:** faq:phases, faq:software-scaling, `engagement-models.ts`. Custom work is scoped after discovery and never priced against a website starting price. The first release has a defined boundary; later phases extend a system that is understood.

### C06-L7 Bespoke discovery requests

Request a **bespoke discovery** meeting when the client describes a workflow, system or integration rather than a website. Include: the workflow in the client's words, the people involved, current tools, rough volumes, what goes wrong today, and any deadline. *[PROPOSED POLICY: bespoke commission eligibility and existing-customer attribution are open founder decisions.]*
