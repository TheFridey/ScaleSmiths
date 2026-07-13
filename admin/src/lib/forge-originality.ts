import type { JsonValue } from "./forge-ai"

export const FORGE_ORIGINALITY_ARTIFACT_TITLE = "Structural originality report"
export const FORGE_ORIGINALITY_ARTIFACT_KIND = "forge_structural_originality_v1"

export type ForgeOriginalitySeverity = "info" | "warning" | "error" | "critical"
export type ForgeOriginalityCategory =
  | "repeated_section_sequences"
  | "near_identical_hero_composition"
  | "excessive_card_grid_reuse"
  | "repeated_decorative_devices"
  | "repeated_animation_patterns"
  | "repeated_testimonial_layouts"
  | "repeated_cta_blocks"
  | "excessive_centred_layouts"
  | "monotonous_page_rhythm"
  | "high_cross_project_similarity"

export type ForgeOriginalityClassification = "appropriate_design_system_consistency" | "legitimate_industry_convention" | "unacceptable_cross_client_templating"

export interface ForgeStructuralFingerprint extends Record<string, JsonValue> {
  projectId: number
  artifactId: number
  artifactVersion: number
  industry: string | null
  routeCount: number
  routeShapes: string[]
  componentSequence: string[]
  sectionSequence: string[]
  heroComposition: string
  cardGridPattern: string
  decorativeDevices: string[]
  animationPattern: string
  testimonialLayout: string
  ctaPattern: string
  centeredLayoutRatio: number
  rhythmSignature: string[]
  styleSystemKey: string
}

export interface ForgeOriginalityFinding extends Record<string, JsonValue> {
  severity: ForgeOriginalitySeverity
  category: ForgeOriginalityCategory
  classification: ForgeOriginalityClassification
  evidence: string[]
  matchingProjects: Array<{ projectId: number; artifactId: number; artifactVersion: number }>
  matchingPatterns: string[]
  suggestedCompositionChanges: string[]
  humanReviewRequired: boolean
  confidence: number
}

export interface ForgeOriginalityReport extends Record<string, JsonValue> {
  kind: typeof FORGE_ORIGINALITY_ARTIFACT_KIND
  evaluatedAt: string
  projectId: number
  similarityScore: number
  severity: ForgeOriginalitySeverity
  humanReviewRequired: boolean
  findings: ForgeOriginalityFinding[]
  privacy: {
    clientContentCompared: false
    comparedFields: string[]
    privateContentExposed: false
  }
}

export function buildForgeStructuralFingerprint(input: {
  projectId: number
  artifactId: number
  artifactVersion: number
  industry?: string | null
  metadataJson: Record<string, unknown> | null | undefined
}): ForgeStructuralFingerprint | null {
  const summary = readSummary(input.metadataJson)
  if (!summary) return null
  const components = stringArray(summary.components)
  const routes = stringArray(summary.routes)
  const styleSystemKey = stringValue((summary.designSystem as Record<string, unknown> | undefined)?.styleSystemKey) || stringArray(summary.animationStack)[0] || "unknown-style-system"
  const routeShapes = routes.map((route) => routeShape(route))
  const sectionSequence = inferSectionSequence(components)
  return {
    projectId: input.projectId,
    artifactId: input.artifactId,
    artifactVersion: input.artifactVersion,
    industry: input.industry ?? null,
    routeCount: routes.length,
    routeShapes,
    componentSequence: components,
    sectionSequence,
    heroComposition: inferHeroComposition(components, summary),
    cardGridPattern: inferCardGridPattern(components, summary),
    decorativeDevices: inferDecorativeDevices(summary),
    animationPattern: stringArray(summary.animationStack).join(" > ") || "static",
    testimonialLayout: components.includes("ReviewsSection") ? "single-proof-band" : "none",
    ctaPattern: inferCtaPattern(components, routes),
    centeredLayoutRatio: inferCenteredLayoutRatio(components),
    rhythmSignature: inferRhythmSignature(components),
    styleSystemKey,
  }
}

