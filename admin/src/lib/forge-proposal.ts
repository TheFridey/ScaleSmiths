import type { JsonValue } from "./forge-ai"
import type { ForgeIntakeData } from "./forge"
import type { ForgeResearchReport } from "./forge-research"
import type { ForgeSitemapStrategy } from "./forge-sitemap"
import type { ForgeSeoPack } from "./forge-seo"
import type { ForgeGeneratedCodeSummary } from "./forge-frontend-code"
import type { ForgeQaReport } from "./forge-qa"

export const FORGE_PROPOSAL_ARTIFACT_TITLE = "Proposal & Audit Pack"
export const FORGE_PROPOSAL_ARTIFACT_KIND = "forge_proposal_pack"

// Compliance guardrail — ScaleSmiths positions on engineering quality, never guaranteed outcomes.
export const FORGE_PROPOSAL_COMPLIANCE_NOTE =
  "ScaleSmiths builds technically excellent, well-structured websites designed to give your business the strongest possible foundation for search and conversion. We do not guarantee specific rankings, lead volumes, or revenue — those outcomes depend on market, budget, and many factors outside any agency's control. What we commit to is the quality, structure, and clarity of the build."

// Phrases we never want to appear in client-facing copy (used by the self-check + tests).
export const FORGE_PROPOSAL_BANNED_PHRASES = [
  "guaranteed rankings",
  "guaranteed leads",
  "guaranteed results",
  "guarantee you leads",
  "guarantee rankings",
  "#1 on google",
  "number one on google",
  "rank #1",
  "guaranteed first page",
  "instant results",
  "double your revenue",
] as const

export type ForgeProposalDocumentKey = "audit" | "proposal" | "retainer" | "roadmap" | "handover"

export interface ForgeProposalProject {
  name: string
  businessName: string
  industry: string | null
  websiteUrl: string | null
  targetAudience: string | null
  primaryGoal: string | null
  budgetRange: string | null
  brandNotes: string | null
}

export interface ForgeProposalIntegration {
  provider: string
  enabled: boolean
}

export interface ForgeProposalInputs {
  project: ForgeProposalProject
  intake: ForgeIntakeData | null
  intakeCompleteness: number
  research: ForgeResearchReport | null
  sitemap: ForgeSitemapStrategy | null
  seo: ForgeSeoPack | null
  generatedSite: ForgeGeneratedCodeSummary | null
  qa: ForgeQaReport | null
  integrations: ForgeProposalIntegration[]
}

export interface ForgeWebsiteAudit extends Record<string, JsonValue> {
  summary: string
  currentWebsite: string
  strengths: string[]
  gaps: string[]
  seoFindings: string[]
  performanceFindings: string[]
  opportunities: string[]
  riskOfInaction: string
}

export interface ForgeProposal extends Record<string, JsonValue> {
  businessProblem: string
  currentWebsiteGaps: string[]
  recommendedSolution: string
  pagesIncluded: string[]
  integrationsIncluded: string[]
  seoAeoGeoBenefits: string[]
  buildPricePlaceholder: string
  monthlyRetainerRecommendation: string
  nextSteps: string[]
}

export interface ForgeRetainerRecommendation extends Record<string, JsonValue> {
  recommendedTier: string
  monthlyRangePlaceholder: string
  inclusions: string[]
  rationale: string
}

export interface ForgeRoadmapPhase extends Record<string, JsonValue> {
  phase: number
  title: string
  focus: string
  outcomes: string[]
  durationEstimate: string
}

export interface ForgeImplementationRoadmap extends Record<string, JsonValue> {
  phases: ForgeRoadmapPhase[]
  assumptions: string[]
}

export interface ForgeHandoverNotes extends Record<string, JsonValue> {
  workspacePath: string | null
  deliverables: string[]
  integrationsSetup: string[]
  envVarsRequired: string[]
  outstandingItems: string[]
  maintenanceNotes: string[]
}

