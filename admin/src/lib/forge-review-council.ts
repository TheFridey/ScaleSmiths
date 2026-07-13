import type { ForgeConsistencyArtifactInput, ForgeConsistencyFinding } from "./forge-consistency"

export const FORGE_REVIEW_COUNCIL_ARTIFACT_TITLE = "Multi-perspective Forge review council"
export const FORGE_REVIEW_COUNCIL_KIND = "forge_review_council_v1"
export const FORGE_REVIEWER_PERSPECTIVES = ["creative_director", "conversion_strategist", "senior_frontend_engineer", "accessibility_specialist", "seo_strategist", "security_reviewer", "performance_engineer", "industry_business_expert", "skeptical_prospective_customer"] as const
export type ForgeReviewerPerspective = (typeof FORGE_REVIEWER_PERSPECTIVES)[number]
export type ForgeCouncilSeverity = "info" | "warning" | "error" | "critical"

export interface ForgeCanonicalFact { key: string; value: string; sourceArtifactId: number; sourceArtifactVersion: number; evidence: string; approved: true }
export interface ForgeCanonicalProjectState { artifacts: Array<{ id: number; type: string; title: string; version: number; qualityState: string; outputHash: string }>; facts: ForgeCanonicalFact[]; snapshotHash: string }
export interface ForgeCouncilFinding { id: string; reviewer: ForgeReviewerPerspective; severity: ForgeCouncilSeverity; category: string; title: string; evidence: string[]; affectedArtifacts: Array<{ artifactId: number; version: number }>; recommendation: string; recommendationRank: number; scoreImpact: number; confidence: number; uncertainty: string | null; automaticFixEligible: boolean; humanDecisionRequired: boolean; highRiskDissent: boolean }
export interface ForgeReviewerReport { perspective: ForgeReviewerPerspective; remit: string; reviewerModelVersion: string; scores: Record<string, number>; findings: ForgeCouncilFinding[]; uncertainty: string[]; canonicalSnapshotHash: string; inventedFacts: false }
export interface ForgeCouncilConflict { topic: string; findingIds: string[]; recommendations: string[]; humanDecisionRequired: true }
export interface ForgeCouncilAction { priority: number; title: string; findingIds: string[]; severity: ForgeCouncilSeverity; recommendation: string; automaticFixEligible: boolean; humanDecisionRequired: boolean }
export interface ForgeCouncilSynthesis { synthesisModelVersion: string; groups: Array<{ category: string; findingIds: string[] }>; conflicts: ForgeCouncilConflict[]; preservedDissent: string[]; actionPlan: ForgeCouncilAction[]; automaticFixes: ForgeCouncilAction[]; humanDecisions: ForgeCouncilAction[] }
export interface ForgeReviewCouncilReport { kind: typeof FORGE_REVIEW_COUNCIL_KIND; createdAt: string; canonicalState: ForgeCanonicalProjectState; reviews: ForgeReviewerReport[]; synthesis: ForgeCouncilSynthesis }

