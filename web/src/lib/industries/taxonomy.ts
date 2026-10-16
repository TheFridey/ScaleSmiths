import type { IndustryCandidate } from "./types"
import { publishedIndustryPages } from "./pages"

/**
 * Living industry universe. Most entries are candidates — discoverable in directory
 * search with a “tell us about your industry” route — not indexed niche pages.
 * Published pages are mirrored here with state "published" for a single inventory.
 */

function candidate(
  hubSlug: string,
  slug: string,
  name: string,
  primaryProblem: string,
  synonyms: string[] = [],
  proofLevel: IndustryCandidate["proofLevel"] = "illustrative",
): IndustryCandidate {
  return {
    id: `cand.${hubSlug}.${slug}`,
    name,
    hubSlug,
    slug,
    state: "idea",
    primaryProblem,
    proofLevel,
    synonyms,
    discoverable: true,
  }
}

const seedCandidates: IndustryCandidate[] = [
  // A. Trades
  candidate("trades-home-services", "plumbers", "Plumbers", "Emergency and planned plumbing enquiries share one weak contact path.", ["plumber", "emergency plumber"]),
  candidate("trades-home-services", "hvac", "HVAC & heating engineers", "Seasonal demand spikes overwhelm undifferentiated quote routes.", ["heating engineer", "boiler installer", "air conditioning"]),
  candidate("trades-home-services", "gas-engineers", "Gas engineers", "Compliance-sensitive trust signals are missing or overclaimed.", ["gas safe", "boiler service"]),
  candidate("trades-home-services", "solar-installers", "Solar installers", "Complex offer packaging confuses homeowners comparing quotes.", ["solar PV", "battery installers"]),
  candidate("trades-home-services", "builders", "Builders & general contractors", "Project evidence and enquiry qualification are too thin for high-ticket work.", ["general contractor", "home renovations", "extensions"]),
  candidate("trades-home-services", "landscapers", "Landscapers & gardeners", "Seasonal galleries and quote context fail to convert browsers.", ["gardeners", "arborists", "tree surgeons"]),
  candidate("trades-home-services", "cleaning", "Cleaning companies", "Commercial vs domestic journeys and recurring contracts are unclear.", ["commercial cleaning", "carpet cleaning"]),
  candidate("trades-home-services", "locksmiths", "Locksmiths", "Emergency mobile callers cannot find trust and response cues fast enough.", ["locksmith", "emergency locksmith"]),
  candidate("trades-home-services", "scaffolding", "Scaffolding", "Commercial RFQs lack site context and safety proof.", ["scaffold hire"]),
  candidate("trades-home-services", "damp-proofing", "Damp proofing & mould remediation", "Diagnostic vs treatment journeys blur; buyers need clarity before quotes.", ["waterproofing", "mould remediation"]),
  // B. Automotive
  candidate("trades-home-services", "independent-mechanics", "Independent mechanics", "Booking and trust paths lose out to aggregator apps.", ["MOT centre", "garage", "auto repair"], "illustrative"),
  candidate("trades-home-services", "vehicle-detailing", "Vehicle detailing & valeting", "Package clarity and local mobile booking are weak.", ["car detailing", "valeting"]),
  candidate("trades-home-services", "ev-charging-installers", "EV charging installers", "Home vs commercial install journeys need distinct qualification.", ["EV charger"]),
  // C. Health
  candidate("healthcare-wellness", "physiotherapy", "Physiotherapy clinics", "Treatment selection and booking expectations confuse new patients.", ["physiotherapist", "sports injury"]),
  candidate("healthcare-wellness", "dental-practices", "Dental practices", "Patient questions and appointment paths are buried under generic clinic copy.", ["dentist", "orthodontist"]),
  candidate("healthcare-wellness", "veterinary-clinics", "Veterinary clinics", "Emergency vs routine care routes and trust signals are unclear.", ["vet", "animal clinic"]),
  candidate("healthcare-wellness", "mental-health-practices", "Mental health practices", "Access, privacy and practitioner fit need careful, non-clinical-claim copy.", ["counselling", "psychology", "therapy"]),
  candidate("healthcare-wellness", "home-care", "Home care & elder care", "Family decision-makers need process clarity without overclaiming outcomes.", ["elder care", "domiciliary care"]),
  // D. Fitness & beauty
  candidate("fitness-beauty-personal-care", "gyms", "Gyms & fitness studios", "Membership and class journeys compete with weak mobile conversion.", ["personal trainers", "Pilates", "yoga"]),
  candidate("fitness-beauty-personal-care", "hairdressers", "Hairdressers & barbers", "Booking and stylist trust paths lose to social DMs.", ["barbers", "hair salon"]),
  candidate("fitness-beauty-personal-care", "spas", "Spas & wellness centres", "Package discovery and booking rules create no-shows and admin load.", ["wellness centre"]),
  // E. Hospitality
  candidate("hospitality-experiences", "cafes", "Cafes & coffee shops", "Hours, menus and location intent dominate; sites lag operational truth.", ["coffee shop", "bakery"]),
  candidate("hospitality-experiences", "hotels", "Hotels & boutique stays", "Booking paths and amenity truthfulness decide direct vs OTA share.", ["B&B", "guest house", "serviced accommodation"]),
  candidate("hospitality-experiences", "wedding-venues", "Wedding & event venues", "Long decision cycles need galleries, packages and serious enquiry forms.", ["event venues", "conference venues"]),
  candidate("hospitality-experiences", "tour-operators", "Tour operators", "Itinerary clarity and booking trust vary by season and region.", ["travel agency", "experiences"]),
  // F. Retail
  candidate("retail-ecommerce", "fashion-boutiques", "Fashion boutiques", "Variant discovery and returns clarity decide conversion.", ["clothing brand", "footwear"]),
  candidate("retail-ecommerce", "homeware", "Homeware & furniture", "High consideration purchases need stock honesty and delivery clarity.", ["furniture", "beds"]),
  candidate("retail-ecommerce", "specialty-food", "Speciality food brands", "Subscription and wholesale paths need different qualification.", ["subscription box", "DTC food"]),
  // G. Professional
  candidate("professional-services", "solicitors", "Solicitors & law firms", "Service packaging and regulated advertising constraints need careful copy.", ["law firm", "conveyancers"]),
  candidate("professional-services", "insurance-brokers", "Insurance brokers", "Quote journeys and trust signals must avoid prohibited claims.", ["mortgage advisers", "IFA"]),
  candidate("professional-services", "recruiters", "Recruiters & staffing", "Candidate vs client journeys collide on one undifferentiated site.", ["staffing agencies", "executive search"]),
  candidate("professional-services", "consultants", "Consultants & coaches", "Positioning is vague; enquiry quality suffers.", ["business coaches", "HR consultancies"]),
  // H. Property
  candidate("professional-services", "estate-agents", "Estate agents & letting agents", "Listing trust and enquiry quality vary wildly by portal dependency.", ["realtors", "property management"]),
  candidate("trades-home-services", "property-maintenance", "Property maintenance", "Reactive vs planned maintenance contracts need distinct journeys.", ["facilities", "handyman"]),
  // I. Manufacturing
  candidate("manufacturing-industrial", "metal-fabrication", "Metal fabrication", "Capability pages and RFQ quality decide lead value.", ["welding", "sheet metal"]),
  candidate("manufacturing-industrial", "food-manufacturers", "Food manufacturers", "Compliance and wholesale enquiry paths are under-specified.", ["packaging manufacturers"]),
  candidate("manufacturing-industrial", "industrial-automation", "Industrial automation", "Long B2B cycles need technical proof without overclaiming.", ["robotics", "machinery"]),
  // J. Tech
  candidate("technology-software", "managed-it", "Managed IT providers", "Trust, response SLAs and package clarity drive SMB deals.", ["MSP", "IT consultancy"]),
  candidate("technology-software", "cybersecurity-firms", "Cybersecurity firms", "Buyers need assurance without fake certification claims.", ["security consultancy"]),
  candidate("technology-software", "marketplaces", "Marketplaces & platforms", "Two-sided activation and trust infrastructure are the real product.", ["directories", "membership platforms"]),
  // K. Education
  candidate("professional-services", "tutoring", "Tutors & training centres", "Booking, safeguarding notes and parent trust paths matter.", ["driving schools", "language schools"]),
  candidate("technology-software", "edtech", "Education technology", "Procurement and teacher activation differ from consumer SaaS.", ["online course creators"]),
  // L. Agriculture / energy
  candidate("manufacturing-industrial", "renewable-energy", "Renewable energy providers", "Homeowner vs commercial journeys and grant narratives need care.", ["solar farms", "energy consultants"]),
  candidate("trades-home-services", "agricultural-contractors", "Agricultural contractors", "Seasonal B2B demand needs capability and coverage clarity.", ["farms", "agri-tech"]),
  // M. Media
  candidate("media-creative", "signage-companies", "Signage specialists", "Quote specs and artwork handoff dominate admin load.", ["large-format", "vehicle wraps"]),
  candidate("media-creative", "creative-agencies", "Creative & marketing agencies", "Positioning against peers requires proof without hype inflation.", ["branding studios", "PR firms"]),
  candidate("media-creative", "photographers", "Photographers & videographers", "Package clarity and enquiry qualification reduce tyre-kickers.", ["videographers", "studios"]),
  // N. Nonprofits
  candidate("professional-services", "charities", "Charities & nonprofits", "Donation and volunteer journeys need trust without dark patterns.", ["foundations", "community centres"]),
  // O. Logistics
  candidate("manufacturing-industrial", "courier-firms", "Courier & last-mile delivery", "Quote and tracking expectations differ by B2B vs consumer.", ["haulage", "3PL", "warehousing"]),
  // P. Personal / specialised
  candidate("fitness-beauty-personal-care", "pet-groomers", "Pet groomers", "Booking and care notes fail on mobile.", ["dog groomers", "pet sitting"]),
  candidate("hospitality-experiences", "funeral-directors", "Funeral directors", "Sensitive journeys need clarity and care — never aggressive conversion patterns.", ["celebrants"]),
  candidate("trades-home-services", "security-alarms", "Security & CCTV installers", "Domestic vs commercial trust and compliance cues are weak.", ["CCTV", "access control"]),
]

/** Published pages appear in the inventory with authoritative state. */
function publishedAsCandidates(): IndustryCandidate[] {
  return publishedIndustryPages().map((page) => ({
    id: page.id,
    name: page.name,
    hubSlug: page.hubSlug,
    slug: page.slug,
    state: "published" as const,
    primaryProblem: page.primaryProblem,
    proofLevel: page.proof.level,
    synonyms: page.synonyms,
    discoverable: true,
  }))
}

export function industryTaxonomy(): IndustryCandidate[] {
  const publishedSlugs = new Set(publishedIndustryPages().map((page) => page.slug))
  const candidates = seedCandidates.filter((entry) => !publishedSlugs.has(entry.slug))
  return [...publishedAsCandidates(), ...candidates]
}

export function discoverableIndustryTaxonomy(): IndustryCandidate[] {
  return industryTaxonomy().filter((entry) => entry.discoverable && entry.state !== "retired" && entry.state !== "merged")
}