export function evaluateForgeStructuralOriginality(current: ForgeStructuralFingerprint, corpus: ForgeStructuralFingerprint[], now = new Date()): ForgeOriginalityReport {
  const comparisons = corpus.filter((item) => item.projectId !== current.projectId)
    .map((candidate) => ({ candidate, score: structuralSimilarity(current, candidate) }))
    .sort((a, b) => b.score - a.score)
  const nearest = comparisons[0]
  const findings: ForgeOriginalityFinding[] = []
  const add = (finding: ForgeOriginalityFinding) => findings.push(finding)

  if (nearest && nearest.score >= 82) {
    add(finding("error", "high_cross_project_similarity", classify(current, nearest.candidate, nearest.score), current, [nearest], [`Overall structural similarity is ${nearest.score}/100.`], ["Change page rhythm, hero composition, CTA block shape, and section order together rather than only swapping tokens."], .92))
  }
  const repeatedSequences = comparisons.filter(({ candidate }) => jaccard(ngrams(current.sectionSequence, 4), ngrams(candidate.sectionSequence, 4)) >= .75)
  if (repeatedSequences.length) add(finding("warning", "repeated_section_sequences", classify(current, repeatedSequences[0].candidate, 72), current, repeatedSequences.slice(0, 3), ["Four-section sequences substantially match previous generated projects."], ["Reorder proof/process/detail sections, add an industry-specific bridge section, or split repeated grids with a bespoke narrative block."], .84))
  const heroMatches = comparisons.filter(({ candidate }) => candidate.heroComposition === current.heroComposition)
  if (heroMatches.length >= 2) add(finding("warning", "near_identical_hero_composition", classify(current, heroMatches[0].candidate, 68), current, heroMatches.slice(0, 3), [`Hero composition '${current.heroComposition}' repeats across ${heroMatches.length} other project(s).`], ["Vary the hero layout: proof-led, media-led, stat-led, split editorial, or action-first depending on approved facts."], .8))
  const cardMatches = comparisons.filter(({ candidate }) => candidate.cardGridPattern === current.cardGridPattern)
  if (cardMatches.length >= 3) add(finding("warning", "excessive_card_grid_reuse", "unacceptable_cross_client_templating", current, cardMatches.slice(0, 3), [`Card grid pattern '${current.cardGridPattern}' is reused heavily.`], ["Change card count, density, interaction model, supporting proof placement, or replace a grid with comparison/process/table composition."], .82))
  const animationMatches = comparisons.filter(({ candidate }) => candidate.animationPattern === current.animationPattern)
  if (animationMatches.length >= 4) add(finding("info", "repeated_animation_patterns", "appropriate_design_system_consistency", current, animationMatches.slice(0, 3), ["Animation pack repeats, but this may be acceptable design-system consistency."], ["Only vary animation if it improves comprehension; keep reduced-motion behaviour stable."], .62))
  const centered = current.centeredLayoutRatio >= .7
  if (centered) add(finding("warning", "excessive_centred_layouts", "unacceptable_cross_client_templating", current, [], [`Estimated centred-layout ratio is ${Math.round(current.centeredLayoutRatio * 100)}%.`], ["Introduce asymmetric proof blocks, side-by-side service detail, anchored CTAs, and left-aligned long-form content."], .76))
  if (new Set(current.rhythmSignature).size <= 2 && current.rhythmSignature.length >= 5) add(finding("warning", "monotonous_page_rhythm", "unacceptable_cross_client_templating", current, [], ["Most sections use the same rhythm signature."], ["Alternate dense/scannable sections with narrative, proof, comparison, FAQ, and conversion blocks."], .78))
  const decorativeMatches = comparisons.filter(({ candidate }) => overlap(current.decorativeDevices, candidate.decorativeDevices).length >= 2)
  if (decorativeMatches.length >= 3) add(finding("warning", "repeated_decorative_devices", classify(current, decorativeMatches[0].candidate, 65), current, decorativeMatches.slice(0, 3), ["Decorative device set repeats across several projects."], ["Swap decorative motifs for industry-specific proof, diagrams, product/process imagery, or client-approved visual evidence."], .7))
  const testimonialMatches = comparisons.filter(({ candidate }) => candidate.testimonialLayout === current.testimonialLayout && current.testimonialLayout !== "none")
  if (testimonialMatches.length >= 4) add(finding("info", "repeated_testimonial_layouts", "legitimate_industry_convention", current, testimonialMatches.slice(0, 3), ["Testimonial/proof layout repeats; this may be a legitimate convention if content and proof placement differ."], ["Consider case-study strips, quote pairs, review stats, or before/after proof when approved facts support them."], .62))
  const ctaMatches = comparisons.filter(({ candidate }) => candidate.ctaPattern === current.ctaPattern)
  if (ctaMatches.length >= 4) add(finding("warning", "repeated_cta_blocks", classify(current, ctaMatches[0].candidate, 67), current, ctaMatches.slice(0, 3), [`CTA pattern '${current.ctaPattern}' repeats heavily.`], ["Vary CTA block placement, proof adjacency, secondary action, and form/WhatsApp relationship by project intent."], .74))

  findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
  const maxSimilarity = nearest?.score ?? 0
  const penalty = findings.reduce((total, item) => total + (item.severity === "error" ? 12 : item.severity === "warning" ? 7 : 2), 0)
  const similarityScore = clamp(Math.round(maxSimilarity + penalty), 0, 100)
  return {
    kind: FORGE_ORIGINALITY_ARTIFACT_KIND,
    evaluatedAt: now.toISOString(),
    projectId: current.projectId,
    similarityScore,
    severity: findings[0]?.severity ?? "info",
    humanReviewRequired: findings.some((item) => item.classification === "unacceptable_cross_client_templating" || ["error", "critical"].includes(item.severity)),
    findings,
    privacy: {
      clientContentCompared: false,
      comparedFields: ["routeShapes", "componentSequence", "sectionSequence", "heroComposition", "cardGridPattern", "decorativeDevices", "animationPattern", "testimonialLayout", "ctaPattern", "centeredLayoutRatio", "rhythmSignature", "styleSystemKey", "industry"],
      privateContentExposed: false,
    },
  }
}