const REMITS: Record<ForgeReviewerPerspective, { remit: string; categories: string[]; scores: string[] }> = {
  creative_director: { remit: "Brand expression, hierarchy, visual coherence, originality, and design direction.", categories: ["design_brand_strategy_conflict", "tone_inconsistency", "weak_visual_hierarchy", "generic_template", "repetitive_sections", "inconsistent_cards", "poor_image_crop"], scores: ["brandFit", "visualCoherence", "originality"] },
  conversion_strategist: { remit: "Conversion journey, page purpose, calls to action, trust, and friction.", categories: ["contradictory_calls_to_action", "unclear_page_conversion_purpose", "missing_trust_signals", "weak_cta", "service_missing_from_sitemap"], scores: ["conversionClarity", "trust", "journey"] },
  senior_frontend_engineer: { remit: "Implementation correctness, responsive composition, component coverage, and maintainability.", categories: ["component_spec_missing_approved_sections", "obsolete_upstream", "overflow", "clipped_content", "broken_responsive_layout", "inconsistent_cards", "animation_hiding_content"], scores: ["implementation", "responsive", "maintainability"] },
  accessibility_specialist: { remit: "WCAG-oriented perceivability, operability, understandability, and motion safety.", categories: ["low_contrast", "unreadable_typography", "weak_cta", "header_navigation", "animation_hiding_content", "missing_legal_pages"], scores: ["perceivable", "operable", "understandable"] },
  seo_strategist: { remit: "Search intent, page differentiation, crawlable structure, claims, and policy coverage.", categories: ["duplicate_seo_intent", "service_missing_from_sitemap", "missing_legal_pages", "unsupported_claims", "unclear_page_conversion_purpose"], scores: ["intentCoverage", "differentiation", "technicalReadiness"] },
  security_reviewer: { remit: "Unsafe provenance, unsupported claims, policy gaps, trust boundaries, and deployment risk.", categories: ["obsolete_upstream", "unsafe_quality_dependency", "unsupported_claims", "missing_legal_pages", "conflicting_phone", "conflicting_address"], scores: ["provenance", "trustBoundary", "deploymentSafety"] },
  performance_engineer: { remit: "Runtime performance, layout stability, rendering cost, media, and animation behaviour.", categories: ["layout_shift", "poor_image_crop", "animation_hiding_content", "repetitive_sections", "overflow"], scores: ["layoutStability", "renderingEfficiency", "mediaEfficiency"] },
  industry_business_expert: { remit: "Industry credibility, service representation, commercial fit, supported claims, and customer expectations.", categories: ["unsupported_claims", "service_missing_from_sitemap", "missing_trust_signals", "conflicting_price", "conflicting_company_name", "conflicting_business_name"], scores: ["industryCredibility", "commercialFit", "factReliability"] },
  skeptical_prospective_customer: { remit: "Customer comprehension, credibility, reassurance, calls to action, and reasons not to convert.", categories: ["missing_trust_signals", "unsupported_claims", "contradictory_calls_to_action", "weak_cta", "conflicting_phone", "conflicting_address", "conflicting_price", "unclear_page_conversion_purpose"], scores: ["clarity", "credibility", "confidenceToAct"] },
}

export function buildCanonicalApprovedProjectState(artifacts: ForgeConsistencyArtifactInput[]): ForgeCanonicalProjectState {
  const approved = artifacts.filter((a) => a.approvalState === "approved" && !a.supersededAt && !["consistency_report", "council_review"].includes(a.type))
  const facts: ForgeCanonicalFact[] = []
  for (const artifact of approved) {
    const text = `${artifact.content ?? ""}\n${JSON.stringify(artifact.metadataJson ?? {})}`
    for (const [key, pattern] of Object.entries({ businessName: /(?:business|company) name[^a-z0-9]{0,8}([^\n;,]{2,100})/i, phone: /(?:phone|telephone)[^0-9+]{0,8}([+0-9][0-9 ()-]{8,})/i, address: /address[^a-z0-9]{0,8}([^\n;]{5,140})/i, primaryGoal: /primary goal[^a-z0-9]{0,8}([^\n;]{3,140})/i })) { const match = text.match(pattern); if (match) facts.push({ key, value: match[1].trim(), sourceArtifactId: artifact.id, sourceArtifactVersion: artifact.version, evidence: match[0].trim(), approved: true }) }
  }
  const artifactSummary = approved.map(({ id, type, title, version, qualityState, outputHash }) => ({ id, type, title, version, qualityState, outputHash })).sort((a, b) => a.id - b.id)
  return { artifacts: artifactSummary, facts: dedupeFacts(facts), snapshotHash: stableHash(JSON.stringify({ artifactSummary, facts: dedupeFacts(facts) })) }
}

export function runDeterministicForgeCouncil(canonical: ForgeCanonicalProjectState, sourceFindings: ForgeConsistencyFinding[], now = new Date()): ForgeReviewCouncilReport {
  const reviews = FORGE_REVIEWER_PERSPECTIVES.map((perspective) => reviewPerspective(perspective, canonical, sourceFindings))
  return { kind: FORGE_REVIEW_COUNCIL_KIND, createdAt: now.toISOString(), canonicalState: canonical, reviews, synthesis: synthesizeForgeCouncil(reviews) }
}

export function validateReviewerReport(report: ForgeReviewerReport) { const contract = REMITS[report.perspective]; const invalid = report.findings.filter((f) => !contract.categories.includes(f.category) || f.reviewer !== report.perspective || !f.evidence.length || !f.affectedArtifacts.length); return { valid: invalid.length === 0 && report.canonicalSnapshotHash.length > 0 && report.inventedFacts === false, invalidFindingIds: invalid.map((f) => f.id) } }

