import type { IndustryHub } from "./types"

/**
 * Vertical hubs under /industries/[hub]. Keep hubs genuinely useful; do not create a hub
 * for every niche. Featured industries must be published pages.
 */
export const industryHubs: Record<string, IndustryHub> = {
  "trades-home-services": {
    slug: "trades-home-services",
    name: "Trades, construction & home services",
    shortName: "Trades & home services",
    metaTitle: "Websites & Growth for Trades | ScaleSmiths",
    description:
      "Industry pages for electricians, roofers, pest control, plasterers and home-service businesses that need clearer enquiries and stronger local journeys.",
    eyebrow: "Trades & home services",
    h1: "Digital growth for trades and home-service businesses.",
    intro:
      "Emergency calls, planned jobs, service-area coverage and trust signals all compete for attention on a phone. These industry pages focus on the customer journeys that turn search into booked work — without pretending every trade is identical.",
    audience: "Owner-operators, estimators and office managers who lose work to missed calls, unclear service pages or slow follow-up.",
    reviewedAt: "2026-10-27",
    sections: [
      {
        title: "A phone call is the product",
        paragraphs: [
          "Most trades enquiries start on a phone, often while someone is driving, on a job, or standing outside a property. The page has to show the service, the area, and a way to call or send photos without a long read.",
          "Emergency work and planned work should not share one vague contact box. A wasp nest, a leaking roof and a rendering quote need different context, and the specialist pages below say what that context is for each trade.",
        ],
      },
      {
        title: "Proof stays specific to the trade",
        paragraphs: [
          "Pest control can point at the published Confirm-A-Kill rebuild. Plastering and rendering can point at Precision Finish. Roofing and electrical pages use adjacent trades evidence only, and they say so.",
          "Plumbers and locksmiths use that same adjacent trades evidence, and each page says it is not a plumbing or locksmith delivery. Heating and ventilation, building and cleaning pages are illustrative where no case study is published.",
          "A town does not get its own URL just because a van can reach it. Coverage belongs in a plain note unless that place has its own services, proof and enquiry path.",
        ],
      },
    ],
    featuredIndustrySlugs: ["pest-control", "plastering-rendering", "plumbers", "roofing", "electricians", "locksmiths"],
    relatedSolutionHrefs: ["/local-growth", "/web-design-nottingham", "/digital-growth-partnership"],
  },
  "healthcare-wellness": {
    slug: "healthcare-wellness",
    name: "Health, clinical & wellness",
    shortName: "Healthcare & wellness",
    metaTitle: "Clinic Websites & Patient Journeys | ScaleSmiths",
    description:
      "Industry guidance for clinics needing clear treatment information, accessible contact routes and honest digital growth — without medical claim inflation.",
    eyebrow: "Healthcare & wellness",
    h1: "Digital journeys for clinics that need clarity, trust and contact.",
    intro:
      "Patients arrive with questions, anxiety and limited time. Clinic pages should make treatments, practitioners and next steps understandable — and never invent clinical outcomes ScaleSmiths cannot substantiate.",
    audience: "Practice owners, clinic managers and practitioners responsible for patient enquiries and reputation.",
    reviewedAt: "2026-10-27",
    sections: [
      {
        title: "Patients need clarity, not a clinical claim",
        paragraphs: [
          "Someone looking for a clinic is often anxious and short of time. They need the treatment, the practitioner and the way to get in touch, in language a patient can follow.",
          "ScaleSmiths does not add recovery rates, review scores or outcomes the practice has not published. If a claim cannot be sourced from the clinic, it does not go on the page.",
        ],
      },
      {
        title: "Clinic proof stays with the clinic",
        paragraphs: [
          "Foot Works Podiatry is the published clinic project: an existing Squarespace site improved around treatment discovery, patient trust and Jane App booking. Physiotherapy and dental pages use that work as adjacent clinic proof. They say so, and they do not borrow podiatry outcomes.",
          "The veterinary page has no case study. Its emergency and routine split is illustrative. A recovery rate, a review score or a clinical result still has to come from that practice before it can be published.",
        ],
      },
    ],
    featuredIndustrySlugs: ["podiatry", "physiotherapy", "dental-practices", "veterinary-clinics"],
    relatedSolutionHrefs: ["/local-growth", "/services/business-growth-audit", "/digital-growth-partnership"],
  },
  "hospitality-experiences": {
    slug: "hospitality-experiences",
    name: "Hospitality, travel & experiences",
    shortName: "Hospitality",
    metaTitle: "Restaurant & Hospitality Digital Growth | ScaleSmiths",
    description:
      "Industry pages for restaurants and hospitality businesses dealing with menus, bookings, mobile search and review trust.",
    eyebrow: "Hospitality & experiences",
    h1: "Digital systems for hospitality businesses that change weekly.",
    intro:
      "Menus move, hours change, and most discovery happens on a phone between plans. These pages focus on keeping information accurate and making the next step — book, order, enquire — obvious.",
    audience: "Owners and managers of restaurants, cafes, venues and experience businesses.",
    reviewedAt: "2026-10-27",
    sections: [
      {
        title: "The facts guests check are the ones that go stale",
        paragraphs: [
          "Hours, menus, dietary notes and booking links change. A hospitality site that the people on shift cannot update becomes wrong on the busiest nights.",
          "Booking a table, placing an order and asking about a private event are different intents. One shared button sends the guest down the wrong path.",
        ],
      },
      {
        title: "No hospitality case study is published yet",
        paragraphs: [
          "ScaleSmiths has published local service and appointment-led websites. It has not published a restaurant or a hotel delivery. The restaurant page says its examples are patterns. The hotel page is a separate specialist page, and its room and enquiry pattern is illustrative, not a claimed stay or a booking-platform result.",
          "A venue page should not be produced by renaming a salon or a trades page. Menus, covers, rooms and functions are different jobs, and this hub exists to keep that distinction visible.",
        ],
      },
    ],
    featuredIndustrySlugs: ["restaurants", "hotels"],
    relatedSolutionHrefs: ["/local-growth", "/custom-systems", "/digital-growth-partnership"],
  },
  "retail-ecommerce": {
    slug: "retail-ecommerce",
    name: "Retail, wholesale & e-commerce",
    shortName: "Retail & e-commerce",
    metaTitle: "Retail & E-commerce Growth | ScaleSmiths",
    description:
      "Industry pages for independent retailers and online merchants facing product discovery, stock accuracy, checkout friction and repeat purchase journeys.",
    eyebrow: "Retail & e-commerce",
    h1: "Commerce journeys that respect margin, stock and buyer intent.",
    intro:
      "Catalogue accuracy, shipping clarity and checkout friction decide whether a visitor becomes a customer. These pages separate brochure ambition from operational commerce reality.",
    audience: "Independent retailers, DTC brands and multi-channel operators.",
    reviewedAt: "2026-10-27",
    sections: [
      {
        title: "A shop is an operation, not a brochure",
        paragraphs: [
          "Independent retail loses the sale when the product, the delivery promise or the returns note is unclear. A handsome homepage does not fix a catalogue the team cannot maintain.",
          "Online stock and shop-floor stock are often different problems. The page should say which one the business actually runs, instead of implying a warehouse it does not have.",
        ],
      },
      {
        title: "Commerce proof, with the limit written down",
        paragraphs: [
          "The independent retail page cites Pinkys Prints as direct commerce proof, and it says every catalogue and fulfilment model differs. The homeware page uses the same project as adjacent retail proof. It is not a claimed furniture or home-furnishings delivery.",
          "Printing and signage sit in their own hub, where the same project is adjacent evidence. A retailer should start here. A print shop should start there.",
        ],
      },
    ],
    featuredIndustrySlugs: ["independent-retail", "homeware"],
    relatedSolutionHrefs: ["/e-commerce-development-nottingham", "/custom-systems", "/digital-growth-partnership"],
  },
  "manufacturing-industrial": {
    slug: "manufacturing-industrial",
    name: "Manufacturing, engineering & industrial",
    shortName: "Manufacturing & industrial",
    metaTitle: "B2B Manufacturing Digital Growth | ScaleSmiths",
    description:
      "Industry pages for precision manufacturers and industrial suppliers who need credible capability pages, RFQ routes and procurement-ready trust.",
    eyebrow: "Manufacturing & industrial",
    h1: "Digital presence for manufacturers who sell capability, not slogans.",
    intro:
      "Procurement teams want tolerances, materials, lead times and a serious RFQ path. These pages help manufacturers present verified capability without inventing specifications ScaleSmiths has not confirmed.",
    audience: "Owner-managers, sales engineers and operations leads in B2B manufacturing.",
    reviewedAt: "2026-10-27",
    sections: [
      {
        title: "Buyers are qualifying a supplier",
        paragraphs: [
          "A procurement lead wants materials, processes, sectors and a way to send a drawing. A line about innovation does not answer whether you can make the part.",
          "Specifications on a public page have to be ones the engineering lead will stand behind. An old brochure PDF is not automatically fit to publish.",
        ],
      },
      {
        title: "There is no manufacturing case study yet",
        paragraphs: [
          "ScaleSmiths builds custom systems and has published operational software. It has not published a precision-engineering, fabrication or automation website as a case study. Those specialist pages say their examples are patterns until that proof exists.",
          "A list of towns is the wrong shape for a manufacturer who sells nationally. The useful page describes capability and the request for quote.",
        ],
      },
    ],
    featuredIndustrySlugs: ["precision-engineering", "metal-fabrication", "industrial-automation"],
    relatedSolutionHrefs: ["/custom-systems", "/custom-software-development-uk", "/enterprise"],
  },
  "technology-software": {
    slug: "technology-software",
    name: "Technology, software & specialist B2B",
    shortName: "Technology & SaaS",
    metaTitle: "SaaS & B2B Product Growth | ScaleSmiths",
    description:
      "Industry pages for SaaS and product-led businesses working on demos, trials, security assurance and enterprise enquiry paths.",
    eyebrow: "Technology & SaaS",
    h1: "Growth systems for product companies that cannot bluff trust.",
    intro:
      "Demo activation, security questions and stakeholder buy-in decide pipeline quality. These pages focus on practical product and marketing engineering — not vanity growth hacks.",
    audience: "Founders, product leads and GTM owners in SaaS and specialist B2B software.",
    reviewedAt: "2026-10-27",
    sections: [
      {
        title: "Trust comes before the demo",
        paragraphs: [
          "A software buyer asks who the product is for, what happens to their data, and how a trial or a demo actually starts. A feature grid without those answers creates weak enquiries.",
          "Security questions should be answered in plain language, or passed to someone who can answer them. They should not be decorated with badges the company has not earned.",
        ],
      },
      {
        title: "Platform work is adjacent proof",
        paragraphs: [
          "The Business Circle and Prymal are published platform projects. The B2B SaaS page uses them as adjacent product-engineering proof, not as a growth-marketing case study for every niche. The managed IT page uses CSDS, a computer-repair firm, as adjacent service proof. It is not a managed-service case study.",
          "This hub keeps that limit in view. A product company or a support provider still has to supply its own customers, security position and enquiry path before those can be published.",
        ],
      },
    ],
    featuredIndustrySlugs: ["b2b-saas", "managed-it"],
    relatedSolutionHrefs: ["/custom-systems", "/enterprise", "/digital-growth-partnership"],
  },
  "media-creative": {
    slug: "media-creative",
    name: "Media, creative, printing & communications",
    shortName: "Printing & creative",
    metaTitle: "Printing & Signage Digital Growth | ScaleSmiths",
    description:
      "Industry pages for printers and signage businesses who need maintainable catalogues, quote clarity and faster updates when prices and lead times change.",
    eyebrow: "Printing & creative",
    h1: "Websites printers can actually keep up to date.",
    intro:
      "When product prices and lead times change weekly, a static brochure site becomes a liability. These pages focus on quote specification, artwork handoff and maintainable catalogues.",
    audience: "Print shop owners, signage firms and trade-print operators.",
    reviewedAt: "2026-10-27",
    sections: [
      {
        title: "A quote needs the job, not a contact name",
        paragraphs: [
          "Printers and sign makers lose urgent work when the site cannot collect size, material, quantity, finishing and a deadline. A name and email is not a brief an estimator can price.",
          "Live prices help only when the price is stable and the configuration is simple. Many print products are healthier as a structured quote than as a shop listing that goes stale.",
        ],
      },
      {
        title: "Print proof, and where it stops",
        paragraphs: [
          "Pinkys Prints is published e-commerce work in a print-adjacent business. The printing page treats it as adjacent proof and says further capability claims are patterns, not identical deliveries.",
          "Artwork handoff, trade accounts and estimating tools are separate decisions. They are not implied by that shop.",
        ],
      },
    ],
    featuredIndustrySlugs: ["printing-signage"],
    relatedSolutionHrefs: ["/e-commerce-development-nottingham", "/web-design-nottingham", "/digital-growth-partnership"],
  },
  "fitness-beauty-personal-care": {
    slug: "fitness-beauty-personal-care",
    name: "Fitness, beauty & personal care",
    shortName: "Beauty & personal care",
    metaTitle: "Salon & Beauty Digital Growth | ScaleSmiths",
    description:
      "Industry pages for salons and personal-care businesses competing on booking clarity, mobile trust and local visibility.",
    eyebrow: "Beauty & personal care",
    h1: "Booking and trust journeys for beauty businesses.",
    intro:
      "Appointment-led businesses lose revenue when services, prices and booking paths are unclear on mobile. These pages focus on the route from discovery to a booked slot.",
    audience: "Salon owners and appointment-led personal-care businesses.",
    reviewedAt: "2026-10-27",
    sections: [
      {
        title: "The booking path has to work on a phone",
        paragraphs: [
          "Appointment-led businesses lose the visit when the treatment, the duration and the way to book are unclear on a small screen. A gallery below the fold does not replace that path.",
          "Seasonal treatments and prices change. The site should let the salon update an offer without rebuilding the page.",
        ],
      },
      {
        title: "The local proof is one Hucknall salon",
        paragraphs: [
          "Glow Tanning is a published ScaleSmiths website for a Hucknall salon. The beauty page builds on that appointment-led work and says treatment menus still differ by salon.",
          "A gym, a barber or another treatment room is not covered by that project. Each would need its own services, proof and booking provider before a page claimed them.",
        ],
      },
    ],
    featuredIndustrySlugs: ["beauty-salons"],
    relatedSolutionHrefs: ["/local-growth", "/web-design-hucknall", "/digital-growth-partnership"],
  },
  "professional-services": {
    slug: "professional-services",
    name: "Professional & financial services",
    shortName: "Professional services",
    metaTitle: "Professional Services Digital Growth | ScaleSmiths",
    description:
      "Industry pages for accountants and professional firms who need clear service positioning, trust and enquiry quality — with advertising constraints respected.",
    eyebrow: "Professional services",
    h1: "Digital clarity for professional firms that sell expertise.",
    intro:
      "Prospects compare credentials, process and responsiveness before they enquire. These pages help firms explain services without crossing professional advertising lines ScaleSmiths cannot advise on alone.",
    audience: "Partners and practice managers in accountancy and adjacent professional firms.",
    reviewedAt: "2026-10-27",
    sections: [
      {
        title: "Expertise has to be specific, and careful",
        paragraphs: [
          "A firm wins the right enquiry when it says who it helps and how an engagement starts. A list of every service a practice could theoretically offer makes the fit harder to see.",
          "Professional advertising rules stay with the firm. ScaleSmiths can draft conservatively and flag a claim. It does not approve that claim with a professional body.",
        ],
      },
      {
        title: "No accountancy case study is published yet",
        paragraphs: [
          "The accountants page is explicit: there is no published accountancy project, and the patterns are illustrative. They have to be checked against the firm's own rules before they go live. The recruitment page is also illustrative. It is not a claimed placement result.",
          "Enquiry volume is not something this hub offers. Clearer positioning can improve the quality of an enquiry. The market, the reputation and the firm's capacity decide the rest.",
        ],
      },
    ],
    featuredIndustrySlugs: ["accountants", "recruiters"],
    relatedSolutionHrefs: ["/local-growth", "/custom-systems", "/digital-growth-partnership"],
  },
}

export function allIndustryHubs(): IndustryHub[] {
  return Object.values(industryHubs)
}

export function getIndustryHub(slug: string): IndustryHub | undefined {
  return industryHubs[slug]
}
