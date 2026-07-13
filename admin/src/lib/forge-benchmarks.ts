type ForgeJsonSchema = {
  type: "object"
  additionalProperties?: boolean
  required?: string[]
  properties?: Record<string, { type: "string" } | { type: "array"; items: { type: "string" } }>
}

export const FORGE_BENCHMARK_VERSION = "2026-07-12.1"
export const FORGE_BENCHMARK_FIXTURE_IDS = [
  "plastering_contractor",
  "electrician",
  "podiatrist",
  "ecommerce_brand",
  "motorsport_technology",
  "veteran_support",
  "premium_professional_service",
  "weak_input_business",
  "contradictory_input_business",
  "old_website_migration",
] as const

export type ForgeBenchmarkFixtureId = (typeof FORGE_BENCHMARK_FIXTURE_IDS)[number]

export interface ForgeBenchmarkFixture {
  id: ForgeBenchmarkFixtureId
  name: string
  projectType: string
  groundTruthFacts: Record<string, string | string[]>
  requiredPages: string[]
  requiredServices: string[]
  prohibitedInventedClaims: string[]
  requiredTrustSignals: string[]
  primaryConversionGoal: string
  designConstraints: string[]
  qualityRubric: string[]
  knownContradictions: string[]
  expectedClarificationQuestions: string[]
}

export interface ForgeBenchmarkCandidate {
  fixtureId: ForgeBenchmarkFixtureId
  provider: string
  model: string
  promptVersion: string
  schemaVersion: string
  costUsd: number | null
  latencyMs: number
  retryCount: number
  fallbackUsed: boolean
  humanReviewRequired: boolean
  output: {
    pages: string[]
    services: string[]
    claims: string[]
    trustSignals: string[]
    conversionGoal: string
    designNotes: string[]
    clarificationQuestions: string[]
  }
}

export interface ForgeBenchmarkResult {
  fixtureId: ForgeBenchmarkFixtureId
  fixtureName: string
  provider: string
  model: string
  promptVersion: string
  schemaVersion: string
  schemaPassed: boolean
  schemaErrors: string[]
  consistencyScore: number
  contentQuality: number
  costUsd: number | null
  latencyMs: number
  retryCount: number
  fallbackUsed: boolean
  humanReviewRequired: boolean
  regression: {
    comparedTo: string | null
    promptChanged: boolean
    schemaChanged: boolean
    modelChanged: boolean
    scoreDelta: number | null
    regressed: boolean
  }
  findings: string[]
}

export interface ForgeBenchmarkReport {
  benchmarkVersion: string
  mode: "offline" | "live"
  generatedAt: string
  fixtureCount: number
  schemaPassRate: number
  averageConsistencyScore: number
  averageContentQuality: number
  totalCostUsd: number | null
  averageLatencyMs: number
  retryCount: number
  fallbackRate: number
  humanReviewRate: number
  results: ForgeBenchmarkResult[]
}

export const FORGE_BENCHMARK_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pages", "services", "claims", "trustSignals", "conversionGoal", "designNotes", "clarificationQuestions"],
  properties: {
    pages: { type: "array", items: { type: "string" } },
    services: { type: "array", items: { type: "string" } },
    claims: { type: "array", items: { type: "string" } },
    trustSignals: { type: "array", items: { type: "string" } },
    conversionGoal: { type: "string" },
    designNotes: { type: "array", items: { type: "string" } },
    clarificationQuestions: { type: "array", items: { type: "string" } },
  },
} as const satisfies ForgeJsonSchema

