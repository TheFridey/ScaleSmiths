/*
 * Operation EMPOWER B2.10: the partner journey.
 *
 * Pure derivation, no database access. The server gathers authoritative FACTS (agreement record, feature switches, published
 * content, toolkit fulfilment records, the partner's own acknowledgements) and this module turns them into what the partner
 * sees. Nothing here can promote an item to "available" on appearance alone: every status is a function of a recorded fact.
 *
 * Onboarding completion counts REQUIRED steps only. Optional tools, training and planned capabilities are never in the
 * denominator, so a partner reaches 100% even while future capabilities remain unavailable. Training is never compulsory
 * (independent contractor arrangement).
 */

export const JOURNEY_STATUSES = ["available", "ready_to_set_up", "awaiting_setup", "in_progress", "coming_soon", "in_development", "action_required", "completed"] as const
export type JourneyStatus = (typeof JOURNEY_STATUSES)[number]

export const JOURNEY_STATUS_LABEL: Record<JourneyStatus, string> = {
  available: "Available",
  ready_to_set_up: "Ready to set up",
  awaiting_setup: "Awaiting setup",
  in_progress: "In progress",
  coming_soon: "Coming soon",
  in_development: "In development",
  action_required: "Action required",
  completed: "Completed",
}

/** Steps a partner acknowledges themselves. Persisted in expansion_onboarding_progress (the CHECK constraint mirrors this list). */
export const ACKNOWLEDGED_STEPS = ["how_you_earn", "commercial_boundaries", "approved_markets"] as const
export type AcknowledgedStep = (typeof ACKNOWLEDGED_STEPS)[number]
export const isAcknowledgedStep = (value: unknown): value is AcknowledgedStep => (ACKNOWLEDGED_STEPS as readonly unknown[]).includes(value)

export type AgreementFact = "none" | "awaiting_acceptance" | "update_awaiting_acceptance" | "accepted" | "unavailable" | "unknown"
export type ToolkitRecord = { status: string; detail: string | null; completedAt?: string | null }

export type JourneyFacts = {
  displayName: string
  agreement: AgreementFact
  acknowledged: Partial<Record<AcknowledgedStep, string>>
  features: { academy: boolean; resources: boolean; knowledge: boolean; objections: boolean; pipeline: boolean; performance: boolean; guidance: boolean; profilePublication: boolean }
  content: { courses: number; lessonsCompleted: number; resources: number; resourceCategories: string[]; knowledgeArticles: number; objectionResponses: number }
  opportunities: number
  allocatedProspects: number
  referralCode: string | null
  meetings: { open: number; byType: Record<string, number> }
  profile: { eligible: boolean; status: string | null }
  approvedMarkets: string[]
  toolkit: Partial<Record<string, ToolkitRecord>>
}

export type JourneyAction = { kind: "link"; href: string; label: string } | { kind: "tab"; tab: string; label: string; meetingType?: string } | { kind: "command"; action: string; label: string; itemKey?: string } | { kind: "acknowledge"; step: AcknowledgedStep; label: string }

export type RequiredStep = { key: string; title: string; detail: string; status: "completed" | "action_required"; completedAt: string | null; action: JourneyAction | null }
export type ToolItem = { key: string; group: "start" | "sell" | "learn" | "brand"; title: string; benefit: string; status: JourneyStatus; detail: string; responsible: string | null; action: JourneyAction | null }
export type UpcomingCapability = { key: string; title: string; benefit: string; status: "coming_soon" | "in_development" }

export type PartnerJourney = {
  required: RequiredStep[]
  completed: number
  total: number
  percent: number
  nextAction: RequiredStep | ToolItem | null
  tools: ToolItem[]
  upcoming: UpcomingCapability[]
}

/**
 * Capabilities recorded as planned or in development in the public programme facts (web/src/lib/partner-programme.ts
 * FEATURE_AVAILABILITY) and the ASCEND roadmap. No dates and no completion percentages: none have been approved.
 */