export interface ForgeProposalBundle extends Record<string, JsonValue> {
  kind: typeof FORGE_PROPOSAL_ARTIFACT_KIND
  businessName: string
  preparedFor: string
  preparedOn: string
  audit: ForgeWebsiteAudit
  proposal: ForgeProposal
  retainer: ForgeRetainerRecommendation
  roadmap: ForgeImplementationRoadmap
  handover: ForgeHandoverNotes
  complianceNote: string
  generatedAt: string
}

export interface ForgeProposalArtifactState {
  bundle: ForgeProposalBundle | null
  status: "generated" | "empty"
  generatedAt: string | null
}

/* ── retainer tiers ─────────────────────────────────────────────────── */

const RETAINER_TIERS = {
  essential: {
    name: "Essential Care",
    monthlyRangePlaceholder: "£[ESSENTIAL]/month (to be confirmed)",
    inclusions: [
      "Hosting, security patching, and uptime monitoring",
      "Monthly backups and dependency updates",
      "Small content and copy edits",
      "Quarterly performance and SEO health check",
    ],
  },
  growth: {
    name: "Growth",
    monthlyRangePlaceholder: "£[GROWTH]/month (to be confirmed)",
    inclusions: [
      "Everything in Essential Care",
      "Ongoing on-page SEO/AEO/GEO improvements",
      "Conversion-focused content updates and new sections",
      "Monthly reporting on traffic, rankings movement, and enquiries",
      "Priority support",
    ],
  },
  performance: {
    name: "Performance",
    monthlyRangePlaceholder: "£[PERFORMANCE]/month (to be confirmed)",
    inclusions: [
      "Everything in Growth",
      "New landing pages and service pages each month",
      "Structured content programme for answer engines",
      "Integration and automation improvements",
      "Strategic review calls and roadmap planning",
    ],
  },
} as const

/* ── document builders ──────────────────────────────────────────────── */

export function buildForgeWebsiteAudit(inputs: ForgeProposalInputs): ForgeWebsiteAudit {
  const { project, research, seo, qa, generatedSite } = inputs
  const business = project.businessName || project.name
  const hasCurrentSite = Boolean(project.websiteUrl)

  const strengths = unique([
    ...(research?.competitorPositioning?.slice(0, 2).map((item) => `Market position: ${item}`) ?? []),
    ...(seo && seo.score.overall >= 70 ? [`Generated site reaches an SEO/AEO/GEO structure score of ${seo.score.overall}/100.`] : []),
    ...(generatedSite ? ["A modern, fast, statically-generated build foundation is in place."] : []),
    ...(intakeStrengths(inputs.intake)),
  ])

  const gaps = unique([
    ...(hasCurrentSite ? [] : ["No effective current website, so the business is largely invisible to people searching online."]),
    ...(research?.trustGaps?.map((item) => `Trust gap: ${item}`) ?? []),
    ...(research?.conversionGaps?.map((item) => `Conversion gap: ${item}`) ?? []),
    ...failingSeoFindings(seo),
    ...qaFindings(qa),
  ]).slice(0, 12)

  const seoFindings = unique([
    ...(seo ? [
      `Structural SEO score ${seo.score.seo}/100, answer-engine (AEO) score ${seo.score.aeo}/100, local/geo (GEO) score ${seo.score.geo}/100.`,
      ...seo.checklist.filter((item) => item.status !== "pass").slice(0, 5).map((item) => `${item.label}: ${item.detail}`),
    ] : ["Structured SEO/AEO/GEO scoring has not been generated yet."]),
    ...(research?.localSeoOpportunities?.slice(0, 3).map((item) => `Local opportunity: ${item}`) ?? []),
  ])

  const performanceFindings = unique([
    ...(qa ? [`Latest build QA status: ${qa.status}.`] : ["Build QA has not been run yet."]),
    ...(generatedSite ? [`Generated ${generatedSite.fileCount} files across ${generatedSite.routes.length} routes with controlled, reduced-motion-safe animation.`] : []),
    "Performance, accessibility, and best-practice scores are validated objectively in the Lighthouse & Visual QA stage.",
  ])

  const opportunities = unique([
    ...(research?.aeoGeoOpportunities?.slice(0, 3) ?? []),
    ...(research?.contentOpportunities?.slice(0, 3) ?? []),
    "Capture high-intent local search with service-specific pages and structured data.",
    "Win AI answer-engine placements with self-contained, entity-rich content and FAQ schema.",
  ]).slice(0, 8)

  return {
    summary: `This audit reviews ${business}'s online presence and the opportunity to convert more of the right visitors into enquiries. ${hasCurrentSite ? "The current website" : "The absence of an effective website"} is assessed against modern search, answer-engine, and conversion standards.`,
    currentWebsite: hasCurrentSite ? `Current website under review: ${project.websiteUrl}.` : "There is no effective current website driving qualified enquiries.",
    strengths: strengths.length ? strengths : ["Clear service offering and a genuine local market to serve."],
    gaps: gaps.length ? gaps : ["Limited structured content, weak proof placement, and unclear conversion paths."],
    seoFindings,
    performanceFindings,
    opportunities,
    riskOfInaction: `Without a structured, modern website, ${business} continues to lose qualified enquiries to competitors who are easier to find and easier to trust online. The gap compounds as search and AI answer engines increasingly favour well-structured sites.`,
  }
}

