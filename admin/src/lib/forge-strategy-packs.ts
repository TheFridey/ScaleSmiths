import type { ForgeIntakeData } from "./forge"

export const FORGE_STRATEGY_PACK_IDS = [
  "local_service_business",
  "ecommerce_store",
  "saas_startup",
  "charity_nonprofit",
  "restaurant_food",
  "trades_business",
  "gaming_community_server",
  "creator_personal_brand",
  "event_venue",
  "professional_services",
] as const

export type ForgeStrategyPackId = (typeof FORGE_STRATEGY_PACK_IDS)[number]

export interface ForgeStrategyPack {
  id: ForgeStrategyPackId
  label: string
  selectionSignals: string[]
  idealHomepageSections: string[]
  correctCtas: string[]
  schemaDirection: string[]
  toneOfVoice: string[]
  trustSignals: string[]
  conversionGoals: string[]
  forbiddenGenericSections: string[]
  commonPageTypes: string[]
  visualStyleSuggestions: string[]
}

export interface ForgeStrategyPackSelection {
  pack: ForgeStrategyPack
  reason: string
}

export interface ForgeStrategyProjectContext {
  name: string
  businessName: string
  industry: string | null
  websiteUrl?: string | null
  targetAudience?: string | null
  primaryGoal?: string | null
  brandNotes?: string | null
}

