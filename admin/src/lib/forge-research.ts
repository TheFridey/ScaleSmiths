import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import type { ForgeIntakeData } from "./forge"

export const FORGE_RESEARCH_ARTIFACT_TITLE = "Research Report"
export const FORGE_RESEARCH_ARTIFACT_KIND = "forge_research_report"

export type ForgeResearchPriority = "primary" | "secondary" | "supporting"

export interface ForgeResearchPersona extends Record<string, JsonValue> {
  name: string
  description: string
  pains: string[]
  motivations: string[]
}

export interface ForgeResearchRecommendedPage extends Record<string, JsonValue> {
  title: string
  purpose: string
  priority: ForgeResearchPriority
}

export interface ForgeResearchReport extends Record<string, JsonValue> {
  businessSummary: string
  customerPersonas: ForgeResearchPersona[]
  localSeoOpportunities: string[]
  trustGaps: string[]
  conversionGaps: string[]
  competitorPositioning: string[]
  recommendedPages: ForgeResearchRecommendedPage[]
  recommendedCallsToAction: string[]
  recommendedProofSections: string[]
  aeoGeoOpportunities: string[]
  contentOpportunities: string[]
}

export interface ForgeResearchProjectContext {
  id?: number
  name: string
  businessName: string
  industry: string | null
  websiteUrl: string | null
  brandNotes: string | null
  targetAudience: string | null
  primaryGoal: string | null
  budgetRange: string | null
}

export interface ForgeResearchMemoryContext {
  key: string
  value: string
  source: string | null
}

export const FORGE_RESEARCH_REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessSummary",
    "customerPersonas",
    "localSeoOpportunities",
    "trustGaps",
    "conversionGaps",
    "competitorPositioning",
    "recommendedPages",
    "recommendedCallsToAction",
    "recommendedProofSections",
    "aeoGeoOpportunities",
    "contentOpportunities",
  ],
  properties: {
    businessSummary: { type: "string", description: "Concise commercial summary of the business and website opportunity." },
    customerPersonas: {
      type: "array",
      description: "Likely buyer/user personas the website should speak to.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "pains", "motivations"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          pains: { type: "array", items: { type: "string" } },
          motivations: { type: "array", items: { type: "string" } },
        },
      },
    },
    localSeoOpportunities: { type: "array", items: { type: "string" } },
    trustGaps: { type: "array", items: { type: "string" } },
    conversionGaps: { type: "array", items: { type: "string" } },
    competitorPositioning: { type: "array", items: { type: "string" } },
    recommendedPages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "purpose", "priority"],
        properties: {
          title: { type: "string" },
          purpose: { type: "string" },
          priority: { type: "string", enum: ["primary", "secondary", "supporting"] },
        },
      },
    },
    recommendedCallsToAction: { type: "array", items: { type: "string" } },
    recommendedProofSections: { type: "array", items: { type: "string" } },
    aeoGeoOpportunities: { type: "array", items: { type: "string" } },
    contentOpportunities: { type: "array", items: { type: "string" } },
  },
} as const satisfies ForgeJsonSchema

export function buildForgeResearchPrompt({
  project,
  intake,
  memories,
}: {
  project: ForgeResearchProjectContext
  intake: ForgeIntakeData
  memories: ForgeResearchMemoryContext[]
}) {
  const competitors = splitLines(intake.competitorUrls)
  const lines = [
    "Create a practical website and business research report for ScaleSmiths Forge.",
    "Use only the project record, structured intake, project memory, website URL text, and competitor URL text supplied below.",
    "Do not claim to have scraped, crawled, visited, tested, audited, or inspected any live website.",
    "Frame website URL and competitor URLs as context clues only.",
    "Make the output specific enough for future research, sitemap, copy, design, build, and integration agents.",
    "",
    "Project:",
    `- Project name: ${project.name}`,
    `- Business name: ${project.businessName}`,
    `- Industry: ${project.industry ?? "Not provided"}`,
    `- Website URL: ${project.websiteUrl ?? "Not provided"}`,
    `- Target audience: ${project.targetAudience ?? "Not provided"}`,
    `- Primary goal: ${project.primaryGoal ?? "Not provided"}`,
    `- Budget range: ${project.budgetRange ?? "Not provided"}`,
    `- Brand notes: ${project.brandNotes ?? "Not provided"}`,
    "",
    "Structured intake:",
    ...Object.entries(intake).map(([key, value]) => `- ${key}: ${value || "Not provided"}`),
    "",
    "Competitor context:",
    ...(competitors.length ? competitors.map((competitor) => `- ${competitor}`) : ["- Not provided"]),
    "",
    "Project memory:",
    ...(memories.length ? memories.map((memory) => `- ${memory.key}: ${memory.value}`) : ["- No stored memory yet"]),
  ]

  return lines.join("\n")
}