export function buildForgeRetainerRecommendation(inputs: ForgeProposalInputs): ForgeRetainerRecommendation {
  const pages = countPages(inputs)
  const enabledIntegrations = inputs.integrations.filter((integration) => integration.enabled).length
  const wantsGrowth = /grow|lead|enquir|sales|revenue|expand/i.test(`${inputs.project.primaryGoal ?? ""} ${inputs.intake?.primaryWebsiteGoal ?? ""}`)

  const tier = pages >= 8 || enabledIntegrations >= 3
    ? RETAINER_TIERS.performance
    : wantsGrowth || pages >= 4
      ? RETAINER_TIERS.growth
      : RETAINER_TIERS.essential

  const rationale = tier === RETAINER_TIERS.performance
    ? `With ${pages} pages and ${enabledIntegrations} active integration(s), a Performance retainer keeps the site improving, adds content for search and answer engines, and maintains the integrations over time.`
    : tier === RETAINER_TIERS.growth
      ? `${inputs.project.businessName || inputs.project.name} is focused on growth, so a Growth retainer funds ongoing SEO/AEO/GEO work and conversion improvements rather than just maintenance.`
      : "An Essential Care retainer keeps the site secure, fast, and up to date, with light content support as the business settles in."

  return {
    recommendedTier: tier.name,
    monthlyRangePlaceholder: tier.monthlyRangePlaceholder,
    inclusions: [...tier.inclusions],
    rationale,
  }
}

export function buildForgeProposal(inputs: ForgeProposalInputs, retainer: ForgeRetainerRecommendation): ForgeProposal {
  const { project, seo } = inputs
  const business = project.businessName || project.name

  const businessProblem = buildBusinessProblem(inputs)
  const currentWebsiteGaps = buildForgeWebsiteAudit(inputs).gaps.slice(0, 6)
  const pagesIncluded = listPages(inputs)
  const integrationsIncluded = listIntegrations(inputs)

  const seoAeoGeoBenefits = unique([
    "SEO: clean technical structure, canonical URLs, sitemap.xml, robots.txt, and rich JSON-LD schema (LocalBusiness, Service, FAQ, Breadcrumb).",
    "AEO: self-contained answers, FAQ sections, and entity-rich copy designed to be quoted by AI answer engines.",
    "GEO: clear service-to-location relationships and structured local data to support local discovery.",
    ...(seo ? [`Generated site reaches a structural SEO/AEO/GEO score of ${seo.score.overall}/100 before content optimisation.`] : []),
    "These foundations give the site the best possible chance to be found — without guaranteeing specific rankings or lead volumes.",
  ])

  const recommendedSolution = `Design and build a modern, fast, conversion-focused website for ${business}${project.industry ? ` in the ${project.industry} sector` : ""}. The build is engineered for search, AI answer engines, and local discovery, with clear enquiry paths, proof placement, and the integrations the business actually needs.`

  return {
    businessProblem,
    currentWebsiteGaps,
    recommendedSolution,
    pagesIncluded,
    integrationsIncluded,
    seoAeoGeoBenefits,
    buildPricePlaceholder: resolveBuildPricePlaceholder(project.budgetRange),
    monthlyRetainerRecommendation: `${retainer.recommendedTier} — ${retainer.monthlyRangePlaceholder}. ${retainer.rationale}`,
    nextSteps: [
      "Review this proposal and confirm the pages, integrations, and priorities.",
      "Approve the build scope and confirm pricing.",
      "Provide outstanding assets (logo, photography, copy approvals) noted in the handover.",
      "ScaleSmiths schedules the build and shares a preview for your review.",
      "Launch, then move into the recommended care/retainer plan.",
    ],
  }
}