export const FORGE_BENCHMARK_FIXTURES: ForgeBenchmarkFixture[] = [
  fixture("plastering_contractor", "Harper Lime Plastering", "trade_local_service", {
    location: "Bristol and Bath",
    services: ["lime plaster repair", "heritage ceiling repair", "internal skimming"],
    proof: ["Federation of Master Builders membership", "before-and-after project photos"],
  }, ["/", "/lime-plaster-repair", "/heritage-ceilings", "/about", "/contact"], ["lime plaster repair", "heritage ceiling repair", "internal skimming"], ["guaranteed damp cure", "30 years experience", "award-winning"], ["Federation of Master Builders membership", "before-and-after project photos"], "Request a site survey", ["heritage feel", "avoid glossy SaaS styling"], ["specific heritage services", "local relevance", "proof near enquiry CTA"], [], ["Is the FMB membership current?", "Which listed-building constraints apply?"]),
  fixture("electrician", "Northline Electrical", "trade_local_service", { location: "Leeds", services: ["EICR testing", "consumer unit upgrades", "EV charger installation"], proof: ["NICEIC registration", "public liability insurance"] }, ["/", "/eicr-testing", "/consumer-unit-upgrades", "/ev-chargers", "/contact"], ["EICR testing", "consumer unit upgrades", "EV charger installation"], ["24/7 emergency cover", "cheapest electrician", "guaranteed same-day"], ["NICEIC registration", "public liability insurance"], "Book a compliance call", ["clear safety-led layout", "no fake certification badges"], ["electrical safety clarity", "compliance language", "strong contact path"], [], ["What certificate numbers can be shown?", "Do they serve commercial properties?"]),
  fixture("podiatrist", "Vale Foot Clinic", "healthcare_local_service", { location: "Cardiff", services: ["routine foot care", "diabetic foot assessment", "biomechanics assessment"], proof: ["HCPC registered podiatrists", "clinic accessibility information"] }, ["/", "/routine-foot-care", "/diabetic-foot-care", "/biomechanics", "/fees", "/contact"], ["routine foot care", "diabetic foot assessment", "biomechanics assessment"], ["cure diabetes", "guaranteed pain-free", "NHS partner"], ["HCPC registered podiatrists", "clinic accessibility information"], "Book an appointment", ["calm clinical design", "accessible typography"], ["medical caution", "clear fees", "accessible forms"], [], ["Which clinicians are HCPC registered?", "Are home visits available?"]),
  fixture("ecommerce_brand", "Morrow Field Goods", "ecommerce", { products: ["waxed canvas bags", "repair kits", "field notebooks"], proof: ["repair programme", "recycled packaging"], audience: "outdoor commuters" }, ["/", "/shop", "/bags", "/repairs", "/journal", "/contact"], ["waxed canvas bags", "repair kits", "field notebooks"], ["lifetime guarantee", "made in UK", "carbon neutral"], ["repair programme", "recycled packaging"], "Buy bags or start a repair", ["product-forward", "avoid local-service quote language"], ["product specificity", "commerce CTAs", "policy clarity"], [], ["Where are products manufactured?", "What is the returns policy?"]),
  fixture("motorsport_technology", "Apex Telemetry Systems", "b2b_technology", { services: ["motorsport telemetry dashboards", "pit-wall analytics", "sensor integration"], proof: ["case studies under NDA", "trackside support process"], audience: "race engineers and team principals" }, ["/", "/telemetry-platform", "/sensor-integration", "/case-studies", "/contact"], ["motorsport telemetry dashboards", "pit-wall analytics", "sensor integration"], ["F1 proven", "wins guaranteed", "official FIA partner"], ["case studies under NDA", "trackside support process"], "Book a technical discovery call", ["technical premium", "avoid generic startup gradients"], ["technical credibility", "specific buyer language", "no invented partnerships"], [], ["Which series can be named?", "What data formats are supported?"]),
  fixture("veteran_support", "Forward Step Veterans", "charity_support", { services: ["peer support groups", "benefits signposting", "family support workshops"], proof: ["registered charity number pending", "local authority referral pathway"], audience: "veterans and families" }, ["/", "/support", "/families", "/referrals", "/volunteer", "/contact"], ["peer support groups", "benefits signposting", "family support workshops"], ["clinical therapy", "crisis hotline", "government endorsed"], ["local authority referral pathway", "safeguarding policy"], "Ask for support or make a referral", ["warm and dignified", "trauma-informed language"], ["no medical overclaiming", "clear referral path", "trust and safeguarding"], ["charity number pending but requested as registered charity"], ["Is charity registration complete?", "What crisis escalation copy is approved?"]),
  fixture("premium_professional_service", "Ashborne Private Office", "premium_professional_service", { services: ["family office coordination", "property acquisition support", "succession planning liaison"], proof: ["partner-led engagements", "confidential onboarding process"], audience: "high-net-worth families" }, ["/", "/private-office", "/property", "/succession", "/contact"], ["family office coordination", "property acquisition support", "succession planning liaison"], ["regulated financial advice", "guaranteed returns", "legal advice"], ["partner-led engagements", "confidential onboarding process"], "Request a confidential introduction", ["restrained luxury", "no flashy animations"], ["discretion", "specific remit boundaries", "compliance caution"], [], ["Which regulated activities are excluded?", "Can partner names be shown?"]),
  fixture("weak_input_business", "Brightside Services", "weak_input", { services: ["property help"], audience: "local customers" }, ["/", "/services", "/about", "/contact"], ["property help"], ["fully insured", "best in town", "30 years experience"], ["clear process explanation"], "Request more information", ["simple and credible"], ["ask clarifying questions", "avoid invented specificity"], [], ["What services are actually offered?", "Where is the business based?", "What proof can be used?"]),
  fixture("contradictory_input_business", "Cedar & Slate", "contradictory_input", { location: ["Manchester", "Birmingham"], services: ["roof repairs", "kitchen fitting"], phone: ["0161 000 1111", "0121 000 2222"] }, ["/", "/services", "/roof-repairs", "/contact"], ["roof repairs"], ["serves every UK city", "Which? award winner"], ["verified service area", "confirmed phone number"], "Request a quote", ["resolve contradictions before polished copy"], ["surface contradictions", "avoid choosing facts silently"], ["Two locations and phone numbers conflict", "Services mix roofing and kitchens"], ["Which city is correct?", "Which phone number is approved?", "Are kitchen services in scope?"]),
  fixture("old_website_migration", "Luna Dental Studio", "migration", { currentWebsitePages: ["/old-treatments", "/fees", "/team"], services: ["teeth whitening", "hygiene appointments", "Invisalign consultation"], proof: ["GDC numbers supplied", "patient finance page"] }, ["/", "/treatments", "/fees", "/team", "/contact"], ["teeth whitening", "hygiene appointments", "Invisalign consultation"], ["pain-free guarantee", "5-star rated", "official Invisalign Diamond provider"], ["GDC numbers supplied", "patient finance page"], "Book a consultation", ["modern clinic but preserve existing SEO equity"], ["migration coverage", "regulated healthcare caution", "redirect awareness"], [], ["Which old URLs need redirects?", "Can review ratings be verified?"]),
]

