import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import type { ForgeIntakeData } from "./forge"
import type { ForgeResearchReport } from "./forge-research"
import { validateJsonSchemaValue } from "./forge-ai"

export const FORGE_SITEMAP_ARTIFACT_TITLE = "Sitemap & Strategy"
export const FORGE_SITEMAP_ARTIFACT_KIND = "forge_sitemap_strategy"

export type ForgeSitemapPriority = "primary" | "secondary" | "supporting"

export interface ForgeSitemapPage extends Record<string, JsonValue> {
  title: string
  path: string
  pagePurpose: string
  targetKeyword: string
  searchIntent: string
  primaryCta: string
  trustElements: string[]
  schemaRecommendation: string
  conversionNotes: string
  priority: ForgeSitemapPriority
}

export interface ForgeSitemapStrategy extends Record<string, JsonValue> {
  strategySummary: string
  sitemap: ForgeSitemapPage[]
  conversionNotes: string[]
  internalLinkingPlan: string[]
  priorityBuildOrder: string[]
}

export interface ForgeSitemapProjectContext {
  id?: number
  name: string
  businessName: string
  industry: string | null
  websiteUrl: string | null
  targetAudience: string | null
  primaryGoal: string | null
}

export interface ForgeSitemapArtifactState {
  strategy: ForgeSitemapStrategy | null
  approvedStrategy: ForgeSitemapStrategy | null
  status: "draft" | "approved" | "empty"
  approvedAt: string | null
  approvedBy: string | null
}

export const FORGE_SITEMAP_STRATEGY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["strategySummary", "sitemap", "conversionNotes", "internalLinkingPlan", "priorityBuildOrder"],
  properties: {
    strategySummary: { type: "string", description: "Short website strategy summary for a local/service business." },
    sitemap: {
      type: "array",
      description: "Recommended website pages.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "path",
          "pagePurpose",
          "targetKeyword",
          "searchIntent",
          "primaryCta",
          "trustElements",
          "schemaRecommendation",
          "conversionNotes",
          "priority",
        ],
        properties: {
          title: { type: "string" },
          path: { type: "string" },
          pagePurpose: { type: "string" },
          targetKeyword: { type: "string" },
          searchIntent: { type: "string" },
          primaryCta: { type: "string" },
          trustElements: { type: "array", items: { type: "string" } },
          schemaRecommendation: { type: "string" },
          conversionNotes: { type: "string" },
          priority: { type: "string", enum: ["primary", "secondary", "supporting"] },
        },
      },
    },
    conversionNotes: { type: "array", items: { type: "string" } },
    internalLinkingPlan: { type: "array", items: { type: "string" } },
    priorityBuildOrder: { type: "array", items: { type: "string" } },
  },
} as const satisfies ForgeJsonSchema

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function parseForgeSitemapStrategyPayload(input: unknown): ParseResult<ForgeSitemapStrategy> {
  const errors = validateJsonSchemaValue(FORGE_SITEMAP_STRATEGY_SCHEMA, input)
  if (errors.length) return { ok: false, error: errors.join(" ") }
  return { ok: true, data: input as ForgeSitemapStrategy }
}

export function readForgeSitemapStrategyArtifact(metadata: Record<string, unknown> | null | undefined): ForgeSitemapArtifactState {
  if (!metadata || metadata.kind !== FORGE_SITEMAP_ARTIFACT_KIND) {
    return {
      strategy: null,
      approvedStrategy: null,
      status: "empty",
      approvedAt: null,
      approvedBy: null,
    }
  }

  const strategy = parseForgeSitemapStrategyPayload(metadata.strategy).ok
    ? (metadata.strategy as ForgeSitemapStrategy)
    : null
  const approvedStrategy = parseForgeSitemapStrategyPayload(metadata.approvedStrategy).ok
    ? (metadata.approvedStrategy as ForgeSitemapStrategy)
    : null

  return {
    strategy,
    approvedStrategy,
    status: metadata.status === "approved" && approvedStrategy ? "approved" : strategy ? "draft" : "empty",
    approvedAt: typeof metadata.approvedAt === "string" ? metadata.approvedAt : null,
    approvedBy: typeof metadata.approvedBy === "string" ? metadata.approvedBy : null,
  }
}