export const FORGE_STRATEGY_PACKS: Record<ForgeStrategyPackId, ForgeStrategyPack> = {
  local_service_business: {
    id: "local_service_business",
    label: "Local service business",
    selectionSignals: ["local service", "service area", "quote", "near me", "repairs", "clinic", "appointment"],
    idealHomepageSections: ["Hero with service/location clarity", "Core service routing", "Proof/reviews", "Process", "Service areas", "FAQ", "Contact"],
    correctCtas: ["Request a quote", "Call now", "Book a consultation", "Send enquiry"],
    schemaDirection: ["LocalBusiness when NAP/location is supplied", "Service", "FAQPage", "BreadcrumbList"],
    toneOfVoice: ["clear", "reassuring", "practical", "locally credible"],
    trustSignals: ["reviews", "case studies", "certifications", "response times", "guarantees"],
    conversionGoals: ["qualified enquiries", "calls", "quote requests", "bookings"],
    forbiddenGenericSections: ["SaaS feature grids", "pricing tiers unless supplied", "app integrations", "investor-style traction"],
    commonPageTypes: ["Home", "Services", "Service detail", "Service area", "About", "Reviews", "Contact"],
    visualStyleSuggestions: ["clean conversion layout", "real local imagery", "trust-led sections", "prominent contact routes"],
  },
  ecommerce_store: {
    id: "ecommerce_store",
    label: "Ecommerce/store",
    selectionSignals: ["store", "shop", "cart", "products", "checkout", "merch", "buy"],
    idealHomepageSections: ["Hero offer", "Featured products", "Categories", "Benefits", "Reviews", "Shipping/returns", "Email capture"],
    correctCtas: ["Shop now", "View products", "Add to cart", "Browse collection"],
    schemaDirection: ["Product", "Offer", "Organization", "BreadcrumbList", "FAQPage"],
    toneOfVoice: ["clear", "benefit-led", "confident", "purchase-focused"],
    trustSignals: ["reviews", "secure checkout", "returns policy", "shipping information", "payment options"],
    conversionGoals: ["product discovery", "add to cart", "checkout", "email signup"],
    forbiddenGenericSections: ["service area pages", "request quote as primary CTA", "generic team process sections"],
    commonPageTypes: ["Home", "Shop", "Category", "Product", "About", "FAQ", "Contact"],
    visualStyleSuggestions: ["product-first imagery", "clear product cards", "trust badges", "fast purchase paths"],
  },
  saas_startup: {
    id: "saas_startup",
    label: "SaaS/startup",
    selectionSignals: ["saas", "software", "platform", "app", "demo", "startup", "subscription"],
    idealHomepageSections: ["Hero value proposition", "Problem/solution", "Feature proof", "Use cases", "Integrations", "Security", "Pricing/demo CTA"],
    correctCtas: ["Book a demo", "Start free trial", "View pricing", "Talk to sales"],
    schemaDirection: ["SoftwareApplication", "Organization", "FAQPage", "BreadcrumbList"],
    toneOfVoice: ["sharp", "outcome-led", "technical but accessible", "growth-focused"],
    trustSignals: ["logos", "security notes", "case studies", "testimonials", "usage proof if supplied"],
    conversionGoals: ["demo bookings", "trial starts", "sales conversations", "email capture"],
    forbiddenGenericSections: ["local service area sections", "LocalBusiness schema unless truly local", "trade accreditations unless supplied"],
    commonPageTypes: ["Home", "Product", "Features", "Use cases", "Pricing", "About", "Contact"],
    visualStyleSuggestions: ["product UI screenshots", "clean dashboard visuals", "technical credibility", "restrained motion"],
  },
  charity_nonprofit: {
    id: "charity_nonprofit",
    label: "Charity/nonprofit",
    selectionSignals: ["charity", "nonprofit", "donate", "volunteer", "foundation", "cause"],
    idealHomepageSections: ["Mission hero", "Impact areas", "Donation ask", "Stories", "Volunteer routes", "Events", "Transparency"],
    correctCtas: ["Donate", "Volunteer", "Get help", "Attend event", "Partner with us"],
    schemaDirection: ["NGO or Organization", "Event", "FAQPage", "BreadcrumbList"],
    toneOfVoice: ["human", "clear", "hopeful", "transparent"],
    trustSignals: ["impact stories", "registered charity details", "partners", "annual reports", "real outcomes"],
    conversionGoals: ["donations", "volunteer signups", "support requests", "event attendance"],
    forbiddenGenericSections: ["pricing tiers", "service quote forms", "product feature grids"],
    commonPageTypes: ["Home", "Mission", "Impact", "Donate", "Volunteer", "Events", "Contact"],
    visualStyleSuggestions: ["real people/impact imagery", "warm contrast", "clear donation pathways", "accessible typography"],
  },
  restaurant_food: {
    id: "restaurant_food",
    label: "Restaurant/food",
    selectionSignals: ["restaurant", "cafe", "menu", "food", "bar", "takeaway", "booking"],
    idealHomepageSections: ["Food-led hero", "Menu highlights", "Booking/order CTA", "Opening hours/location", "Reviews", "Gallery", "Private events"],
    correctCtas: ["Book a table", "View menu", "Order online", "Call restaurant"],
    schemaDirection: ["Restaurant or FoodEstablishment", "Menu", "LocalBusiness if location supplied", "FAQPage"],
    toneOfVoice: ["warm", "appetising", "local", "simple"],
    trustSignals: ["reviews", "hygiene rating if supplied", "chef/story", "fresh ingredients", "photos"],
    conversionGoals: ["bookings", "orders", "calls", "menu views"],
    forbiddenGenericSections: ["B2B process sections", "SaaS pricing", "service area pages unless catering"],
    commonPageTypes: ["Home", "Menu", "Bookings", "Gallery", "Events/Catering", "Contact"],
    visualStyleSuggestions: ["large food photography", "menu cards", "location clarity", "mobile booking focus"],
  },
  trades_business: {
    id: "trades_business",
    label: "Trades business",
    selectionSignals: ["plumber", "electrician", "builder", "roofer", "trade", "emergency", "repair"],
    idealHomepageSections: ["Emergency/service hero", "Core trades", "Why trust us", "Recent work", "Areas covered", "Reviews", "Contact"],
    correctCtas: ["Call now", "Request a quote", "Book a visit", "Emergency help"],
    schemaDirection: ["LocalBusiness", "Service", "FAQPage", "BreadcrumbList"],
    toneOfVoice: ["direct", "reliable", "plain-spoken", "urgent when needed"],
    trustSignals: ["insurance", "accreditations", "reviews", "before/after work", "response times"],
    conversionGoals: ["calls", "quote requests", "emergency bookings"],
    forbiddenGenericSections: ["startup feature grids", "abstract mission blocks", "pricing tiers without real prices"],
    commonPageTypes: ["Home", "Services", "Emergency", "Areas", "Reviews", "Gallery", "Contact"],
    visualStyleSuggestions: ["job-site imagery", "high-contrast CTAs", "proof near services", "mobile call buttons"],
  },
  gaming_community_server: {
    id: "gaming_community_server",
    label: "Gaming/community/server",
    selectionSignals: ["minecraft", "gaming", "server", "discord", "community", "players", "game mode", "vote"],
    idealHomepageSections: ["Immersive server hero", "Server IP/status card", "Game modes/features", "Community/news/events", "Store/vote prompts", "Rules/support", "Discord/community CTA"],
    correctCtas: ["Copy server IP", "Join Discord", "Login / Register", "Visit store", "Vote for server"],
    schemaDirection: ["WebSite", "Organization", "FAQPage", "Event for events", "Product/Offer for store items if supplied", "No LocalBusiness unless truly local"],
    toneOfVoice: ["energetic", "community-led", "premium", "clear for new players"],
    trustSignals: ["live status/stat placeholders", "player counts if connected", "community screenshots", "staff/support routes", "rules clarity", "store security notes"],
    conversionGoals: ["server joins", "Discord joins", "account registrations", "store visits", "votes", "community retention"],
    forbiddenGenericSections: ["Local service area pages", "Request a quote", "LocalBusiness schema by default", "generic About us agency sections", "trade accreditations"],
    commonPageTypes: ["Home", "Play / Join", "Game modes", "Rules", "Store", "Vote", "News / Events", "Support", "Community"],
    visualStyleSuggestions: ["game-inspired premium UI", "status cards", "server stat placeholders", "bold Discord/store CTAs", "screenshots or generated game-style media"],
  },
  creator_personal_brand: {
    id: "creator_personal_brand",
    label: "Creator/personal brand",
    selectionSignals: ["creator", "personal brand", "portfolio", "influencer", "speaker", "newsletter", "youtube"],
    idealHomepageSections: ["Creator hero", "Featured work/content", "Audience value", "Social proof", "Newsletter/community", "Offers", "Contact"],
    correctCtas: ["Subscribe", "Watch latest", "Work with me", "Join community", "Book me"],
    schemaDirection: ["Person", "Organization where relevant", "Article/CreativeWork", "FAQPage"],
    toneOfVoice: ["personal", "distinctive", "direct", "audience-aware"],
    trustSignals: ["featured work", "audience proof if supplied", "testimonials", "logos", "press"],
    conversionGoals: ["subscribers", "follows", "bookings", "sales", "community joins"],
    forbiddenGenericSections: ["service-area SEO", "LocalBusiness unless local creator", "generic corporate sections"],
    commonPageTypes: ["Home", "About", "Work", "Content", "Newsletter", "Shop/Offers", "Contact"],
    visualStyleSuggestions: ["personality-led visuals", "content cards", "strong bio section", "social proof band"],
  },
  event_venue: {
    id: "event_venue",
    label: "Event/venue",
    selectionSignals: ["event", "venue", "tickets", "conference", "wedding", "festival", "calendar"],
    idealHomepageSections: ["Venue/event hero", "Upcoming events", "Spaces/packages", "Gallery", "Location", "Reviews", "Booking/tickets"],
    correctCtas: ["Book venue", "Buy tickets", "View events", "Check availability"],
    schemaDirection: ["Event", "Place", "LocalBusiness if venue location supplied", "FAQPage"],
    toneOfVoice: ["exciting", "clear", "logistical", "experience-led"],
    trustSignals: ["photos", "capacity", "accessibility", "reviews", "past events", "location details"],
    conversionGoals: ["ticket sales", "availability enquiries", "venue bookings", "event registrations"],
    forbiddenGenericSections: ["SaaS pricing", "service-area pages unless relevant", "generic product cards"],
    commonPageTypes: ["Home", "Events", "Venue", "Packages", "Gallery", "Location", "Contact"],
    visualStyleSuggestions: ["large venue/event imagery", "calendar modules", "availability CTAs", "map/location clarity"],
  },
  professional_services: {
    id: "professional_services",
    label: "Professional services",
    selectionSignals: ["consultant", "law", "accountant", "advisor", "agency", "professional services", "b2b"],
    idealHomepageSections: ["Authority hero", "Services/expertise", "Who we help", "Proof", "Process", "Insights", "Consultation CTA"],
    correctCtas: ["Book a consultation", "Talk to an expert", "Request advice", "Send enquiry"],
    schemaDirection: ["ProfessionalService", "Organization", "Service", "FAQPage", "BreadcrumbList"],
    toneOfVoice: ["expert", "measured", "clear", "trustworthy"],
    trustSignals: ["credentials", "case studies", "testimonials", "sector expertise", "process clarity"],
    conversionGoals: ["consultation bookings", "qualified enquiries", "lead capture"],
    forbiddenGenericSections: ["consumer product grids", "local trade emergency framing unless relevant", "unsupported guarantees"],
    commonPageTypes: ["Home", "Services", "Industries", "Insights", "About", "Case studies", "Contact"],
    visualStyleSuggestions: ["premium editorial layout", "authority-led typography", "case study cards", "calm conversion points"],
  },
}

