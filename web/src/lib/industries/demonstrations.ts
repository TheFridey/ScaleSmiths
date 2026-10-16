/**
 * Four worked examples of how a ScaleSmiths engagement runs.
 * They are walkthroughs of a workflow, not claimed performance results.
 */

export interface WorkflowStep {
  title: string
  happens: string
  system: string
  outcome: string
}

export interface WorkflowTrack {
  id: string
  label: string
  summary: string
  steps: WorkflowStep[]
}

export interface IndustryDemonstration {
  hubSlug: string
  shortName: string
  metaTitle: string
  description: string
  eyebrow: string
  h1: string
  intro: string
  tracks: WorkflowTrack[]
  proofLabel: string
  proofSummary: string
  workSlug?: string
  faqs: Array<{ q: string; a: string }>
}

const demonstrations: IndustryDemonstration[] = [
  {
    hubSlug: "trades-home-services",
    shortName: "trades and home services",
    metaTitle: "Trades Enquiry Workflow | ScaleSmiths",
    description:
      "A worked example of emergency calls, planned quotes and the job context a trades office actually needs. No invented time savings.",
    eyebrow: "Trades and home services",
    h1: "From a late-night call to a job the office can act on.",
    intro:
      "A trades business loses time twice: once when the caller cannot tell whether to ring or send photos, and again when the office retypes that information into the job system. This walkthrough shows the separation ScaleSmiths builds. It is not a promise of a fixed number of hours saved.",
    tracks: [
      {
        id: "emergency",
        label: "Emergency call-out",
        summary: "A wasp nest, a burst pipe, a lockout. The caller needs a person, not a brochure.",
        steps: [
          {
            title: "The call arrives",
            happens: "Someone searches on a phone, often outside office hours, and needs the coverage area and a number.",
            system: "The service page puts the call action and the towns you actually cover above the explanation.",
            outcome: "The caller can decide to ring without hunting the footer.",
          },
          {
            title: "Context travels with the call",
            happens: "If they use the form instead, the office still needs the address, the fault and how urgent it is.",
            system: "A short emergency form asks for those three things and nothing that belongs on a planned quote.",
            outcome: "The person who calls back is not reconstructing the job from a blank email.",
          },
          {
            title: "The office dispatches or declines",
            happens: "Your team decides whether the job is in area and worth attending.",
            system: "The enquiry lands with the same fields your process already uses, ready to copy into the tool you already run.",
            outcome: "Follow-up time goes on the decision, not on asking for the postcode again.",
          },
        ],
      },
      {
        id: "planned",
        label: "Planned quote",
        summary: "A bathroom, a render, a reroof. The quote is only as good as the photos and the scope.",
        steps: [
          {
            title: "The buyer picks a specialism",
            happens: "They searched for one job, not for the whole trade.",
            system: "A dedicated service page shows comparable work and a quote route for that job.",
            outcome: "Tyre-kickers and serious buyers are no longer sharing one generic contact box.",
          },
          {
            title: "Photos and scope arrive first",
            happens: "Estimating starts with what the property looks like and what the buyer thinks they want.",
            system: "The quote path asks for photos, property type and a deadline before anyone visits.",
            outcome: "Site visits are booked for jobs you can price, not for conversations that should have been an email.",
          },
          {
            title: "The estimate is yours to send",
            happens: "ScaleSmiths does not invent the price of the job. The system hands you the brief.",
            system: "You keep the estimating tool, the CRM and the customer relationship.",
            outcome: "The website becomes a way to collect better work, not a second business you have to feed.",
          },
        ],
      },
    ],
    proofLabel: "Worked from completed trades sites",
    proofSummary:
      "Confirm-A-Kill and Precision Finish are published examples of emergency-versus-planned journeys and photo-led quotes. This page describes that pattern. It does not claim a new measured saving for every trade.",
    workSlug: "confirm-a-kill",
    faqs: [
      {
        q: "Will this replace our job management software?",
        a: "No. The website collects a usable enquiry. Connecting it to a specific job system is scoped only after we know which system you use.",
      },
      {
        q: "How much time does the workflow save?",
        a: "That depends on how many enquiries you retype today. We do not publish a universal hours figure. After launch you can compare form completeness and call-back effort with the way you work now.",
      },
      {
        q: "Can one website do both emergency and planned work?",
        a: "Yes. The point of the split is that both journeys stay obvious, not that you need two websites.",
      },
    ],
  },
  {
    hubSlug: "healthcare-wellness",
    shortName: "clinics and professional firms",
    metaTitle: "Clinic and Practice Workflow | ScaleSmiths",
    description:
      "How a clinic or professional firm turns a first question into a suitable appointment, without clinical or regulated claims we cannot support.",
    eyebrow: "Healthcare and professional services",
    h1: "The first question should reach the right person.",
    intro:
      "A new patient and a new client have the same problem: they cannot tell who will see them, what to bring, or whether they are in the right place. This walkthrough covers a clinic and a professional firm. Clinical accuracy and professional-body rules stay with the practice.",
    tracks: [
      {
        id: "clinic",
        label: "Clinic",
        summary: "Treatment, practitioner and how to book, in that order.",
        steps: [
          {
            title: "The question is recognised",
            happens: "Someone arrives with a symptom or a treatment name, not with your brand.",
            system: "The page explains who the clinic sees and what the first appointment involves, in plain language.",
            outcome: "People who are not a fit can stop before they book the wrong slot.",
          },
          {
            title: "They can see who they will meet",
            happens: "Trust sits with the practitioner, the access notes and the cancellation rule.",
            system: "Those facts stay near the booking action. Patient stories are used only with permission.",
            outcome: "The booking is a decision, not a guess.",
          },
          {
            title: "The diary receives a complete request",
            happens: "Reception still confirms clinical suitability. The website does not diagnose.",
            system: "The form or booking link asks for the contact route you already use, plus the question they came with.",
            outcome: "Staff spend less time asking which service the person meant.",
          },
        ],
      },
      {
        id: "professional",
        label: "Professional firm",
        summary: "Service fit, documents and who will take the first meeting.",
        steps: [
          {
            title: "The buyer checks fit",
            happens: "An owner comparing accountants, recruiters or advisers wants to know who you take on.",
            system: "Service pages name the situations you handle and the ones you send elsewhere.",
            outcome: "Poor-fit enquiries drop before a partner spends an hour on them.",
          },
          {
            title: "The first meeting has a brief",
            happens: "You need the entity, the deadline and the question. You do not need their whole archive on a public form.",
            system: "The enquiry asks for that minimum and explains what happens next, including who replies.",
            outcome: "The discovery meeting starts from a written brief the firm owns.",
          },
          {
            title: "Claims stay inside the rules",
            happens: "Advertising for regulated work can cross a line the website should not invent.",
            system: "Copy is drafted for the firm to approve. ScaleSmiths does not publish outcome promises the profession would not.",
            outcome: "The site can be updated without becoming a compliance incident.",
          },
        ],
      },
    ],
    proofLabel: "Clinic pattern from published podiatry work",
    proofSummary:
      "Foot Works is a published podiatry site about treatment clarity and booking. The professional-firm track is a working pattern, not a claimed accountancy or legal delivery.",
    workSlug: "foot-works-podiatry",
    faqs: [
      {
        q: "Do you write clinical advice?",
        a: "We structure the page. A clinician reviews anything that could be read as medical advice before it is published.",
      },
      {
        q: "Can the same pattern serve a law firm or an accountancy practice?",
        a: "The enquiry shape is similar. The words, the disclaimers and the approval route are not. Those are agreed with the firm.",
      },
      {
        q: "Will you connect to our practice management system?",
        a: "Only after discovery, and only if the vendor, the consent rules and the security fit are confirmed. It is not assumed.",
      },
    ],
  },
  {
    hubSlug: "manufacturing-industrial",
    shortName: "manufacturing and engineering",
    metaTitle: "Manufacturer RFQ Workflow | ScaleSmiths",
    description:
      "How a manufacturer turns a capability search into an RFQ with drawings, materials and quantities the estimator can use.",
    eyebrow: "Manufacturing and engineering",
    h1: "A serious buyer should be able to send a serious RFQ.",
    intro:
      "Procurement teams do not enquire because a factory has a slogan. They enquire when they can see a process, a material and a way to send a drawing. This walkthrough is the path from that search to an estimator who is not starting from a blank email.",
    tracks: [
      {
        id: "rfq",
        label: "Capability to RFQ",
        summary: "What you can make, what the buyer must send, and who replies.",
        steps: [
          {
            title: "Capability is specific",
            happens: "The buyer searched for a process or a material, then checks whether you actually do it.",
            system: "Capability pages list the processes and standards the engineering lead has confirmed, not a scraped brochure.",
            outcome: "Unsuitable work is filtered before it reaches estimating.",
          },
          {
            title: "The RFQ has the fields estimating needs",
            happens: "A drawing, a material, a quantity and a required date are the difference between a lead and a favour.",
            system: "The enquiry asks for those items and states which file types you accept. Retention of files is agreed before go-live.",
            outcome: "Estimators open a complete request or a clear reason to ask for one missing piece.",
          },
          {
            title: "The commercial reply stays with the factory",
            happens: "Lead time and price are operational facts ScaleSmiths does not invent.",
            system: "The system records the request and notifies the people you name. Quoting stays in your process.",
            outcome: "Sales engineering spends time on fit and price, not on chasing a PDF that was never attached.",
          },
        ],
      },
    ],
    proofLabel: "Illustrative manufacturing pattern",
    proofSummary:
      "No manufacturing case study is published yet, so this workflow is illustrative. It is not a claimed factory delivery and it does not invent tolerances, certifications or lead times.",
    faqs: [
      {
        q: "Can buyers upload controlled drawings?",
        a: "Yes when the project includes it. Access, retention and who inside the factory can see the file are written down first.",
      },
      {
        q: "Will you publish our machine list from an old PDF?",
        a: "Only the items your engineering lead confirms are still accurate. An outdated tolerance is a commercial risk.",
      },
      {
        q: "Do you create a page for every town a manufacturer delivers to?",
        a: "No. Capability is not a local doorway. Location pages are a different problem and only exist where the page has something distinct to say.",
      },
    ],
  },
  {
    hubSlug: "technology-software",
    shortName: "technology and commerce",
    metaTitle: "Product and Commerce Workflow | ScaleSmiths",
    description:
      "A worked example for software companies and online retailers: the question, the trust check, and an enquiry or order the operator can run.",
    eyebrow: "Technology and e-commerce",
    h1: "The next step should match how the business actually sells.",
    intro:
      "A software company and a retailer both lose buyers in the gap between interest and a concrete next step. One needs a demo or security answer. The other needs stock, delivery and a checkout that matches the warehouse. This walkthrough keeps those paths separate.",
    tracks: [
      {
        id: "software",
        label: "Software and product",
        summary: "Who the product is for, what happens on a demo, and where security questions go.",
        steps: [
          {
            title: "The buyer finds the right product surface",
            happens: "A founder and an enterprise evaluator are not asking the same question.",
            system: "The site separates a product explanation, a demo request and an enterprise enquiry.",
            outcome: "Sales receives a request that already says which conversation it is.",
          },
          {
            title: "Trust questions have a place",
            happens: "Security, data location and integrations decide whether a trial is even relevant.",
            system: "A plain assurance page states what is true today. Missing certifications are not implied.",
            outcome: "Questionnaires start from a document the company can stand behind.",
          },
          {
            title: "The pipeline is operable",
            happens: "A form that nobody triages is not a growth system.",
            system: "Enquiries land where the team already works, with the product and the urgency attached.",
            outcome: "Follow-up is a sales task, not an archaeology task.",
          },
        ],
      },
      {
        id: "commerce",
        label: "E-commerce",
        summary: "Catalogue truth, delivery expectations and an order operations can fulfil.",
        steps: [
          {
            title: "The product page tells the truth",
            happens: "Variant, stock and shipping cost are the decision. A lifestyle headline is not.",
            system: "The catalogue shows the facts the warehouse can honour, including when an item is made to order.",
            outcome: "Fewer orders are placed for something you cannot ship.",
          },
          {
            title: "Checkout matches the operation",
            happens: "Returns, lead times and trade accounts are different journeys.",
            system: "Retail checkout and a trade enquiry stay separate when the business sells both ways.",
            outcome: "Margin and customer service are not surprised by the wrong kind of order.",
          },
          {
            title: "The merchant keeps the customer",
            happens: "The store is an asset the business should be able to run.",
            system: "Platform choice follows the catalogue and the integrations you already depend on. You are not locked to a theme we disappear with.",
            outcome: "Repeat purchase and support sit in tools your team can administer.",
          },
        ],
      },
    ],
    proofLabel: "Adjacent product and quote-system work",
    proofSummary:
      "The Business Circle and Prymal are published product builds. CSDS, a computer repair firm in Pennsylvania, runs a multi-step quote into an admin panel the owner uses. Those are adjacent examples, not a claim that every SaaS or shop receives the same system.",
    workSlug: "csds",
    faqs: [
      {
        q: "Do you only implement Shopify?",
        a: "No. The platform is chosen from catalogue size, integrations and who has to operate it. That decision is part of discovery.",
      },
      {
        q: "Can you show a security badge we have not earned?",
        a: "No. Assurance copy covers what the company can evidence. A questionnaire is not a certification.",
      },
      {
        q: "Is the commerce track only for Nottingham shops?",
        a: "No. Remote delivery is available where the commercial and legal fit works. We still do not invent a local office in the buyer's city.",
      },
    ],
  },
]

export function industryDemonstrations(): IndustryDemonstration[] {
  return demonstrations
}

export function getIndustryDemonstration(hubSlug: string): IndustryDemonstration | undefined {
  return demonstrations.find((item) => item.hubSlug === hubSlug)
}

export function industryDemonstrationPath(hubSlug: string) {
  return `/industries/${hubSlug}/experience`
}
