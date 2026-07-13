import type { ForgeSitemapArtifactState } from "./forge-sitemap"
import type { ForgeCopyArtifactState } from "./forge-copy"
import type { ForgeComponentSpecArtifactState } from "./forge-component-spec"
import type { ForgeGeneratedCodeArtifactState } from "./forge-frontend-code"
import type { ForgeQaArtifactState } from "./forge-qa"
import type { ForgeVisualQaArtifactState } from "./forge-visual-qa"

export type ProjectEstimateComplexity = "low" | "medium" | "high" | "enterprise"
export type ProjectEstimateConfidence = "low" | "medium" | "high"
export type ProjectEstimateInputStatus = "known" | "assumed"

export interface ProjectEstimateInput {
  key: string
  label: string
  value: string | number | boolean
  status: ProjectEstimateInputStatus
  evidence: string
}

export interface ProjectEstimateRisk {
  category: string
  severity: "low" | "medium" | "high"
  impactHours: number
  explanation: string
}

export interface ProjectEstimateResult {
  modelVersion: string
  estimatedHours: number
  confidenceRange: { low: number; high: number }
  confidence: ProjectEstimateConfidence
  complexityRating: ProjectEstimateComplexity
  riskFactors: ProjectEstimateRisk[]
  suggestedBuildPrice: number
  suggestedRetainer: number
  minimumViableScope: string[]
  optionalEnhancements: string[]
  estimatedDeliveryRange: { minWeeks: number; maxWeeks: number }
  marginEstimate: { revenue: number; labourCost: number; grossMargin: number; grossMarginPercent: number; assumedHourlyCost: number }
  knownInputs: ProjectEstimateInput[]
  assumptions: ProjectEstimateInput[]
  underpricingRisks: string[]
  disclaimer: string
}

export interface ProjectEstimateContext {
  project: {
    name: string
    businessName: string
    industry: string | null
    websiteUrl: string | null
    status: string
    priority: string
    brandNotes: string | null
    targetAudience: string | null
    primaryGoal: string | null
    budgetRange: string | null
    deadline: Date | string | null
  }
  sitemap: ForgeSitemapArtifactState
  copy: ForgeCopyArtifactState
  componentSpec: ForgeComponentSpecArtifactState
  generatedCode: ForgeGeneratedCodeArtifactState
  qa: ForgeQaArtifactState
  visualQa: ForgeVisualQaArtifactState
  integrations: Array<{ provider: string; enabled: boolean }>
  approvedArtifactCount: number
  degradedOrFallbackCount: number
  taskCount: number
}

const MODEL_VERSION = "deterministic-project-estimator-v1"
const BILLABLE_RATE = 85
const INTERNAL_HOURLY_COST = 38
const TARGET_MARGIN = 0.55