export const UPCOMING_CAPABILITIES: readonly UpcomingCapability[] = [
  { key: "website_intelligence", title: "Website Intelligence", benefit: "A structured review of a prospect's public website, so your first conversation starts from evidence.", status: "in_development" },
  { key: "sales_studio", title: "Sales Studio", benefit: "Help preparing tailored, approval-ready sales material for a specific prospect.", status: "in_development" },
  { key: "ask_scalesmiths", title: "Ask ScaleSmiths", benefit: "Ask a question in plain language and get an answer drawn from approved ScaleSmiths guidance.", status: "in_development" },
  { key: "meeting_preparation", title: "Meeting preparation", benefit: "A briefing before a client meeting that brings together your notes, the opportunity and relevant guidance.", status: "coming_soon" },
  { key: "proposal_assistance", title: "Proposal assistance", benefit: "Faster, consistent proposal requests that reach the founders with everything they need to quote.", status: "coming_soon" },
  { key: "sales_coaching", title: "Advanced sales coaching", benefit: "Further optional learning on discovery, qualification and closing, building on the Partner Academy.", status: "coming_soon" },
]

const done = (status: string | undefined) => status === "available" || status === "completed"

/** The note recorded when a partner requests an item without adding their own words. */
export const PARTNER_REQUEST_NOTE = "Requested by the partner from the onboarding journey."

/** Founder-recorded fulfilment of a MANUAL item (email, CircleCard). Unrecorded means the partner may ask for it. */
function manualStatus(record: ToolkitRecord | undefined, requestable: boolean): { status: JourneyStatus; detail: string; responsible: string | null } {
  switch (record?.status) {
    case "completed": return { status: "completed", detail: record.detail || "Set up by ScaleSmiths.", responsible: null }
    case "available": return { status: "available", detail: record.detail || "Set up by ScaleSmiths.", responsible: null }
    case "in_preparation": return { status: "in_progress", detail: record.detail || "ScaleSmiths is setting this up for you.", responsible: "ScaleSmiths founders" }
    case "awaiting_approval": return { status: "awaiting_setup", detail: record.detail && record.detail !== PARTNER_REQUEST_NOTE ? `Requested. ${record.detail}` : "Requested. A founder will set this up with you.", responsible: "ScaleSmiths founders" }
    case "unavailable": return { status: "coming_soon", detail: record.detail || "Not offered yet in your market.", responsible: null }
    case "planned": return { status: "coming_soon", detail: record.detail || "Being prepared by ScaleSmiths.", responsible: null }
    default: return requestable ? { status: "ready_to_set_up", detail: "Request it here and a founder sets it up with you. Nothing is provisioned automatically.", responsible: null } : { status: "coming_soon", detail: "Being prepared by ScaleSmiths.", responsible: null }
  }
}

/** A published-content item: available once something is published in a matching category, otherwise with the founders. */
function contentStatus(featureOn: boolean, matches: number, record: ToolkitRecord | undefined): { status: JourneyStatus; detail: string; responsible: string | null } {
  if (featureOn && matches > 0) return { status: "available", detail: `${matches} approved ${matches === 1 ? "item" : "items"} ready to use.`, responsible: null }
  if (done(record?.status)) return { status: "available", detail: record?.detail || "Provided by ScaleSmiths.", responsible: null }
  return { status: "awaiting_setup", detail: "Prepared and with the founders for approval. It appears here as soon as it is published.", responsible: "ScaleSmiths founders" }
}

const categoryCount = (categories: string[], pattern: RegExp) => categories.filter((c) => pattern.test(c)).length

