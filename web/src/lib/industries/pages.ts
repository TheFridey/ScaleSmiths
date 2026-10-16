import type { IndustryPage } from "./types"

/**
 * First-wave published industry pages. Each must fail the “swap the industry name
 * and it still works” test. Only entries with state "published" are routable.
 */
export const industryPages: Record<string, IndustryPage> = {
  "pest-control": {
    id: "ind.pest-control",
    slug: "pest-control",
    hubSlug: "trades-home-services",
    name: "Pest control",
    pluralName: "pest control businesses",
    metaTitle: "Websites for Pest Control Companies | ScaleSmiths",
    description:
      "Digital growth for pest control firms: emergency vs planned enquiries, domestic and commercial journeys, mobile call paths — with Confirm-A-Kill experience.",
    eyebrow: "Pest control",
    h1: "When the call is urgent, the website has about four seconds to help.",
    intro:
      "Pest control buyers arrive stressed, often outside office hours, and need to know who you treat, where you cover, and how fast someone will respond. ScaleSmiths builds the journeys that separate emergency jobs from planned treatments without burying either.",
    searchIntent:
      "For pest control owners comparing website rebuilds or growth partners because enquiries are messy, service pages are thin, or mobile callers bounce before they find a number.",
    buyer: "Owner-operators and office managers handling domestic and commercial pest enquiries.",
    presentation: "trades",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Emergency and planned enquiries share one undifferentiated contact path, so high-intent callers leave and commercial RFQs arrive incomplete.",
    frictions: [
      {
        title: "Emergency and planned demand collide",
        symptom: "A wasp nest at 9pm and a quarterly commercial contract both land in the same inbox with no priority or context.",
        fix: "Separate domestic emergency, planned domestic and commercial journeys with the right call, form or callback expectation on each.",
      },
      {
        title: "Service-area ambiguity",
        symptom: "Visitors cannot tell whether you cover their town, so they dial a national competitor instead.",
        fix: "Clear coverage architecture and internal links that explain where you work — without thin town-name doorway pages.",
      },
      {
        title: "Trust collapses on mobile",
        symptom: "Reviews, insurance cues and response expectations sit below the fold while the call button is hard to find.",
        fix: "Mobile-first contact hierarchy, permissioned proof, and plain-language answers to “how soon can you come?”",
      },
      {
        title: "CRM handoff is manual",
        symptom: "Office staff re-type form submissions, losing pest type, property type and urgency.",
        fix: "Structured enquiry fields and a handoff path that preserves the context your team needs to quote.",
      },
    ],
    strategy: [
      { title: "Journey split", description: "Domestic emergency, planned domestic and commercial paths get distinct page structures and CTAs." },
      { title: "Visibility with substance", description: "Service and advice content that answers real pest questions, not keyword stuffing." },
      { title: "Measurement that matters", description: "Track calls, form starts, qualified jobs and seasonal spikes — not vanity sessions alone." },
    ],
    journey: [
      { title: "Search or referral", description: "Buyer looks for a pest type, emergency help or commercial contractor." },
      { title: "Relevant service page", description: "They land on a page that matches the pest and property context." },
      { title: "Proof and expectation", description: "Coverage, response cues and reviews reduce doubt." },
      { title: "Clear enquiry", description: "Call or structured form captures urgency, pest and property type." },
      { title: "Job tracking", description: "Your team receives usable context and can follow up without re-asking basics." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Firms whose site cannot separate services, areas and enquiry types cleanly.", whatNext: "Discovery, information architecture, mobile contact design, then a scoped build." },
      { pathway: "growth", whoFor: "Firms with a usable site who need content, conversion and seasonal visibility improved continuously.", whatNext: "Strategy call to agree priorities around Search Console, conversion and maintenance." },
      { pathway: "audit", whoFor: "Owners unsure whether the constraint is the website, local visibility or follow-up.", whatNext: "Optional Business Growth Audit before committing to a rebuild." },
    ],
    proof: {
      level: "direct",
      workSlug: "confirm-a-kill",
      label: "Direct industry proof — Confirm-A-Kill",
      summary:
        "ScaleSmiths rebuilt Confirm-A-Kill’s pest and service journeys, Nottinghamshire coverage architecture and advice hub. Publish only verified outcomes and permissioned assets from that case study.",
    },
    faqs: [
      { q: "Can you handle emergency call tracking?", a: "We can design call and form paths that capture urgency and pest context. Call-tracking products are integrated only when scoped and available in your stack." },
      { q: "Do you write pest advice content?", a: "We can structure an advice hub and editorial workflow. Technical pest guidance should be reviewed by your qualified technicians before publication." },
      { q: "Will you create a page for every town we cover?", a: "Only where a page can say something useful and distinct. Thin location swaps harm trust and search quality." },
      { q: "Can Growth Partnership start without a rebuild?", a: "Yes. Many pest control firms begin with measurement, content and conversion improvements on the site they already have." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/digital-growth-partnership", "/web-design-nottingham"],
    relatedIndustrySlugs: ["roofing", "electricians", "plastering-rendering"],
    synonyms: ["pest controller", "exterminator", "pest management", "wildlife control"],
    meaningfulMetrics: ["Qualified emergency calls", "Commercial RFQ completeness", "Form-to-job conversion", "Seasonal enquiry mix"],
    unknowns: ["Which CRM you use today", "Whether call tracking is already in place", "Which pest advice you are willing to publish under your name"],
    showCustomSystems: true,
  },

  "plastering-rendering": {
    id: "ind.plastering-rendering",
    slug: "plastering-rendering",
    hubSlug: "trades-home-services",
    name: "Plastering & rendering",
    pluralName: "plastering and rendering businesses",
    metaTitle: "Websites for Plasterers & Renderers | ScaleSmiths",
    description:
      "Digital growth for plastering and rendering firms: service specialisms, project proof, quote context and local coverage — with verified Precision Finish work.",
    eyebrow: "Plastering & rendering",
    h1: "Specialist trades lose work when every service looks the same on one page.",
    intro:
      "Buyers comparing render systems, damp replastering or ceiling repairs need to see the difference before they ask for a quote. ScaleSmiths structures trades sites around specialisms, proof and a photo-led enquiry — not a single “we do plastering” block.",
    searchIntent:
      "For plastering and rendering owners whose website under-explains specialist services, buries project photos, or collects bare contact details instead of useful quote context.",
    buyer: "Trade owners and estimators who quote from photos, site visits and service-area coverage.",
    presentation: "trades",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Multiple specialist services share one thin page, so high-intent buyers cannot self-qualify and quotes arrive without photos or scope.",
    frictions: [
      {
        title: "Specialisms flattened into one page",
        symptom: "Rendering, skimming, damp work and repairs compete for the same paragraph.",
        fix: "Dedicated service pages with distinct proof, FAQs and quote routes for each specialism worth owning.",
      },
      {
        title: "Proof is a buried gallery",
        symptom: "Project photos live on Facebook or a hard-to-filter portfolio, so buyers never connect work to a service.",
        fix: "Filterable project evidence tied to the service the visitor is considering.",
      },
      {
        title: "Quotes start from a phone number alone",
        symptom: "You spend the first call reconstructing address, property type and photos.",
        fix: "A quote journey that invites photos and basic scope before the conversation.",
      },
    ],
    strategy: [
      { title: "Service architecture", description: "One clear page per commercially important specialism, linked from a strong trades hub." },
      { title: "Evidence next to intent", description: "Show relevant projects beside the service, not only in a generic gallery." },
      { title: "Quote quality", description: "Capture photos and context so estimating time is spent on viable work." },
    ],
    journey: [
      { title: "Local service search", description: "Buyer searches a specialism and area." },
      { title: "Specialist page", description: "They land on rendering, skimming or another dedicated service." },
      { title: "Project proof", description: "Photos and notes show comparable work." },
      { title: "Photo-led quote", description: "Form or WhatsApp path collects images and basics." },
      { title: "Site visit or estimate", description: "Your team arrives with context already captured." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Firms ready to replace a brochure site with service-led architecture and proof.", whatNext: "Discovery around services, coverage and content readiness, then a scoped website build." },
      { pathway: "growth", whoFor: "Firms with a solid site who need ongoing content, galleries and local visibility work.", whatNext: "Growth Partnership discussion around search, conversion and maintenance." },
      { pathway: "audit", whoFor: "Owners unsure whether structure, content or follow-up is the real constraint.", whatNext: "Optional audit before committing budget." },
    ],
    proof: {
      level: "direct",
      workSlug: "precision-finish-plastering-rendering",
      label: "Direct industry proof — Precision Finish",
      summary:
        "Precision Finish’s search-led trades website turns a wide service area and specialist offer into clear routes to advice, proof and a quote. See the published case study for scope and method.",
    },
    faqs: [
      { q: "Do I need a page for every service?", a: "Only for services that attract distinct buyer intent and that you can support with real copy and proof. Thin duplicates help nobody." },
      { q: "Can customers upload photos?", a: "Yes, when scoped. Photo-led quotes are one of the highest-value trades patterns we implement." },
      { q: "Will you guarantee local rankings?", a: "No. We build durable structure and content; rankings depend on competition, reviews, authority and ongoing work." },
    ],
    relatedSolutionHrefs: ["/web-design-hucknall", "/local-growth", "/local-seo-nottingham"],
    relatedIndustrySlugs: ["roofing", "pest-control", "electricians"],
    synonyms: ["plasterer", "renderer", "external rendering", "skim plastering"],
    meaningfulMetrics: ["Quote requests with photos", "Service-page engagement", "Qualified estimate appointments"],
    unknowns: ["Which specialisms you want to own commercially", "Photo library readiness", "Current enquiry channels"],
    showCustomSystems: false,
  },

  roofing: {
    id: "ind.roofing",
    slug: "roofing",
    hubSlug: "trades-home-services",
    name: "Roofing",
    pluralName: "roofing companies",
    metaTitle: "Websites for Roofing Companies | ScaleSmiths",
    description:
      "Digital growth for roofers: high-intent local searches, storm and emergency spikes, call vs quote routes, project evidence and review acquisition under consent.",
    eyebrow: "Roofing",
    h1: "Storm weeks punish roofing websites that only work on calm Tuesdays.",
    intro:
      "Roofing demand spikes with weather, and buyers choose fast between call and quote. ScaleSmiths designs trades journeys that keep emergency contact obvious, project proof visible, and lead qualification honest — without inventing local offices you do not have.",
    searchIntent:
      "For roofing companies losing high-intent local enquiries because the site is slow on mobile, light on proof, or unclear about emergency versus planned work.",
    buyer: "Roofing owners and office staff handling emergency call-outs and planned reroof quotes.",
    presentation: "trades",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "High-intent local and emergency searches hit a site that cannot route callers quickly or qualify planned projects.",
    frictions: [
      {
        title: "Call vs quote is ambiguous",
        symptom: "Emergency leak callers and full-reroof buyers share one “contact us” button.",
        fix: "Dual routes: immediate call path for urgent work, structured quote for planned projects.",
      },
      {
        title: "Storm spike overload",
        symptom: "After bad weather the inbox fills with incomplete messages while the phone rings unanswered.",
        fix: "Expectation-setting copy, callback windows and form fields that capture property type and urgency.",
      },
      {
        title: "Trust without scaffolding photos",
        symptom: "Buyers comparing major spend see stock images and no project evidence.",
        fix: "Permissioned before/after and project notes tied to roof type and area.",
      },
      {
        title: "Reviews lack a consent path",
        symptom: "Happy customers are never systematically invited to review under clear consent.",
        fix: "A post-job review request workflow that respects consent and platform rules.",
      },
    ],
    strategy: [
      { title: "Intent routing", description: "Emergency and planned journeys are visually and structurally distinct." },
      { title: "Local honesty", description: "Coverage and response expectations match where you actually work." },
      { title: "Lead quality", description: "Forms collect enough to quote without turning into a barrier for urgent callers." },
    ],
    journey: [
      { title: "High-intent search", description: "Buyer searches roof repair, replacement or emergency help." },
      { title: "Trust scan", description: "They check coverage, insurance cues and project proof." },
      { title: "Route choice", description: "Call for urgency or quote for planned work." },
      { title: "Qualification", description: "Your team receives usable property and job context." },
      { title: "Follow-up", description: "Survey, schedule or decline with clear next steps." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Roofers whose current site cannot support emergency and planned demand together.", whatNext: "Scoped website rebuild around services, proof and contact hierarchy." },
      { pathway: "growth", whoFor: "Roofers with a decent site who need content, reviews and conversion improved through seasons.", whatNext: "Growth Partnership around visibility and enquiry quality." },
      { pathway: "systems", whoFor: "Larger firms needing job intake, scheduling or customer portals beyond a brochure site.", whatNext: "Custom systems discovery." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "precision-finish-plastering-rendering",
      label: "Adjacent trades proof — Precision Finish",
      summary:
        "We have not published a roofing-only case study yet. Precision Finish demonstrates the trades pattern: specialist service pages, coverage architecture and quote capture. Treat it as adjacent, not direct roofing experience.",
    },
    faqs: [
      { q: "Can you promise we will rank for “emergency roofer” in every town?", a: "No. We avoid doorway location spam. We build honest coverage and service pages that can compete where the business is real." },
      { q: "Do you integrate job management software?", a: "When scoped and after discovery. We do not claim every roofing CRM is supported out of the box." },
      { q: "How do reviews work?", a: "We can design consent-aware review request journeys. We never fabricate ratings or post reviews on your behalf without authorisation." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/web-design-nottingham", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["plastering-rendering", "pest-control", "electricians"],
    synonyms: ["roofer", "roof repair", "roof replacement", "flat roofing"],
    meaningfulMetrics: ["Emergency call connection rate", "Planned-quote completeness", "Qualified survey bookings"],
    unknowns: ["Storm-season capacity", "Insurance/trust copy you can publish", "Current review platforms"],
    showCustomSystems: true,
  },

  electricians: {
    id: "ind.electricians",
    slug: "electricians",
    hubSlug: "trades-home-services",
    name: "Electricians",
    pluralName: "electrical contractors",
    metaTitle: "Websites for Electricians | ScaleSmiths",
    description:
      "Digital growth for electricians: domestic vs commercial intent, compliance-sensitive trust, emergency call paths and clear service packaging.",
    eyebrow: "Electricians",
    h1: "Electrical buyers need competence signals, not a clever slogan.",
    intro:
      "Domestic fault calls, EV charger installs and commercial maintenance are different buying journeys. ScaleSmiths helps electrical businesses present services, credentials they can actually claim, and contact routes that match urgency — without inventing certifications.",
    searchIntent:
      "For electricians and electrical contractors whose website under-explains services, buries credentials, or loses mobile callers before a booking is made.",
    buyer: "Owner-electricians and contracting firms balancing emergency, domestic and commercial work.",
    presentation: "trades",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Mixed domestic and commercial demand hits undifferentiated pages, while compliance and credential claims are either missing or overstated.",
    frictions: [
      {
        title: "Domestic and commercial blur",
        symptom: "A blown fuse enquiry and a facilities RFQ share the same thin homepage.",
        fix: "Separate journeys and proof for domestic, commercial and specialist installs you actually offer.",
      },
      {
        title: "Credential anxiety",
        symptom: "Buyers look for competence signals; the site either hides them or overclaims.",
        fix: "Publish only verifiable memberships and insurance details the business can stand behind.",
      },
      {
        title: "Emergency path buried",
        symptom: "Fault callers scroll past galleries before finding a number.",
        fix: "Persistent mobile contact and clear “fault / planned / quote” choices.",
      },
    ],
    strategy: [
      { title: "Service packaging", description: "Group offers the way customers search: faults, upgrades, EV, testing, commercial." },
      { title: "Trust without inventing badges", description: "Show real credentials; never fabricate scheme logos." },
      { title: "Enquiry quality", description: "Capture property type, urgency and job class before the callback." },
    ],
    journey: [
      { title: "Intent search", description: "Buyer searches a fault, install or contractor." },
      { title: "Competence scan", description: "They check services, coverage and credentials." },
      { title: "Contact", description: "Call for urgent faults or form for planned work." },
      { title: "Dispatch or quote", description: "Your team schedules with useful context." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Electrical firms ready for a service-led website with honest trust signals.", whatNext: "Scoped build after confirming which services and credentials can be published." },
      { pathway: "growth", whoFor: "Firms with a site who need content, local visibility and conversion improved.", whatNext: "Growth Partnership discussion." },
      { pathway: "audit", whoFor: "Owners unsure what is costing enquiries.", whatNext: "Optional Business Growth Audit." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "precision-finish-plastering-rendering",
      label: "Adjacent trades proof",
      summary:
        "No electrician-only case study is published yet. Precision Finish shows the local trades pattern we apply: clear services, coverage and quote capture. Labelled adjacent on purpose.",
    },
    faqs: [
      { q: "Will you list our accreditations automatically?", a: "We only publish credentials you confirm and can evidence. We do not scrape or invent scheme memberships." },
      { q: "Can you integrate online booking?", a: "Yes when scoped. Many electrical firms prefer call or callback for faults; booking suits planned work better." },
      { q: "Do you work outside the UK?", a: "Yes where delivery is viable. We are UK-based; international work is quoted for location, timezone and scope." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/web-design-nottingham", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["roofing", "pest-control", "plastering-rendering"],
    synonyms: ["electrician", "electrical contractor", "EV charger installer", "electrical testing"],
    meaningfulMetrics: ["Fault-call connection rate", "Planned-job quote quality", "Commercial enquiry completeness"],
    unknowns: ["Which credentials you can publish", "Domestic/commercial mix", "Emergency cover hours"],
    showCustomSystems: false,
  },

  podiatry: {
    id: "ind.podiatry",
    slug: "podiatry",
    hubSlug: "healthcare-wellness",
    name: "Podiatry",
    pluralName: "podiatry clinics",
    metaTitle: "Websites for Podiatry Clinics | ScaleSmiths",
    description:
      "Digital growth for podiatry clinics: treatment clarity, practitioner trust, accessible booking and patient questions — with Foot Works experience.",
    eyebrow: "Podiatry clinics",
    h1: "Patients need answers before they trust a clinic with their feet.",
    intro:
      "Podiatry visitors arrive with specific conditions, accessibility needs and booking anxiety. ScaleSmiths improves clinic journeys so treatments, practitioners and next steps are clear — without claiming medical outcomes we have not delivered or cannot evidence.",
    searchIntent:
      "For podiatry practice owners whose website confuses treatments, weakens practitioner credibility, or makes booking and home-visit options hard to find.",
    buyer: "Practice owners and clinic managers responsible for patient enquiries and reputation.",
    presentation: "clinic",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Treatment selection and practitioner trust are unclear, so patients bounce before booking or call with avoidable admin questions.",
    frictions: [
      {
        title: "Treatment fog",
        symptom: "Patients cannot tell which service matches their symptom or whether a home visit is available.",
        fix: "Plain-language treatment pages with clear who-it-is-for notes and clinic vs home-visit paths.",
      },
      {
        title: "Practitioner credibility buried",
        symptom: "Qualifications and faces sit on a generic “about” page patients never reach.",
        fix: "Practitioner context near the treatments and booking decision.",
      },
      {
        title: "Booking friction",
        symptom: "Cancellation rules, first-visit expectations and contact options are unclear.",
        fix: "Accessible booking/contact paths with FAQ clarity — integrations only after validation.",
      },
      {
        title: "Clinical overclaim risk",
        symptom: "Marketing copy drifts into outcome promises the clinic should not publish casually.",
        fix: "Editorial review discipline: no invented results; clinical content reviewed by the practice.",
      },
    ],
    strategy: [
      { title: "Patient questions first", description: "Structure content around conditions and decisions, not clinic jargon alone." },
      { title: "Trust and access", description: "Practitioners, accessibility notes and contact options stay visible." },
      { title: "Privacy-aware growth", description: "No patient data in marketing experiments; booking tools scoped carefully." },
    ],
    journey: [
      { title: "Condition or clinic search", description: "Patient searches a symptom or podiatrist near them." },
      { title: "Treatment clarity", description: "They recognise a relevant service and expectations." },
      { title: "Practitioner trust", description: "They see who will care for them." },
      { title: "Book or contact", description: "Accessible booking or enquiry with cancellation clarity." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Clinics whose site cannot explain treatments or support booking confidence.", whatNext: "Scoped rebuild with clinical content review by the practice." },
      { pathway: "growth", whoFor: "Clinics with a workable site needing content, local visibility and conversion work.", whatNext: "Growth Partnership with privacy-conscious measurement." },
      { pathway: "audit", whoFor: "Practices unsure whether content, booking or visibility is the constraint.", whatNext: "Optional Business Growth Audit." },
    ],
    proof: {
      level: "direct",
      workSlug: "foot-works-podiatry",
      label: "Direct industry proof — Foot Works Podiatry",
      summary:
        "Foot Works Podiatry work covers healthcare website optimisation and local growth in Bangor, Northern Ireland. Patient outcomes are not claimed beyond what the published case study supports.",
    },
    faqs: [
      { q: "Do you integrate clinical systems?", a: "Only after discovery and validation. We do not imply clinical integrations are ready without confirming fit, security and consent requirements." },
      { q: "Will you write medical content?", a: "We can draft plain-language structure. Clinical accuracy remains the practice’s responsibility before anything goes live." },
      { q: "Can you guarantee more bookings?", a: "No. We improve clarity and contact paths; appointment volume depends on capacity, reputation and demand." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/services/business-growth-audit", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["beauty-salons", "accountants"],
    synonyms: ["podiatrist", "chiropody", "foot clinic", "home visit podiatry"],
    meaningfulMetrics: ["Treatment-page to contact rate", "Booking completion / enquiry quality", "Reduced admin FAQ calls"],
    unknowns: ["Booking provider in use", "Home-visit coverage rules", "Which clinical claims the practice will approve"],
    showCustomSystems: false,
  },

  restaurants: {
    id: "ind.restaurants",
    slug: "restaurants",
    hubSlug: "hospitality-experiences",
    name: "Restaurants",
    pluralName: "restaurants",
    metaTitle: "Websites for Restaurants | ScaleSmiths",
    description:
      "Digital growth for restaurants: menu changes, bookings, dietary information, opening hours, mobile intent and private-dining leads.",
    eyebrow: "Restaurants",
    h1: "If the menu changed last week, the website should not still be arguing about it.",
    intro:
      "Restaurant discovery is mobile, impatient and unforgiving about wrong hours or stale menus. ScaleSmiths helps hospitality owners keep the essentials accurate and make booking, ordering or private-dining enquiries obvious — including when a third-party reservation tool is already in play.",
    searchIntent:
      "For restaurant owners whose website fights them on menu updates, buries booking, or loses private-dining and event leads to Instagram DMs.",
    buyer: "Owners and managers of independent restaurants and hospitality venues.",
    presentation: "hospitality",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Operational facts (menu, hours, dietary info, bookings) drift out of date while high-value event enquiries have no proper route.",
    frictions: [
      {
        title: "Menu and hours rot",
        symptom: "Staff change dishes weekly; the website lags, so guests trust Google or a delivery app instead.",
        fix: "An update workflow the team will actually use, with clear ownership for hours and menus.",
      },
      {
        title: "Booking path ambiguity",
        symptom: "Guests bounce between phone, Instagram and a half-configured widget.",
        fix: "One primary reservation path, with fallbacks stated honestly.",
      },
      {
        title: "Dietary questions unanswered",
        symptom: "Allergen and dietary information is incomplete, creating risk and lost bookings.",
        fix: "Structured dietary guidance and a contact path for edge cases — reviewed by the kitchen.",
      },
      {
        title: "Private dining ignored",
        symptom: "High-value event enquiries arrive as vague DMs with no date, headcount or budget.",
        fix: "A dedicated private-dining/enquiry journey that captures the basics.",
      },
    ],
    strategy: [
      { title: "Operational truth", description: "Hours, location, menu and booking status stay correct on mobile." },
      { title: "Intent routes", description: "Book a table, order, and enquire for events are separate, obvious actions." },
      { title: "Review trust", description: "Help guests find real reviews; never fabricate ratings." },
    ],
    journey: [
      { title: "Mobile discovery", description: "Guest searches cuisine, area or the restaurant name." },
      { title: "Fact check", description: "They confirm hours, menu fit and dietary needs." },
      { title: "Action", description: "Book, order or enquire for a private event." },
      { title: "Confirmation", description: "Expectations for response or reservation are clear." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Restaurants whose site cannot keep menus accurate or convert private-dining demand.", whatNext: "Scoped website with maintainable content and clear booking routes." },
      { pathway: "growth", whoFor: "Venues with a workable site needing ongoing content, SEO and conversion help.", whatNext: "Growth Partnership around visibility and enquiry quality." },
      { pathway: "systems", whoFor: "Groups needing deeper booking, ordering or multi-site operations tooling.", whatNext: "Custom systems discovery after validating existing providers." },
    ],
    proof: {
      level: "illustrative",
      label: "Illustrative hospitality pattern",
      summary:
        "ScaleSmiths has published local service and appointment-led work, but not a restaurant case study yet. Examples on this page are illustrative patterns, not claimed restaurant deliveries.",
    },
    faqs: [
      { q: "Can you replace OpenTable / Resy / a booking widget?", a: "Sometimes the right answer is to integrate what you already use. Replacement is only proposed after discovery." },
      { q: "Will you photograph our food?", a: "Photography can be scoped. We do not pass stock imagery off as your kitchen." },
      { q: "Do you manage social media?", a: "Social can sit inside a Growth Partnership when agreed. It is not automatic with a website build." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/custom-systems", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["beauty-salons", "independent-retail"],
    synonyms: ["restaurant", "cafe", "bistro", "dining", "private dining"],
    meaningfulMetrics: ["Menu update latency", "Booking starts", "Private-dining enquiry quality"],
    unknowns: ["Current reservation provider", "Who owns menu updates", "Delivery/order integrations required"],
    showCustomSystems: true,
  },

  "printing-signage": {
    id: "ind.printing-signage",
    slug: "printing-signage",
    hubSlug: "media-creative",
    name: "Printing & signage",
    pluralName: "printing and signage businesses",
    metaTitle: "Websites for Printers & Signage Firms | ScaleSmiths",
    description:
      "Digital growth for printers and signage firms: changing prices, quote specs, artwork upload security, lead times and catalogue maintainability.",
    eyebrow: "Printing & signage",
    h1: "Print businesses do not need another pretty brochure they cannot update.",
    intro:
      "When prices, stocks and lead times move weekly, a static site becomes an expensive argument with reality. ScaleSmiths focuses on quote specification, maintainable product information and secure artwork handoff — drawing on e-commerce and print-adjacent delivery experience.",
    searchIntent:
      "For print and signage owners who are too busy to update pages, receive vague quote requests, or cannot safely collect artwork and specifications online.",
    buyer: "Print shop owners, estimators and trade-print operators.",
    presentation: "ecommerce",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Catalogue and price drift plus underspecified quote requests create admin load and lost urgent orders.",
    frictions: [
      {
        title: "Prices change; pages do not",
        symptom: "Owners avoid updating the site, so published prices are wrong or missing, and every job becomes a phone quote.",
        fix: "A maintainable catalogue pattern and clear “request a quote” paths where fixed prices are dishonest.",
      },
      {
        title: "Vague quote requests",
        symptom: "Enquiries omit size, material, quantity, finish and deadline.",
        fix: "Specification-led quote forms for common product families.",
      },
      {
        title: "Artwork handoff risk",
        symptom: "Files arrive by insecure email links or unreadable formats.",
        fix: "Scoped upload flows with format guidance and security appropriate to the file types you accept.",
      },
      {
        title: "Trade vs retail confusion",
        symptom: "Trade customers and retail buyers need different pricing and lead-time expectations.",
        fix: "Distinct journeys or gated trade paths where commercially justified.",
      },
    ],
    strategy: [
      { title: "Maintainability first", description: "Design content the shop can keep current without a developer for every price change." },
      { title: "Specification quality", description: "Quotes start with the fields estimators actually need." },
      { title: "Secure handoff", description: "Artwork and files move through intentional, scoped channels." },
    ],
    journey: [
      { title: "Product or capability search", description: "Buyer looks for a print product or signage capability." },
      { title: "Fit check", description: "They confirm options, lead times and whether pricing is listed or quoted." },
      { title: "Specify", description: "Quote form or shop flow captures dimensions, materials and deadline." },
      { title: "Artwork", description: "Files upload with clear requirements." },
      { title: "Confirm", description: "Estimator follows up with a real quote." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Printers whose site cannot support quotes, catalogues or updates.", whatNext: "Scoped platform build — brochure, catalogue or commerce depending on discovery." },
      { pathway: "growth", whoFor: "Shops with a usable site needing content, SEO and conversion help.", whatNext: "Growth Partnership." },
      { pathway: "systems", whoFor: "Firms needing estimating portals, trade accounts or production integrations.", whatNext: "Custom systems discovery." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "pinkys-prints",
      label: "Adjacent proof — Pinkys Prints",
      summary:
        "Pinkys Prints is published ScaleSmiths e-commerce work in the UK print-adjacent space. Treat capability claims beyond that case study as proposed patterns, not identical deliveries.",
    },
    faqs: [
      { q: "Can you connect to our print MIS / estimating software?", a: "Possibly, after discovery. We do not advertise universal MIS connectors we have not validated." },
      { q: "Should every product have a live price?", a: "Only when price stability and configuration complexity allow it. Many print products are healthier as structured quotes." },
      { q: "How do you handle large artwork files?", a: "Upload limits, formats and storage are scoped. Security and retention rules are agreed before go-live." },
    ],
    relatedSolutionHrefs: ["/e-commerce-development-nottingham", "/custom-systems", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["independent-retail", "precision-engineering"],
    synonyms: ["printer", "print shop", "signage", "large format printing", "trade print"],
    meaningfulMetrics: ["Quote completeness", "Time-to-first-response", "Repeat order path usage", "Catalogue update latency"],
    unknowns: ["MIS stack", "Trade vs retail mix", "Which products can carry fixed prices"],
    showCustomSystems: true,
  },

  "independent-retail": {
    id: "ind.independent-retail",
    slug: "independent-retail",
    hubSlug: "retail-ecommerce",
    name: "Independent retail & e-commerce",
    pluralName: "independent retailers",
    metaTitle: "E-commerce for Independent Retailers | ScaleSmiths",
    description:
      "Digital growth for independent retailers: product discovery, stock accuracy, variants, checkout friction, shipping/returns and margin-aware merchandising.",
    eyebrow: "Independent retail",
    h1: "An online shop that lies about stock is worse than no shop.",
    intro:
      "Independent retailers win on curation and service — and lose on slow discovery, inaccurate stock and checkout friction. ScaleSmiths builds commerce journeys that respect supplier reality and margin, rather than chasing vanity catalogue size.",
    searchIntent:
      "For independent retailers and DTC operators struggling with product discovery, stock sync, variants, abandoned baskets or unclear shipping and returns.",
    buyer: "Owners and operators of independent retail and multi-channel brands.",
    presentation: "ecommerce",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Product discovery and checkout friction combine with fragile stock accuracy to burn margin and trust.",
    frictions: [
      {
        title: "Discovery without curation",
        symptom: "Customers cannot find the right variant or collection, so they bounce to marketplaces.",
        fix: "Information architecture and merchandising that match how your buyers browse.",
      },
      {
        title: "Stock fiction",
        symptom: "Overselling or ghost stock destroys trust faster than a plain “email for availability”.",
        fix: "Honest stock rules and supplier integration only where discovery proves it is feasible.",
      },
      {
        title: "Checkout friction",
        symptom: "Surprise shipping costs and unclear returns kill otherwise willing buyers.",
        fix: "Transparent shipping, returns and payment expectations before the final step.",
      },
      {
        title: "First vs repeat purchase",
        symptom: "The site optimises acquisition but makes reordering or loyalty awkward.",
        fix: "Repeat paths scoped to what the catalogue and ops can support.",
      },
    ],
    strategy: [
      { title: "Margin-aware commerce", description: "Prioritise products and journeys that the business can fulfil profitably." },
      { title: "Operational honesty", description: "Stock, shipping and returns reflect real constraints." },
      { title: "Measure the funnel", description: "Watch product views, add-to-cart, checkout starts and completed orders — not sessions alone." },
    ],
    journey: [
      { title: "Discover", description: "Buyer finds a product via search, collection or referral." },
      { title: "Evaluate", description: "Variants, stock and shipping expectations are clear." },
      { title: "Purchase", description: "Checkout completes without surprises." },
      { title: "Fulfil", description: "Ops receives accurate orders." },
      { title: "Return or repeat", description: "Returns and reorder paths are usable." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Retailers ready for a purposeful commerce site or rebuild.", whatNext: "Discovery around catalogue, payments, fulfilment and integrations." },
      { pathway: "growth", whoFor: "Merchants with a live shop needing conversion, content and technical improvement.", whatNext: "Growth Partnership." },
      { pathway: "systems", whoFor: "Operators needing deeper inventory, wholesale or multi-channel systems.", whatNext: "Custom systems / enterprise discussion." },
    ],
    proof: {
      level: "direct",
      workSlug: "pinkys-prints",
      label: "Direct commerce proof — Pinkys Prints",
      summary:
        "Pinkys Prints is a published ScaleSmiths e-commerce project. Apply its lessons carefully; every catalogue and fulfilment model differs.",
    },
    faqs: [
      { q: "Do you only build Shopify?", a: "No. Platform choice follows catalogue complexity, integrations and ops — decided in discovery, not by fashion." },
      { q: "Can you sync our supplier stock automatically?", a: "Only when the supplier feed and your operations make it reliable. We will say so if it is not feasible yet." },
      { q: "Will you promise a revenue percentage lift?", a: "No. We work on measurable funnel improvements; revenue depends on offer, traffic and operations." },
    ],
    relatedSolutionHrefs: ["/e-commerce-development-nottingham", "/custom-systems", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["printing-signage", "restaurants", "b2b-saas"],
    synonyms: ["online shop", "e-commerce", "DTC brand", "independent retailer", "Shopify merchant"],
    meaningfulMetrics: ["Add-to-cart rate", "Checkout completion", "Stock accuracy incidents", "Repeat purchase rate"],
    unknowns: ["Platform preference", "Supplier feed quality", "Shipping regions you actually serve"],
    showCustomSystems: true,
  },

  "precision-engineering": {
    id: "ind.precision-engineering",
    slug: "precision-engineering",
    hubSlug: "manufacturing-industrial",
    name: "Precision engineering & CNC",
    pluralName: "precision engineering firms",
    metaTitle: "Websites for Precision Engineers | ScaleSmiths",
    description:
      "Digital growth for CNC and precision manufacturers: capability pages, RFQ specifications, file uploads, procurement trust and long B2B decision cycles.",
    eyebrow: "Precision engineering",
    h1: "Procurement does not buy vibes. It buys capability it can verify.",
    intro:
      "B2B manufacturing websites fail when they read like consumer brands: vague claims, no tolerances, no RFQ path. ScaleSmiths helps engineering firms present verified capabilities and serious enquiry routes — and we refuse to invent machine specs we have not confirmed with you.",
    searchIntent:
      "For CNC and precision engineering firms whose website under-sells capability, attracts tyre-kickers, or has no usable RFQ and drawing-upload path.",
    buyer: "Owner-managers, sales engineers and operations leads handling RFQs.",
    presentation: "industrial",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Capability is real on the shop floor but invisible online, so RFQs are low-quality or never arrive.",
    frictions: [
      {
        title: "Capability without evidence",
        symptom: "The site says “precision engineering” without materials, tolerances, industries or certifications you can prove.",
        fix: "Capability pages grounded in verified equipment, materials and sectors — supplied by your team.",
      },
      {
        title: "RFQ underspecification",
        symptom: "Enquiries omit drawings, quantities, materials and deadlines.",
        fix: "Structured RFQ with secure file upload and the fields estimators need.",
      },
      {
        title: "Procurement trust gap",
        symptom: "Long-cycle buyers cannot find quality, compliance or contact accountability.",
        fix: "Clear company identity, process notes and human contacts — no fake office network.",
      },
      {
        title: "International enquiry noise",
        symptom: "Unqualified overseas enquiries consume quoting time.",
        fix: "Honest service-geography and qualification questions without pretending every region is equal.",
      },
    ],
    strategy: [
      { title: "Verified capability", description: "Publish only specs and certifications the firm confirms." },
      { title: "RFQ quality", description: "Make serious buyers successful; politely filter incomplete requests." },
      { title: "Long-cycle nurturing", description: "Content and follow-up that survive multi-stakeholder decisions." },
    ],
    journey: [
      { title: "Capability search", description: "Buyer looks for process, material or industry fit." },
      { title: "Evidence", description: "They check equipment, sectors and quality signals." },
      { title: "RFQ", description: "Drawings and requirements upload securely." },
      { title: "Qualification", description: "Your team reviews fit and responds." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Manufacturers ready to replace a brochure site with capability and RFQ infrastructure.", whatNext: "Scoped build after confirming publishable specs." },
      { pathway: "systems", whoFor: "Firms needing portals, estimating workflows or customer project spaces.", whatNext: "Custom systems / enterprise discovery." },
      { pathway: "growth", whoFor: "Firms with a solid site needing content and lead-quality improvement.", whatNext: "Growth Partnership." },
    ],
    proof: {
      level: "illustrative",
      label: "Illustrative industrial pattern",
      summary:
        "ScaleSmiths has deep custom-systems and engineering delivery experience, but no public precision-engineering case study is published yet. Treat examples here as proposed patterns pending authorised proof.",
    },
    faqs: [
      { q: "Will you list our machine tolerances from a brochure PDF?", a: "Only after your engineering lead confirms what may be published. Out-of-date specs are a liability." },
      { q: "Can buyers upload sensitive drawings?", a: "Yes when scoped, with retention and access rules agreed. We do not treat uploads casually." },
      { q: "Do you create city pages for manufacturers?", a: "No. Fake local SEO for industrial capability searches is the wrong tool." },
    ],
    relatedSolutionHrefs: ["/custom-systems", "/custom-software-development-uk", "/enterprise"],
    relatedIndustrySlugs: ["printing-signage", "b2b-saas", "accountants"],
    synonyms: ["CNC machining", "precision engineering", "metal fabrication", "contract machining"],
    meaningfulMetrics: ["RFQ completeness", "Qualified quote rate", "Time-to-first-engineering response"],
    unknowns: ["Publishable machine list", "Certification claims allowed", "File types and NDA requirements"],
    showCustomSystems: true,
  },

  "b2b-saas": {
    id: "ind.b2b-saas",
    slug: "b2b-saas",
    hubSlug: "technology-software",
    name: "B2B SaaS",
    pluralName: "B2B SaaS companies",
    metaTitle: "Growth Systems for B2B SaaS | ScaleSmiths",
    description:
      "Digital growth for B2B SaaS: demo activation, trial conversion, security assurance, integration docs and enterprise enquiry paths.",
    eyebrow: "B2B SaaS",
    h1: "Your homepage is not the product. The activation path is.",
    intro:
      "SaaS growth stalls when demos do not activate, security questions go unanswered, and enterprise buyers cannot find a serious path. ScaleSmiths works on product-led and sales-assisted journeys with the same engineering discipline we use on platforms — without promising magical conversion rates.",
    searchIntent:
      "For SaaS founders and product leads whose marketing site and product activation paths lose trials, bury security answers, or mishandle enterprise enquiries.",
    buyer: "Founders, product leads and GTM owners in B2B SaaS.",
    presentation: "saas",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Acquisition traffic meets weak activation, thin trust collateral and an enterprise path that feels amateur.",
    frictions: [
      {
        title: "Demo without activation",
        symptom: "Trials sign up and stall because onboarding and empty states do not teach the aha moment.",
        fix: "Joint marketing-and-product work on activation metrics, not just landing-page copy.",
      },
      {
        title: "Security questionnaire panic",
        symptom: "Enterprise deals stall while someone digs for answers that should be public.",
        fix: "Honest security and trust pages that match what you actually do — no fake SOC2 claims.",
      },
      {
        title: "Integration ambiguity",
        symptom: "Buyers cannot tell what is supported, documented or on the roadmap.",
        fix: "Clear integration status and docs routes maintained as product truth.",
      },
      {
        title: "Enterprise enquiry as a black hole",
        symptom: "“Contact sales” forms gather volume without stakeholder context.",
        fix: "Qualification that captures company size, use case and timeline without becoming hostile.",
      },
    ],
    strategy: [
      { title: "Activation over vanity", description: "Optimise for activated accounts and qualified pipeline." },
      { title: "Trust as infrastructure", description: "Security, privacy and status pages earn enterprise attention." },
      { title: "One honest GTM path", description: "Self-serve and sales-assisted routes stay coherent." },
    ],
    journey: [
      { title: "Problem discovery", description: "Buyer finds the product via search, peer or content." },
      { title: "Trust check", description: "Security, customers and docs reduce risk." },
      { title: "Try or talk", description: "Trial/demo or enterprise enquiry." },
      { title: "Activate", description: "Onboarding reaches first value." },
      { title: "Expand", description: "Usage and stakeholder buy-in grow." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Teams needing a sharper marketing site and clearer product entry points.", whatNext: "Scoped website/product marketing build." },
      { pathway: "systems", whoFor: "Teams needing product, billing, admin or integration engineering.", whatNext: "Custom systems / enterprise engagement." },
      { pathway: "growth", whoFor: "Teams with a live product needing ongoing conversion and content systems.", whatNext: "Growth Partnership." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "the-business-circle",
      label: "Adjacent platform proof — The Business Circle & Prymal",
      summary:
        "ScaleSmiths has published SaaS/platform engineering work including The Business Circle and Prymal. Treat those as adjacent product-engineering proof, not identical growth-marketing case studies for every niche.",
    },
    faqs: [
      { q: "Do you run paid acquisition?", a: "Paid media can be discussed inside an agreed partnership. We do not sell guaranteed CAC or ROAS." },
      { q: "Can you implement SSO / SOC2 for us?", a: "Engineering work can be scoped. We never claim certifications you do not hold." },
      { q: "Will you rewrite our entire product UI?", a: "Product UI work is scoped separately from a marketing site. We challenge scope that tries to smuggle a rebuild into a brochure project." },
    ],
    relatedSolutionHrefs: ["/custom-systems", "/enterprise", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["precision-engineering", "independent-retail", "accountants"],
    synonyms: ["SaaS", "B2B software", "product-led growth", "startup web app"],
    meaningfulMetrics: ["Trial activation", "Demo-to-opportunity rate", "Enterprise form quality", "Security-page engagement"],
    unknowns: ["Self-serve vs sales-led mix", "Current analytics instrumentation", "Security claims you can publish"],
    showCustomSystems: true,
  },

  "beauty-salons": {
    id: "ind.beauty-salons",
    slug: "beauty-salons",
    hubSlug: "fitness-beauty-personal-care",
    name: "Beauty salons",
    pluralName: "beauty salons",
    metaTitle: "Websites for Beauty Salons | ScaleSmiths",
    description:
      "Digital growth for beauty salons: service clarity, mobile booking paths, local trust and appointment-led conversion — with Glow Tanning experience.",
    eyebrow: "Beauty salons",
    h1: "Salon websites should make the next appointment feel inevitable.",
    intro:
      "Beauty buyers decide on phones, between scrolling competitors. ScaleSmiths builds salon journeys where services, prices you are willing to publish, and booking paths are obvious — grounded in appointment-led work such as Glow Tanning.",
    searchIntent:
      "For salon owners whose website under-explains services, hides booking, or fails to compete on local mobile search and trust.",
    buyer: "Salon owners and managers of appointment-led beauty businesses.",
    presentation: "clinic",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Service menus and booking paths are unclear on mobile, so browsers leave for a competitor with a simpler next step.",
    frictions: [
      {
        title: "Service menu sprawl",
        symptom: "Treatments are listed without duration, who-it-suits notes or clear categories.",
        fix: "Scannable service architecture with honest pricing rules (listed or “from”).",
      },
      {
        title: "Booking buried",
        symptom: "Guests must hunt for a third-party widget or DM on social.",
        fix: "Primary booking CTA that matches how you actually take appointments.",
      },
      {
        title: "Local trust thin",
        symptom: "Reviews and real photos are missing while stock imagery dominates.",
        fix: "Permissioned photography and review paths; no fake testimonials.",
      },
    ],
    strategy: [
      { title: "Mobile appointment path", description: "Services → proof → book in as few steps as possible." },
      { title: "Local visibility", description: "Structure and content that support genuine local discovery." },
      { title: "Maintainable offers", description: "Seasonal treatments can change without a full rebuild." },
    ],
    journey: [
      { title: "Local discovery", description: "Guest searches a treatment or salon nearby." },
      { title: "Service fit", description: "They confirm treatment, duration and expectations." },
      { title: "Trust", description: "Photos and reviews reduce risk." },
      { title: "Book", description: "Appointment path completes on mobile." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Salons ready for a purpose-built site and booking journey.", whatNext: "Scoped website build with booking provider validation." },
      { pathway: "growth", whoFor: "Salons with a site needing ongoing local visibility and conversion work.", whatNext: "Growth Partnership." },
      { pathway: "audit", whoFor: "Owners unsure what is costing bookings.", whatNext: "Optional Business Growth Audit." },
    ],
    proof: {
      level: "direct",
      workSlug: "glow-tanning",
      label: "Direct appointment-led proof — Glow Tanning",
      summary:
        "Glow Tanning is a published ScaleSmiths local business website in Hucknall. Beauty-salon patterns here build on that appointment-led work; treatment menus still differ by salon.",
    },
    faqs: [
      { q: "Do you only work with one booking provider?", a: "No. We integrate what you already use when it is sound, or recommend alternatives after discovery." },
      { q: "Can you guarantee fully booked diaries?", a: "No. We improve discovery and booking clarity; capacity and service quality remain yours." },
      { q: "Will you manage Instagram?", a: "Only when included in an agreed Growth Partnership scope." },
    ],
    relatedSolutionHrefs: ["/web-design-hucknall", "/local-growth", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["podiatry", "restaurants", "pest-control"],
    synonyms: ["beauty salon", "nail salon", "tanning salon", "hair and beauty"],
    meaningfulMetrics: ["Booking starts", "Mobile conversion", "Service-page engagement"],
    unknowns: ["Booking provider", "Which prices can be listed publicly", "Photography assets available"],
    showCustomSystems: false,
  },

  accountants: {
    id: "ind.accountants",
    slug: "accountants",
    hubSlug: "professional-services",
    name: "Accountants",
    pluralName: "accountancy firms",
    metaTitle: "Websites for Accountants | ScaleSmiths",
    description:
      "Digital growth for accountancy firms: service clarity, trust, enquiry quality and client onboarding paths — with professional advertising constraints respected.",
    eyebrow: "Accountants",
    h1: "Prospective clients compare process and responsiveness before they compare fees.",
    intro:
      "Accountancy buyers look for fit: personal vs limited company, sector experience, and how onboarding works. ScaleSmiths helps firms explain services and capture qualified enquiries — without crossing professional advertising rules we are not authorised to interpret for every jurisdiction.",
    searchIntent:
      "For accountancy partners whose website under-explains services, attracts poor-fit enquiries, or makes onboarding expectations unclear.",
    buyer: "Partners and practice managers in accountancy and bookkeeping firms.",
    presentation: "professional",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Generic service copy attracts mismatched enquiries while serious prospects cannot see process, sector fit or next steps.",
    frictions: [
      {
        title: "Generic “we do accounts” positioning",
        symptom: "Every firm sounds identical; differentiation never reaches the page.",
        fix: "Service and audience packaging based on who you actually want to take on.",
      },
      {
        title: "Poor-fit enquiries",
        symptom: "Leads arrive outside your client ideal, wasting partner time.",
        fix: "Qualification questions and clear “who we help” boundaries.",
      },
      {
        title: "Onboarding mystery",
        symptom: "Prospects do not know documents, timelines or communication norms.",
        fix: "A plain onboarding explanation that reduces anxiety before the first meeting.",
      },
      {
        title: "Compliance advertising risk",
        symptom: "Marketing claims drift into regulated territory without review.",
        fix: "Conservative copy and professional-body review where required — we do not invent legal clearance.",
      },
    ],
    strategy: [
      { title: "Positioning with teeth", description: "Say who you help and how engagement works." },
      { title: "Enquiry quality", description: "Capture entity type, software and urgency." },
      { title: "Trust without hype", description: "People, process and clarity beat hollow superlatives." },
    ],
    journey: [
      { title: "Problem search", description: "Buyer looks for an accountant for their situation." },
      { title: "Fit check", description: "Services, sector notes and people reduce mismatch." },
      { title: "Enquire", description: "Structured form or call request." },
      { title: "Discovery meeting", description: "Your team qualifies with context already captured." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Firms ready for a clearer service site and enquiry path.", whatNext: "Scoped website build with partner-approved claims." },
      { pathway: "growth", whoFor: "Firms with a site needing content and conversion improvement.", whatNext: "Growth Partnership." },
      { pathway: "systems", whoFor: "Firms needing client portals or intake automation.", whatNext: "Custom systems discovery." },
    ],
    proof: {
      level: "illustrative",
      label: "Illustrative professional-services pattern",
      summary:
        "No accountancy case study is published yet. Patterns here are illustrative and must be reviewed against your professional body’s advertising rules before go-live.",
    },
    faqs: [
      { q: "Can you promise lead volume?", a: "No. We improve clarity and enquiry quality; volume depends on market, reputation and capacity." },
      { q: "Will you handle professional-body advertising approval?", a: "You remain responsible for regulated advertising compliance. We draft conservatively and flag claims that need your review." },
      { q: "Do you integrate Xero / QuickBooks portals?", a: "Client portal and tooling integrations are scoped after discovery — not assumed in a foundation website price." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/custom-systems", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["b2b-saas", "precision-engineering", "podiatry"],
    synonyms: ["accountant", "accountancy firm", "bookkeeper", "tax adviser", "CPA"],
    meaningfulMetrics: ["Qualified enquiry rate", "Poor-fit lead reduction", "Time-to-first-response"],
    unknowns: ["Ideal client profile", "Jurisdictions you serve", "Which claims partners will approve"],
    showCustomSystems: true,
  },
}

export function allIndustryPages(): IndustryPage[] {
  return Object.values(industryPages)
}

export function publishedIndustryPages(): IndustryPage[] {
  return allIndustryPages().filter((page) => page.state === "published")
}

export function getIndustryPage(slug: string): IndustryPage | undefined {
  const page = industryPages[slug]
  return page?.state === "published" ? page : undefined
}

export function industryPagesForHub(hubSlug: string): IndustryPage[] {
  return publishedIndustryPages().filter((page) => page.hubSlug === hubSlug)
}