export function buildForgeImplementationRoadmap(inputs: ForgeProposalInputs): ForgeImplementationRoadmap {
  const hasBuild = Boolean(inputs.generatedSite)
  const phases: ForgeRoadmapPhase[] = [
    { phase: 1, title: "Discovery & Strategy", focus: "Confirm goals, audience, services, and the sitemap.", outcomes: ["Approved sitemap and content plan", "Agreed success measures"], durationEstimate: "Week 1" },
    { phase: 2, title: "Copy & Design", focus: "Conversion-focused copy and an on-brand design direction.", outcomes: ["Approved page copy", "Approved design direction"], durationEstimate: "Weeks 1–2" },
    { phase: 3, title: "Build & Integrations", focus: "Engineer the site, wire up forms/WhatsApp, and add SEO/AEO/GEO structure.", outcomes: ["Working preview", "Integrations configured", "Structured data in place"], durationEstimate: "Weeks 2–3" },
    { phase: 4, title: "QA & Launch", focus: "Build, typecheck, Lighthouse, and visual QA, then launch.", outcomes: ["Passing QA report", "Objective quality scores", "Live website"], durationEstimate: "Week 3" },
    { phase: 5, title: "Care & Growth", focus: "Ongoing maintenance, SEO, and conversion improvements under the retainer.", outcomes: ["Continuous improvement", "Monthly reporting"], durationEstimate: "Ongoing" },
  ]

  return {
    phases,
    assumptions: unique([
      "Timelines assume timely feedback and asset delivery from the client.",
      hasBuild ? "An initial generated build already exists, which accelerates the build phase." : "Build estimates assume a standard service-business website scope.",
      "Pricing is confirmed before the build phase begins.",
    ]),
  }
}

export function buildForgeHandoverNotes(inputs: ForgeProposalInputs): ForgeHandoverNotes {
  const { generatedSite, integrations, qa } = inputs
  const enabled = integrations.filter((integration) => integration.enabled).map((integration) => integration.provider)

  const envVars: string[] = []
  if (enabled.includes("resend")) envVars.push("RESEND_API_KEY (server-side, never committed)")
  if (enabled.includes("whatsapp")) envVars.push("Optional future WhatsApp Cloud API: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN")

  return {
    workspacePath: generatedSite?.workspacePath ?? null,
    deliverables: unique([
      ...(generatedSite ? [`Generated Next.js site (${generatedSite.fileCount} files, ${generatedSite.routes.length} routes).`] : ["Website build to be generated."]),
      "Reusable component library and typed site data.",
      "SEO pack: sitemap.xml, robots.txt, and JSON-LD schema.",
    ]),
    integrationsSetup: enabled.length
      ? enabled.map((provider) => `${provider}: confirm production credentials and verified sender/number before go-live.`)
      : ["No integrations enabled yet. Enable Resend and/or WhatsApp before launch if required."],
    envVarsRequired: envVars.length ? envVars : ["No server secrets required for the current scope."],
    outstandingItems: unique([
      ...(qa && qa.status !== "passed" ? ["Resolve outstanding QA findings before launch."] : []),
      "Confirm final domain and DNS/hosting target.",
      "Collect final approved photography and copy sign-off.",
    ]),
    maintenanceNotes: [
      "Keep dependencies patched and run QA after any change.",
      "Replace the in-memory contact rate-limit with a durable store before heavy traffic.",
      "Keep contact-form test mode on until the verified sender/domain is live.",
    ],
  }
}

