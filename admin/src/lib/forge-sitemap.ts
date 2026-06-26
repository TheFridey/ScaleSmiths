import type { ForgeJsonSchema, JsonValue } from "./forge-ai"
import type { ForgeIntakeData } from "./forge"
import type { ForgeResearchReport } from "./forge-research"
import { formatForgeStrategyPackForPrompt, selectForgeStrategyPack, type ForgeStrategyPackId } from "./forge-strategy-packs"
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
  selectedStrategyPack: ForgeStrategyPackId
  strategyPackRationale: string
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
  required: ["strategySummary", "selectedStrategyPack", "strategyPackRationale", "sitemap", "conversionNotes", "internalLinkingPlan", "priorityBuildOrder"],
  properties: {
    strategySummary: { type: "string", description: "Short website strategy summary for the selected industry/site-type." },
    selectedStrategyPack: { type: "string", enum: ["local_service_business", "ecommerce_store", "saas_startup", "charity_nonprofit", "restaurant_food", "trades_business", "gaming_community_server", "creator_personal_brand", "event_venue", "professional_services"] },
    strategyPackRationale: { type: "string" },
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
  const normalized = normalizeLegacyStrategyPack(input)
  const errors = validateJsonSchemaValue(FORGE_SITEMAP_STRATEGY_SCHEMA, normalized)
  if (errors.length) return { ok: false, error: errors.join(" ") }
  return { ok: true, data: normalized as ForgeSitemapStrategy }
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

  const parsedStrategy = parseForgeSitemapStrategyPayload(metadata.strategy)
  const parsedApprovedStrategy = parseForgeSitemapStrategyPayload(metadata.approvedStrategy)
  const strategy = parsedStrategy.ok ? parsedStrategy.data : null
  const approvedStrategy = parsedApprovedStrategy.ok ? parsedApprovedStrategy.data : null

  return {
    strategy,
    approvedStrategy,
    status: metadata.status === "approved" && approvedStrategy ? "approved" : strategy ? "draft" : "empty",
    approvedAt: typeof metadata.approvedAt === "string" ? metadata.approvedAt : null,
    approvedBy: typeof metadata.approvedBy === "string" ? metadata.approvedBy : null,
  }
}

function normalizeLegacyStrategyPack(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input
  const record = input as Record<string, unknown>
  return {
    selectedStrategyPack: "local_service_business",
    strategyPackRationale: "Legacy sitemap created before strategy packs; defaulted to Local service business.",
    ...record,
  }
}

