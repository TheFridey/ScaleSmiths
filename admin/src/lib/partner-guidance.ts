/**
 * Operation Empower B1.6: deterministic, explainable mapping from what a partner has already recorded about a prospect to approved
 * guidance. Pure: no database, no network, no logging, no generated text.
 *
 * Privacy: prospect text only decides which rule applies. The search terms used afterwards come from the fixed vocabulary below,
 * never from what the partner or client typed, so prospect details never reach a search query, a log or another partner.
 */
import { DISCOVERY_FIELDS } from "./expansion"
import { COURSE_CATEGORIES, KNOWLEDGE_TOPICS } from "./empower-content"

type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number]
type CourseCategory = (typeof COURSE_CATEGORIES)[number]
export type DiscoveryRecord = Partial<Record<(typeof DISCOVERY_FIELDS)[number], string>>

export type GuidanceRule = {
  id: string
  /** Shown to the partner: why this guidance appears. Never quotes the prospect's own words. */
  reason: string
  knowledgeTopics: KnowledgeTopic[]
  courseCategories: CourseCategory[]
  /** Fixed vocabulary for resource search; founders change it by code review. */
  searchTerms: string[]
  /** B1.5 objection categories, used once objection handling is merged and switched on. */
  objectionCategories: string[]
  escalation?: "technical_scoping" | "bespoke_discovery" | "commercial_assistance"
  when: (d: DiscoveryRecord, p: { website: boolean }) => boolean
}

const has = (v: string | undefined, re: RegExp) => !!v && re.test(v)
const anyText = (d: DiscoveryRecord, keys: (keyof DiscoveryRecord)[], re: RegExp) => keys.some((k) => has(d[k], re))

export const GUIDANCE_RULES: readonly GuidanceRule[] = [
  { id: "new-website", reason: "No existing website is recorded, so start with what a new build includes.",
    knowledgeTopics: ["hosting", "domains"], courseCategories: ["services"], searchTerms: ["website", "build"], objectionCategories: ["price", "delivery-times"],
    when: (d, p) => !p.website && !has(d.existingWebsite, /\w{3,}/) },
  { id: "existing-website", reason: "The business already has a website, so review what works before recommending changes.",
    knowledgeTopics: ["wordpress-migration", "redirects", "analytics"], courseCategories: ["digital-growth"], searchTerms: ["growth", "partnership", "website"], objectionCategories: ["existing-supplier", "website-migration"],
    when: (d, p) => p.website || has(d.existingWebsite, /\w{3,}/) },
  { id: "cost", reason: "Budget is part of the conversation, so use the approved pricing guidance and never improvise a price.",
    knowledgeTopics: ["commercial-terms", "payment-schedules"], courseCategories: ["commercial-policies"], searchTerms: ["pricing", "price"], objectionCategories: ["price", "payment-schedules", "contract-length"],
    escalation: "commercial_assistance", when: (d) => has(d.budget, /\w/) || anyText(d, ["objectives", "restrictions"], /\b(cost|budget|price|afford|cheap|expensive)\b/i) },
  { id: "seo", reason: "Search visibility is mentioned, so use the approved SEO and AI search explanations.",
    knowledgeTopics: ["seo", "ai-search", "analytics"], courseCategories: ["digital-growth"], searchTerms: ["seo", "search"], objectionCategories: ["seo", "ai-search"],
    when: (d) => has(d.seoConcerns, /\w{2,}/) || anyText(d, ["objectives", "marketingChannels"], /\b(seo|google|rank|search|visib)/i) },
  { id: "hosting-email", reason: "Hosting, domains or email are part of the picture.",
    knowledgeTopics: ["hosting", "domains", "dns", "business-email"], courseCategories: ["technical-knowledge"], searchTerms: ["hosting", "email"], objectionCategories: ["hosting", "maintenance"],
    when: (d) => has(d.hosting, /\w{2,}/) || has(d.domainOwnership, /\w{2,}/) || anyText(d, ["functionality", "restrictions"], /\b(hosting|domain|dns|e-?mail|mailbox)/i) },
  { id: "automation", reason: "Integrations, automation or bespoke features are mentioned, which need technical scoping before any commitment.",
    knowledgeTopics: ["crm", "automation", "custom-software", "booking-systems"], courseCategories: ["technical-knowledge", "advanced-opportunities"], searchTerms: ["bespoke", "automation", "integration"],
    objectionCategories: ["bespoke-development"], escalation: "bespoke_discovery",
    when: (d) => has(d.integrations, /\w{2,}/) || anyText(d, ["functionality", "objectives", "enquiryProcess"], /\b(crm|automat|integrat|api|booking|portal|bespoke|custom|workflow|software)/i) },
  { id: "ecommerce", reason: "Selling online is mentioned.",
    knowledgeTopics: ["e-commerce"], courseCategories: ["services"], searchTerms: ["ecommerce", "shop"], objectionCategories: ["bespoke-development"],
    when: (d) => anyText(d, ["functionality", "objectives"], /\b(shop|e-?commerce|store|checkout|products|payments?)\b/i) },
  { id: "migration", reason: "Moving from another platform is mentioned, so explain how a rebuild protects what already works.",
    knowledgeTopics: ["wordpress-migration", "redirects", "seo"], courseCategories: ["technical-knowledge"], searchTerms: ["migration", "redirect"], objectionCategories: ["website-migration"],
    escalation: "technical_scoping", when: (d) => anyText(d, ["existingWebsite", "restrictions", "objectives", "functionality"], /\b(migrat|move|moving|rebuild|replatform|wordpress|wix|shopify|squarespace)/i) },
  { id: "accessibility", reason: "Accessibility needs are recorded.",
    knowledgeTopics: ["accessibility"], courseCategories: ["technical-knowledge"], searchTerms: ["accessibility"], objectionCategories: [],
    when: (d) => has(d.accessibility, /\w{2,}/) },
  { id: "timing", reason: "A timescale is recorded; delivery dates are confirmed only by ScaleSmiths after discovery.",
    knowledgeTopics: ["client-onboarding"], courseCategories: ["sales-fundamentals"], searchTerms: ["timeline", "onboarding"], objectionCategories: ["delivery-times", "decision-timing"],
    when: (d) => has(d.timescale, /\w/) },
]