export function buildForgeProposalBundle(inputs: ForgeProposalInputs, generatedAt = new Date().toISOString()): ForgeProposalBundle {
  const business = inputs.project.businessName || inputs.project.name
  const retainer = buildForgeRetainerRecommendation(inputs)

  return {
    kind: FORGE_PROPOSAL_ARTIFACT_KIND,
    businessName: business,
    preparedFor: business,
    preparedOn: formatDate(generatedAt),
    audit: buildForgeWebsiteAudit(inputs),
    proposal: buildForgeProposal(inputs, retainer),
    retainer,
    roadmap: buildForgeImplementationRoadmap(inputs),
    handover: buildForgeHandoverNotes(inputs),
    complianceNote: FORGE_PROPOSAL_COMPLIANCE_NOTE,
    generatedAt,
  }
}

/* ── markdown exporters ─────────────────────────────────────────────── */

export function buildForgeAuditMarkdown(bundle: ForgeProposalBundle): string {
  const a = bundle.audit
  return [
    `# Website Audit — ${bundle.businessName}`,
    `Prepared by ScaleSmiths · ${bundle.preparedOn}`,
    "",
    "## Overview",
    a.summary,
    "",
    a.currentWebsite,
    "",
    "## Strengths",
    ...bullets(a.strengths),
    "",
    "## Gaps & risks",
    ...bullets(a.gaps),
    "",
    "## SEO / AEO / GEO findings",
    ...bullets(a.seoFindings),
    "",
    "## Performance & quality",
    ...bullets(a.performanceFindings),
    "",
    "## Opportunities",
    ...bullets(a.opportunities),
    "",
    "## Risk of inaction",
    a.riskOfInaction,
    "",
    "---",
    bundle.complianceNote,
  ].join("\n").trim()
}

export function buildForgeProposalMarkdown(bundle: ForgeProposalBundle): string {
  const p = bundle.proposal
  return [
    `# Website Proposal — ${bundle.businessName}`,
    `Prepared by ScaleSmiths · ${bundle.preparedOn}`,
    "",
    "## The business problem",
    p.businessProblem,
    "",
    "## Current website gaps",
    ...bullets(p.currentWebsiteGaps),
    "",
    "## Recommended solution",
    p.recommendedSolution,
    "",
    "## Pages included",
    ...bullets(p.pagesIncluded),
    "",
    "## Integrations included",
    ...bullets(p.integrationsIncluded),
    "",
    "## SEO / AEO / GEO benefits",
    ...bullets(p.seoAeoGeoBenefits),
    "",
    "## Investment",
    `- Build: ${p.buildPricePlaceholder}`,
    `- Ongoing: ${p.monthlyRetainerRecommendation}`,
    "",
    "## Next steps",
    ...numbered(p.nextSteps),
    "",
    "---",
    bundle.complianceNote,
  ].join("\n").trim()
}

export function buildForgeRetainerMarkdown(bundle: ForgeProposalBundle): string {
  const r = bundle.retainer
  return [
    `# Retainer Recommendation — ${bundle.businessName}`,
    "",
    `## Recommended tier: ${r.recommendedTier}`,
    `Indicative: ${r.monthlyRangePlaceholder}`,
    "",
    r.rationale,
    "",
    "## Included each month",
    ...bullets(r.inclusions),
  ].join("\n").trim()
}