export function readForgeOriginalityReport(value: unknown): ForgeOriginalityReport | null {
  if (!value || typeof value !== "object") return null
  const report = (value as Record<string, unknown>).report
  return report && typeof report === "object" && (report as Record<string, unknown>).kind === FORGE_ORIGINALITY_ARTIFACT_KIND ? report as ForgeOriginalityReport : null
}

function readSummary(metadata: Record<string, unknown> | null | undefined) {
  const summary = metadata?.summary
  return summary && typeof summary === "object" && !Array.isArray(summary) ? summary as Record<string, unknown> : null
}
function stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [] }
function stringValue(value: unknown) { return typeof value === "string" ? value : "" }
function routeShape(route: string) { if (route === "/") return "home"; if (/style-guide/.test(route)) return "internal-style-guide"; if (/contact|quote|enquiry/.test(route)) return "conversion"; if (/about|team|story/.test(route)) return "trust"; if (/area|location|near/.test(route)) return "local"; if (/store|vote|community|support|game/.test(route)) return "community"; return "service" }
function inferSectionSequence(components: string[]) { return components.filter((name) => /Hero|Trust|Services|Service|Process|Reviews|FAQ|Contact|WhatsApp|LeadForm|LocalSEO|Card|CTA|Navigation|Footer/i.test(name)) }
function inferHeroComposition(components: string[], summary: Record<string, unknown>) { const hasTrust = components.includes("TrustBar"); const hasGrid = components.includes("ServicesGrid"); const animation = stringArray(summary.animationStack)[0] ?? "static"; return `hero:${hasTrust ? "proof" : "plain"}:${hasGrid ? "grid-follow" : "linear"}:${animation}` }
function inferCardGridPattern(components: string[], summary: Record<string, unknown>) { const grid = components.includes("ServicesGrid") ? "services-grid" : "no-service-grid"; const count = Number(summary.routeCount ?? stringArray(summary.routes).length) || 0; return `${grid}:${count >= 6 ? "many-routes" : count >= 3 ? "standard-routes" : "few-routes"}` }
function inferDecorativeDevices(summary: Record<string, unknown>) { const animation = stringArray(summary.animationStack).join(" ").toLowerCase(); return ["glow", "glass", "gradient", "shadow", "rounded-panels", "motion-reveal"].filter((item) => animation.includes(item.replace("-", " ")) || JSON.stringify(summary).toLowerCase().includes(item)) }
function inferCtaPattern(components: string[], routes: string[]) { const whatsApp = components.includes("WhatsAppCTA"); const lead = components.includes("LeadForm"); const contact = routes.some((route) => /contact/.test(route)); return `${lead ? "form" : "no-form"}:${whatsApp ? "whatsapp" : "no-whatsapp"}:${contact ? "contact-route" : "inline-only"}` }
function inferCenteredLayoutRatio(components: string[]) { const centered = components.filter((name) => /Hero|TrustBar|FAQ|Reviews|CTA/i.test(name)).length; return components.length ? Number((centered / components.length).toFixed(2)) : 0 }
function inferRhythmSignature(components: string[]) { return components.map((name) => /Grid|Cards|Services/.test(name) ? "grid" : /Hero|CTA|LeadForm|Contact/.test(name) ? "conversion" : /Trust|Reviews|FAQ/.test(name) ? "proof" : "content") }
function structuralSimilarity(a: ForgeStructuralFingerprint, b: ForgeStructuralFingerprint) { const parts = [jaccard(a.routeShapes, b.routeShapes), jaccard(a.componentSequence, b.componentSequence), jaccard(ngrams(a.sectionSequence, 3), ngrams(b.sectionSequence, 3)), a.heroComposition === b.heroComposition ? 1 : 0, a.cardGridPattern === b.cardGridPattern ? 1 : 0, a.ctaPattern === b.ctaPattern ? 1 : 0, a.animationPattern === b.animationPattern ? .65 : 0, Math.max(0, 1 - Math.abs(a.centeredLayoutRatio - b.centeredLayoutRatio))]; return Math.round((parts.reduce((sum, item) => sum + item, 0) / parts.length) * 100) }
function classify(a: ForgeStructuralFingerprint, b: ForgeStructuralFingerprint, score: number): ForgeOriginalityClassification { if (a.styleSystemKey === b.styleSystemKey && score < 78) return "appropriate_design_system_consistency"; if (a.industry && b.industry && normalizeIndustry(a.industry) === normalizeIndustry(b.industry) && score < 84) return "legitimate_industry_convention"; return "unacceptable_cross_client_templating" }
function finding(severity: ForgeOriginalitySeverity, category: ForgeOriginalityCategory, classification: ForgeOriginalityClassification, current: ForgeStructuralFingerprint, matches: Array<{ candidate: ForgeStructuralFingerprint; score: number }>, evidence: string[], suggestions: string[], confidence: number): ForgeOriginalityFinding { return { severity, category, classification, evidence, matchingProjects: matches.map(({ candidate }) => ({ projectId: candidate.projectId, artifactId: candidate.artifactId, artifactVersion: candidate.artifactVersion })), matchingPatterns: [current.heroComposition, current.cardGridPattern, current.ctaPattern].filter(Boolean), suggestedCompositionChanges: suggestions, humanReviewRequired: classification === "unacceptable_cross_client_templating" || ["error", "critical"].includes(severity), confidence } }
function ngrams(values: string[], size: number) { if (values.length < size) return values; const out: string[] = []; for (let index = 0; index <= values.length - size; index += 1) out.push(values.slice(index, index + size).join(">")); return out }
function jaccard(a: string[], b: string[]) { const left = new Set(a); const right = new Set(b); if (!left.size && !right.size) return 1; const intersection = [...left].filter((item) => right.has(item)).length; return intersection / new Set([...left, ...right]).size }
function overlap(a: string[], b: string[]) { const right = new Set(b); return a.filter((item) => right.has(item)) }
function normalizeIndustry(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() }
function severityRank(v: ForgeOriginalitySeverity) { return ({ info: 0, warning: 1, error: 2, critical: 3 })[v] }
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)) }