export function buildForgeSitemapPrompt({
  project,
  intakeSummary,
  researchReport,
}: {
  project: ForgeSitemapProjectContext
  intakeSummary: string
  researchReport: ForgeResearchReport | null
}) {
  const lines = [
    "Generate a website strategy and sitemap for a real local/service business.",
    "Avoid generic SaaS assumptions such as pricing pages, product tours, integrations pages, and feature grids unless explicitly supported by the intake.",
    "Prioritise high-intent service pages, local search intent, proof, trust, and clear enquiry paths.",
    "Every page should include page purpose, target keyword/search intent, CTA, trust elements, schema recommendation, and conversion notes.",
    "",
    "Project:",
    `- Project name: ${project.name}`,
    `- Business name: ${project.businessName}`,
    `- Industry: ${project.industry ?? "Not provided"}`,
    `- Current website URL: ${project.websiteUrl ?? "Not provided"}`,
    `- Target audience: ${project.targetAudience ?? "Not provided"}`,
    `- Primary goal: ${project.primaryGoal ?? "Not provided"}`,
    "",
    "Intake summary:",
    intakeSummary || "No intake summary available.",
    "",
    "Research report:",
    researchReport ? JSON.stringify(researchReport, null, 2) : "No research report available. Use intake and project context only.",
  ]

  return lines.join("\n")
}

export function buildForgeSitemapArtifactContent(strategy: ForgeSitemapStrategy) {
  const lines = [
    "# Sitemap & Strategy",
    "",
    "## Strategy summary",
    strategy.strategySummary,
    "",
    "## Recommended sitemap",
    ...strategy.sitemap.flatMap((page, index) => [
      `### ${index + 1}. ${page.title}`,
      `- Path: ${page.path}`,
      `- Purpose: ${page.pagePurpose}`,
      `- Target keyword/search intent: ${page.targetKeyword} / ${page.searchIntent}`,
      `- CTA: ${page.primaryCta}`,
      `- Trust elements: ${page.trustElements.join("; ") || "Not specified"}`,
      `- Schema: ${page.schemaRecommendation}`,
      `- Conversion notes: ${page.conversionNotes}`,
      `- Priority: ${page.priority}`,
      "",
    ]),
    "## Conversion notes",
    ...bulletList(strategy.conversionNotes),
    "",
    "## Internal linking plan",
    ...bulletList(strategy.internalLinkingPlan),
    "",
    "## Priority build order",
    ...strategy.priorityBuildOrder.map((item, index) => `${index + 1}. ${item}`),
  ]

  return lines.join("\n").trim()
}