export function buildForgeRoadmapMarkdown(bundle: ForgeProposalBundle): string {
  const r = bundle.roadmap
  return [
    `# Implementation Roadmap — ${bundle.businessName}`,
    "",
    ...r.phases.flatMap((phase) => [
      `## Phase ${phase.phase}: ${phase.title} (${phase.durationEstimate})`,
      phase.focus,
      ...bullets(phase.outcomes),
      "",
    ]),
    "## Assumptions",
    ...bullets(r.assumptions),
  ].join("\n").trim()
}

export function buildForgeHandoverMarkdown(bundle: ForgeProposalBundle): string {
  const h = bundle.handover
  return [
    `# Handover Notes — ${bundle.businessName}`,
    h.workspacePath ? `Workspace: \`${h.workspacePath}\`` : "Workspace: not yet generated.",
    "",
    "## Deliverables",
    ...bullets(h.deliverables),
    "",
    "## Integrations setup",
    ...bullets(h.integrationsSetup),
    "",
    "## Environment variables required",
    ...bullets(h.envVarsRequired),
    "",
    "## Outstanding items",
    ...bullets(h.outstandingItems),
    "",
    "## Maintenance notes",
    ...bullets(h.maintenanceNotes),
  ].join("\n").trim()
}

export function buildForgeProposalPackMarkdown(bundle: ForgeProposalBundle): string {
  return [
    buildForgeProposalMarkdown(bundle),
    "",
    buildForgeAuditMarkdown(bundle),
    "",
    buildForgeRetainerMarkdown(bundle),
    "",
    buildForgeRoadmapMarkdown(bundle),
    "",
    buildForgeHandoverMarkdown(bundle),
  ].join("\n\n").trim()
}

export function forgeProposalDocuments(bundle: ForgeProposalBundle): { key: ForgeProposalDocumentKey; label: string; markdown: string }[] {
  return [
    { key: "proposal", label: "Proposal", markdown: buildForgeProposalMarkdown(bundle) },
    { key: "audit", label: "Website Audit", markdown: buildForgeAuditMarkdown(bundle) },
    { key: "retainer", label: "Retainer", markdown: buildForgeRetainerMarkdown(bundle) },
    { key: "roadmap", label: "Roadmap", markdown: buildForgeRoadmapMarkdown(bundle) },
    { key: "handover", label: "Handover", markdown: buildForgeHandoverMarkdown(bundle) },
  ]
}

/* ── overpromising self-check ───────────────────────────────────────── */

export function findForgeProposalOverpromises(bundle: ForgeProposalBundle): string[] {
  const haystack = buildForgeProposalPackMarkdown(bundle).toLowerCase()
  return FORGE_PROPOSAL_BANNED_PHRASES.filter((phrase) => haystack.includes(phrase))
}

/* ── artifact read + render ─────────────────────────────────────────── */

export function readForgeProposalArtifact(metadata: Record<string, unknown> | null | undefined): ForgeProposalArtifactState {
  if (!metadata || metadata.kind !== FORGE_PROPOSAL_ARTIFACT_KIND || typeof metadata.bundle !== "object" || metadata.bundle === null) {
    return { bundle: null, status: "empty", generatedAt: null }
  }
  const bundle = metadata.bundle as Partial<ForgeProposalBundle>
  if (bundle.kind !== FORGE_PROPOSAL_ARTIFACT_KIND || typeof bundle.proposal !== "object" || bundle.proposal === null || typeof bundle.audit !== "object" || bundle.audit === null) {
    return { bundle: null, status: "empty", generatedAt: null }
  }
  return {
    bundle: bundle as ForgeProposalBundle,
    status: "generated",
    generatedAt: typeof bundle.generatedAt === "string" ? bundle.generatedAt : null,
  }
}

export function buildForgeProposalArtifactContent(bundle: ForgeProposalBundle): string {
  return buildForgeProposalPackMarkdown(bundle)
}

/* ── internal helpers ───────────────────────────────────────────────── */

