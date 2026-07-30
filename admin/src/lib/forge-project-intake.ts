import { createHash } from "node:crypto"
import { emptyForgeIntakeData, getForgeIntakeMissingFields, type ForgeIntakeData, type ForgePriority } from "./forge"
import { createForgeBuildBriefFromPrompt, finalizeForgeBuildBriefIntake, type ForgeBuildBriefState } from "./forge-intake-brief"
import { selectForgeStrategyPack } from "./forge-strategy-packs"
import type { ForgeUrlAutofillResult } from "./server/forge-url-autofill"

export interface ForgeIntakeAsset {
  name: string
  type: string
  size: number
  dataUrl?: string
}

export interface ForgeProjectIntakeInput {
  websiteUrl?: string
  request?: string
  existingContent?: string
  deadline?: string
  budgetRange?: string
  priority?: ForgePriority
  assets?: ForgeIntakeAsset[]
  advanced?: Partial<{
    name: string
    businessName: string
    industry: string
    targetAudience: string
    primaryGoal: string
    brandNotes: string
  }>
}

export interface ForgeIntakeInterpretation {
  project: {
    name: string
    businessName: string
    industry: string
    websiteUrl: string
    targetAudience: string
    primaryGoal: string
    budgetRange: string
    deadline: string
    brandNotes: string
    priority: ForgePriority
  }
  intake: ForgeIntakeData
  buildBrief: ForgeBuildBriefState
  summary: {
    business: string
    projectType: "new_build" | "redesign" | "migration"
    primaryOutcome: string
    targetAudience: string
    proposedPages: string
    requiredFunctionality: string
    designDirection: string
    integrations: string
    contentAssumptions: string
    exclusions: string
    openQuestions: string
  }
  confidenceNotes: string[]
  confirmedFields: string[]
  assumedFields: string[]
  missingCritical: Array<{ key: string; label: string }>
  strategyPack: { id: string; label: string; reason: string }
  assets: ForgeIntakeAsset[]
}