export function createMockSitemapStrategy(project: ForgeSitemapProjectContext, intake: ForgeIntakeData, researchReport: ForgeResearchReport | null): ForgeSitemapStrategy {
  const businessName = project.businessName || project.name
  const location = intake.primaryLocation || intake.businessLocation || "local service area"
  const services = splitList(intake.coreServices || "Core services")
  const primaryService = services[0] || "Services"
  const cta = splitList(intake.conversionActions)[0] || "Request a quote"
  const proof = splitList(intake.testimonials || "Reviews, case studies, accreditations")
  const recommendedPages = researchReport?.recommendedPages.map((page) => page.title) ?? []
  const servicePages = services.slice(0, 3).map((service) => ({
    title: service,
    path: `/${slugify(service)}`,
    pagePurpose: `Convert high-intent visitors looking for ${service.toLowerCase()} into enquiries.`,
    targetKeyword: `${service.toLowerCase()} ${location.toLowerCase()}`,
    searchIntent: `Find a trusted local provider for ${service.toLowerCase()}.`,
    primaryCta: cta,
    trustElements: proof.slice(0, 3),
    schemaRecommendation: "Service schema with LocalBusiness context",
    conversionNotes: "Place proof and enquiry action above the fold, then explain process and outcomes.",
    priority: "primary" as const,
  }))

  const sitemap: ForgeSitemapPage[] = [
    {
      title: "Home",
      path: "/",
      pagePurpose: `Position ${businessName}, route visitors to key services, and make the next step obvious.`,
      targetKeyword: `${project.industry ?? primaryService} ${location}`.toLowerCase(),
      searchIntent: "Find a credible local business and understand whether they are the right fit.",
      primaryCta: cta,
      trustElements: proof.slice(0, 3),
      schemaRecommendation: "LocalBusiness schema",
      conversionNotes: "Lead with offer clarity, service routing, proof, and one primary enquiry route.",
      priority: "primary",
    },
    ...servicePages,
    {
      title: "Service Area",
      path: "/service-area",
      pagePurpose: `Support local discovery across ${location} and surrounding areas.`,
      targetKeyword: `${primaryService.toLowerCase()} near ${location.toLowerCase()}`,
      searchIntent: "Check whether the business serves the visitor's area.",
      primaryCta: cta,
      trustElements: ["Local coverage notes", "Response expectations", ...proof.slice(0, 1)],
      schemaRecommendation: "AreaServed property on LocalBusiness or Service schema",
      conversionNotes: "Connect each area mention back to the most relevant service page.",
      priority: "secondary",
    },
    {
      title: "About",
      path: "/about",
      pagePurpose: "Build confidence with story, standards, team, process, and proof.",
      targetKeyword: `${businessName.toLowerCase()} ${location.toLowerCase()}`,
      searchIntent: "Validate credibility before making contact.",
      primaryCta: cta,
      trustElements: proof,
      schemaRecommendation: "Organization schema",
      conversionNotes: "Use real credibility markers and route visitors back to service/contact pages.",
      priority: "secondary",
    },
    {
      title: "Contact",
      path: "/contact",
      pagePurpose: "Turn qualified interest into a clear enquiry.",
      targetKeyword: `contact ${businessName.toLowerCase()}`,
      searchIntent: "Get in touch, ask for a quote, or check availability.",
      primaryCta: cta,
      trustElements: ["Response time", "Contact options", "Service area reassurance"],
      schemaRecommendation: "ContactPoint schema",
      conversionNotes: "Keep the form short, restate the offer, and include alternative contact routes.",
      priority: "primary",
    },
  ]

  return {
    strategySummary: `${businessName} should use a service-led local sitemap focused on ${primaryService.toLowerCase()}, trust proof, local relevance around ${location}, and frictionless enquiry actions rather than a generic brochure or SaaS-style structure.`,
    sitemap: dedupePages(sitemap, recommendedPages),
    conversionNotes: [
      "Repeat one primary CTA consistently across commercial pages.",
      "Place proof near claims, service explanations, and form prompts.",
      "Use service-specific pages as the main conversion routes, with Home and Service Area feeding them.",
    ],
    internalLinkingPlan: [
      "Home links to every primary service page and Contact.",
      "Each service page links to relevant proof, Service Area, and Contact.",
      "Service Area links back to the highest-value service pages.",
      "About reinforces credibility and routes visitors back to commercial pages.",
    ],
    priorityBuildOrder: ["Home", ...servicePages.map((page) => page.title), "Contact", "Service Area", "About"],
  }
}

function bulletList(values: string[]) {
  return values.length ? values.map((value) => `- ${value}`) : ["- Not specified"]
}

function splitList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "services"
}

function dedupePages(pages: ForgeSitemapPage[], recommendedTitles: string[]) {
  const seen = new Set<string>()
  const ordered = [...pages]

  for (const title of recommendedTitles) {
    if (!ordered.some((page) => page.title.toLowerCase() === title.toLowerCase())) {
      ordered.splice(Math.max(1, ordered.length - 1), 0, {
        title,
        path: `/${slugify(title)}`,
        pagePurpose: `Support the ${title.toLowerCase()} buyer journey with clear information and proof.`,
        targetKeyword: title.toLowerCase(),
        searchIntent: `Understand ${title.toLowerCase()} options before enquiry.`,
        primaryCta: "Request a quote",
        trustElements: ["Relevant proof", "Process clarity"],
        schemaRecommendation: "WebPage schema",
        conversionNotes: "Keep the page focused on one intent and link to Contact.",
        priority: "supporting",
      })
    }
  }

  return ordered.filter((page) => {
    const key = page.path
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
