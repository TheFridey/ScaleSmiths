import type { DeliveryProjectPhase } from "./delivery-projects"

export const ONBOARDING_ITEM_KINDS = ["task", "client_input", "document_request", "internal_check"] as const
export const ONBOARDING_ITEM_STATUSES = ["not_started", "in_progress", "blocked", "completed", "not_required"] as const

export type OnboardingItemKind = (typeof ONBOARDING_ITEM_KINDS)[number]
export type OnboardingItemStatus = (typeof ONBOARDING_ITEM_STATUSES)[number]

export interface OnboardingTemplate {
  key: string
  version: number
  name: string
  description: string
  project: { summary: string; portalWelcomeTitle: string; portalWelcomeContent: string }
  milestones: Array<{ ref: string; title: string; description: string; phase: DeliveryProjectPhase; clientVisible: boolean; weight: number }>
  items: Array<{ milestoneRef: string; kind: OnboardingItemKind; title: string; description?: string; clientVisible: boolean }>
  deliverables: Array<{ milestoneRef: string; title: string; description?: string; clientVisible: boolean }>
}

const buildMilestones: OnboardingTemplate["milestones"] = [
  ["discovery", "Discovery", "Agree goals, audiences, scope and measures of success.", "discovery", true, 1],
  ["access", "Access and asset collection", "Collect the accounts, brand assets and source material needed to begin.", "discovery", true, 1],
  ["content", "Content", "Prepare, review and approve the content required for the build.", "strategy", true, 1],
  ["design", "Design direction", "Agree the visual direction before full production.", "design", true, 1],
  ["build", "Build", "Implement the agreed pages, components and integrations.", "build", true, 3],
  ["qa", "Internal QA", "Check quality, accessibility, performance and critical journeys.", "review", false, 1],
  ["client_review", "Client review", "Review the staging build and agree final amendments.", "review", true, 1],
  ["launch_prep", "Launch preparation", "Complete launch checks, redirects, analytics and approvals.", "launch", true, 1],
  ["deployment", "Deployment", "Release the approved build and verify production.", "launch", true, 1],
  ["handoff", "Handoff", "Provide documentation, access and agreed post-launch support.", "ongoing", true, 1],
].map(([ref, title, description, phase, clientVisible, weight]) => ({ ref: String(ref), title: String(title), description: String(description), phase: phase as DeliveryProjectPhase, clientVisible: Boolean(clientVisible), weight: Number(weight) }))