export function createOfflineBenchmarkCandidate(fixture: ForgeBenchmarkFixture): ForgeBenchmarkCandidate {
  const weak = fixture.id === "weak_input_business" || fixture.id === "contradictory_input_business"
  return {
    fixtureId: fixture.id,
    provider: "mock",
    model: "deterministic-benchmark-v1",
    promptVersion: "offline-fixture-v1",
    schemaVersion: "forge.benchmark-output@1.0.0",
    costUsd: null,
    latencyMs: 5,
    retryCount: 0,
    fallbackUsed: true,
    humanReviewRequired: weak || fixture.knownContradictions.length > 0,
    output: {
      pages: fixture.requiredPages,
      services: fixture.requiredServices,
      claims: fixture.requiredTrustSignals,
      trustSignals: fixture.requiredTrustSignals,
      conversionGoal: fixture.primaryConversionGoal,
      designNotes: fixture.designConstraints,
      clarificationQuestions: fixture.expectedClarificationQuestions,
    },
  }
}

export function evaluateForgeBenchmarkCandidate(fixture: ForgeBenchmarkFixture, candidate: ForgeBenchmarkCandidate, baseline?: ForgeBenchmarkResult): ForgeBenchmarkResult {
  const schemaErrors = validateJsonSchemaValue(FORGE_BENCHMARK_OUTPUT_SCHEMA, candidate.output)
  const findings: string[] = []
  const missingPages = missing(fixture.requiredPages, candidate.output.pages)
  const missingServices = missing(fixture.requiredServices, candidate.output.services)
  const missingTrust = missing(fixture.requiredTrustSignals, candidate.output.trustSignals)
  const inventedClaims = candidate.output.claims.filter((claim) => fixture.prohibitedInventedClaims.some((blocked) => normalized(claim).includes(normalized(blocked))))
  const missingQuestions = missing(fixture.expectedClarificationQuestions, candidate.output.clarificationQuestions)
  if (schemaErrors.length) findings.push(`Schema errors: ${schemaErrors.join(" ")}`)
  if (missingPages.length) findings.push(`Missing pages: ${missingPages.join(", ")}`)
  if (missingServices.length) findings.push(`Missing services: ${missingServices.join(", ")}`)
  if (missingTrust.length) findings.push(`Missing trust signals: ${missingTrust.join(", ")}`)
  if (inventedClaims.length) findings.push(`Invented prohibited claims: ${inventedClaims.join(", ")}`)
  if (fixture.knownContradictions.length && missingQuestions.length) findings.push(`Missing clarification questions: ${missingQuestions.join("; ")}`)
  const consistencyScore = clamp(100 - missingPages.length * 8 - missingServices.length * 10 - missingTrust.length * 6 - inventedClaims.length * 20 - (fixture.knownContradictions.length && missingQuestions.length ? 15 : 0))
  const genericPenalty = candidate.output.claims.some((claim) => /quality you can trust|tailored solutions|unlock/i.test(claim)) ? 10 : 0
  const contentQuality = clamp(100 - genericPenalty - missingServices.length * 8 - missingTrust.length * 5 - inventedClaims.length * 25 - (candidate.humanReviewRequired ? 5 : 0))
  const currentCombined = (consistencyScore + contentQuality) / 2
  const baselineCombined = baseline ? (baseline.consistencyScore + baseline.contentQuality) / 2 : null
  return {
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    provider: candidate.provider,
    model: candidate.model,
    promptVersion: candidate.promptVersion,
    schemaVersion: candidate.schemaVersion,
    schemaPassed: schemaErrors.length === 0,
    schemaErrors,
    consistencyScore,
    contentQuality,
    costUsd: candidate.costUsd,
    latencyMs: candidate.latencyMs,
    retryCount: candidate.retryCount,
    fallbackUsed: candidate.fallbackUsed,
    humanReviewRequired: candidate.humanReviewRequired,
    regression: {
      comparedTo: baseline ? `${baseline.promptVersion}/${baseline.schemaVersion}/${baseline.model}` : null,
      promptChanged: baseline ? baseline.promptVersion !== candidate.promptVersion : false,
      schemaChanged: baseline ? baseline.schemaVersion !== candidate.schemaVersion : false,
      modelChanged: baseline ? baseline.model !== candidate.model : false,
      scoreDelta: baselineCombined === null ? null : Number((currentCombined - baselineCombined).toFixed(2)),
      regressed: baselineCombined !== null && currentCombined < baselineCombined - 3,
    },
    findings,
  }
}