export function buildForgeResearchArtifactContent(report: ForgeResearchReport) {
  const lines = [
    "# Research Report",
    "",
    "## Business summary",
    report.businessSummary,
    "",
    "## Likely customer personas",
    ...report.customerPersonas.flatMap((persona) => [
      `### ${persona.name}`,
      persona.description,
      `- Pains: ${persona.pains.join("; ") || "Not specified"}`,
      `- Motivations: ${persona.motivations.join("; ") || "Not specified"}`,
      "",
    ]),
    "## Local SEO opportunities",
    ...bulletList(report.localSeoOpportunities),
    "",
    "## Trust gaps",
    ...bulletList(report.trustGaps),
    "",
    "## Conversion gaps",
    ...bulletList(report.conversionGaps),
    "",
    "## Competitor positioning",
    ...bulletList(report.competitorPositioning),
    "",
    "## Recommended pages",
    ...report.recommendedPages.map((page) => `- ${page.title} (${page.priority}): ${page.purpose}`),
    "",
    "## Recommended calls to action",
    ...bulletList(report.recommendedCallsToAction),
    "",
    "## Recommended proof/trust sections",
    ...bulletList(report.recommendedProofSections),
    "",
    "## AEO/GEO opportunities",
    ...bulletList(report.aeoGeoOpportunities),
    "",
    "## Content opportunities",
    ...bulletList(report.contentOpportunities),
  ]

  return lines.join("\n").trim()
}

export function createMockResearchReport(project: ForgeResearchProjectContext, intake: ForgeIntakeData): ForgeResearchReport {
  const businessName = project.businessName || project.name
  const audience = project.targetAudience || intake.idealCustomers || "qualified buyers"
  const location = intake.primaryLocation || intake.businessLocation || "the target service area"
  const goal = project.primaryGoal || intake.primaryWebsiteGoal || "increase qualified enquiries"
  const services = intake.coreServices || "core services"
  const differentiators = intake.differentiators || "clear process, credible proof, and fast response"

  return {
    businessSummary: `${businessName} needs a website that turns ${audience} into confident enquiries by making ${services} easy to understand, proving credibility quickly, and keeping every page aligned to ${goal}.`,
    customerPersonas: [
      {
        name: "Ready-to-buy decision maker",
        description: `A commercially aware visitor comparing providers in ${location} and looking for confidence before contacting ${businessName}.`,
        pains: ["Unclear service fit", "Weak proof of delivery", "Slow or hidden contact routes"],
        motivations: ["Fast answers", "Visible evidence", "A simple next step"],
      },
      {
        name: "Research-stage evaluator",
        description: `A visitor learning what good looks like before shortlisting ${businessName} against local alternatives.`,
        pains: ["Generic service copy", "No comparison guidance", "Little detail about process or outcomes"],
        motivations: ["Plain-language education", "Service-specific pages", "Trust signals close to claims"],
      },
    ],
    localSeoOpportunities: [
      `Create service and location language around ${location}.`,
      "Use page titles and headings that combine service, outcome, and service area.",
      "Add FAQ content that answers buyer questions in natural language.",
    ],
    trustGaps: [
      "Surface testimonials, reviews, accreditations, and case evidence near conversion points.",
      "Explain process, response times, guarantees, and what happens after enquiry.",
      "Show real assets such as team, premises, work examples, or deliverables where available.",
    ],
    conversionGaps: [
      "Make the primary CTA persistent and outcome-led.",
      "Add low-friction contact routes for call, form, email, and WhatsApp where relevant.",
      "Match each service page to one clear enquiry action.",
    ],
    competitorPositioning: [
      `Position around ${differentiators}.`,
      "Avoid generic claims; make the difference specific, provable, and repeated across key pages.",
      "Use competitor URLs as reference context only until a future safe crawler is added.",
    ],
    recommendedPages: [
      { title: "Home", purpose: "Explain the offer, prove credibility, and route visitors to key services.", priority: "primary" },
      { title: "Services", purpose: `Break down ${services} into clear buyer-friendly options.`, priority: "primary" },
      { title: "Service Area", purpose: `Support local intent around ${location} and surrounding areas.`, priority: "secondary" },
      { title: "About", purpose: "Build confidence through story, team, process, and standards.", priority: "secondary" },
      { title: "Contact", purpose: "Convert interest into a clear enquiry with minimal friction.", priority: "primary" },
    ],
    recommendedCallsToAction: [
      "Request a quote",
      "Book a discovery call",
      "Ask about availability",
      "Send project details",
    ],
    recommendedProofSections: [
      "Reviews/testimonials",
      "Process steps",
      "Case studies or work examples",
      "Accreditations, guarantees, or quality markers",
    ],
    aeoGeoOpportunities: [
      "Answer high-intent questions in concise FAQ blocks.",
      "Create pages and sections that mention services, location, outcomes, and proof in complete sentences.",
      "Add structured, reusable summaries that future AI assistants can cite accurately.",
    ],
    contentOpportunities: [
      `How to choose the right ${project.industry ?? "service"} option for your property`,
      "Before/after or result-led case study",
      "Buyer FAQ",
      "Process explainer",
      "Local service area content",
    ],
  }
}

export function extractForgeResearchCompetitors(intake: ForgeIntakeData) {
  return splitLines(intake.competitorUrls)
}

function bulletList(values: string[]) {
  return values.length ? values.map((value) => `- ${value}`) : ["- Not specified"]
}

function splitLines(value: string | null | undefined) {
  return (value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}