export const ONBOARDING_TEMPLATES: readonly OnboardingTemplate[] = [
  {
    key: "website-build", version: 1, name: "Website build", description: "Full website delivery from discovery through launch and handoff.",
    project: { summary: "A structured website project from discovery through launch and handoff.", portalWelcomeTitle: "Welcome to your website project", portalWelcomeContent: "This workspace shows what is happening, what we need from you and what comes next. We will keep milestones and requests updated as the project moves forward." },
    milestones: buildMilestones,
    items: [
      { milestoneRef: "discovery", kind: "task", title: "Run discovery workshop", clientVisible: true },
      { milestoneRef: "discovery", kind: "client_input", title: "Confirm goals, audiences and priority journeys", clientVisible: true },
      { milestoneRef: "access", kind: "document_request", title: "Provide brand assets and guidelines", clientVisible: true },
      { milestoneRef: "access", kind: "client_input", title: "Provide domain, hosting and analytics access", description: "Use an approved secure sharing method; do not place credentials in project notes.", clientVisible: true },
      { milestoneRef: "content", kind: "document_request", title: "Provide or approve page content", clientVisible: true },
      { milestoneRef: "design", kind: "client_input", title: "Approve design direction", clientVisible: true },
      { milestoneRef: "build", kind: "task", title: "Build agreed pages and integrations", clientVisible: false },
      { milestoneRef: "qa", kind: "internal_check", title: "Complete accessibility and responsive QA", clientVisible: false },
      { milestoneRef: "qa", kind: "internal_check", title: "Test forms, analytics and critical journeys", clientVisible: false },
      { milestoneRef: "client_review", kind: "client_input", title: "Review staging build and consolidate feedback", clientVisible: true },
      { milestoneRef: "launch_prep", kind: "internal_check", title: "Complete launch readiness checklist", clientVisible: false },
      { milestoneRef: "deployment", kind: "task", title: "Deploy and verify production", clientVisible: true },
      { milestoneRef: "handoff", kind: "task", title: "Run handoff and confirm support route", clientVisible: true },
    ],
    deliverables: [
      { milestoneRef: "design", title: "Approved design direction", clientVisible: true },
      { milestoneRef: "client_review", title: "Staging website", clientVisible: true },
      { milestoneRef: "deployment", title: "Production website", clientVisible: true },
      { milestoneRef: "handoff", title: "Handoff documentation", clientVisible: true },
    ],
  },
  {
    key: "seo-foundation", version: 1, name: "SEO foundation", description: "Technical, content and local-search foundations with a prioritised action plan.",
    project: { summary: "Technical and content foundations for sustainable organic visibility.", portalWelcomeTitle: "Welcome to your SEO foundation project", portalWelcomeContent: "We will audit the current position, collect the access and context we need, then work through a prioritised set of technical and content improvements." },
    milestones: [
      { ref: "discovery", title: "Discovery and access", description: "Confirm goals, markets and measurement access.", phase: "discovery", clientVisible: true, weight: 1 },
      { ref: "audit", title: "Technical and search audit", description: "Assess crawlability, performance, content and search demand.", phase: "strategy", clientVisible: true, weight: 2 },
      { ref: "implementation", title: "Priority implementation", description: "Complete the agreed high-value fixes.", phase: "build", clientVisible: true, weight: 3 },
      { ref: "review", title: "Measurement and handoff", description: "Verify changes and agree the next action plan.", phase: "review", clientVisible: true, weight: 1 },
    ],
    items: [
      { milestoneRef: "discovery", kind: "client_input", title: "Confirm priority services and locations", clientVisible: true },
      { milestoneRef: "discovery", kind: "client_input", title: "Provide Search Console and analytics access", clientVisible: true },
      { milestoneRef: "audit", kind: "internal_check", title: "Complete technical crawl and indexation review", clientVisible: false },
      { milestoneRef: "audit", kind: "internal_check", title: "Review search demand and current content coverage", clientVisible: false },
      { milestoneRef: "implementation", kind: "task", title: "Implement agreed priority fixes", clientVisible: true },
      { milestoneRef: "review", kind: "internal_check", title: "Verify measurement and indexing signals", clientVisible: false },
    ],
    deliverables: [{ milestoneRef: "audit", title: "Prioritised SEO action plan", clientVisible: true }, { milestoneRef: "review", title: "Implementation and measurement handoff", clientVisible: true }],
  },
  {
    key: "growth-partnership", version: 1, name: "Digital Growth Partnership", description: "Recurring onboarding for measurement, priorities, delivery rhythm and reporting.",
    project: { summary: "An ongoing delivery partnership focused on agreed growth priorities.", portalWelcomeTitle: "Welcome to your growth partnership", portalWelcomeContent: "This workspace is the shared view of current priorities, requests, deliverables and next actions. We will keep it focused on the work that matters now." },
    milestones: [
      { ref: "baseline", title: "Baseline and access", description: "Establish goals, current performance and required access.", phase: "discovery", clientVisible: true, weight: 1 },
      { ref: "plan", title: "90-day priority plan", description: "Agree the first delivery priorities and measures.", phase: "strategy", clientVisible: true, weight: 1 },
      { ref: "rhythm", title: "Delivery rhythm established", description: "Start the agreed delivery and reporting cadence.", phase: "ongoing", clientVisible: true, weight: 1 },
    ],
    items: [
      { milestoneRef: "baseline", kind: "client_input", title: "Confirm commercial priorities and constraints", clientVisible: true },
      { milestoneRef: "baseline", kind: "client_input", title: "Provide analytics, search and website access", clientVisible: true },
      { milestoneRef: "baseline", kind: "internal_check", title: "Validate tracking and baseline measures", clientVisible: false },
      { milestoneRef: "plan", kind: "task", title: "Prepare and agree the first 90-day plan", clientVisible: true },
      { milestoneRef: "rhythm", kind: "task", title: "Confirm communication and reporting cadence", clientVisible: true },
    ],
    deliverables: [{ milestoneRef: "plan", title: "90-day priority plan", clientVisible: true }, { milestoneRef: "rhythm", title: "Baseline performance summary", clientVisible: true }],
  },
] as const

export function getOnboardingTemplate(key: unknown) {
  if (key === null || key === undefined || key === "") return null
  return ONBOARDING_TEMPLATES.find((template) => template.key === key) ?? null
}

export function snapshotOnboardingTemplate(template: OnboardingTemplate): OnboardingTemplate {
  return structuredClone(template)
}