function reviewPerspective(perspective: ForgeReviewerPerspective, canonical: ForgeCanonicalProjectState, source: ForgeConsistencyFinding[]): ForgeReviewerReport {
  const contract = REMITS[perspective]
  const relevant = source.filter((finding) => contract.categories.includes(finding.category))
  const findings = relevant.map((finding, index): ForgeCouncilFinding => ({ id: `${perspective}-${index + 1}`, reviewer: perspective, severity: finding.severity, category: finding.category, title: humanize(finding.category), evidence: finding.evidence, affectedArtifacts: finding.affectedArtifactVersions, recommendation: finding.recommendedCorrection, recommendationRank: index + 1, scoreImpact: severityWeight(finding.severity), confidence: finding.confidence, uncertainty: finding.confidence < .8 ? "Evidence is indirect; confirm against approved project context." : null, automaticFixEligible: finding.automaticFixEligible && !finding.humanReviewRequired, humanDecisionRequired: finding.humanReviewRequired, highRiskDissent: finding.severity === "critical" }))
  const penalty = findings.reduce((sum, f) => sum + f.scoreImpact, 0)
  return { perspective, remit: contract.remit, reviewerModelVersion: `deterministic-${perspective}-1.0.0`, scores: Object.fromEntries(contract.scores.map((score) => [score, Math.max(0, 100 - penalty)])), findings, uncertainty: relevant.length ? [] : ["No remit-specific issue was evidenced in the supplied approved snapshot; this is not proof of absence."], canonicalSnapshotHash: canonical.snapshotHash, inventedFacts: false }
}

export function synthesizeForgeCouncil(reviews: ForgeReviewerReport[]): ForgeCouncilSynthesis {
  const findings = reviews.flatMap((review) => review.findings)
  const byCategory = new Map<string, ForgeCouncilFinding[]>(); for (const finding of findings) byCategory.set(finding.category, [...(byCategory.get(finding.category) ?? []), finding])
  const groups = [...byCategory.entries()].map(([category, values]) => ({ category, findingIds: values.map((v) => v.id) }))
  const conflicts: ForgeCouncilConflict[] = []
  for (const [category, values] of byCategory) { const recommendations = [...new Set(values.map((v) => v.recommendation))]; const autoModes = new Set(values.map((v) => v.automaticFixEligible)); if (recommendations.length > 1 || autoModes.size > 1) conflicts.push({ topic: category, findingIds: values.map((v) => v.id), recommendations, humanDecisionRequired: true }) }
  const conflictIds = new Set(conflicts.flatMap((c) => c.findingIds))
  const actionPlan = [...byCategory.entries()].map(([category, values]) => { const severity = values.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))[0].severity; const human = values.some((v) => v.humanDecisionRequired) || values.some((v) => conflictIds.has(v.id)); return { priority: 0, title: humanize(category), findingIds: values.map((v) => v.id), severity, recommendation: [...new Set(values.map((v) => v.recommendation))].join(" / "), automaticFixEligible: !human && values.every((v) => v.automaticFixEligible), humanDecisionRequired: human } }).sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)).map((a, i) => ({ ...a, priority: i + 1 }))
  const preservedDissent = findings.filter((f) => f.highRiskDissent || (f.severity === "critical" && !groups.some((g) => g.findingIds.includes(f.id) && g.findingIds.length > 1))).map((f) => f.id)
  return { synthesisModelVersion: "deterministic-council-synthesis-1.0.0", groups, conflicts, preservedDissent, actionPlan, automaticFixes: actionPlan.filter((a) => a.automaticFixEligible), humanDecisions: actionPlan.filter((a) => a.humanDecisionRequired) }
}

function severityWeight(severity: ForgeCouncilSeverity) { return ({ info: 2, warning: 8, error: 18, critical: 30 })[severity] }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()) }
function dedupeFacts(facts: ForgeCanonicalFact[]) { return [...new Map(facts.map((f) => [`${f.key}:${f.value.toLowerCase()}`, f])).values()] }
function stableHash(value: string) { let hash = 2166136261; for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619) } return (hash >>> 0).toString(16).padStart(8, "0") }
