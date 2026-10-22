import type { IndustryPage } from "./types"

/**
 * Second-wave specialist pages. Each one has to be recognisable to someone who
 * runs that kind of business. Candidates that cannot clear that bar stay unpublished.
 */
export const industryPagesWaveTwo: Record<string, IndustryPage> = {
  plumbers: {
    id: "ind.plumbers",
    slug: "plumbers",
    hubSlug: "trades-home-services",
    name: "Plumbers",
    pluralName: "plumbing businesses",
    metaTitle: "Websites for Plumbers | ScaleSmiths",
    description:
      "Plumbing websites that separate emergency call-outs from planned bathrooms, and collect the address, photos and postcode a quote needs.",
    eyebrow: "Plumbing",
    h1: "A burst pipe and a bathroom refit should not share one contact box.",
    intro:
      "Plumbing demand arrives in two speeds. A leak needs a number and a coverage answer. A bathroom needs photos, access and a date. ScaleSmiths builds those as different journeys so the office stops reconstructing the job on the first phone call.",
    searchIntent:
      "For plumbing owners whose website sends emergency callers and planned quotes through the same form, or hides the number on a phone.",
    buyer: "Plumbing owners and office staff who book call-outs and quote planned work.",
    presentation: "trades",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Emergency leaks and planned installations arrive with the same thin details, so the first conversation is spent collecting the address and the fault.",
    frictions: [
      {
        title: "Leak and bathroom share one form",
        symptom: "A night-time leak and a six-week bathroom both land as “please call me”.",
        fix: "Separate emergency and planned routes, with a phone action on the first and photos on the second.",
      },
      {
        title: "Postcode is a second call",
        symptom: "The office cannot tell if the job is in area until someone rings back.",
        fix: "Show the areas you cover and ask for the postcode before the callback is booked.",
      },
      {
        title: "Cylinder and boiler work look identical",
        symptom: "Specialist jobs are buried under a single plumbing paragraph.",
        fix: "Give commercially important jobs their own page, proof and quote questions.",
      },
    ],
    strategy: [
      { title: "Two speeds of enquiry", description: "Emergency call-outs and planned work get different pages, actions and expectations." },
      { title: "Quote context up front", description: "Photos, property type and access notes arrive before a survey is booked." },
      { title: "Coverage in plain language", description: "Towns and postcodes you actually serve, not a map of places you would like to rank for." },
    ],
    journey: [
      { title: "Fault or project search", description: "The buyer looks for a leak, a boiler or a bathroom." },
      { title: "Matching page", description: "They land on the route that matches the speed of the job." },
      { title: "Area check", description: "They can see whether you cover the address." },
      { title: "Usable enquiry", description: "Call, or a form with photos and the fault." },
      { title: "Your dispatch", description: "The office decides, with the context already written down." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Firms whose site cannot separate leaks from planned work.", whatNext: "A scoped website with both journeys and a mobile call path." },
      { pathway: "growth", whoFor: "Firms with a usable site who need the pages and the follow-up kept current.", whatNext: "A Growth Partnership around search, conversion and maintenance." },
      { pathway: "audit", whoFor: "Owners unsure whether the site, the coverage pages or the office process is the constraint.", whatNext: "Optional Business Growth Audit before a rebuild." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "confirm-a-kill",
      label: "Adjacent trades proof — Confirm-A-Kill",
      summary:
        "Confirm-A-Kill is a pest-control site, not a plumbing delivery. It shows the emergency-versus-planned split a plumbing office can use. It is not a claim that the same result was delivered for a plumber.",
    },
    faqs: [
      { q: "Can the emergency number stay click-to-call on a phone?", a: "Yes. The emergency route is designed so the number is usable without a long scroll." },
      { q: "Do you write Gas Safe claims for plumbers?", a: "Only the registrations you hold and can show. We do not add scheme marks a business has not earned." },
      { q: "Will a page for every town help a plumber rank?", a: "A town page with nothing distinct on it does not. We publish coverage that matches where you work." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/digital-growth-partnership", "/web-design-nottingham"],
    relatedIndustrySlugs: ["hvac", "locksmiths", "electricians"],
    synonyms: ["plumber", "emergency plumber", "bathroom fitter", "boiler installer"],
    meaningfulMetrics: ["Emergency calls with a postcode", "Planned quotes that include photos", "Jobs declined because they were out of area"],
    unknowns: ["Which job system you use", "Whether boilers and bathrooms are separate teams", "The postcodes you will not travel to"],
    showCustomSystems: false,
  },

  hvac: {
    id: "ind.hvac",
    slug: "hvac",
    hubSlug: "trades-home-services",
    name: "HVAC and heating",
    pluralName: "heating and air-conditioning businesses",
    metaTitle: "Heating Engineer Websites | ScaleSmiths",
    description:
      "Websites for heating and air-conditioning firms: breakdowns, planned installs, servicing contracts and seasonal demand that the office can actually schedule.",
    eyebrow: "Heating and HVAC",
    h1: "Breakdowns, installs and service contracts are three different diaries.",
    intro:
      "A heating business sells urgency in winter, surveys in spring and contracts all year. One contact form mixes a no-heating call with a commercial plant quote. ScaleSmiths separates those journeys and the information each one needs.",
    searchIntent:
      "For heating and air-conditioning owners whose site treats a breakdown, a new system and a maintenance contract as the same enquiry.",
    buyer: "Heating engineers, HVAC contractors and the people who schedule them.",
    presentation: "trades",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Seasonal breakdowns and high-value installs share one path, so the diary fills with incomplete requests while contract renewals have nowhere obvious to go.",
    frictions: [
      {
        title: "No-heat calls wait behind surveys",
        symptom: "A household without heating and a commercial survey sit in the same inbox.",
        fix: "A breakdown route with a call action, and a survey route that collects property and system type.",
      },
      {
        title: "Service plans are invisible",
        symptom: "Existing customers cannot see how to book a service or what the plan includes.",
        fix: "A contract page that states what is included, how to book, and who it is for.",
      },
      {
        title: "System type is missing from the lead",
        symptom: "The office asks whether it is a boiler, a heat pump or a commercial plant on every call.",
        fix: "The enquiry asks for the system and the fuel before anyone is dispatched.",
      },
    ],
    strategy: [
      { title: "Diary by job type", description: "Breakdown, install and contract pages match how the board is already planned." },
      { title: "Seasonal pages with a purpose", description: "Winter breakdown content is useful only if it tells people what you can attend and when." },
      { title: "Commercial versus domestic", description: "Plant rooms and houses do not share a quote form." },
    ],
    journey: [
      { title: "Seasonal search", description: "The buyer needs a repair, a replacement or a service plan." },
      { title: "Job-type page", description: "They see the route that matches the diary." },
      { title: "System details", description: "Fuel, property and urgency are captured." },
      { title: "Schedule or survey", description: "Your team books the right kind of visit." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Firms whose site is a single heating page.", whatNext: "A scoped build around breakdowns, installs and contracts." },
      { pathway: "growth", whoFor: "Firms who already have a site and need seasonal content kept honest.", whatNext: "Growth Partnership for search, pages and conversion." },
      { pathway: "systems", whoFor: "Firms who want servicing reminders or a customer portal after the website is clear.", whatNext: "Custom systems discovery, scoped separately." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "confirm-a-kill",
      label: "Adjacent emergency-service proof — Confirm-A-Kill",
      summary:
        "The adjacent example is a pest-control emergency journey, not a heating installation. Use it as the pattern for separating urgent and planned work. It is not a heating case study.",
    },
    faqs: [
      { q: "Can servicing customers book without calling?", a: "When you want them to. Many firms keep breakdowns on the phone and put planned servicing on a form or a booking link." },
      { q: "Will you claim a heat-pump grant outcome?", a: "No. Grant rules change and we will not publish an incentive you cannot evidence." },
      { q: "How should a heating firm handle a winter spike?", a: "The site should say what you can attend and offer a clear next step when the diary is full, including a planned callback." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/custom-systems", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["plumbers", "electricians", "roofing"],
    synonyms: ["heating engineer", "boiler service", "air conditioning", "HVAC"],
    meaningfulMetrics: ["Breakdown calls with a system type", "Survey requests that include the property", "Service-plan enquiries"],
    unknowns: ["Domestic versus commercial split", "Whether you sell service contracts", "The booking tool you already pay for"],
    showCustomSystems: true,
  },

  builders: {
    id: "ind.builders",
    slug: "builders",
    hubSlug: "trades-home-services",
    name: "Builders",
    pluralName: "building and renovation businesses",
    metaTitle: "Websites for Builders | ScaleSmiths",
    description:
      "Websites for builders and renovation firms: extensions, refurbishments and the drawings, budget range and access notes an estimator needs.",
    eyebrow: "Builders and renovations",
    h1: "A renovation enquiry without drawings is a conversation, not a lead.",
    intro:
      "Extension and refurbishment buyers arrive with a house, a hope and a budget they may not want to say. The useful website shows the kind of work you take, the proof of similar jobs, and a way to send drawings or photos before a site meeting.",
    searchIntent:
      "For building firms whose enquiries arrive as “can you do an extension?” with no address, drawings or sense of budget.",
    buyer: "Owners and estimators at building and renovation firms.",
    presentation: "trades",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "High-value building enquiries arrive without drawings, budget range or site access, so estimating time is spent qualifying work that was never ready.",
    frictions: [
      {
        title: "Extensions and repairs look the same",
        symptom: "A cracked wall and a two-storey extension share a gallery and a phone number.",
        fix: "Separate project types that you actually want more of, each with relevant proof.",
      },
      {
        title: "No drawings, no budget band",
        symptom: "The first meeting is a discovery you could have done from a form.",
        fix: "Ask for photos or drawings, the property, the timing and a budget band the buyer chooses.",
      },
      {
        title: "Planning status is a surprise",
        symptom: "You find out on site that permission has not been considered.",
        fix: "The enquiry asks whether drawings or planning advice already exist, without pretending you are the planning authority.",
      },
    ],
    strategy: [
      { title: "Project types you want", description: "Pages for the work you want more of, not a list of every trade you could subcontract." },
      { title: "Proof beside the project", description: "Photos of comparable jobs sit on the page the buyer is reading." },
      { title: "Estimator-ready briefs", description: "The form collects the minimum that makes a site visit worthwhile." },
    ],
    journey: [
      { title: "Project search", description: "The buyer looks for an extension, a renovation or a named builder." },
      { title: "Fit and proof", description: "They see similar work and how you start." },
      { title: "Brief", description: "Drawings, photos, timing and a budget band." },
      { title: "Site meeting", description: "Your estimator arrives with a file, not a blank notebook." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Firms whose brochure site cannot explain project types.", whatNext: "Scoped website around the work you want to win." },
      { pathway: "growth", whoFor: "Firms who need the gallery and the pages maintained as jobs finish.", whatNext: "Growth Partnership." },
      { pathway: "audit", whoFor: "Owners unsure which service is worth a page.", whatNext: "Optional audit before the structure is built." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "precision-finish-plastering-rendering",
      label: "Adjacent home-improvement proof — Precision Finish",
      summary:
        "Precision Finish is a plastering and rendering site, not a main-contractor case study. It shows specialist proof and a quote path for home improvement work. It is not a claimed building-firm delivery.",
    },
    faqs: [
      { q: "Should a builder publish prices?", a: "A budget band the buyer selects is more honest than a fixed extension price. Published build prices for the website itself stay on the ScaleSmiths pricing page." },
      { q: "Can homeowners upload plans?", a: "Yes when scoped. File types, size limits and how long you keep the files are agreed first." },
      { q: "Do you design the extension as well as the website?", a: "No. We build the digital system. Architectural design stays with the people qualified to do it." },
    ],
    relatedSolutionHrefs: ["/web-design-nottingham", "/local-growth", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["plastering-rendering", "roofing", "plumbers"],
    synonyms: ["builder", "general contractor", "home extensions", "renovation"],
    meaningfulMetrics: ["Enquiries with drawings or photos", "Site visits that were worth making", "Project types that convert"],
    unknowns: ["Which project types you want more of", "Whether you employ estimators", "How you handle planning-stage leads"],
    showCustomSystems: false,
  },

  locksmiths: {
    id: "ind.locksmiths",
    slug: "locksmiths",
    hubSlug: "trades-home-services",
    name: "Locksmiths",
    pluralName: "locksmith businesses",
    metaTitle: "Websites for Locksmiths | ScaleSmiths",
    description:
      "Locksmith websites for emergency lockouts and planned security upgrades, with coverage, response expectations and a mobile call path.",
    eyebrow: "Locksmiths",
    h1: "A lockout is decided in the time it takes to find a number.",
    intro:
      "Locksmith buyers are often locked out, on a phone, and comparing whoever answers clearly. Planned work — locks, access control, a shopfront — can wait for a quote. The website has to do both without looking like a national call centre you are not.",
    searchIntent:
      "For locksmiths whose emergency number is hard to find on a phone, or whose planned security work has no serious quote path.",
    buyer: "Locksmith owners covering domestic call-outs and planned security work.",
    presentation: "trades",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Emergency callers cannot find a number and a coverage answer quickly, while planned security quotes arrive with no property or lock detail.",
    frictions: [
      {
        title: "The number is below the story",
        symptom: "A locked-out caller scrolls through a company history before they can tap to call.",
        fix: "The emergency route leads with the number, the hours and where you attend.",
      },
      {
        title: "Response claims with no basis",
        symptom: "“We arrive in 20 minutes” is published for areas the van cannot reach.",
        fix: "State the coverage and the response you will actually stand behind, including when you cannot attend.",
      },
      {
        title: "Commercial locks have no specification",
        symptom: "Shopfront and access-control enquiries arrive as a name and a number.",
        fix: "A planned-work form asks for the property, the lock problem and any photos.",
      },
    ],
    strategy: [
      { title: "Mobile emergency path", description: "Call, coverage and hours are the page, not a footnote." },
      { title: "Honest attendance", description: "Say where you go and what happens when you are already on a job." },
      { title: "Planned security quotes", description: "Upgrades and commercial work collect the specification before a visit." },
    ],
    journey: [
      { title: "Lockout or upgrade", description: "The buyer is either locked out or planning a change." },
      { title: "Trust scan", description: "Coverage, identity and a real phone number." },
      { title: "Call or specify", description: "Tap to call, or send the property and the problem." },
      { title: "Your decision", description: "Attend, schedule or decline with the facts in front of you." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Locksmiths whose current site hides the number or mixes every job.", whatNext: "A scoped mobile-first site with both routes." },
      { pathway: "growth", whoFor: "Locksmiths who need coverage and service pages kept accurate.", whatNext: "Growth Partnership." },
      { pathway: "audit", whoFor: "Owners who suspect the site is losing emergency calls.", whatNext: "Optional audit of the mobile journey." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "confirm-a-kill",
      label: "Adjacent emergency-call proof — Confirm-A-Kill",
      summary:
        "Confirm-A-Kill shows an urgent mobile journey for pest control. A locksmith can use the same clarity. It is adjacent proof, not a locksmith project.",
    },
    faqs: [
      { q: "Should a locksmith publish a fixed call-out fee?", a: "Only if that fee is real for the jobs and the areas you mean. We will not invent a price to make the page look decisive." },
      { q: "Can you stop the site looking like a lead-generation directory?", a: "Yes. The page should show the business the customer will actually meet, including where you work." },
      { q: "Do you integrate dispatch software for locksmiths?", a: "Only after we know the product. It is not included in a foundation website by default." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/web-design-hucknall", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["plumbers", "electricians", "pest-control"],
    synonyms: ["locksmith", "emergency locksmith", "lockout", "access control"],
    meaningfulMetrics: ["Emergency calls from mobile", "Planned quotes with a property photo", "Out-of-area enquiries declined early"],
    unknowns: ["Hours you actually cover", "Domestic versus commercial mix", "Whether a fixed call-out fee is true"],
    showCustomSystems: false,
  },

  cleaning: {
    id: "ind.cleaning",
    slug: "cleaning",
    hubSlug: "trades-home-services",
    name: "Cleaning companies",
    pluralName: "cleaning companies",
    metaTitle: "Cleaning Company Websites | ScaleSmiths",
    description:
      "Websites for cleaning firms that separate domestic jobs, commercial contracts and specialist cleans, and collect the site details a quote needs.",
    eyebrow: "Cleaning",
    h1: "A one-off house clean and a commercial contract are not the same sale.",
    intro:
      "Cleaning companies lose margin when a domestic booking, a contract clean and a specialist job all arrive as “how much to clean?”. The website should ask different questions for each, and show the work you want more of.",
    searchIntent:
      "For cleaning-company owners whose quotes start without the size of the site, the frequency, or whether the job is domestic or commercial.",
    buyer: "Owners of domestic, commercial and specialist cleaning firms.",
    presentation: "trades",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Domestic, commercial and specialist cleaning enquiries share one form, so quotes are guessed from a phone call and contract leads look like one-off jobs.",
    frictions: [
      {
        title: "Frequency is missing from the enquiry",
        symptom: "Nobody has said whether this is a one-off, a weekly clean or a contract.",
        fix: "Ask for frequency, and route contracts away from one-off bookings.",
      },
      {
        title: "Floor area arrives later",
        symptom: "The price depends on rooms, floors or square metres you do not have.",
        fix: "The form asks for the size measure you actually price on.",
      },
      {
        title: "Specialist cleans are unnamed",
        symptom: "End of tenancy, builders’ cleans and carpet work are invisible.",
        fix: "Pages for the specialist jobs that have their own price logic.",
      },
    ],
    strategy: [
      { title: "Three commercial routes", description: "Domestic, contract and specialist pages, only where you offer them." },
      { title: "Pricing inputs, not a fake calculator", description: "Collect the inputs you use. Do not publish a calculator that ignores access, condition or extras." },
      { title: "Contract follow-up", description: "Commercial leads name the site, the frequency and the decision maker." },
    ],
    journey: [
      { title: "Job-type search", description: "The buyer wants a home clean, a contract or a specialist service." },
      { title: "Scope questions", description: "Size, frequency and access are asked up front." },
      { title: "Quote or booking", description: "One-offs and contracts do not share a confirmation." },
      { title: "Your schedule", description: "The job lands with enough detail to price or to decline." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Firms whose site is one cleaning paragraph.", whatNext: "Scoped pages for the services you sell." },
      { pathway: "growth", whoFor: "Firms who need local visibility and quote quality improved over time.", whatNext: "Growth Partnership." },
      { pathway: "systems", whoFor: "Firms ready to connect enquiries to scheduling once the offer is clear.", whatNext: "Systems discovery after the journeys exist." },
    ],
    proof: {
      level: "illustrative",
      label: "Illustrative cleaning pattern",
      summary:
        "No cleaning case study is published. This page is illustrative: it describes the enquiry split we would build, and it is not a claimed cleaning-company delivery.",
    },
    faqs: [
      { q: "Can you add an instant cleaning price calculator?", a: "Only if your pricing really is a formula. Most firms are better served by structured quotes than by a number the site invents." },
      { q: "Do domestic customers need an account?", a: "Not by default. An account is justified when repeat booking or contract management needs it." },
      { q: "Will you promise a cleaner a full diary?", a: "No. The site can make the right enquiry easier. Capacity and reputation decide the diary." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/custom-systems", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["plumbers", "builders", "independent-retail"],
    synonyms: ["commercial cleaning", "domestic cleaner", "end of tenancy", "carpet cleaning"],
    meaningfulMetrics: ["Quotes with a frequency", "Contract leads with a site size", "One-off bookings that match the service"],
    unknowns: ["How you price", "Which specialist cleans you want", "The scheduling tool already in use"],
    showCustomSystems: true,
  },

  physiotherapy: {
    id: "ind.physiotherapy",
    slug: "physiotherapy",
    hubSlug: "healthcare-wellness",
    name: "Physiotherapy",
    pluralName: "physiotherapy clinics",
    metaTitle: "Physiotherapy Clinic Websites | ScaleSmiths",
    description:
      "Clinic websites for physiotherapy: who you treat, what a first appointment involves, and a booking path reception can trust. No treatment promises.",
    eyebrow: "Physiotherapy",
    h1: "Patients need to know if this clinic sees their problem.",
    intro:
      "People looking for physiotherapy arrive with a pain, a referral or a sport, and a limited sense of who can help. The site should explain who the clinic sees, what the first visit involves, and how to book — without promising a recovery the clinician has not assessed.",
    searchIntent:
      "For physiotherapy clinics whose treatment pages are vague and whose booking path does not tell reception what the patient is asking about.",
    buyer: "Clinic owners, practice managers and physiotherapists responsible for new-patient enquiries.",
    presentation: "clinic",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "New patients cannot tell whether the clinic treats their problem, so bookings arrive without the context reception needs and some people never book at all.",
    frictions: [
      {
        title: "Conditions are a single paragraph",
        symptom: "Back pain, post-operative work and sports injuries compete in one block of text.",
        fix: "Pages for the problems you genuinely treat, reviewed by a clinician before publication.",
      },
      {
        title: "The first visit is unexplained",
        symptom: "Patients do not know the length, the cost conversation or what to bring.",
        fix: "A plain account of the first appointment, written by the clinic.",
      },
      {
        title: "Referral and self-pay collide",
        symptom: "Reception cannot see whether the person has a referral, an insurer or is paying themselves.",
        fix: "The booking path asks which of those applies, without collecting clinical records on a marketing form.",
      },
    ],
    strategy: [
      { title: "Problems you treat", description: "Content follows the caseload, not a directory of every condition." },
      { title: "Practitioner visibility", description: "Patients can see who they might meet and how to reach the clinic." },
      { title: "Reception-ready bookings", description: "The request includes the problem in the patient’s words and the funding route." },
    ],
    journey: [
      { title: "Problem search", description: "The patient looks for a physiotherapist or a named condition." },
      { title: "Fit", description: "They see whether the clinic treats it and what happens first." },
      { title: "Book or ask", description: "A booking link or a short form reception can read." },
      { title: "Clinical decision", description: "The clinician, not the website, decides the treatment." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Clinics whose site does not explain the first appointment.", whatNext: "A scoped clinic site with clinician-approved copy." },
      { pathway: "growth", whoFor: "Clinics with a site that needs pages and booking clarity maintained.", whatNext: "Growth Partnership." },
      { pathway: "audit", whoFor: "Practices unsure whether bookings fail on the site or at reception.", whatNext: "Optional audit." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "foot-works-podiatry",
      label: "Adjacent clinic proof — Foot Works",
      summary:
        "Foot Works is a podiatry website, not a physiotherapy delivery. It is adjacent proof of a clinic journey. It is not a claim of clinical outcomes for physiotherapy.",
    },
    faqs: [
      { q: "Will the site diagnose a patient?", a: "No. It helps someone decide whether to make contact. Assessment stays with the clinician." },
      { q: "Can you integrate our physiotherapy booking software?", a: "If you already use one, we connect the path to it when the product and the privacy fit are confirmed." },
      { q: "Do you publish patient recovery percentages?", a: "No. Recovery figures appear only when the clinic already holds them and has approved the wording." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/services/business-growth-audit", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["podiatry", "dental-practices", "veterinary-clinics"],
    synonyms: ["physiotherapist", "sports injury clinic", "physio"],
    meaningfulMetrics: ["Bookings that name the problem", "Enquiries that were not a clinical fit", "First appointments with a funding route"],
    unknowns: ["Booking system", "Conditions you will not treat", "How referrals arrive today"],
    showCustomSystems: false,
  },

  "dental-practices": {
    id: "ind.dental-practices",
    slug: "dental-practices",
    hubSlug: "healthcare-wellness",
    name: "Dental practices",
    pluralName: "dental practices",
    metaTitle: "Dental Practice Websites | ScaleSmiths",
    description:
      "Dental practice websites that explain treatments, clinicians and how to enquire, with advertising claims kept inside what the practice can defend.",
    eyebrow: "Dental practices",
    h1: "A dental website should answer the question before it asks for a booking.",
    intro:
      "New patients compare treatments, clinicians, nervous-patient information and how to register or book. A dental site that leads with a generic smile and a buried phone number creates work for reception and anxiety for the patient. ScaleSmiths builds the structure. The practice approves every clinical claim.",
    searchIntent:
      "For dental practices whose treatment information is thin and whose new-patient route does not tell reception what the person wants.",
    buyer: "Practice owners, practice managers and clinicians responsible for new-patient enquiries.",
    presentation: "clinic",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Treatment pages and the new-patient route do not say what the practice offers or what reception should prepare, so calls start from zero.",
    frictions: [
      {
        title: "Treatments are a price list without context",
        symptom: "Implants, hygiene and emergencies look like three links with no explanation.",
        fix: "A page per treatment family the practice wants, written so a patient can tell if it applies.",
      },
      {
        title: "Nervous patients have nowhere to look",
        symptom: "People who need reassurance leave because the site never addresses the visit itself.",
        fix: "A plain description of what happens on arrival, approved by the practice.",
      },
      {
        title: "Emergency and registration share a button",
        symptom: "A broken tooth and a new-patient registration create the same task.",
        fix: "Separate emergency contact from registration and routine booking.",
      },
    ],
    strategy: [
      { title: "Treatment families", description: "Explain the treatments you want patients to understand, and leave out the ones you do not offer." },
      { title: "Clinician trust", description: "Show who works at the practice and how to reach them through reception." },
      { title: "Claim discipline", description: "No before-and-after stories and no outcome lines the practice has not approved." },
    ],
    journey: [
      { title: "Treatment or practice search", description: "The patient looks for a dentist, a treatment or emergency help." },
      { title: "Expectation", description: "They read what the visit involves." },
      { title: "Correct route", description: "Emergency, registration or routine contact." },
      { title: "Reception", description: "The task arrives with the treatment the patient named." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Practices replacing a template that hides clinicians and treatments.", whatNext: "Scoped site with practice-approved copy." },
      { pathway: "growth", whoFor: "Practices that need pages and offers kept current.", whatNext: "Growth Partnership." },
      { pathway: "audit", whoFor: "Practices unsure which treatment pages are worth having.", whatNext: "Optional audit before rewriting the site." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "foot-works-podiatry",
      label: "Adjacent clinical-practice proof — Foot Works",
      summary:
        "Foot Works is podiatry, not dentistry. The adjacent lesson is clarity and a contact path. Dental advertising rules and clinical claims remain the practice’s to approve. This is not a dental case study.",
    },
    faqs: [
      { q: "Can you publish dental implant prices?", a: "Only the figures the practice confirms are current. We will not invent a from-price for a treatment." },
      { q: "Will you use stock smiles as if they were patients?", a: "No. Photography is either the practice’s own, with permission, or clearly not presented as a patient result." },
      { q: "Do you replace our dental patient software?", a: "No. We link to the booking or contact route you choose. Replacing clinical software is a different project." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/digital-growth-partnership", "/services/business-growth-audit"],
    relatedIndustrySlugs: ["physiotherapy", "podiatry", "beauty-salons"],
    synonyms: ["dentist", "dental clinic", "orthodontist", "hygienist"],
    meaningfulMetrics: ["New-patient enquiries that name a treatment", "Emergency contacts separated from registrations", "Pages the practice has approved"],
    unknowns: ["Which treatments you want emphasised", "Booking or registration process", "What the practice will allow in public copy"],
    showCustomSystems: false,
  },

  "veterinary-clinics": {
    id: "ind.veterinary-clinics",
    slug: "veterinary-clinics",
    hubSlug: "healthcare-wellness",
    name: "Veterinary clinics",
    pluralName: "veterinary clinics",
    metaTitle: "Veterinary Clinic Websites | ScaleSmiths",
    description:
      "Veterinary websites that separate emergency care from routine appointments, and show an owner how to reach the practice. No clinical outcome claims.",
    eyebrow: "Veterinary clinics",
    h1: "An owner with a sick animal needs the emergency path, not the newsletter.",
    intro:
      "Veterinary visits split into emergencies, routine care and planned procedures. Owners are worried and usually on a phone. The site should show whether you are open, how to reach the duty team, and what a routine appointment involves.",
    searchIntent:
      "For veterinary clinics whose emergency instructions are hard to find and whose routine booking does not say which species or service the owner needs.",
    buyer: "Practice managers and clinical directors responsible for client contact.",
    presentation: "clinic",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Emergency and routine care share one phone number explanation, so owners in a crisis miss the out-of-hours instruction and routine bookings arrive without the species or the reason.",
    frictions: [
      {
        title: "Out-of-hours instructions are buried",
        symptom: "The duty arrangement is a paragraph under a photo of a dog.",
        fix: "Emergency and out-of-hours instructions are the first thing on that route, including when you refer elsewhere.",
      },
      {
        title: "Species and reason are missing",
        symptom: "Reception asks “what animal, and what for?” on every booking.",
        fix: "The routine form asks for species, the reason in the owner’s words, and the preferred contact.",
      },
      {
        title: "Branch differences are invisible",
        symptom: "Multi-site clinics send people to the wrong building.",
        fix: "Each location states the services and the hours that are true for that building.",
      },
    ],
    strategy: [
      { title: "Emergency first", description: "Crisis instructions are impossible to miss on a phone." },
      { title: "Routine with a reason", description: "Bookings carry species and the owner’s description of the problem." },
      { title: "No invented medicine", description: "The site does not diagnose and does not promise an outcome." },
    ],
    journey: [
      { title: "Crisis or routine", description: "The owner is either worried now or planning a visit." },
      { title: "Correct instruction", description: "They see hours, duty cover or how to request a routine slot." },
      { title: "Useful request", description: "Species and reason travel with the booking." },
      { title: "Clinical team", description: "The practice decides the care. The website stops at contact." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Clinics whose emergency information is hard to find.", whatNext: "A scoped site with separate emergency and routine routes." },
      { pathway: "growth", whoFor: "Clinics that need hours, services and location facts kept true.", whatNext: "Growth Partnership." },
      { pathway: "audit", whoFor: "Practices that do not know which calls are failing.", whatNext: "Optional audit of the contact journey." },
    ],
    proof: {
      level: "illustrative",
      label: "Illustrative veterinary pattern",
      summary:
        "No veterinary case study is published. The emergency-versus-routine split is illustrative and is not a claimed clinic delivery or a clinical result.",
    },
    faqs: [
      { q: "Can the website tell an owner whether to come in?", a: "It can show how to reach the duty team. It must not decide that an animal is or is not an emergency." },
      { q: "Do you write pet-health articles?", a: "We can structure them. A clinician reviews them before they are treated as advice." },
      { q: "Will you list out-of-hours fees you have not confirmed?", a: "No. Fees and referral arrangements are published only when the practice confirms they are current." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/digital-growth-partnership", "/services/business-growth-audit"],
    relatedIndustrySlugs: ["physiotherapy", "podiatry", "dental-practices"],
    synonyms: ["vet", "veterinary practice", "animal clinic", "emergency vet"],
    meaningfulMetrics: ["Emergency contacts that found the duty instructions", "Routine bookings with species and reason", "Wrong-branch visits you can see in reception feedback"],
    unknowns: ["Out-of-hours arrangement", "Species you treat", "How many buildings the site must explain"],
    showCustomSystems: false,
  },

  "metal-fabrication": {
    id: "ind.metal-fabrication",
    slug: "metal-fabrication",
    hubSlug: "manufacturing-industrial",
    name: "Metal fabrication",
    pluralName: "metal fabrication businesses",
    metaTitle: "Metal Fabrication Websites | ScaleSmiths",
    description:
      "Websites for fabrication shops: processes, materials and an RFQ that asks for drawings, quantity and finish before estimating starts.",
    eyebrow: "Metal fabrication",
    h1: "Estimating starts when the drawing arrives, not when the email does.",
    intro:
      "Fabrication buyers send a sketch, a STEP file or a sentence. The shops that waste the least time are the ones whose website says which processes they run and which facts an RFQ must include. ScaleSmiths builds that path. The quote remains yours.",
    searchIntent:
      "For fabrication businesses whose website lists “steel and aluminium” and whose RFQs arrive without a drawing, a quantity or a finish.",
    buyer: "Owners and estimators in fabrication, welding and sheet-metal shops.",
    presentation: "industrial",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Capability is described in general terms and RFQs arrive without drawings or quantities, so estimators spend the first hour asking for the file.",
    frictions: [
      {
        title: "Processes are a logo row",
        symptom: "Laser, fold, weld and powder coat are icons with no indication of what you will take on.",
        fix: "A short account of each process you want enquiries for, confirmed by the shop.",
      },
      {
        title: "RFQs arrive without a file",
        symptom: "The email says “can you make this?” and attaches nothing.",
        fix: "The form requires a drawing or an explicit note that the buyer needs help producing one.",
      },
      {
        title: "Finish and quantity are later",
        symptom: "Price depends on batch size and coating you hear about on the second call.",
        fix: "Quantity, material and finish are fields, not optional comments.",
      },
    ],
    strategy: [
      { title: "Processes you will price", description: "Say what the shop does and what it declines." },
      { title: "File-first RFQ", description: "Drawings and accepted formats are part of the enquiry, with retention agreed." },
      { title: "Estimator handover", description: "The request reaches the person who prices it, with the fields filled." },
    ],
    journey: [
      { title: "Process search", description: "The buyer looks for a material or a process." },
      { title: "Capability check", description: "They see whether the shop does that work." },
      { title: "RFQ", description: "Drawing, quantity, material, finish, date." },
      { title: "Your price", description: "Estimating replies. The website does not invent a rate." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Shops whose site cannot explain the processes.", whatNext: "A scoped capability site and RFQ." },
      { pathway: "growth", whoFor: "Shops who need the capability pages kept aligned with the floor.", whatNext: "Growth Partnership." },
      { pathway: "systems", whoFor: "Shops that later want RFQs inside the system estimators already use.", whatNext: "Integration scoped after the enquiry is clear." },
    ],
    proof: {
      level: "illustrative",
      label: "Illustrative fabrication pattern",
      summary:
        "No fabrication case study is published. This RFQ pattern is illustrative. It is not a claimed shop delivery and it does not state tolerances the business has not confirmed.",
    },
    faqs: [
      { q: "Can you calculate a fabrication price online?", a: "Not honestly, unless your pricing really is a stable formula. Most shops should receive a complete RFQ and price it themselves." },
      { q: "Which drawing formats can the form accept?", a: "The ones your estimators will open. That list is agreed before launch, not copied from another shop." },
      { q: "Will you claim ISO certification for the fabricator?", a: "Only when you can show it. A badge the shop does not hold is not a design detail." },
    ],
    relatedSolutionHrefs: ["/custom-systems", "/enterprise", "/custom-software-development-uk"],
    relatedIndustrySlugs: ["precision-engineering", "industrial-automation", "builders"],
    synonyms: ["fabrication", "welding", "sheet metal", "steelwork"],
    meaningfulMetrics: ["RFQs with a drawing attached", "Requests declined for process fit", "Estimator time spent chasing files"],
    unknowns: ["Processes you want public", "File types estimators accept", "Who should receive the RFQ"],
    showCustomSystems: true,
  },

  "industrial-automation": {
    id: "ind.industrial-automation",
    slug: "industrial-automation",
    hubSlug: "manufacturing-industrial",
    name: "Industrial automation",
    pluralName: "industrial automation businesses",
    metaTitle: "Industrial Automation Sites | ScaleSmiths",
    description:
      "Sites for automation and machinery firms: applications, integration questions and a technical enquiry a sales engineer can qualify.",
    eyebrow: "Industrial automation",
    h1: "A machinery enquiry without the line context is a brochure request.",
    intro:
      "Automation buyers are qualifying a supplier across a long cycle. They need to know which applications you have delivered, which systems you integrate with, and how to send a proper technical brief. The website should make that possible without overclaiming a sector you have not worked in.",
    searchIntent:
      "For automation and machinery firms whose site reads as a product catalogue and whose enquiries lack the line, the throughput or the existing controls.",
    buyer: "Sales engineers and owners at automation, robotics and machinery firms.",
    presentation: "industrial",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Technical buyers cannot tell which applications you will take, and enquiries arrive without the line context a sales engineer needs to qualify them.",
    frictions: [
      {
        title: "Applications are unnamed industries",
        symptom: "The site says food, automotive and packaging without saying what you did.",
        fix: "Describe applications you can evidence, and omit the ones you cannot.",
      },
      {
        title: "Controls and throughput are absent",
        symptom: "The first call is spent learning the existing line.",
        fix: "The enquiry asks for the process, the current controls and what success means on that line.",
      },
      {
        title: "A product PDF stands in for a conversation",
        symptom: "Serious buyers download a brochure and disappear.",
        fix: "Offer a technical enquiry with a named next step, not only a file.",
      },
    ],
    strategy: [
      { title: "Evidence-led applications", description: "Sectors and machines you can describe honestly." },
      { title: "Qualification before a visit", description: "The brief captures process, constraints and timing." },
      { title: "Long-cycle follow-up", description: "The site explains how a multi-stakeholder enquiry is handled." },
    ],
    journey: [
      { title: "Application search", description: "The buyer looks for a process or a machine type." },
      { title: "Evidence", description: "They check whether your experience matches the line." },
      { title: "Technical brief", description: "Process, controls, constraints, timing." },
      { title: "Sales engineering", description: "Your team qualifies and decides whether to visit." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Firms whose site is a catalogue without a qualification path.", whatNext: "Scoped capability site and technical enquiry." },
      { pathway: "growth", whoFor: "Firms who need application stories kept current as projects finish.", whatNext: "Growth Partnership." },
      { pathway: "systems", whoFor: "Firms that need a portal for drawings, specs and project communication.", whatNext: "Custom systems or enterprise discovery." },
    ],
    proof: {
      level: "illustrative",
      label: "Illustrative automation pattern",
      summary:
        "No industrial-automation case study is published. This qualification path is illustrative. It is not a claimed machinery delivery.",
    },
    faqs: [
      { q: "Will you write that we automate every industry?", a: "No. Application pages cover work you can describe. Empty sector claims are removed." },
      { q: "Can a buyer attach a line layout?", a: "When the project includes secure file handover. Retention and access are agreed with you first." },
      { q: "Do you supply the PLC programming?", a: "No. ScaleSmiths builds the digital system around the enquiry and, where scoped, the tools your team uses. The automation engineering stays with you." },
    ],
    relatedSolutionHrefs: ["/custom-systems", "/enterprise", "/enterprise/delivery"],
    relatedIndustrySlugs: ["metal-fabrication", "precision-engineering", "managed-it"],
    synonyms: ["robotics", "machinery", "controls integration", "industrial systems"],
    meaningfulMetrics: ["Enquiries with a process description", "Visits booked after a complete brief", "Sectors you stopped claiming"],
    unknowns: ["Applications you can evidence", "File sensitivity", "Who qualifies a lead before a visit"],
    showCustomSystems: true,
  },

  "managed-it": {
    id: "ind.managed-it",
    slug: "managed-it",
    hubSlug: "technology-software",
    name: "Managed IT",
    pluralName: "managed IT providers",
    metaTitle: "Managed IT Provider Websites | ScaleSmiths",
    description:
      "Websites for managed IT providers: packages a buyer can compare, a response expectation you will stand behind, and an enquiry your service desk can triage.",
    eyebrow: "Managed IT",
    h1: "An IT buyer should be able to tell what happens when something breaks.",
    intro:
      "Small businesses buying managed IT are comparing response, what is included, and whether you look after the tools they already have. A site full of stock server photos and “proactive monitoring” does not answer that. ScaleSmiths builds the explanation and the enquiry. An SLA is published only when it matches the contract.",
    searchIntent:
      "For managed service providers whose packages are unclear and whose enquiries arrive without the company size, the current stack or the problem.",
    buyer: "Owners and service-delivery leads at managed IT providers.",
    presentation: "saas",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Package and response information is vague, so enquiries arrive from poor-fit clients and the service desk starts every conversation by asking what the business uses.",
    frictions: [
      {
        title: "Packages hide the exclusions",
        symptom: "Buyers cannot tell whether onboarding, Microsoft 365 or out-of-hours is included.",
        fix: "Package pages state what is in, what is out, and what is quoted separately.",
      },
      {
        title: "Response language is stronger than the contract",
        symptom: "The homepage implies a speed the agreement does not offer.",
        fix: "Publish the response you will put in a contract, or do not publish a number.",
      },
      {
        title: "The stack is discovered on the call",
        symptom: "Nobody has said whether this is Microsoft, Google, a server room or a handful of laptops.",
        fix: "The enquiry asks for headcount, the main systems and the problem that prompted the search.",
      },
    ],
    strategy: [
      { title: "Comparable packages", description: "A buyer can see the difference between plans without a sales call." },
      { title: "Honest operations", description: "Hours, onboarding and exclusions match the service you deliver." },
      { title: "Triage-ready leads", description: "Size, stack and the triggering problem arrive together." },
    ],
    journey: [
      { title: "Provider search", description: "The buyer looks for support, a named product, or a replacement MSP." },
      { title: "Package fit", description: "They compare what is included." },
      { title: "Context", description: "Headcount, systems and the problem." },
      { title: "Your qualification", description: "The service desk or sales lead decides whether to propose." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Providers whose site does not explain the service.", whatNext: "A scoped site around packages and enquiry quality." },
      { pathway: "growth", whoFor: "Providers who need the offer and the proof kept current.", whatNext: "Growth Partnership." },
      { pathway: "systems", whoFor: "Providers who want a client portal or onboarding workflow.", whatNext: "Custom systems discovery." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "csds",
      label: "Adjacent service-business proof — CSDS",
      summary:
        "CSDS is a computer-repair firm in Pennsylvania, not a managed-service contract. The adjacent proof is a quote path and an admin panel the owner uses. It is not an MSP case study.",
    },
    faqs: [
      { q: "Will you write a 15-minute response promise?", a: "Only if that promise is in the service you sell. Marketing copy does not get to be braver than the contract." },
      { q: "Can the enquiry create a ticket in our PSA?", a: "Sometimes, after discovery. We do not advertise a connector we have not tested against your tool." },
      { q: "Do you replace our remote-monitoring stack?", a: "No. We present and, where scoped, integrate with the operation you already run." },
    ],
    relatedSolutionHrefs: ["/custom-systems", "/digital-growth-partnership", "/security"],
    relatedIndustrySlugs: ["b2b-saas", "industrial-automation", "precision-engineering"],
    synonyms: ["MSP", "IT support", "managed service provider", "IT consultancy"],
    meaningfulMetrics: ["Enquiries that name the stack", "Poor-fit leads declined before a survey", "Packages a buyer can compare without a call"],
    unknowns: ["What each package excludes", "The PSA or ticket tool", "Whether out-of-hours is real"],
    showCustomSystems: true,
  },

  hotels: {
    id: "ind.hotels",
    slug: "hotels",
    hubSlug: "hospitality-experiences",
    name: "Independent hotels",
    pluralName: "independent hotels and guest houses",
    metaTitle: "Independent Hotel Websites | ScaleSmiths",
    description:
      "Websites for independent hotels and guest houses: rooms, availability expectations, direct enquiries and the facts a guest checks before booking.",
    eyebrow: "Independent hotels",
    h1: "A guest who cannot trust the rooms will book somewhere that answers faster.",
    intro:
      "Independent hotels lose direct bookings when room facts, availability and the difference between a night and an event enquiry are unclear. ScaleSmiths builds those paths around the booking method you already use. We do not promise to replace an online travel agent.",
    searchIntent:
      "For independent hotels and guest houses whose own website sends guests to a dead end, an outdated tariff, or a phone that is not answered at the moment of decision.",
    buyer: "Owners and managers of independent hotels, guest houses and small stays.",
    presentation: "hospitality",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Room facts and the direct booking or enquiry path are unclear, so guests who wanted to book direct cannot tell what they would get or how to ask.",
    frictions: [
      {
        title: "Room pages omit the decision facts",
        symptom: "Occupancy, bed layout and what is not included are missing or out of date.",
        fix: "Each sellable room states the facts a guest uses to choose, and the hotel can update them.",
      },
      {
        title: "Events and overnight stays share a form",
        symptom: "A wedding enquiry and a two-night stay create the same email.",
        fix: "Separate overnight booking or enquiry from events, groups and private dining.",
      },
      {
        title: "The booking engine is a surprise",
        symptom: "Guests reach a third-party step that contradicts the page they just read.",
        fix: "The handoff matches the availability and the policies shown on the site, or the contradiction is removed.",
      },
    ],
    strategy: [
      { title: "Rooms a guest can compare", description: "Facts, photos of the actual rooms, and policies beside the decision." },
      { title: "Direct next step", description: "The booking link or enquiry you want, labelled honestly." },
      { title: "Events as their own sale", description: "Groups and functions collect dates, numbers and the kind of event." },
    ],
    journey: [
      { title: "Stay or event search", description: "The guest looks for the property, the place or a function." },
      { title: "Room or space facts", description: "They check what they would actually get." },
      { title: "Book or enquire", description: "Overnight and events take different paths." },
      { title: "Your confirmation", description: "The hotel confirms in the system it already trusts." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Properties whose site contradicts the booking step.", whatNext: "A scoped site around rooms, policies and the enquiry split." },
      { pathway: "growth", whoFor: "Properties that need pages and offers kept true through the season.", whatNext: "Growth Partnership." },
      { pathway: "systems", whoFor: "Properties that need a better handoff into an existing booking tool.", whatNext: "Integration scoped after discovery." },
    ],
    proof: {
      level: "illustrative",
      label: "Illustrative hospitality pattern",
      summary:
        "No hotel case study is published. The room-and-enquiry pattern is illustrative. It is not a claimed stay, occupancy result or partnership with a booking platform.",
    },
    faqs: [
      { q: "Will you move a hotel off Booking.com?", a: "No. We can make the direct path clearer. Channel mix is a commercial decision for the hotel, not a promise from the website." },
      { q: "Can room photos be stock images?", a: "Not if they are presented as your rooms. Guests compare the picture with the bed." },
      { q: "Do you run the property management system?", a: "No. We work with the booking route you choose and leave the operation of the property system with you." },
    ],
    relatedSolutionHrefs: ["/local-growth", "/custom-systems", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["restaurants", "independent-retail", "beauty-salons"],
    synonyms: ["boutique hotel", "guest house", "B&B", "inn"],
    meaningfulMetrics: ["Direct enquiries that name a room", "Event briefs with a date and headcount", "Policy questions asked before arrival"],
    unknowns: ["Which booking tool you use", "Whether events are a real offer", "Who updates room facts in season"],
    showCustomSystems: true,
  },

  recruiters: {
    id: "ind.recruiters",
    slug: "recruiters",
    hubSlug: "professional-services",
    name: "Recruiters",
    pluralName: "recruitment and staffing firms",
    metaTitle: "Recruitment Firm Websites | ScaleSmiths",
    description:
      "Websites for recruiters that keep hiring managers and candidates on different paths, and collect the role or the discipline before a consultant calls.",
    eyebrow: "Recruitment",
    h1: "A hiring manager and a candidate should not land in the same inbox.",
    intro:
      "Recruitment sites fail when a client looking for a shortlist and a candidate looking for a role share one “get in touch” button. ScaleSmiths separates those journeys and the information each consultant needs before they pick up the phone.",
    searchIntent:
      "For recruitment firms whose website mixes client briefs and candidate applications, or hides the sectors the desk actually fills.",
    buyer: "Directors and consultants at specialist recruitment and staffing firms.",
    presentation: "professional",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Client mandates and candidate approaches share one form, so consultants sort mixed messages before they know the role, the sector or the availability.",
    frictions: [
      {
        title: "Clients and candidates share a button",
        symptom: "A hiring brief and a CV arrive with the same subject line.",
        fix: "Two routes from the first screen, with different questions.",
      },
      {
        title: "Desks are not named",
        symptom: "A visitor cannot tell whether you fill the role they have.",
        fix: "Sector or discipline pages for the desks you want to be known for.",
      },
      {
        title: "The brief is a CV dump",
        symptom: "Clients attach a job description and candidates attach a CV, with no availability or location.",
        fix: "Ask for the role, the location and the timing on the client side, and the discipline and availability on the candidate side.",
      },
    ],
    strategy: [
      { title: "Two front doors", description: "Hiring managers and candidates never share a confirmation message." },
      { title: "Desks with a boundary", description: "Say which roles you fill and which you do not." },
      { title: "Consultant-ready context", description: "The first call starts from a role or a discipline, not from a guess." },
    ],
    journey: [
      { title: "Role or representation search", description: "A client needs a hire, or a candidate needs a desk." },
      { title: "Correct door", description: "They choose the route that matches them." },
      { title: "Minimum brief", description: "Role, place and timing, or discipline and availability." },
      { title: "Consultant", description: "Your team qualifies. The site does not promise a placement." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Firms whose site is one contact form for everyone.", whatNext: "A scoped site with two journeys and real desks." },
      { pathway: "growth", whoFor: "Firms who need sector pages maintained as the desk changes.", whatNext: "Growth Partnership." },
      { pathway: "systems", whoFor: "Firms that want enquiries in the recruitment system they already use.", whatNext: "Integration after discovery." },
    ],
    proof: {
      level: "illustrative",
      label: "Illustrative recruitment pattern",
      summary:
        "No recruitment case study is published. The two-door pattern is illustrative and is not a claimed placement result or a staffed desk.",
    },
    faqs: [
      { q: "Will you scrape job boards onto the site?", a: "No. Vacancies come from a source you control. Empty job listings are not added to make the page look active." },
      { q: "Can candidates apply without creating an account?", a: "Yes, unless your process needs an account. Friction is a choice, not a default." },
      { q: "Do you guarantee a shortlist?", a: "No. The website qualifies the conversation. Filling the role remains your work." },
    ],
    relatedSolutionHrefs: ["/custom-systems", "/digital-growth-partnership", "/local-growth"],
    relatedIndustrySlugs: ["accountants", "b2b-saas", "managed-it"],
    synonyms: ["recruitment agency", "staffing", "headhunter", "executive search"],
    meaningfulMetrics: ["Client briefs with a role and location", "Candidate approaches that name a discipline", "Mixed enquiries that had to be re-sorted"],
    unknowns: ["Which desks are active", "Where vacancies should come from", "The recruitment system already in place"],
    showCustomSystems: true,
  },

  homeware: {
    id: "ind.homeware",
    slug: "homeware",
    hubSlug: "retail-ecommerce",
    name: "Homeware and furniture",
    pluralName: "homeware and furniture retailers",
    metaTitle: "Homeware Retail Websites | ScaleSmiths",
    description:
      "Commerce sites for homeware and furniture retailers: variants, delivery, made-to-order lead times and a checkout that matches what the warehouse can ship.",
    eyebrow: "Homeware and furniture",
    h1: "A sofa enquiry fails when delivery and lead time are a surprise.",
    intro:
      "Homeware buyers compare size, fabric, stock and whether the item fits through the door. Furniture adds made-to-order lead times and delivery that is not a small parcel. The site has to say those things before checkout, or the warehouse pays for the silence.",
    searchIntent:
      "For homeware and furniture retailers whose product pages hide lead times, delivery limits or the difference between in-stock and made to order.",
    buyer: "Owners and ecommerce managers at homeware, furniture and interiors retailers.",
    presentation: "ecommerce",
    state: "published",
    reviewedAt: "2026-10-16",
    reviewer: "rhys",
    primaryProblem: "Product pages and checkout do not state lead time, delivery limits or stock truth, so orders are placed for items the warehouse cannot ship as the customer expects.",
    frictions: [
      {
        title: "Made to order looks in stock",
        symptom: "A twelve-week sofa can be bought as if it leaves tomorrow.",
        fix: "Lead time and the made-to-order status sit on the product and in checkout.",
      },
      {
        title: "Delivery is a footnote",
        symptom: "Two-person delivery, room of choice and areas you will not enter are discovered after payment.",
        fix: "Delivery rules are visible before the customer commits, for the regions you serve.",
      },
      {
        title: "Variants are a dropdown of codes",
        symptom: "Fabric and size choices do not show the combination you can actually supply.",
        fix: "Options match the catalogue the warehouse recognises, including combinations you do not sell.",
      },
    ],
    strategy: [
      { title: "Catalogue honesty", description: "Stock, lead time and options match operations." },
      { title: "Delivery before payment", description: "The cost, the crew and the limits are part of the decision." },
      { title: "Trade and retail if you do both", description: "A trade account is not forced through the consumer checkout." },
    ],
    journey: [
      { title: "Product discovery", description: "The buyer finds an item by type, room or search." },
      { title: "Fit and timing", description: "Size, options and lead time are visible." },
      { title: "Delivery decision", description: "They see how it arrives and what it costs." },
      { title: "Fulfilment", description: "The order matches a product the warehouse can pick or order in." },
    ],
    pathways: [
      { pathway: "build", whoFor: "Retailers whose catalogue and checkout disagree.", whatNext: "A scoped commerce build around the real catalogue." },
      { pathway: "growth", whoFor: "Retailers who need merchandising and conversion work after launch.", whatNext: "Growth Partnership." },
      { pathway: "systems", whoFor: "Retailers who need stock or trade accounts connected to an existing system.", whatNext: "Integration scoped to the systems you run." },
    ],
    proof: {
      level: "adjacent",
      workSlug: "pinkys-prints",
      label: "Adjacent retail proof — Pinky’s Prints",
      summary:
        "Pinky’s Prints is a print and retail business, not a furniture warehouse. The adjacent lesson is a catalogue a merchant can run. It is not a claimed homeware delivery or a revenue figure.",
    },
    faqs: [
      { q: "Do you only launch furniture brands on Shopify?", a: "No. Platform choice follows catalogue complexity, delivery rules and who will operate the store." },
      { q: "Can you sync supplier stock for every SKU?", a: "Only when the feed and your warehouse process make it reliable. A bad feed is worse than a clearly manual lead time." },
      { q: "Will you promise a conversion-rate increase for the store?", a: "No. We work on the points where orders fail. Revenue still depends on the product, the price and fulfilment." },
    ],
    relatedSolutionHrefs: ["/e-commerce-development-nottingham", "/custom-systems", "/digital-growth-partnership"],
    relatedIndustrySlugs: ["independent-retail", "printing-signage", "hotels"],
    synonyms: ["furniture", "interiors", "home furnishings", "beds"],
    meaningfulMetrics: ["Orders with a correct lead time", "Delivery questions asked before checkout", "Made-to-order items bought as if they were in stock"],
    unknowns: ["Which items are made to order", "Delivery regions and crew rules", "The stock system of record"],
    showCustomSystems: true,
  },
}