export function selectForgeStrategyPack(project: ForgeStrategyProjectContext, intake: ForgeIntakeData): ForgeStrategyPackSelection {
  const haystack = [
    project.name,
    project.businessName,
    project.industry,
    project.websiteUrl,
    project.targetAudience,
    project.primaryGoal,
    project.brandNotes,
    intake.businessOverview,
    intake.coreServices,
    intake.flagshipOffer,
    intake.idealCustomers,
    intake.customerProblems,
    intake.primaryWebsiteGoal,
    intake.conversionActions,
    intake.requiredPages,
    intake.requiredIntegrations,
    intake.visualStyle,
    intake.brandTone,
  ].filter(Boolean).join(" ").toLowerCase()

  const scores = Object.values(FORGE_STRATEGY_PACKS).map((pack) => ({
    pack,
    score: pack.selectionSignals.reduce((sum, signal) => sum + (haystack.includes(signal) ? 3 : 0), 0) + explicitBoost(pack.id, haystack),
  }))
  scores.sort((a, b) => b.score - a.score)
  const selected = scores[0]?.score ? scores[0].pack : FORGE_STRATEGY_PACKS.local_service_business
  const matched = selected.selectionSignals.filter((signal) => haystack.includes(signal)).slice(0, 4)
  return {
    pack: selected,
    reason: matched.length
      ? `Selected ${selected.label} because the brief mentions ${matched.join(", ")}.`
      : `Selected ${selected.label} as the safest default for the supplied website brief.`,
  }
}

