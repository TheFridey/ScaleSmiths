/**
 * Every answer ScaleSmiths publishes to a question buyers genuinely ask, in one place.
 *
 * `/faq` renders the whole library grouped by category (see faq-knowledge-base.ts). Service,
 * location and landing pages select the subset relevant to their intent rather than repeating
 * one block everywhere, so a question is written once and stays consistent wherever it appears.
 *
 * Every answer must stay consistent with published evidence (data.ts, pricing claims, the
 * managed-email service record and the legal terms). Where working practice is defined per
 * engagement rather than published, the answer says so and points at contact instead of
 * inventing policy. Answers marked `ownerReview` describe practice the founders should confirm
 * before it is expanded; see docs/SEO_ARCHITECTURE.md.
 */

export interface LibraryFaq {
  q: string
  a: string
  /** Service routes that answer this question in depth. Must exist in serviceRouteCatalogue(). */
  services?: readonly string[]
  /** Published insight slugs that expand on this answer. */
  insights?: readonly string[]
  ownerReview?: boolean
}

export const faqLibrary = {
  // ---------------------------------------------------------------- web design
  cost: {
    q: "How much does a business website cost?",
    a: "It depends on scope, content, integrations and delivery risk, so every project receives a written proposal after discovery. Any current verified price guidance is published on the pricing page rather than quoted as a generic range.",
    services: ["/pricing", "/web-design-nottingham"],
    insights: ["how-much-does-a-business-website-cost-uk-2026", "why-cheap-websites-often-become-expensive"],
  },
  timeline: {
    q: "How long does a website take to build?",
    a: "Timing is confirmed after discovery, because content readiness, integrations, review cycles and technical risk change the schedule more than page count does. The proposal records the delivery range and the assumptions behind it.",
    services: ["/web-design-nottingham", "/services"],
    insights: ["how-long-does-it-take-to-build-a-business-website"],
  },
  "website-ownership": {
    q: "Do I own my website?",
    a: "Ownership of the bespoke deliverable, along with content, accounts and any third-party services, is set out in the signed project documents, and transfer follows once the agreed fees are paid. ScaleSmiths keeps its own pre-existing tools, frameworks and know-how, and open-source components stay under their own licences. The client service terms state this in full.",
    services: ["/services"],
  },
  "self-editing": {
    q: "Can I edit my website myself?",
    a: "Where self-service editing matters, we build for it — published work includes a JWT-secured admin panel for Glow Tanning and a custom product admin for Pinkys Prints. How much you can edit is a scoping decision: an editable content layer is worth building when content changes often, and unnecessary when it does not. Tell us what you expect to change and how often, and the proposal says exactly what will be editable.",
    services: ["/web-development-nottingham", "/custom-web-app-development-uk"],
  },
  wordpress: {
    q: "Does ScaleSmiths use WordPress?",
    a: "The websites and platforms in our published work are custom builds using technologies such as Next.js, React, Astro, Node.js and PostgreSQL rather than WordPress themes. If you already run WordPress, we look at what it is doing well before recommending whether a rebuild is justified.",
    services: ["/next-js-agency-uk", "/web-design-nottingham"],
    insights: ["custom-website-vs-wordpress-vs-wix", "nextjs-vs-wordpress-for-business-websites", "why-scalesmiths-builds-custom-websites"],
    ownerReview: true,
  },
  rebuilds: {
    q: "Can you rebuild my existing website?",
    a: "Yes. We start by reviewing what the current site already does well — pages that rank, enquiries it generates, integrations and hosting — and then recommend a rebuild, a focused repair or a migration, whichever the evidence supports.",
    services: ["/website-redesign-nottingham", "/seo-website-audit"],
    insights: ["signs-your-business-website-needs-rebuilding", "website-redesign-vs-website-refresh"],
  },
  "hosting-provided": {
    q: "Do you provide hosting?",
    a: "Yes. Published work runs on self-hosted Docker Compose and Nginx setups on a VPS as well as managed platforms such as Vercel, chosen around the workload and the support model rather than sold as an anonymous storage allowance. Hosting can be arranged as part of a build or as a managed service on its own.",
    services: ["/managed-website-hosting"],
    insights: ["website-hosting-explained"],
  },
  "website-migration": {
    q: "Can you migrate an existing website?",
    a: "Often, after a technical review of the current code, licence terms, data, deployment process and connected services. Pinkys Prints is a published example: a Shopify store rebuilt as a custom platform and moved from managed cloud services onto self-hosted infrastructure. We map existing URLs, metadata and internal links before a migration to reduce avoidable search disruption.",
    services: ["/managed-website-hosting", "/website-redesign-nottingham"],
    insights: ["website-redesign-vs-website-refresh"],
  },
  "project-inputs": {
    q: "What information do you need before starting?",
    a: "Discovery covers what you sell, who buys it, how they currently choose you, what the present site or system does well, and what evidence exists — analytics, Search Console, enquiry records. Practically, projects move fastest when content, imagery, brand assets and access to domains, hosting and any integrated systems are identified early, because content readiness affects the schedule more than page count does.",
    services: ["/services/business-growth-audit", "/services"],
    insights: ["what-should-a-professional-business-website-include"],
  },
  "ecommerce-builds": {
    q: "Do you build ecommerce websites?",
    a: "Yes. Pinkys Prints is a custom e-commerce platform with catalogue variants and a tailored product admin, migrated from Shopify. We recommend custom commerce only when the operational value justifies owning it; where an established platform already fits, configuring and integrating it is usually the better decision.",
    services: ["/e-commerce-development-nottingham"],
  },

  // ---------------------------------------------------------------------- SEO
  "what-is-seo": {
    q: "What is SEO?",
    a: "Search engine optimisation is the work that makes a website findable, understandable and worth choosing in search results. In practice it splits into three parts: the technical foundations that let search engines crawl and index pages, the content that answers what people are actually searching for, and the on-page experience that turns a click into an enquiry. It is ongoing work, not a one-off setting.",
    services: ["/local-seo-nottingham", "/seo-website-audit"],
    insights: ["website-seo-checklist-uk-small-businesses", "what-is-local-seo-and-do-you-need-it"],
  },
  "what-is-local-seo": {
    q: "What is local SEO?",
    a: "Local SEO is search work aimed at people looking for a provider in a particular place — searches with an area in them, and searches where results are shaped by where the person is. It covers how clearly the site describes each service and the areas covered, how consistent the business details are across the web, how the Google Business Profile supports the site, and whether the proof a local buyer needs is actually visible.",
    services: ["/local-seo-nottingham", "/local-growth"],
    insights: ["what-is-local-seo-and-do-you-need-it", "local-seo-nottingham-businesses-guide"],
  },
  "seo-timeline": {
    q: "How long does SEO take?",
    a: "Longer than most sales pitches suggest, and it varies with the starting point. Technical fixes can change indexation quickly; content and authority work is measured over months, not weeks. Anyone quoting a fixed timescale before looking at your current visibility, competition and site health is guessing.",
    services: ["/local-seo-nottingham", "/digital-growth-partnership"],
    insights: ["how-long-does-seo-take-local-business"],
  },
  "ranking-guarantees": {
    q: "Can anyone guarantee first place on Google?",
    a: "No. Rankings depend on Google's systems, your competitors and the searcher, none of which any agency controls. We will not promise a position. What can be committed to is the work itself: technical health, content that matches real search intent, credible proof, and measurement against a recorded baseline so progress is judged on evidence.",
    services: ["/local-seo-nottingham", "/seo-website-audit"],
    insights: ["how-long-does-seo-take-local-business", "seo-vs-google-ads"],
  },
  "seo-in-build": {
    q: "Is SEO included in a website build?",
    a: "Search foundations are part of the build: deliberate metadata, canonicals, structured data, heading and route architecture, internal links, indexation controls and page speed. Ongoing SEO — content, authority, continued measurement and iteration — is separate work, scoped either as a project or through a Digital Growth Partnership.",
    services: ["/web-design-nottingham", "/digital-growth-partnership"],
    insights: ["website-seo-checklist-uk-small-businesses"],
  },
  "technical-seo": {
    q: "What is technical SEO?",
    a: "Technical SEO is everything that determines whether a search engine can reach, render, understand and trust your pages: crawlability and robots rules, canonical URLs, sitemaps, redirects, structured data, heading hierarchy, mobile rendering, Core Web Vitals and HTTPS. It rarely wins attention on its own, but content cannot perform if the technical layer is working against it.",
    services: ["/seo-website-audit", "/local-seo-nottingham"],
    insights: ["what-are-core-web-vitals", "why-your-website-isnt-showing-on-google", "does-website-speed-affect-seo"],
  },
  "seo-and-google-ads": {
    q: "Do I need Google Ads as well as SEO?",
    a: "They solve different problems. Ads buy visibility immediately and stop when the budget does; SEO compounds slowly and keeps working. Which mix is right depends on how urgently you need enquiries, your margin per customer and how competitive the terms are. We will say plainly when paid search is the more honest answer for a given timeframe.",
    services: ["/local-seo-nottingham"],
    insights: ["seo-vs-google-ads"],
  },
  "seo-existing-site": {
    q: "Can ScaleSmiths improve an existing site's SEO?",
    a: "Yes, and that is often the better starting point. An SEO and website audit reviews indexation, technical health, content coverage, internal linking and the conversion journey, and produces a prioritised list. Implementation can then be scoped separately, handled through a Digital Growth Partnership, or carried out by your own team.",
    services: ["/seo-website-audit", "/digital-growth-partnership"],
    insights: ["website-seo-checklist-uk-small-businesses", "why-your-website-isnt-showing-on-google"],
  },
  "not-on-google": {
    q: "Why is my website not appearing on Google?",
    a: "The usual causes, in the order we find them: the pages are not indexed at all (blocked by robots rules, a noindex tag or a staging setting left in place), the site is indexed but nothing on it matches what people search for, or it competes for terms far above its current authority. Search Console usually distinguishes these quickly, which is why an audit starts there.",
    services: ["/seo-website-audit"],
    insights: ["why-your-website-isnt-showing-on-google"],
  },
  "website-speed": {
    q: "How important is website speed?",
    a: "It matters most where it affects people. Core Web Vitals are a real but modest ranking input; the larger commercial effect is that slow pages lose visitors before they read anything, particularly on mobile connections. We treat speed as a build standard rather than a late optimisation pass.",
    services: ["/seo-website-audit", "/next-js-agency-uk"],
    insights: ["does-website-speed-affect-seo", "what-are-core-web-vitals"],
  },
  "seo-rebuild": {
    q: "Will we lose SEO rankings during a rebuild?",
    a: "Any rebuild carries some risk and nobody can honestly guarantee rankings. We reduce the risk by mapping existing URLs to their new equivalents with redirects, carrying over content that already performs, preserving metadata and structured data, and checking indexing after launch.",
    services: ["/website-redesign-nottingham", "/seo-website-audit"],
    insights: ["website-redesign-vs-website-refresh", "why-your-website-isnt-showing-on-google"],
    ownerReview: true,
  },

  // --------------------------------------------------- ongoing support / retainer
  support: {
    q: "What happens after my website launches?",
    a: "Launch is a measurement point, not the end of the work. The production site is verified, measurement is connected, and ownership of accounts and access is agreed. From there a Digital Growth Partnership can continue the work — it can start after a ScaleSmiths build or with an existing website, and it covers agreed priorities rather than an open-ended retainer.",
    services: ["/digital-growth-partnership"],
    insights: ["what-does-website-maintenance-include"],
  },
  "support-included": {
    q: "What is included in ongoing website management?",
    a: "The proposal defines it. A Digital Growth Partnership can include hosting, updates, monitoring, fixes, SEO, conversion work, content, automation and roadmap delivery, with priorities and working cadence agreed up front. Maintenance protects dependable operation; SEO, content, design changes and new integrations are improvement work and are scoped accordingly.",
    services: ["/digital-growth-partnership", "/website-maintenance-nottingham"],
    insights: ["what-does-website-maintenance-include"],
  },
  "manage-external-site": {
    q: "Can ScaleSmiths manage a website it did not build?",
    a: "Often, after an initial review. We need to understand its code, hosting, access and update path before accepting responsibility, and that review may identify prerequisite repair work or a platform that needs its original specialist. We will not take on an unknown system blind.",
    services: ["/website-maintenance-nottingham", "/managed-website-hosting"],
    insights: ["what-does-website-maintenance-include"],
  },
  "content-updates": {
    q: "Are content updates included?",
    a: "Only where the agreement says so. Routine edits, new pages and campaign work can be included or scoped separately depending on the working model, so the boundary is written into the partnership rather than assumed. If you expect frequent changes, say so during scoping — it affects both the build and the support arrangement.",
    services: ["/digital-growth-partnership", "/website-maintenance-nottingham"],
  },
  "seo-ongoing": {
    q: "Is SEO ongoing?",
    a: "Yes, if it is going to work. Search results, competitors and your own services all change, so content, technical health and measurement need continued attention. That is why SEO sits in a Digital Growth Partnership as prioritised improvement work rather than being treated as a task that completes at launch.",
    services: ["/digital-growth-partnership", "/local-seo-nottingham"],
    insights: ["how-long-does-seo-take-local-business"],
  },
  "something-breaks": {
    q: "What happens if something breaks?",
    a: "For clients under an agreed arrangement, the escalation route, contacts and cadence are documented as part of the partnership, and ScaleSmiths can perform emergency maintenance and proportionate protective action. Response commitments exist only where they have been contracted — we do not publish response times we have not agreed with you. If you need emergency help without an existing arrangement, contact us and we will tell you honestly whether we can assist.",
    services: ["/website-maintenance-nottingham", "/digital-growth-partnership"],
    insights: ["what-happens-when-your-website-goes-down"],
  },
  monitoring: {
    q: "Do you monitor websites?",
    a: "Uptime checks and monitoring are part of managed hosting and maintenance arrangements, scoped to the actual stack. What is monitored, and what happens when a check fails, is written into the agreement rather than implied.",
    services: ["/managed-website-hosting", "/website-maintenance-nottingham"],
    insights: ["what-happens-when-your-website-goes-down"],
  },
  "hosting-included": {
    q: "Is hosting included?",
    a: "Not automatically. Hosting can be part of a Digital Growth Partnership or arranged as a managed hosting service on its own, and the order states which applications, environments, monitoring, maintenance and backups are covered. Managed Business Email is likewise separate unless a combined arrangement is written into the agreement.",
    services: ["/managed-website-hosting", "/digital-growth-partnership"],
    insights: ["website-hosting-explained"],
  },
  "request-priority": {
    q: "How are requests prioritised?",
    a: "A Digital Growth Partnership works to an agreed roadmap and a prioritised backlog rather than a first-come queue, so work that matters commercially is not displaced by whatever arrived most recently. Incidents affecting a live service take precedence over improvement work. Clients can raise and track requests through the ScaleSmiths client portal.",
    services: ["/digital-growth-partnership"],
  },
  "new-features": {
    q: "Can I request new features later?",
    a: "Yes. New features are improvement work: they are specified, scoped and placed on the roadmap rather than absorbed into routine maintenance. Building in phases is a deliberate part of how we work — the first release is dependable, and later work follows evidence rather than a fixed wish list.",
    services: ["/digital-growth-partnership", "/custom-web-app-development-uk"],
  },

  // ------------------------------------------------------------ custom development
  "custom-web-development": {
    q: "What is custom web development?",
    a: "It is the part of a website a template cannot do: booking and quote workflows, integrations with the tools you already use, admin areas, databases, user roles, and hosting that someone is accountable for. Published examples include the CSDS multi-step quote form feeding its own admin panel, and the Glow Tanning booking and review integrations behind an admin login.",
    services: ["/web-development-nottingham", "/custom-web-app-development-uk"],
    insights: ["what-is-a-web-application", "why-scalesmiths-builds-custom-websites"],
  },
  "custom-software": {
    q: "What is custom software?",
    a: "Software built around one organisation's workflow instead of configured from a general-purpose product. It is justified when the workflow genuinely differentiates the business, when existing tools create material friction, or when integration and data-ownership needs cannot be met by configuration. If a proven product already meets the requirement, buying and integrating it is usually the better decision, and we will say so.",
    services: ["/custom-software-development-uk"],
    insights: ["when-does-a-business-need-custom-software", "what-is-a-web-application"],
  },
  crm: {
    q: "Can ScaleSmiths build a CRM?",
    a: "Yes, where an off-the-shelf CRM does not fit the workflow. Confirm-A-Kill runs on a private PostgreSQL-backed CRM covering enquiries, customers, properties, quotations, appointments, jobs, visits and commercial service records; CSDS has a quote management admin panel behind its website. If an existing CRM already does the job, connecting the website to it is often the better investment.",
    services: ["/custom-software-development-uk", "/custom-web-app-development-uk"],
    insights: ["when-does-a-business-need-custom-software"],
    ownerReview: true,
  },
  "customer-portals": {
    q: "Can you build customer portals?",
    a: "Yes. ScaleSmiths runs its own client portal for projects, invoices, documents, messages and requests, with tenant isolation enforced server-side. The Business Circle is a published membership platform with tiered access, and VeteranFinder includes member and admin applications. Permissions and tenant boundaries are enforced on the server rather than treated as interface options.",
    services: ["/custom-web-app-development-uk", "/custom-software-development-uk"],
    insights: ["what-is-a-web-application"],
  },
  stripe: {
    q: "Can you integrate Stripe?",
    a: "Yes. The Business Circle runs Stripe subscription billing for tiered memberships, and Prymal uses Stripe for plans, team seats and execution credits. Card details stay with the payment provider — we do not create a reason to handle them directly — and order or subscription state relies on verified server-side provider events rather than a browser redirect alone.",
    services: ["/e-commerce-development-nottingham", "/custom-web-app-development-uk"],
  },
  integrations: {
    q: "Can you integrate third-party APIs?",
    a: "Usually, yes. Published work includes a Salon Tracker booking integration and Google and Facebook review aggregation for Glow Tanning, and Stripe subscription billing with LiveKit video for The Business Circle. We check the existing system's API, data and ownership before committing to an approach, because not every tool exposes what an integration needs.",
    services: ["/web-development-nottingham", "/business-automation-nottingham"],
  },
  "process-automation": {
    q: "Can you automate existing business processes?",
    a: "Yes, starting with one bounded workflow whose owner, inputs, exceptions and useful outcome can be defined. Useful automation removes repeated handling while preserving the decisions people still need to make, so high-consequence steps keep a human review point and a record of what the system proposed or changed. Deterministic rules and integrations are often safer and cheaper than adding a language model; AI is used where interpretation is genuinely required.",
    services: ["/business-automation-nottingham"],
    insights: ["when-does-a-business-need-custom-software"],
  },
  "replace-spreadsheets": {
    q: "Can you replace spreadsheets and manual processes?",
    a: "Yes, and usually gradually. A phased system can begin with the highest-friction workflow and leave stable existing processes in place until replacement is justified. That avoids the common failure of rebuilding everything at once and discovering the exceptions afterwards.",
    services: ["/business-automation-nottingham", "/custom-software-development-uk"],
    insights: ["when-does-a-business-need-custom-software"],
  },
  "internal-admin-systems": {
    q: "Can you build internal admin systems?",
    a: "Yes. Admin surfaces are a recurring part of published work: quote management for CSDS, product and catalogue administration for Pinkys Prints, content administration for Glow Tanning, member management for The Business Circle, and a dedicated admin console for VeteranFinder. Roles, permissions and sensitive operations are enforced server-side.",
    services: ["/custom-web-app-development-uk", "/web-development-nottingham"],
    insights: ["what-is-a-web-application"],
  },
  "software-scaling": {
    q: "Can software grow as the business grows?",
    a: "That is the point of building it deliberately. We define a release boundary rather than a wish list, keep data and permissions designed for the next stage, and document deployment and operations as part of delivery. Later phases then extend a system that is understood, instead of working around one nobody can safely change.",
    services: ["/custom-software-development-uk", "/digital-growth-partnership"],
  },
  phases: {
    q: "Can the work be delivered in phases?",
    a: "Yes. We separate the essential launch scope from later improvements, so the first release is dependable and further work follows evidence rather than a fixed wish list.",
    services: ["/services", "/custom-software-development-uk"],
  },

  // ------------------------------------------------------------ infrastructure / email
  "business-email": {
    q: "Do you provide business email?",
    a: "Yes. ScaleSmiths Managed Business Email starts at £15 per month for three custom-domain mailboxes with 5GB of storage each, and initial mailbox and DNS setup is included at no additional setup charge. It covers webmail, desktop and mobile client compatibility, aliases and forwarding, spam filtering, TLS-secured transport, and SPF, DKIM and DMARC configuration. It is available standalone — you do not need a ScaleSmiths website.",
    services: ["/services/managed-business-email"],
    insights: ["why-use-your-own-email-domain"],
  },
  spf: {
    q: "What is SPF?",
    a: "Sender Policy Framework is a DNS record listing which mail servers are allowed to send email using your domain. When a receiving system gets a message claiming to be from you, it checks that record to see whether the sending server is on the list. Without it, anyone can send mail that appears to come from your domain, and legitimate mail is more likely to be treated as suspicious.",
    services: ["/services/managed-business-email"],
    insights: ["spf-dkim-dmarc-explained"],
  },
  dkim: {
    q: "What is DKIM?",
    a: "DomainKeys Identified Mail adds a cryptographic signature to the messages you send, using a key published in your DNS. The receiving system verifies that signature to confirm the message really came from your domain and was not altered in transit. SPF establishes where mail was sent from; DKIM establishes that it has not been tampered with.",
    services: ["/services/managed-business-email"],
    insights: ["spf-dkim-dmarc-explained"],
  },
  dmarc: {
    q: "What is DMARC?",
    a: "DMARC ties SPF and DKIM together. It tells receiving mail systems what to do when a message fails those checks — monitor, quarantine or reject it — and can send reports back so you can see who is sending mail as your domain. It is the policy layer that makes the other two records meaningful.",
    services: ["/services/managed-business-email"],
    insights: ["spf-dkim-dmarc-explained"],
  },
  "email-spam": {
    q: "Why are business emails going to spam?",
    a: "Most often because the domain's authentication records are missing or wrong, so receiving systems cannot verify the mail is genuinely yours. Sending from a free consumer address, a shared or poor-reputation server, or a domain with no sending history makes it worse. Correct SPF, DKIM and DMARC configuration supports good deliverability, but no configuration can guarantee that every message reaches an inbox.",
    services: ["/services/managed-business-email"],
    insights: ["why-business-emails-go-to-spam", "spf-dkim-dmarc-explained"],
  },
  dns: {
    q: "Do you manage DNS?",
    a: "Yes, where you give us appropriate access. Managed Business Email onboarding includes configuring the required mail and authentication records, and website or hosting work includes the DNS changes a launch or migration needs. We use delegated or scoped access where it is supported, and we never ask for domain or registrar passwords through a public form.",
    services: ["/services/managed-business-email", "/managed-website-hosting"],
  },
  domains: {
    q: "Do you manage domains?",
    a: "You remain the registrant unless a transfer is expressly agreed in writing. ScaleSmiths needs appropriate access to configure records, but a domain transfer is not automatically required. If you want us to take on registration or renewal administration, ask and we will scope it explicitly rather than assume it.",
    services: ["/managed-website-hosting", "/services/managed-business-email"],
  },
  ssl: {
    q: "Do you provide SSL?",
    a: "Yes. HTTPS is a build standard, not an upsell, and certificate provisioning and renewal are part of managed hosting and deployment. The specific arrangement depends on where the site runs: platform-managed certificates on a host such as Vercel, or certificates managed at the Nginx layer on a VPS deployment.",
    services: ["/managed-website-hosting"],
    insights: ["website-hosting-explained"],
  },
  backups: {
    q: "Are websites backed up?",
    a: "Backups are part of a managed hosting or maintenance arrangement, and the order states which environments, data and retention are covered. We are deliberately plain about the limits: backups reduce risk but do not make loss impossible, they do not replace your own continuity responsibilities, and no restoration guarantee, recovery point or recovery time is created by our online terms. Ask, and the actual arrangement is written into the agreement.",
    services: ["/managed-website-hosting", "/website-maintenance-nottingham"],
    insights: ["what-happens-when-your-website-goes-down"],
  },
  "hosting-location": {
    q: "Where are websites hosted?",
    a: "It depends on the build. Published work runs on self-hosted Docker Compose and Nginx deployments on a VPS, and on managed platforms such as Vercel. We choose around the workload, operational risk and support model rather than defaulting to one provider, and the hosting arrangement is documented so nobody is guessing who is accountable.",
    services: ["/managed-website-hosting"],
    insights: ["website-hosting-explained"],
  },

  // ------------------------------------------------------------------- commercial
  "project-pricing": {
    q: "How much do ScaleSmiths projects cost?",
    a: "Projects are scoped by business outcome and complexity rather than sold as fixed packages, and the final price follows a project-specific written proposal. Two services carry published prices: the Business Growth Audit, with the full fee credited against an eligible subsequent build, and Managed Business Email from £15 per month. Everything else appears on the pricing page as guidance and is confirmed after discovery.",
    services: ["/pricing", "/services/business-growth-audit"],
    insights: ["how-much-does-a-business-website-cost-uk-2026", "why-cheap-websites-often-become-expensive"],
  },
  deposit: {
    q: "Do you require a deposit?",
    a: "Payment terms, including any staged or upfront payment, are set out in the proposal and signed order for each project rather than published as a blanket policy. Ownership of bespoke deliverables transfers once the applicable agreed fees are paid. Ask during discovery and you will have the terms in writing before anything is committed.",
    services: ["/pricing", "/services"],
  },
  "outside-nottingham": {
    q: "Do you work with businesses outside Nottingham?",
    a: "Yes. ScaleSmiths is based in Hucknall, Nottinghamshire and works with businesses across the UK. Published work also includes CSDS, a computer repair firm in Pennsylvania. Projects outside the area run remotely with a review cadence agreed in the scope.",
    services: ["/services", "/local-growth"],
  },
  startups: {
    q: "Do you work with startups?",
    a: "Yes, where the scope is honest about the stage. Published work includes early platforms such as The Business Circle, Prymal and VeteranFinder. For an early-stage business we would usually argue for a bounded first release that tests the commercial idea, rather than a full platform built before anyone has established that people want it.",
    services: ["/custom-systems", "/custom-software-development-uk"],
  },
  "established-businesses": {
    q: "Do you work with established businesses?",
    a: "Yes, and that is where most of the client work sits. Confirm-A-Kill is an established Nottinghamshire pest-control business whose website and operating systems were rebuilt around search, conversion and day-to-day delivery. Established businesses usually have real evidence — rankings, enquiries, existing systems — and the work starts by protecting what already performs.",
    services: ["/website-redesign-nottingham", "/digital-growth-partnership"],
    insights: ["signs-your-business-website-needs-rebuilding"],
  },
  "unfinished-project": {
    q: "Can you take over an unfinished project?",
    a: "Usually, yes, but never sight unseen. We start with a code and infrastructure review so the path forward is based on what is actually there, and that review sometimes concludes that finishing the existing build would cost more than replacing part of it. You get that assessment honestly, before committing to delivery.",
    services: ["/web-development-nottingham", "/custom-software-development-uk"],
  },
  "code-ownership": {
    q: "Do clients own the code?",
    a: "Ownership or licence of the bespoke deliverable follows the signed project documents, and any transfer occurs once the applicable agreed fees are paid. Clients retain their own materials, trademarks and business data. ScaleSmiths retains its pre-existing tools, frameworks, methods and know-how, and third-party and open-source components stay under their own licences. It is written down rather than left to assumption.",
    services: ["/services"],
  },
  "internal-team": {
    q: "Can you work alongside an internal team?",
    a: "Yes. We can take a defined delivery stream, unblock architecture decisions, or build alongside an existing marketing or operations team. Where an audit produces a roadmap, your own team or another supplier is welcome to implement it — the findings are useful either way.",
    services: ["/services/business-growth-audit", "/web-development-nottingham"],
  },
} as const satisfies Record<string, LibraryFaq>

export type FaqId = keyof typeof faqLibrary

/**
 * The same data widened to the declared shape. `as const satisfies` above keeps the id union
 * exact, but narrows each entry to its own literal type, which hides the optional fields; read
 * answers through this record whenever the id is not a literal.
 */
export const faqEntries: Record<FaqId, LibraryFaq> = faqLibrary

export function libraryFaqs(ids: readonly FaqId[]): Array<{ q: string; a: string }> {
  return ids.map((id) => ({ q: faqLibrary[id].q, a: faqLibrary[id].a }))
}