export function interpretForgeProjectIntake(input: ForgeProjectIntakeInput, autofill?: ForgeUrlAutofillResult | null): ForgeIntakeInterpretation {
  const request = clean(input.request, 5000)
  const existingContent = clean(input.existingContent, 20_000)
  const advanced = input.advanced ?? {}
  const websiteUrl = clean(input.websiteUrl, 500)
  const urlProject = autofill?.project
  const businessName = clean(advanced.businessName, 160) || urlProject?.businessName || inferBusinessName(request) || "New client"
  const industry = clean(advanced.industry, 120) || urlProject?.industry || inferIndustry(request)
  const targetAudience = clean(advanced.targetAudience, 1000) || urlProject?.targetAudience || inferAudience(request, industry)
  const primaryGoal = clean(advanced.primaryGoal, 1000) || urlProject?.primaryGoal || inferGoal(request)
  const projectName = clean(advanced.name, 160) || urlProject?.name || `${businessName} website`
  const seedProject = { businessName, industry: industry || null, targetAudience: targetAudience || null, primaryGoal: primaryGoal || null, websiteUrl: websiteUrl || null }
  const generated = createForgeBuildBriefFromPrompt({ prompt: [request, existingContent].filter(Boolean).join("\n\n"), project: seedProject })
  const intake = mergeIntake(generated.intake, autofill?.intake)

  intake.businessOverview = intake.businessOverview || request || `${businessName} needs a website.`
  intake.idealCustomers = targetAudience || intake.idealCustomers
  intake.primaryWebsiteGoal = primaryGoal || intake.primaryWebsiteGoal
  if (existingContent) intake.assetAccessNotes = [intake.assetAccessNotes, `Existing documents/content supplied:\n${existingContent}`].filter(Boolean).join("\n\n")
  const assets = normalizeAssets(input.assets)
  if (assets.length) {
    intake.existingAssets = [intake.existingAssets, `Uploaded assets: ${assets.map((asset) => asset.name).join(", ")}`].filter(Boolean).join("\n")
  }

  const finalIntake = finalizeForgeBuildBriefIntake(intake)
  const projectType = inferProjectType(request, websiteUrl)
  const strategy = selectForgeStrategyPack({
    name: projectName,
    businessName,
    industry: industry || null,
    websiteUrl: websiteUrl || null,
    targetAudience: targetAudience || null,
    primaryGoal: primaryGoal || null,
    brandNotes: clean(advanced.brandNotes, 4000) || urlProject?.brandNotes || null,
  }, finalIntake)
  const missing = criticalMissing(finalIntake, businessName, request, websiteUrl)
  const confirmedFields = [
    request ? "build request" : "",
    websiteUrl ? "website URL" : "",
    input.deadline ? "deadline" : "",
    input.budgetRange ? "budget" : "",
    existingContent ? "existing content" : "",
    assets.length ? "uploaded assets" : "",
    ...Object.entries(advanced).filter(([, value]) => Boolean(value?.trim())).map(([key]) => key),
  ].filter(Boolean)
  const assumedFields = [
    !advanced.businessName && !urlProject?.businessName ? "business name" : "",
    !advanced.industry && !urlProject?.industry ? "industry" : "",
    !advanced.targetAudience && !urlProject?.targetAudience ? "target audience" : "",
    !advanced.primaryGoal && !urlProject?.primaryGoal ? "primary outcome" : "",
    "proposed pages",
    "design direction",
    "content assumptions",
  ].filter(Boolean)

  return {
    project: {
      name: projectName,
      businessName,
      industry,
      websiteUrl,
      targetAudience,
      primaryGoal,
      budgetRange: clean(input.budgetRange, 120),
      deadline: clean(input.deadline, 40),
      brandNotes: clean(advanced.brandNotes, 4000) || urlProject?.brandNotes || "",
      priority: input.priority === "high" || input.priority === "low" ? input.priority : "medium",
    },
    intake: finalIntake,
    buildBrief: { ...generated.state, currentQuestionId: null },
    summary: {
      business: finalIntake.businessOverview,
      projectType,
      primaryOutcome: finalIntake.primaryWebsiteGoal,
      targetAudience: finalIntake.idealCustomers,
      proposedPages: finalIntake.requiredPages,
      requiredFunctionality: inferFunctionality(request, finalIntake),
      designDirection: `${finalIntake.visualStyle}\n${finalIntake.brandTone}`,
      integrations: finalIntake.requiredIntegrations,
      contentAssumptions: buildContentAssumptions(websiteUrl, existingContent, assets),
      exclusions: "Credentials, paid services, unsupported claims, and deployment are excluded until explicitly supplied or approved.",
      openQuestions: missing.length ? missing.map((item) => item.label).join("\n") : "No critical questions. Forge can use sensible defaults for remaining details.",
    },
    confidenceNotes: autofill?.confidenceNotes ?? (websiteUrl ? [] : ["Interpretation is based on the operator request and sensible defaults; no website was required."]),
    confirmedFields,
    assumedFields,
    missingCritical: missing,
    strategyPack: { id: strategy.pack.id, label: strategy.pack.label, reason: strategy.reason },
    assets,
  }
}

export function applyForgeInterpretationSummary(interpretation: ForgeIntakeInterpretation, summary: ForgeIntakeInterpretation["summary"]) {
  const intake = { ...interpretation.intake }
  intake.businessOverview = summary.business
  intake.primaryWebsiteGoal = summary.primaryOutcome
  intake.idealCustomers = summary.targetAudience
  intake.requiredPages = summary.proposedPages
  intake.requiredIntegrations = summary.integrations
  const [visualStyle, ...tone] = summary.designDirection.split("\n")
  intake.visualStyle = visualStyle?.trim() || intake.visualStyle
  intake.brandTone = tone.join("\n").trim() || intake.brandTone
  intake.assetAccessNotes = [intake.assetAccessNotes, summary.contentAssumptions].filter(Boolean).join("\n")
  return { ...interpretation, intake, summary, missingCritical: criticalMissing(intake, interpretation.project.businessName, interpretation.buildBrief.starterPrompt, interpretation.project.websiteUrl) }
}

export function forgeIntakeSubmissionKey(interpretation: ForgeIntakeInterpretation, actor: string) {
  return createHash("sha256").update(JSON.stringify({
    actor: actor.toLowerCase(),
    websiteUrl: interpretation.project.websiteUrl.toLowerCase(),
    request: interpretation.buildBrief.starterPrompt,
    businessName: interpretation.project.businessName.toLowerCase(),
  })).digest("hex")
}

function mergeIntake(base: ForgeIntakeData, supplied?: ForgeIntakeData) {
  if (!supplied) return { ...base }
  return Object.fromEntries(Object.keys(emptyForgeIntakeData()).map((key) => {
    const typedKey = key as keyof ForgeIntakeData
    return [typedKey, supplied[typedKey]?.trim() || base[typedKey]]
  })) as ForgeIntakeData
}