export function estimateProjectEffort(context: ProjectEstimateContext): ProjectEstimateResult {
  const knownInputs: ProjectEstimateInput[] = []
  const assumptions: ProjectEstimateInput[] = []
  const risks: ProjectEstimateRisk[] = []
  const pageCount = inferPageCount(context)
  const enabledIntegrations = context.integrations.filter((integration) => integration.enabled)
  const hasEcommerce = detect(/e-?commerce|shop|checkout|stripe|payment|cart/i, context)
  const hasAuth = detect(/auth|login|account|portal|dashboard/i, context)
  const hasAdmin = detect(/admin|cms|dashboard|manage|back office/i, context)
  const hasMigration = detect(/migration|existing site|redirect|old url|crawl/i, context)
  const hasPhotography = detect(/photography|photo shoot|images required|asset/i, context)
  const hasAnimation = detect(/animation|motion|interactive/i, context)
  const hasThreeD = detect(/\b3d\b|three\.js|webgl|r3f|react three fiber/i, context)
  const hasSeo = Boolean(context.project.primaryGoal?.match(/seo|search|rank|local/i) || context.sitemap.strategy || context.copy.approvedCopy)
  const accessibilityKnown = /access|contrast|keyboard|aria|alt/i.test(JSON.stringify(context.visualQa.report ?? {}))
  const clientReadinessScore = clamp(context.sitemap.status === "approved" ? 85 : context.copy.status === "approved" ? 75 : context.taskCount > 0 ? 55 : 35, 0, 100)

  addInput(knownInputs, "pageCount", "Page count", pageCount, context.sitemap.strategy ? "known" : "assumed", context.sitemap.strategy ? "Approved sitemap is available." : "Assumed from missing sitemap.")
  addInput(knownInputs, "integrations", "Enabled integrations", enabledIntegrations.length, "known", "Read from Forge integration configuration.")
  addDetected(knownInputs, assumptions, "ecommerce", "E-commerce", hasEcommerce, context)
  addDetected(knownInputs, assumptions, "authentication", "Authentication", hasAuth, context)
  addDetected(knownInputs, assumptions, "adminFunctionality", "Admin functionality", hasAdmin, context)
  addDetected(knownInputs, assumptions, "contentMigration", "Content migration", hasMigration, context)
  addDetected(knownInputs, assumptions, "photography", "Photography/assets", hasPhotography, context)
  addDetected(knownInputs, assumptions, "customAnimation", "Custom animation", hasAnimation, context)
  addDetected(knownInputs, assumptions, "threeD", "3D/WebGL", hasThreeD, context)
  addInput(knownInputs, "seo", "SEO scope", hasSeo, hasSeo ? "known" : "assumed", hasSeo ? "SEO/sitemap/copy evidence exists." : "Basic SEO assumed for every build.")
  addInput(knownInputs, "clientReadiness", "Client readiness", clientReadinessScore, "known", "Estimated from approved sitemap/copy and task progress.")
  addInput(knownInputs, "approvedArtifactCount", "Approved artifacts", context.approvedArtifactCount, "known", "Current approved artifact count.")
  addInput(knownInputs, "degradedOrFallbackCount", "Fallback/degraded dependencies", context.degradedOrFallbackCount, "known", "Current degraded or fallback task/artifact count.")

  let hours = 18 + pageCount * 4
  hours += enabledIntegrations.length * 3
  if (hasEcommerce) hours += 22
  if (hasAuth) hours += 16
  if (hasAdmin) hours += 18
  if (hasMigration) hours += 10 + pageCount * 1.5
  if (hasPhotography) hours += 6
  if (hasAnimation) hours += 8
  if (hasThreeD) hours += 18
  if (hasSeo) hours += Math.max(6, pageCount * 1.25)
  hours += 6 // accessibility baseline
  if (clientReadinessScore < 50) risk(risks, "client_readiness", "high", 10, "Client approvals or source material are incomplete, increasing clarification and rework risk.")
  if (context.degradedOrFallbackCount > 0) risk(risks, "approval_complexity", "high", context.degradedOrFallbackCount * 3, "Approved output depends on fallback/degraded work and needs explicit review before quoting tightly.")
  if (accessibilityKnown) risk(risks, "accessibility", "medium", 4, "Visual QA/accessibility findings may require additional correction passes.")
  if (hasEcommerce || hasAuth || hasAdmin) risk(risks, "technical_scope", "high", 12, "Transactional/authenticated/admin features carry higher test, security and acceptance overhead.")
  if (pageCount > 10) risk(risks, "content_volume", "medium", Math.round(pageCount * 0.75), "Large page count increases copy review, QA and migration overhead.")
  if (hasThreeD) risk(risks, "interactive_3d", "high", 10, "3D/WebGL work has higher browser, performance and device-compatibility risk.")

  hours += risks.reduce((sum, item) => sum + item.impactHours, 0)
  const estimatedHours = Math.round(hours)
  const assumptionPenalty = assumptions.length
  const confidence: ProjectEstimateConfidence = assumptionPenalty <= 2 && risks.filter((item) => item.severity === "high").length === 0 ? "high" : assumptionPenalty <= 5 ? "medium" : "low"
  const spread = confidence === "high" ? 0.15 : confidence === "medium" ? 0.25 : 0.38
  const complexityRating = estimatedHours >= 120 ? "enterprise" : estimatedHours >= 76 ? "high" : estimatedHours >= 42 ? "medium" : "low"
  const buildPriceFloor = Math.ceil((estimatedHours * BILLABLE_RATE) / 250) * 250
  const marginPrice = Math.ceil(((estimatedHours * INTERNAL_HOURLY_COST) / (1 - TARGET_MARGIN)) / 250) * 250
  const suggestedBuildPrice = Math.max(buildPriceFloor, marginPrice)
  const suggestedRetainer = suggestRetainer({ pageCount, enabledIntegrations: enabledIntegrations.length, hasEcommerce, hasAuth, hasAdmin, hasSeo })
  const labourCost = estimatedHours * INTERNAL_HOURLY_COST
  const grossMargin = suggestedBuildPrice - labourCost

  return {
    modelVersion: MODEL_VERSION,
    estimatedHours,
    confidenceRange: { low: Math.max(1, Math.round(estimatedHours * (1 - spread))), high: Math.round(estimatedHours * (1 + spread)) },
    confidence,
    complexityRating,
    riskFactors: risks,
    suggestedBuildPrice,
    suggestedRetainer,
    minimumViableScope: minimumScope({ pageCount, hasSeo, enabledIntegrations: enabledIntegrations.length }),
    optionalEnhancements: optionalEnhancements({ hasEcommerce, hasAuth, hasAdmin, hasPhotography, hasAnimation, hasThreeD, hasMigration }),
    estimatedDeliveryRange: { minWeeks: Math.max(1, Math.ceil(estimatedHours / 32)), maxWeeks: Math.max(2, Math.ceil(estimatedHours / 22)) },
    marginEstimate: { revenue: suggestedBuildPrice, labourCost, grossMargin, grossMarginPercent: Math.round((grossMargin / suggestedBuildPrice) * 100), assumedHourlyCost: INTERNAL_HOURLY_COST },
    knownInputs: knownInputs.filter((input) => input.status === "known"),
    assumptions,
    underpricingRisks: underpricingRisks({ estimatedHours, suggestedBuildPrice, risks, confidence }),
    disclaimer: "Internal estimate only. It is not a delivery guarantee, fixed quote, or client-facing promise until scope, assumptions, exclusions, and approval responsibilities are confirmed.",
  }
}

