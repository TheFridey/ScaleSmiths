import type { V2Industry } from "@/lib/v2/scenes"

export type V2IndustryModuleLabel =
  | "Lead Capture"
  | "Quote Engine"
  | "Booking Calendar"
  | "CRM Pipeline"
  | "Review Requests"
  | "SEO Visibility"
  | "Follow-up Automation"
  | "Analytics"

export interface V2IndustryModule {
  label: V2IndustryModuleLabel
  summary: string
}

export interface V2IndustryCtaWording {
  primary: string
  secondary: string
  simulationNext: string
}

export interface V2IndustryContent {
  id: V2Industry
  name: string
  headline: string
  painPoints: string[]
  simulatedWorkflow: string[]
  modules: V2IndustryModule[]
  finalPitch: string
  ctaWording: V2IndustryCtaWording
}

export const industryContent: Record<V2Industry, V2IndustryContent> = {
  "local-trade-builder": {
    id: "local-trade-builder",
    name: "Trades",
    headline: "Turn missed calls into qualified jobs.",
    painPoints: [
      "Missed calls while on site",
      "Unstructured quote requests",
      "No follow-up system",
      "Weak local SEO",
      "Reviews not being captured",
    ],
    simulatedWorkflow: [
      "Customer describes the job",
      "Photos are uploaded",
      "AI structures the enquiry",
      "Quote draft is prepared",
      "Booking slot is suggested",
      "Follow-up is scheduled",
    ],
    modules: [
      { label: "Lead Capture", summary: "Collect job details, contact info and site context before the first call." },
      { label: "Quote Engine", summary: "Shape messy requests into a clear quote draft the team can review." },
      { label: "Booking Calendar", summary: "Suggest realistic appointment slots around site visits and availability." },
      { label: "CRM Pipeline", summary: "Track enquiry, quoted, booked, completed and review-ready stages." },
      { label: "Review Requests", summary: "Prepare polite review prompts after completed work." },
      { label: "SEO Visibility", summary: "Surface local service pages and location signals for nearby searches." },
      { label: "Follow-up Automation", summary: "Queue reminders for unaccepted quotes and post-job check-ins." },
      { label: "Analytics", summary: "Show which services, areas and channels are creating useful enquiries." },
    ],
    finalPitch: "ScaleSmiths can turn a trade website into a 24/7 quoting and lead qualification system.",
    ctaWording: {
      primary: "Request a Trade Strategy Call",
      secondary: "View Normal Website",
      simulationNext: "Forge the trade system",
    },
  },
  "restaurant-food": {
    id: "restaurant-food",
    name: "Restaurant",
    headline: "Turn hungry interest into booked tables and repeat visits.",
    painPoints: [
      "Booking requests spread across channels",
      "Menus changing faster than the website",
      "Reviews handled too late",
      "Quiet services needing better visibility",
      "Customer follow-up living in separate tools",
    ],
    simulatedWorkflow: [
      "Guest checks availability",
      "Menu interest is captured",
      "Booking details are structured",
      "Table slot is suggested",
      "Review request is prepared",
      "Return visit prompt is scheduled",
    ],
    modules: [
      { label: "Lead Capture", summary: "Capture booking intent, party size, diet notes and event context." },
      { label: "Quote Engine", summary: "Prepare private hire, catering or set-menu enquiry summaries." },
      { label: "Booking Calendar", summary: "Connect guest demand to table, event or tasting availability." },
      { label: "CRM Pipeline", summary: "Track new guests, regulars, events, feedback and follow-up moments." },
      { label: "Review Requests", summary: "Prepare timely review prompts after visits or resolved service issues." },
      { label: "SEO Visibility", summary: "Strengthen local dining, cuisine and occasion-led discovery pages." },
      { label: "Follow-up Automation", summary: "Queue birthday, event, quiet-night and return-visit messages." },
      { label: "Analytics", summary: "Show demand by service, menu interest, booking source and review flow." },
    ],
    finalPitch: "ScaleSmiths can turn a restaurant website into a booking, menu and guest follow-up system.",
    ctaWording: {
      primary: "Request a Hospitality Strategy Call",
      secondary: "View Normal Website",
      simulationNext: "Forge the restaurant system",
    },
  },
  "gym-fitness": {
    id: "gym-fitness",
    name: "Gym",
    headline: "Turn fitness intent into committed members.",
    painPoints: [
      "Trial enquiries not followed up consistently",
      "Class schedules hard to keep current",
      "Membership options causing friction",
      "Retention signals hidden until too late",
      "Local search pages not matching real offers",
    ],
    simulatedWorkflow: [
      "Prospect chooses a goal",
      "Class or intro interest is captured",
      "Best-fit offer is suggested",
      "Visit slot is reserved",
      "Follow-up is scheduled",
      "Retention signal is added to the dashboard",
    ],
    modules: [
      { label: "Lead Capture", summary: "Capture goals, experience level and preferred training times." },
      { label: "Quote Engine", summary: "Shape membership, PT or challenge options into a clear recommendation." },
      { label: "Booking Calendar", summary: "Reserve intro sessions, trials and class slots without manual chasing." },
      { label: "CRM Pipeline", summary: "Track prospects, trials, members, pauses and win-back opportunities." },
      { label: "Review Requests", summary: "Prepare prompts after milestones, classes and successful onboarding." },
      { label: "SEO Visibility", summary: "Connect local fitness searches to offers, classes and transformation pages." },
      { label: "Follow-up Automation", summary: "Queue trial reminders, onboarding nudges and reactivation messages." },
      { label: "Analytics", summary: "Show which offers, classes and channels are producing qualified interest." },
    ],
    finalPitch: "ScaleSmiths can turn a gym website into a member acquisition, booking and retention system.",
    ctaWording: {
      primary: "Request a Fitness Strategy Call",
      secondary: "View Normal Website",
      simulationNext: "Forge the gym system",
    },
  },
  "professional-services": {
    id: "professional-services",
    name: "Professional Services",
    headline: "Turn complex enquiries into qualified appointments.",
    painPoints: [
      "Unqualified enquiries taking senior time",
      "Document requests handled manually",
      "Consultation booking friction",
      "Client pipeline spread across inboxes",
      "Follow-up depending on memory",
    ],
    simulatedWorkflow: [
      "Client describes the issue",
      "Eligibility questions are answered",
      "Documents are requested",
      "Enquiry is qualified",
      "Appointment slot is suggested",
      "Next-step follow-up is scheduled",
    ],
    modules: [
      { label: "Lead Capture", summary: "Collect structured enquiry details before the consultation stage." },
      { label: "Quote Engine", summary: "Prepare scope, fit and next-step summaries for the service team." },
      { label: "Booking Calendar", summary: "Suggest consultation slots based on matter type and availability." },
      { label: "CRM Pipeline", summary: "Track enquiry, qualified, booked, active and follow-up stages." },
      { label: "Review Requests", summary: "Prepare compliant feedback prompts after appropriate service milestones." },
      { label: "SEO Visibility", summary: "Build service and location pages around specific client needs." },
      { label: "Follow-up Automation", summary: "Queue document reminders, appointment nudges and next-step messages." },
      { label: "Analytics", summary: "Show which services and sources are creating suitable enquiries." },
    ],
    finalPitch: "ScaleSmiths can turn a professional services website into a qualification, booking and client pipeline system.",
    ctaWording: {
      primary: "Request a Services Strategy Call",
      secondary: "View Normal Website",
      simulationNext: "Forge the services system",
    },
  },
  ecommerce: {
    id: "ecommerce",
    name: "Ecommerce",
    headline: "Turn product browsing into guided buying journeys.",
    painPoints: [
      "Shoppers unsure which product fits",
      "Basket intent disappearing without context",
      "Product pages lacking guidance",
      "Fulfilment questions slowing decisions",
      "Marketing data not connected to real behaviour",
    ],
    simulatedWorkflow: [
      "Shopper explores a product need",
      "Preference signals are captured",
      "Recommended products are surfaced",
      "Basket intent is detected",
      "Delivery question is answered",
      "Follow-up is scheduled",
    ],
    modules: [
      { label: "Lead Capture", summary: "Capture preference, fit and buying-intent signals during browsing." },
      { label: "Quote Engine", summary: "Prepare bundle, custom order or high-ticket enquiry summaries." },
      { label: "Booking Calendar", summary: "Reserve demos, fittings or consultation slots where needed." },
      { label: "CRM Pipeline", summary: "Track shoppers, high-intent baskets, support needs and repeat buyers." },
      { label: "Review Requests", summary: "Prepare product feedback prompts after delivery or support resolution." },
      { label: "SEO Visibility", summary: "Connect product, category and comparison pages to search demand." },
      { label: "Follow-up Automation", summary: "Queue abandoned-basket, back-in-stock and post-purchase messages." },
      { label: "Analytics", summary: "Show product interest, funnel friction and useful conversion signals." },
    ],
    finalPitch: "ScaleSmiths can turn an ecommerce website into a guided product discovery and follow-up system.",
    ctaWording: {
      primary: "Request an Ecommerce Strategy Call",
      secondary: "View Normal Website",
      simulationNext: "Forge the ecommerce system",
    },
  },
  other: {
    id: "other",
    name: "Other",
    headline: "Turn customer signals into a business system built around you.",
    painPoints: [
      "Website enquiries arriving without structure",
      "Manual admin between first contact and next step",
      "Follow-up happening inconsistently",
      "Search visibility not mapped to the offer",
      "Performance data split across tools",
    ],
    simulatedWorkflow: [
      "Customer intent is captured",
      "Business rules are applied",
      "Next step is suggested",
      "Pipeline stage is updated",
      "Follow-up is prepared",
      "Performance signal is recorded",
    ],
    modules: [
      { label: "Lead Capture", summary: "Capture the details that matter for this specific business model." },
      { label: "Quote Engine", summary: "Shape enquiries into clear next steps, estimates or qualification notes." },
      { label: "Booking Calendar", summary: "Suggest appointments, calls, visits or fulfilment windows where relevant." },
      { label: "CRM Pipeline", summary: "Track customers through the stages that match the real operation." },
      { label: "Review Requests", summary: "Prepare feedback prompts at the right moment in the customer journey." },
      { label: "SEO Visibility", summary: "Map search demand to the offers, locations and questions customers use." },
      { label: "Follow-up Automation", summary: "Queue reminders and next-step messages without pretending every business is the same." },
      { label: "Analytics", summary: "Show the signals that help the team decide what to improve next." },
    ],
    finalPitch: "ScaleSmiths can turn a website into a tailored operating layer for the way your business actually works.",
    ctaWording: {
      primary: "Request a Strategy Call",
      secondary: "View Normal Website",
      simulationNext: "Forge the custom system",
    },
  },
}

export function getIndustryContent(industry: V2Industry | null) {
  return industryContent[industry ?? "other"]
}