function buildBusinessProblem(inputs: ForgeProposalInputs): string {
  const business = inputs.project.businessName || inputs.project.name
  const audience = inputs.project.targetAudience || inputs.intake?.idealCustomers || "the right local customers"
  const problem = inputs.intake?.customerProblems?.trim() || inputs.research?.conversionGaps?.[0] || "potential customers struggle to find, understand, and trust the business online"
  const goal = inputs.project.primaryGoal || inputs.intake?.primaryWebsiteGoal || "win more qualified enquiries"
  return `${business} needs to reach ${audience} and turn interest into enquiries, but ${lowerFirst(problem)}. The objective is to ${lowerFirst(goal)} with a website that is easy to find, clear to read, and built to convert.`
}

function listPages(inputs: ForgeProposalInputs): string[] {
  const fromSite = inputs.generatedSite?.routes ?? []
  const fromSitemap = inputs.sitemap?.sitemap.map((page) => `${page.title} (${page.path})`) ?? []
  const fromResearch = inputs.research?.recommendedPages.map((page) => page.title) ?? []
  const pages = fromSitemap.length ? fromSitemap : fromSite.length ? fromSite : fromResearch
  return unique(pages.length ? pages : ["Home", "Services", "About", "Contact"]).slice(0, 16)
}

function countPages(inputs: ForgeProposalInputs): number {
  return inputs.generatedSite?.routes.length ?? inputs.sitemap?.sitemap.length ?? inputs.research?.recommendedPages.length ?? 4
}

function listIntegrations(inputs: ForgeProposalInputs): string[] {
  const labels: Record<string, string> = {
    resend: "Contact form with email delivery (Resend)",
    whatsapp: "WhatsApp click-to-chat (wa.me)",
    analytics: "Privacy-conscious analytics",
    calendly: "Booking/scheduling",
    stripe: "Payments",
    cloudinary: "Media/asset delivery",
  }
  const enabled = inputs.integrations.filter((integration) => integration.enabled).map((integration) => labels[integration.provider] ?? integration.provider)
  const fromIntake = inputs.intake?.requiredIntegrations ? splitList(inputs.intake.requiredIntegrations) : []
  return unique(enabled.length ? enabled : fromIntake.length ? fromIntake : ["Contact form with email delivery"]).slice(0, 10)
}

function resolveBuildPricePlaceholder(budgetRange: string | null): string {
  if (budgetRange && budgetRange.trim()) return `£[BUILD] (to be confirmed; indicated budget: ${budgetRange.trim()})`
  return "£[BUILD] (to be confirmed)"
}

function intakeStrengths(intake: ForgeIntakeData | null): string[] {
  if (!intake) return []
  const strengths: string[] = []
  if (intake.testimonials?.trim()) strengths.push("Existing reviews and testimonials to build trust from.")
  if (intake.certifications?.trim()) strengths.push("Accreditations and certifications that strengthen credibility.")
  if (intake.caseStudies?.trim()) strengths.push("Real results and case studies that can anchor the proof story.")
  return strengths
}

function failingSeoFindings(seo: ForgeSeoPack | null): string[] {
  if (!seo) return []
  return seo.checklist.filter((item) => item.status === "fail").map((item) => `SEO gap: ${item.label}.`)
}

function qaFindings(qa: ForgeQaReport | null): string[] {
  if (!qa || qa.status === "passed") return []
  return [qa.failureSummary ? `Build issue: ${qa.failureSummary}` : "Build QA has not yet passed."]
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function bullets(values: string[]): string[] {
  return values.length ? values.map((value) => `- ${value}`) : ["- Not specified."]
}

function numbered(values: string[]): string[] {
  return values.length ? values.map((value, index) => `${index + 1}. ${value}`) : ["1. Not specified."]
}

function splitList(value: string): string[] {
  return value.split(/\r?\n|,|;/).map((item) => item.trim()).filter(Boolean)
}

function lowerFirst(value: string): string {
  const trimmed = value.trim()
  return trimmed ? trimmed.charAt(0).toLowerCase() + trimmed.slice(1) : trimmed
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
}