function inferPageCount(context: ProjectEstimateContext) {
  const sitemapPages = context.sitemap.strategy?.sitemap?.length ?? 0
  const copyPages = context.copy.approvedCopy?.pages?.length ?? 0
  const specPages = context.componentSpec.approvedSpec?.pages?.length ?? 0
  const routePages = context.generatedCode.summary?.routes?.length ?? 0
  return Math.max(sitemapPages, copyPages, specPages, routePages, 1)
}

function detect(pattern: RegExp, context: ProjectEstimateContext) {
  return pattern.test(JSON.stringify({
    project: context.project,
    sitemap: context.sitemap.strategy,
    copy: context.copy.approvedCopy,
    spec: context.componentSpec.approvedSpec,
    integrations: context.integrations,
  }))
}

function addDetected(known: ProjectEstimateInput[], assumptions: ProjectEstimateInput[], key: string, label: string, value: boolean, context: ProjectEstimateContext) {
  const status: ProjectEstimateInputStatus = value ? "known" : "assumed"
  addInput(value ? known : assumptions, key, label, value, status, value ? "Detected in approved project data or integration config." : "Not detected; assumed out of scope unless manually added.")
  if (!value && /ecommerce|authentication|adminFunctionality|contentMigration|photography|customAnimation|threeD/.test(key) && context.project.budgetRange) return
}

function addInput(target: ProjectEstimateInput[], key: string, label: string, value: string | number | boolean, status: ProjectEstimateInputStatus, evidence: string) {
  target.push({ key, label, value, status, evidence })
}

function risk(target: ProjectEstimateRisk[], category: string, severity: ProjectEstimateRisk["severity"], impactHours: number, explanation: string) {
  target.push({ category, severity, impactHours, explanation })
}

function suggestRetainer(input: { pageCount: number; enabledIntegrations: number; hasEcommerce: boolean; hasAuth: boolean; hasAdmin: boolean; hasSeo: boolean }) {
  let retainer = 250
  if (input.pageCount >= 6) retainer += 150
  if (input.enabledIntegrations > 0) retainer += input.enabledIntegrations * 75
  if (input.hasSeo) retainer += 250
  if (input.hasEcommerce || input.hasAuth || input.hasAdmin) retainer += 250
  return Math.ceil(retainer / 50) * 50
}

function minimumScope(input: { pageCount: number; hasSeo: boolean; enabledIntegrations: number }) {
  return [
    "Approved sitemap and core conversion journey.",
    `Build ${Math.min(input.pageCount, 5)} core page(s) first: home, services, about/proof, contact and priority service page where relevant.`,
    input.hasSeo ? "Technical SEO foundations and structured data for approved pages." : "Basic metadata, sitemap and robots.txt.",
    input.enabledIntegrations > 0 ? "Only approved production integrations included in phase one." : "Lead form and manual enquiry workflow before deeper integrations.",
    "Accessibility and responsive QA before launch.",
  ]
}

function optionalEnhancements(input: { hasEcommerce: boolean; hasAuth: boolean; hasAdmin: boolean; hasPhotography: boolean; hasAnimation: boolean; hasThreeD: boolean; hasMigration: boolean }) {
  return [
    !input.hasPhotography ? "Professional photography or image sourcing pass." : null,
    !input.hasAnimation ? "Custom motion polish after content approval." : null,
    !input.hasThreeD ? "Interactive 3D or immersive experience where it supports conversion." : null,
    !input.hasEcommerce ? "E-commerce, payments or booking flow." : null,
    !input.hasAuth ? "Client/member login or portal functionality." : null,
    !input.hasAdmin ? "Admin/CMS tools for self-service content management." : null,
    !input.hasMigration ? "Full crawl-backed migration and redirect plan." : null,
    "Ongoing SEO content programme and conversion experiments.",
  ].filter((item): item is string => Boolean(item))
}

function underpricingRisks(input: { estimatedHours: number; suggestedBuildPrice: number; risks: ProjectEstimateRisk[]; confidence: ProjectEstimateConfidence }) {
  const warnings = [
    `At ${input.estimatedHours} estimated hours, every GBP 500 discount removes roughly ${Math.round(500 / BILLABLE_RATE)} billable hour(s) of delivery capacity.`,
    "Do not absorb unapproved pages, integrations, migration work or client delays inside the base build price.",
  ]
  if (input.confidence === "low") warnings.push("Low confidence means assumptions are carrying the quote; price a discovery phase or hold the quote until scope is confirmed.")
  if (input.risks.some((risk) => risk.severity === "high")) warnings.push("High-risk factors should be either priced, excluded, or moved into optional phases.")
  if (input.suggestedBuildPrice < input.estimatedHours * BILLABLE_RATE) warnings.push("Suggested price is below the nominal billable-rate floor.")
  return warnings
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}