export function formatForgeStrategyPackForPrompt(selection: ForgeStrategyPackSelection) {
  const { pack, reason } = selection
  return [
    `Selected strategy pack: ${pack.label} (${pack.id})`,
    `Selection reason: ${reason}`,
    `Ideal homepage sections: ${pack.idealHomepageSections.join("; ")}`,
    `Correct CTAs: ${pack.correctCtas.join("; ")}`,
    `Schema direction: ${pack.schemaDirection.join("; ")}`,
    `Tone of voice: ${pack.toneOfVoice.join("; ")}`,
    `Trust signals: ${pack.trustSignals.join("; ")}`,
    `Conversion goals: ${pack.conversionGoals.join("; ")}`,
    `Forbidden generic sections: ${pack.forbiddenGenericSections.join("; ")}`,
    `Common page types: ${pack.commonPageTypes.join("; ")}`,
    `Visual style suggestions: ${pack.visualStyleSuggestions.join("; ")}`,
  ].join("\n")
}

function explicitBoost(packId: ForgeStrategyPackId, text: string) {
  if (packId === "gaming_community_server" && /minecraft|discord|server ip|game mode|players|vote/.test(text)) return 10
  if (packId === "ecommerce_store" && /store|shop|cart|checkout|product/.test(text)) return 8
  if (packId === "saas_startup" && /saas|software|platform|demo|trial/.test(text)) return 8
  if (packId === "restaurant_food" && /restaurant|menu|table|takeaway|cafe/.test(text)) return 8
  if (packId === "trades_business" && /plumber|electrician|builder|roofer|emergency repair/.test(text)) return 8
  return 0
}