export function buildForgeSitemapPrompt({
  project,
  intake,
  intakeSummary,
  researchReport,
}: {
  project: ForgeSitemapProjectContext
  intake: ForgeIntakeData
  intakeSummary: string
  researchReport: ForgeResearchReport | null
}) {
  const selectedPack = selectForgeStrategyPack(project, intake)
  const lines = [
    "Generate a website strategy and sitemap for the selected industry/site-type strategy pack.",
    "Do not force local-service, generic agency, or SaaS structure unless the selected pack supports it.",
    "The response must include selectedStrategyPack and strategyPackRationale explaining why the pack was selected.",
    "Use the selected pack's homepage sections, CTAs, schema direction, tone, trust signals, conversion goals, common page types, and forbidden generic sections.",
    "Every page should include page purpose, target keyword/search intent, CTA, trust elements, schema recommendation, and conversion notes.",
    "",
    "Selected strategy pack:",
    formatForgeStrategyPackForPrompt(selectedPack),
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
    "## Selected strategy pack",
    `- Pack: ${strategy.selectedStrategyPack}`,
    `- Rationale: ${strategy.strategyPackRationale}`,
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
  const selection = selectForgeStrategyPack(project, intake)
  if (selection.pack.id === "gaming_community_server") return createGamingSitemapStrategy(project, intake, selection)

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
    strategySummary: `${businessName} should use a ${selection.pack.label.toLowerCase()} sitemap focused on ${primaryService.toLowerCase()}, trust proof, relevant conversion actions, and page types that match the selected site type rather than a generic agency-style structure.`,
    selectedStrategyPack: selection.pack.id,
    strategyPackRationale: selection.reason,
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

function createGamingSitemapStrategy(
  project: ForgeSitemapProjectContext,
  intake: ForgeIntakeData,
  selection: ReturnType<typeof selectForgeStrategyPack>,
): ForgeSitemapStrategy {
  const businessName = project.businessName || project.name
  const ctas = splitList(intake.conversionActions || selection.pack.correctCtas.join("\n"))
  const primaryCta = ctas.find((cta) => /server|ip|join/i.test(cta)) ?? "Copy server IP"
  const proof = splitList(intake.testimonials || selection.pack.trustSignals.join("\n"))
  const features = splitList(intake.coreServices || "Survival gameplay\nCommunity events\nPremium ranks\nDiscord community")
  const page = (
    title: string,
    path: string,
    purpose: string,
    cta: string,
    trustElements: string[],
    schemaRecommendation = "WebPage schema",
    priority: ForgeSitemapPriority = "primary",
  ): ForgeSitemapPage => ({
    title,
    path,
    pagePurpose: purpose,
    targetKeyword: `${businessName} ${title}`.toLowerCase(),
    searchIntent: `Understand ${title.toLowerCase()} for ${businessName} and take the next community action.`,
    primaryCta: cta,
    trustElements,
    schemaRecommendation,
    conversionNotes: "Keep server actions visible, use live/stat placeholders only when data is connected, and avoid local-service enquiry framing.",
    priority,
  })

  const sitemap: ForgeSitemapPage[] = [
    page(
      "Home",
      "/",
      `Position ${businessName} as a premium gaming community, show the server IP/status, route players to game modes, Discord, store, and support.`,
      primaryCta,
      ["Server IP CTA", "Discord CTA", "Live status/stat placeholders", ...proof.slice(0, 2)],
      "WebSite schema plus Organization schema; no LocalBusiness unless a real local venue/location is supplied",
    ),
    page(
      "Play / Join",
      "/play",
      "Help new players copy the server IP, understand versions/platforms, register or log in, and join Discord.",
      "Copy server IP",
      ["Server IP", "Version/platform notes", "Login/register CTA"],
      "HowTo or FAQPage schema where setup steps are provided",
    ),
    page(
      "Game Modes",
      "/game-modes",
      "Explain the server's main game modes, features, ranks, seasons, and reasons to keep playing.",
      "View game modes",
      features.slice(0, 4),
      "ItemList schema for mode/features where appropriate",
    ),
    page(
      "Store",
      "/store",
      "Route players to ranks, cosmetics, bundles, or supporter products without inventing prices or perks.",
      "Visit store",
      ["Store security notes", "No invented pricing", "Supporter benefits if supplied"],
      "Product/Offer schema only for real supplied store items",
    ),
    page(
      "Vote",
      "/vote",
      "Send players to voting links and explain rewards only if supplied.",
      "Vote for server",
      ["Voting links", "Reward notes if supplied"],
      "WebPage schema",
      "secondary",
    ),
    page(
      "News / Events",
      "/news",
      "Show community updates, seasonal events, announcements, changelogs, and event recaps.",
      "Join Discord",
      ["Community/news/events sections", "Event placeholders", "Discord announcements"],
      "Event schema for dated events; Article schema for news posts",
      "secondary",
    ),
    page(
      "Rules & Support",
      "/support",
      "Make rules, moderation, ban appeals, contact routes, and player support clear.",
      "Get support",
      ["Rules clarity", "Support routes", "Staff/moderation notes"],
      "FAQPage schema",
      "secondary",
    ),
    page(
      "Community",
      "/community",
      "Promote Discord, social links, screenshots, creators, staff, and player community proof.",
      "Join Discord",
      ["Discord CTA", "Community screenshots", "Creator/social links"],
      "Organization/SocialProfile links where supplied",
      "secondary",
    ),
  ]

  return {
    strategySummary: `${businessName} should use a gaming/community/server strategy: server IP and Discord actions first, store/vote/login routes close behind, live status/stat placeholders where data is connected, and community/rules/game-mode content instead of local-service pages or request-a-quote framing.`,
    selectedStrategyPack: selection.pack.id,
    strategyPackRationale: selection.reason,
    sitemap,
    conversionNotes: [
      "Make server IP, Discord, login/register, store, and vote CTAs persistent and easy to scan.",
      "Use live status/stat cards as placeholders unless a real API/source is connected; never invent player counts.",
      "Do not use LocalBusiness schema unless the brief supplies a genuine local venue/location requirement.",
      "Replace service-area and quote flows with player onboarding, game mode discovery, support, and community retention.",
    ],
    internalLinkingPlan: [
      "Home links immediately to Play / Join, Discord/community, Game Modes, Store, Vote, and Support.",
      "Game Modes links to Play / Join and Store where ranks/perks are relevant.",
      "News / Events and Community route players back to Discord and Play / Join.",
      "Rules & Support is linked from footer, Play / Join, and account/support CTAs.",
    ],
    priorityBuildOrder: ["Home", "Play / Join", "Game Modes", "Rules & Support", "Store", "Vote", "News / Events", "Community"],
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
