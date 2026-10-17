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