function criticalMissing(intake: ForgeIntakeData, businessName: string, request: string, websiteUrl: string) {
  const missing = getForgeIntakeMissingFields(intake)
  const criticalKeys = new Set(["businessOverview", "idealCustomers", "primaryWebsiteGoal", "conversionActions"])
  const result: Array<{ key: string; label: string }> = missing.filter((item) => criticalKeys.has(item.key)).map(({ key, label }) => ({ key, label }))
  if (!businessName || businessName === "New client") result.unshift({ key: "businessName", label: "Business name" })
  if (!request && !websiteUrl) result.unshift({ key: "request", label: "Build request or existing website URL" })
  return result
}

function inferProjectType(request: string, websiteUrl: string): "new_build" | "redesign" | "migration" {
  if (/migrat|move from|replatform|wordpress to|shopify to/i.test(request)) return "migration"
  if (websiteUrl || /redesign|rebuild|refresh|replace (the|our) (site|website)/i.test(request)) return "redesign"
  return "new_build"
}

function inferBusinessName(request: string) {
  const match = request.match(/(?:for|website for)\s+(?:a|an|the)?\s*([A-Z][A-Za-z0-9&' -]{2,60})(?:\.|,|\bwho\b|\bthat\b)/)
  return match?.[1]?.trim() ?? ""
}

function inferIndustry(request: string) {
  const matches: Array<[RegExp, string]> = [
    [/roof/i, "Commercial roofing"], [/plumb/i, "Plumbing"], [/electric/i, "Electrical services"],
    [/construction|builder/i, "Construction"], [/dent/i, "Dental healthcare"], [/legal|solicitor/i, "Legal services"],
    [/account/i, "Accounting and finance"], [/restaurant|cafe/i, "Hospitality"], [/software|saas|technology/i, "Technology"],
  ]
  return matches.find(([pattern]) => pattern.test(request))?.[1] ?? ""
}

function inferAudience(request: string, industry: string) {
  if (/commercial|larger contracts|b2b|business/i.test(request)) return "Business owners, procurement teams, facilities managers, and commercial decision makers."
  if (/homeowner|residential/i.test(request)) return "Homeowners comparing a trustworthy local provider."
  return industry ? `Customers actively comparing ${industry.toLowerCase()} providers.` : "Qualified prospective customers who need clarity, confidence, and an obvious next step."
}

function inferGoal(request: string) {
  if (/larger contract|commercial/i.test(request)) return "Win larger, qualified commercial contracts."
  if (/book|appointment/i.test(request)) return "Increase qualified bookings."
  if (/sell|ecommerce|shop/i.test(request)) return "Increase online sales."
  return "Generate more qualified enquiries."
}

function inferFunctionality(request: string, intake: ForgeIntakeData) {
  const features = ["Responsive content-managed marketing site", "Accessible enquiry journey"]
  if (/email|contact|enquir/i.test(`${request} ${intake.requiredIntegrations}`)) features.push("Email enquiry delivery")
  if (/whatsapp/i.test(`${request} ${intake.requiredIntegrations}`)) features.push("WhatsApp enquiry action")
  if (/book|calend/i.test(`${request} ${intake.requiredIntegrations}`)) features.push("Booking integration")
  if (/pay|stripe|shop|ecommerce/i.test(`${request} ${intake.requiredIntegrations}`)) features.push("Payment or commerce integration")
  return features.join("\n")
}

function buildContentAssumptions(websiteUrl: string, content: string, assets: ForgeIntakeAsset[]) {
  const assumptions = [
    websiteUrl ? "Reuse factual content from the current public website where it remains accurate." : "Create draft copy from the supplied brief; no existing website is assumed.",
    content ? "Treat supplied documents/content as operator-provided source material." : "Use clearly marked draft content until client facts are supplied.",
    assets.length ? `Use ${assets.length} supplied asset${assets.length === 1 ? "" : "s"} where relevant.` : "Use placeholders only where approved imagery has not been supplied.",
    "Never invent testimonials, certifications, prices, guarantees, or performance claims.",
  ]
  return assumptions.join("\n")
}

function normalizeAssets(assets: ForgeIntakeAsset[] | undefined) {
  return (assets ?? []).filter((asset) => asset && typeof asset.name === "string" && asset.size >= 0 && asset.size <= 2_000_000)
    .slice(0, 10)
    .map((asset) => ({ name: clean(asset.name, 180), type: clean(asset.type, 120), size: asset.size, ...(asset.dataUrl?.startsWith("data:") ? { dataUrl: asset.dataUrl.slice(0, 2_700_000) } : {}) }))
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}