export function deriveJourney(f: JourneyFacts): PartnerJourney {
  const ack = (step: AcknowledgedStep) => f.acknowledged[step] ?? null
  const agreementDone = f.agreement === "accepted"
  const required: RequiredStep[] = [
    {
      key: "agreement", title: agreementDone ? "Partner agreement accepted" : "Review and accept your partner agreement",
      detail: agreementDone ? "Your accepted agreement is available to read and download at any time." : f.agreement === "none" || f.agreement === "unknown" ? "ScaleSmiths issues your agreement through the portal. It sets out your commercial terms and approved scope." : "Your agreement has been issued. Read it carefully and accept it to confirm your terms.",
      status: agreementDone ? "completed" : "action_required", completedAt: null, action: { kind: "link", href: "/partner/agreement", label: agreementDone ? "View agreement" : "Review agreement" },
    },
    {
      key: "how_you_earn", title: "Understand how you earn",
      detail: "Commission is earned on eligible payments a client actually makes, under your accepted agreement. Read how it moves from pending to payable in the commission centre.",
      status: ack("how_you_earn") ? "completed" : "action_required", completedAt: ack("how_you_earn"), action: ack("how_you_earn") ? { kind: "tab", tab: "finance", label: "Open commission centre" } : { kind: "acknowledge", step: "how_you_earn", label: "I understand how I earn" },
    },
    {
      key: "commercial_boundaries", title: "Know what you can promise",
      detail: "You introduce and qualify. ScaleSmiths confirms scope, price, discounts and delivery dates in writing. Never promise a result, a price or a timescale that has not been approved.",
      status: ack("commercial_boundaries") ? "completed" : "action_required", completedAt: ack("commercial_boundaries"), action: ack("commercial_boundaries") ? null : { kind: "acknowledge", step: "commercial_boundaries", label: "I understand the boundaries" },
    },
    {
      key: "approved_markets", title: "Confirm your approved markets",
      detail: f.approvedMarkets.length ? `Contracts can currently be accepted for clients in: ${f.approvedMarkets.join(", ")}. You may talk to businesses elsewhere, but ScaleSmiths can only contract where a market is approved.` : "ScaleSmiths has not yet approved a market for client contracts. Register opportunities and a founder will confirm what is possible.",
      status: ack("approved_markets") ? "completed" : "action_required", completedAt: ack("approved_markets"), action: ack("approved_markets") ? null : { kind: "acknowledge", step: "approved_markets", label: "I have noted my markets" },
    },
  ]
  const completed = required.filter((s) => s.status === "completed").length
  const percent = Math.round((completed / required.length) * 100)

  const categories = f.content.resourceCategories
  const academyLive = f.features.academy && f.content.courses > 0
  const profileStatus: { status: JourneyStatus; detail: string } = !f.profile.eligible
    ? { status: "coming_soon", detail: "Unlocks when you reach five qualifying clients. Nothing is published without your consent and a founder's approval." }
    : f.profile.status === "live" ? { status: "completed", detail: "Your page is live." }
    : f.profile.status === "submitted" ? { status: "in_progress", detail: "With a founder for review." }
    : f.profile.status ? { status: "in_progress", detail: "Draft saved. Record your consent and submit it for review." }
    : { status: "ready_to_set_up", detail: "Prepare your wording, record consent and submit it for founder review." }

  const meetingsOf = (...types: string[]) => types.reduce((n, t) => n + (f.meetings.byType[t] ?? 0), 0)
  const tools: ToolItem[] = [
    { key: "pipeline", group: "sell", title: "Prospect registration and pipeline", benefit: "Register businesses, record discovery and follow each opportunity to a decision.", status: "available", detail: f.opportunities ? `${f.opportunities} ${f.opportunities === 1 ? "opportunity" : "opportunities"} registered.` : "Register your first business to begin.", responsible: null, action: f.features.pipeline ? { kind: "link", href: "/partner/pipeline", label: "Manage prospects" } : { kind: "tab", tab: "pipeline", label: "Manage prospects" } },
    { key: "researched_prospects", group: "sell", title: "Researched prospects", benefit: "Businesses researched by ScaleSmiths from public sources and allocated to you inside your markets.", status: f.allocatedProspects > 0 ? "available" : "awaiting_setup", detail: f.allocatedProspects > 0 ? `${f.allocatedProspects} researched ${f.allocatedProspects === 1 ? "business" : "businesses"} allocated to you.` : "Founders allocate screened businesses when eligible ones exist in an approved market. No number is guaranteed.", responsible: f.allocatedProspects > 0 ? null : "ScaleSmiths founders", action: f.allocatedProspects > 0 ? { kind: "tab", tab: "pipeline", label: "View allocations" } : null },
    { key: "joint_meetings", group: "sell", title: "Joint sales meetings", benefit: "Ask a founder to join a client conversation. Founder involvement never reduces your commission.", status: meetingsOf("joint_sales") ? "in_progress" : "available", detail: meetingsOf("joint_sales") ? "You have a joint meeting request in progress." : "Request a meeting with your preferred times; a founder confirms a real time.", responsible: null, action: { kind: "tab", tab: "meetings", label: "Request a meeting", meetingType: "joint_sales" } },
    { key: "technical_assistance", group: "sell", title: "Technical assistance", benefit: "Bring a founder in for technical scoping, bespoke discovery or a complex opportunity.", status: meetingsOf("technical_scoping", "bespoke_discovery", "escalation") ? "in_progress" : "available", detail: "Link the request to an opportunity so the founders have the context.", responsible: null, action: { kind: "tab", tab: "meetings", label: "Request assistance", meetingType: "technical_scoping" } },
    { key: "referral_identifier", group: "start", title: "Your referral code", benefit: "A permanent code to give to someone you introduce as a partner.", status: f.referralCode ? "available" : "ready_to_set_up", detail: f.referralCode ? `Your code: ${f.referralCode}` : "Create your code once. It never changes.", responsible: null, action: f.referralCode ? { kind: "tab", tab: "referrals", label: "View referrals" } : { kind: "command", action: "create_referral_code", label: "Create my code" } },
    { key: "academy", group: "learn", title: "Partner Academy", benefit: "Optional, self-paced lessons on ScaleSmiths services, discovery, qualification and client handover.", status: academyLive ? (f.content.lessonsCompleted > 0 ? "in_progress" : "available") : f.features.academy ? "awaiting_setup" : "in_development", detail: academyLive ? (f.content.lessonsCompleted > 0 ? `${f.content.lessonsCompleted} ${f.content.lessonsCompleted === 1 ? "lesson" : "lessons"} completed. Pick up where you left off.` : `${f.content.courses} ${f.content.courses === 1 ? "course" : "courses"} ready. Learning is optional.`) : f.features.academy ? "Courses are prepared and with the founders for approval." : "Being prepared for launch.", responsible: academyLive ? null : "ScaleSmiths founders", action: academyLive ? { kind: "link", href: "/partner/academy", label: f.content.lessonsCompleted > 0 ? "Resume learning" : "Start learning" } : null },
    { key: "founder_training", group: "learn", title: "Optional founder-led training", benefit: "A session with a founder on the services, the sales process or a topic you choose.", status: meetingsOf("training") ? "in_progress" : "available", detail: meetingsOf("training") ? "Your training request is with the founders." : "Optional. Request it whenever it would help; availability is confirmed by a founder.", responsible: null, action: { kind: "tab", tab: "meetings", label: "Request training", meetingType: "training" } },
    { key: "knowledge_base", group: "learn", title: "Knowledge Base", benefit: "Approved answers to the questions clients and partners ask most.", ...contentStatus(f.features.knowledge, f.content.knowledgeArticles, undefined), action: f.features.knowledge && f.content.knowledgeArticles > 0 ? { kind: "link", href: "/partner/knowledge", label: "Search answers" } : null },
    { key: "objection_handling", group: "learn", title: "Objection handling", benefit: "Approved responses to common concerns, with when to involve a founder.", ...contentStatus(f.features.objections, f.content.objectionResponses, undefined), action: f.features.objections && f.content.objectionResponses > 0 ? { kind: "link", href: "/partner/objections", label: "View responses" } : null },
    { key: "pricing_documents", group: "sell", title: "Pricing guide", benefit: "Published starting prices, what they include and how bespoke quotations work.", ...contentStatus(f.features.resources, categoryCount(categories, /pric/i), f.toolkit.pricing_documents), action: f.features.resources && categoryCount(categories, /pric/i) ? { kind: "link", href: "/partner/resources", label: "Open pricing guide" } : null },
    { key: "commission_documents", group: "start", title: "Commission guide", benefit: "How commission is earned, when it becomes payable and how withdrawals work, with worked examples.", ...contentStatus(f.features.resources, categoryCount(categories, /commission/i), f.toolkit.commission_documents), action: f.features.resources && categoryCount(categories, /commission/i) ? { kind: "link", href: "/partner/resources", label: "Read the guide" } : { kind: "tab", tab: "finance", label: "Open commission centre" } },
    { key: "brochures", group: "sell", title: "Sales brochures and guides", benefit: "Client-safe service overviews, discovery questionnaires and meeting guides.", ...contentStatus(f.features.resources, categoryCount(categories, /brochure|service|sales|guide/i), f.toolkit.brochures), action: f.features.resources && f.content.resources > 0 ? { kind: "link", href: "/partner/resources", label: "View resources" } : null },
    { key: "industry_demonstrations", group: "sell", title: "Website demonstrations", benefit: "Example websites by industry to show prospects what ScaleSmiths builds. Examples, not client projects.", ...contentStatus(f.features.resources, categoryCount(categories, /demonstration/i), f.toolkit.industry_demonstrations), action: f.features.resources && categoryCount(categories, /demonstration/i) ? { kind: "link", href: "/partner/resources", label: "Browse demonstrations" } : { kind: "tab", tab: "meetings", label: "Request a demonstration", meetingType: "commercial_assistance" } },
    { key: "email", group: "brand", title: "ScaleSmiths email address", benefit: "A professional ScaleSmiths mailbox for client correspondence.", ...manualStatus(f.toolkit.email, true), action: f.toolkit.email ? null : { kind: "command", action: "request_toolkit_item", itemKey: "email", label: "Request setup" } },
    { key: "business_card", group: "brand", title: "Digital business card", benefit: "A ScaleSmiths-branded card with your approved name, role and the ScaleSmiths enquiry route.", ...manualStatus(f.toolkit.business_card, true), action: f.toolkit.business_card ? null : { kind: "command", action: "request_toolkit_item", itemKey: "business_card", label: "Request card" } },
    { key: "circlecard", group: "brand", title: "Personalised CircleCard", benefit: "A personalised CircleCard for sharing your details in person.", ...manualStatus(f.toolkit.circlecard, true), action: f.toolkit.circlecard ? null : { kind: "command", action: "request_toolkit_item", itemKey: "circlecard", label: "Request CircleCard" } },
    { key: "personal_webpage", group: "brand", title: "Personal partner web page", benefit: "Your own page on scalesmiths.co.uk, published only with your consent and founder approval.", ...profileStatus, responsible: null, action: f.profile.eligible && f.profile.status !== "live" ? { kind: "tab", tab: "profile", label: "Set up my page" } : null },
  ]
  const nextAction = required.find((s) => s.status === "action_required") ?? (f.opportunities === 0 ? tools.find((t) => t.key === "pipeline") ?? null : tools.find((t) => t.status === "ready_to_set_up") ?? null)
  return { required, completed, total: required.length, percent, nextAction, tools, upcoming: [...UPCOMING_CAPABILITIES] }
}

/** Partner-requestable manual toolkit items. A request only records intent; a founder fulfils it and records evidence. */
export const REQUESTABLE_TOOLKIT_ITEMS = ["email", "business_card", "circlecard"] as const
export const isRequestableToolkitItem = (value: unknown): value is (typeof REQUESTABLE_TOOLKIT_ITEMS)[number] => (REQUESTABLE_TOOLKIT_ITEMS as readonly unknown[]).includes(value)