export type GuidancePlan = {
  rules: { id: string; reason: string; escalation?: GuidanceRule["escalation"] }[]
  knowledgeTopics: KnowledgeTopic[]; courseCategories: CourseCategory[]; searchTerms: string[]; objectionCategories: string[]
  escalation: GuidanceRule["escalation"] | null
}

/** Rules apply in table order; outputs are de-duplicated in first-seen order, so the same record always gives the same plan. */
export function guidancePlanFor(discovery: unknown, prospect: { website?: unknown }): GuidancePlan {
  const d: DiscoveryRecord = {}
  if (discovery && typeof discovery === "object" && !Array.isArray(discovery)) {
    for (const key of DISCOVERY_FIELDS) { const v = (discovery as Record<string, unknown>)[key]; if (typeof v === "string") d[key] = v.slice(0, 4000) }
  }
  const p = { website: typeof prospect.website === "string" && prospect.website.trim().length > 3 }
  const rules = GUIDANCE_RULES.filter((r) => r.when(d, p))
  const uniq = <T,>(xs: T[]) => [...new Set(xs)]
  return {
    rules: rules.map((r) => ({ id: r.id, reason: r.reason, ...(r.escalation ? { escalation: r.escalation } : {}) })),
    knowledgeTopics: uniq(rules.flatMap((r) => r.knowledgeTopics)), courseCategories: uniq(["discovery" as CourseCategory, ...rules.flatMap((r) => r.courseCategories)]),
    searchTerms: uniq(rules.flatMap((r) => r.searchTerms)), objectionCategories: uniq(rules.flatMap((r) => r.objectionCategories)),
    escalation: rules.find((r) => r.escalation)?.escalation ?? null,
  }
}

/** Discovery prompts for fields not yet recorded: product wording, not client-facing content. */
export const DISCOVERY_PROMPTS: Readonly<Record<(typeof DISCOVERY_FIELDS)[number], string>> = {
  objectives: "What would success look like for the business in the next year?",
  existingWebsite: "Do they have a website today, and what works well about it?",
  marketingChannels: "Where do new customers come from at the moment?",
  targetCustomers: "Who are their best customers?",
  serviceArea: "Which areas do they serve?",
  enquiryProcess: "What happens today when someone enquires?",
  hosting: "Who hosts the current website, and who looks after it?",
  domainOwnership: "Who controls the domain name?",
  seoConcerns: "Do they have any concerns about how they appear in search?",
  pages: "Roughly what pages or sections do they expect?",
  functionality: "What should the website do beyond giving information?",
  integrations: "Does anything need to connect to other systems they use?",
  content: "Who will provide the words and images?",
  budget: "Have they set aside a budget range?",
  timescale: "Is there a date they are working towards, and why?",
  decisionProcess: "Who else is involved in the decision?",
  accessibility: "Are there accessibility needs to plan for?",
  restrictions: "Is there anything that would rule a supplier out?",
}
export function discoveryGaps(discovery: unknown, limit = 5): { field: string; prompt: string }[] {
  const d = (discovery && typeof discovery === "object" && !Array.isArray(discovery) ? discovery : {}) as Record<string, unknown>
  return DISCOVERY_FIELDS.filter((k) => !(typeof d[k] === "string" && (d[k] as string).trim().length > 1)).slice(0, limit).map((field) => ({ field, prompt: DISCOVERY_PROMPTS[field] }))
}