export function runOfflineForgeBenchmark(baseline?: Partial<Record<ForgeBenchmarkFixtureId, ForgeBenchmarkResult>>, now = new Date()): ForgeBenchmarkReport {
  const results = FORGE_BENCHMARK_FIXTURES.map((fixture) => evaluateForgeBenchmarkCandidate(fixture, createOfflineBenchmarkCandidate(fixture), baseline?.[fixture.id]))
  return buildBenchmarkReport("offline", results, now)
}

export function buildBenchmarkReport(mode: "offline" | "live", results: ForgeBenchmarkResult[], now = new Date()): ForgeBenchmarkReport {
  return {
    benchmarkVersion: FORGE_BENCHMARK_VERSION,
    mode,
    generatedAt: now.toISOString(),
    fixtureCount: results.length,
    schemaPassRate: ratio(results.filter((result) => result.schemaPassed).length, results.length),
    averageConsistencyScore: avg(results.map((result) => result.consistencyScore)),
    averageContentQuality: avg(results.map((result) => result.contentQuality)),
    totalCostUsd: results.some((result) => result.costUsd !== null) ? Number(results.reduce((sum, result) => sum + (result.costUsd ?? 0), 0).toFixed(6)) : null,
    averageLatencyMs: avg(results.map((result) => result.latencyMs)),
    retryCount: results.reduce((sum, result) => sum + result.retryCount, 0),
    fallbackRate: ratio(results.filter((result) => result.fallbackUsed).length, results.length),
    humanReviewRate: ratio(results.filter((result) => result.humanReviewRequired).length, results.length),
    results,
  }
}

function fixture(id: ForgeBenchmarkFixtureId, name: string, projectType: string, groundTruthFacts: Record<string, string | string[]>, requiredPages: string[], requiredServices: string[], prohibitedInventedClaims: string[], requiredTrustSignals: string[], primaryConversionGoal: string, designConstraints: string[], qualityRubric: string[], knownContradictions: string[], expectedClarificationQuestions: string[]): ForgeBenchmarkFixture {
  return { id, name, projectType, groundTruthFacts, requiredPages, requiredServices, prohibitedInventedClaims, requiredTrustSignals, primaryConversionGoal, designConstraints, qualityRubric, knownContradictions, expectedClarificationQuestions }
}
function missing(required: string[], actual: string[]) { const set = new Set(actual.map(normalized)); return required.filter((item) => !set.has(normalized(item))) }
function normalized(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() }
function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))) }
function ratio(count: number, total: number) { return total ? Number((count / total).toFixed(4)) : 0 }
function avg(values: number[]) { return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0 }

function validateJsonSchemaValue(schema: ForgeJsonSchema, value: unknown): string[] {
  const errors: string[] = []
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["Output must be an object."]
  const record = value as Record<string, unknown>
  for (const key of schema.required ?? []) {
    if (!(key in record)) errors.push(`Missing required property "${key}".`)
  }
  for (const [key, property] of Object.entries(schema.properties ?? {})) {
    const field = record[key]
    if (field === undefined) continue
    if (property.type === "string" && typeof field !== "string") errors.push(`Property "${key}" must be a string.`)
    if (property.type === "array") {
      if (!Array.isArray(field)) {
        errors.push(`Property "${key}" must be an array.`)
      } else if (field.some((item) => typeof item !== "string")) {
        errors.push(`Property "${key}" must contain only strings.`)
      }
    }
  }
  if (schema.additionalProperties === false) {
    const allowed = new Set(Object.keys(schema.properties ?? {}))
    for (const key of Object.keys(record)) {
      if (!allowed.has(key)) errors.push(`Unexpected property "${key}".`)
    }
  }
  return errors
}