/** Meeting type to extra guidance. Combined with the linked opportunity's plan when there is one. */
export const MEETING_GUIDANCE: Readonly<Record<string, { knowledgeTopics: KnowledgeTopic[]; courseCategories: CourseCategory[]; searchTerms: string[] }>> = {
  joint_sales: { knowledgeTopics: [], courseCategories: ["sales-fundamentals", "discovery"], searchTerms: ["meeting", "discovery"] },
  technical_scoping: { knowledgeTopics: ["hosting", "website-security", "wordpress-migration"], courseCategories: ["technical-knowledge"], searchTerms: ["technical", "escalation"] },
  bespoke_discovery: { knowledgeTopics: ["custom-software", "automation", "crm"], courseCategories: ["advanced-opportunities"], searchTerms: ["bespoke"] },
  commercial_assistance: { knowledgeTopics: ["commercial-terms", "payment-schedules"], courseCategories: ["commercial-policies"], searchTerms: ["pricing"] },
  proposal_review: { knowledgeTopics: ["client-onboarding"], courseCategories: ["services"], searchTerms: ["proposal"] },
  training: { knowledgeTopics: [], courseCategories: ["getting-started"], searchTerms: ["handbook"] },
  escalation: { knowledgeTopics: [], courseCategories: ["professional-conduct"], searchTerms: ["escalation"] },
}

/* Plain-language status explanations, keyed by the real backend statuses (no new commercial states). */
export type StatusExplanation = { label: string; meaning: string; tone: "neutral" | "progress" | "action" | "done" | "closed" }
export const OPPORTUNITY_STATUS: Readonly<Record<string, StatusExplanation>> = {
  registered: { label: "Registered", meaning: "You have registered this business. Start discovery when you have spoken to them.", tone: "neutral" },
  contacted: { label: "Contacted", meaning: "You are in touch with the business.", tone: "neutral" },
  discovery: { label: "Discovery in progress", meaning: "Record what the business needs, then submit the scope for review.", tone: "progress" },
  qualified: { label: "Qualified", meaning: "Discovery is complete enough to submit a scope.", tone: "progress" },
  scope_submitted: { label: "Under review", meaning: "ScaleSmiths is reviewing the scope and delivery capacity. Nothing is committed yet.", tone: "progress" },
  more_information: { label: "Information required", meaning: "ScaleSmiths needs more detail before deciding. Update discovery and resubmit.", tone: "action" },
  bespoke_required: { label: "Awaiting founder", meaning: "This needs a bespoke review by a ScaleSmiths founder before any proposal.", tone: "action" },
  deferred: { label: "Deferred", meaning: "Paused for now; it can be picked up again later.", tone: "neutral" },
  approved: { label: "Approved", meaning: "ScaleSmiths has approved the scope. The client has not signed yet.", tone: "progress" },
  contract_accepted: { label: "Contract accepted", meaning: "The client has signed. Commission becomes earned only when qualifying payments are verified.", tone: "done" },
  closed_lost: { label: "Declined", meaning: "This opportunity did not go ahead.", tone: "closed" },
  withdrawn: { label: "Withdrawn", meaning: "This opportunity was withdrawn.", tone: "closed" },
}
export const MEETING_STATUS: Readonly<Record<string, StatusExplanation>> = {
  requested: { label: "Meeting requested", meaning: "Not booked yet. ScaleSmiths will confirm a time, suggest another or ask for more information.", tone: "progress" },
  under_review: { label: "Under review", meaning: "ScaleSmiths is looking at your request. Nothing is booked yet.", tone: "progress" },
  info_required: { label: "Information required", meaning: "ScaleSmiths needs more information before arranging this.", tone: "action" },
  alternative_proposed: { label: "New time proposed", meaning: "ScaleSmiths has suggested another time. Accept it or ask for another.", tone: "action" },
  confirmed: { label: "Meeting confirmed", meaning: "This meeting is booked.", tone: "done" },
  completed: { label: "Meeting completed", meaning: "This meeting has taken place.", tone: "closed" },
  declined: { label: "Declined", meaning: "ScaleSmiths could not arrange this meeting.", tone: "closed" },
  cancelled: { label: "Meeting cancelled", meaning: "This meeting will not take place.", tone: "closed" },
}
export const explain = (map: Readonly<Record<string, StatusExplanation>>, status: unknown): StatusExplanation =>
  map[String(status)] ?? { label: String(status ?? "Unknown").replaceAll("_", " "), meaning: "", tone: "neutral" }
