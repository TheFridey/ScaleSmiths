import type { ForgeConsistencyArtifactInput } from "./forge-consistency"

export const FORGE_COPY_QUALITY_ARTIFACT_TITLE = "Copy quality report"
export const FORGE_COPY_QUALITY_ARTIFACT_KIND = "forge_copy_quality_report_v1"

export const FORGE_COPY_QUALITY_CATEGORIES = [
  "generic_ai_language",
  "empty_superlative",
  "repetitive_sentence_structure",
  "excessive_em_dash",
  "unsupported_claim",
  "vague_call_to_action",
  "missing_geographic_relevance",
  "missing_service_specificity",
  "competitor_generic_phrase",
  "excessive_repetition",
  "weak_evidence",
  "missing_objection",
  "missing_next_step_clarity",
  "overly_long_introduction",
  "keyword_stuffing",
  "unnatural_local_seo",
] as const

export type ForgeCopyQualityCategory = (typeof FORGE_COPY_QUALITY_CATEGORIES)[number]
export type ForgeCopyQualitySeverity = "info" | "warning" | "error" | "critical"

export interface ForgeCopyQualityFinding {
  severity: ForgeCopyQualitySeverity
  category: ForgeCopyQualityCategory
  evidence: string[]
  affectedArtifacts: number[]
  affectedArtifactVersions: Array<{ artifactId: number; version: number }>
  suggestedRevision: string
  humanReviewRequired: boolean
  confidence: number
}

export interface ForgeCopyQualityReport {
  kind: typeof FORGE_COPY_QUALITY_ARTIFACT_KIND
  evaluatedAt: string
  copyArtifactId: number | null
  copyArtifactVersion: number | null
  scores: {
    specificity: number
    brandFit: number
    conversion: number
    evidence: number
    readability: number
    repetition: number
  }
  highRiskClaims: string[]
  exactEvidence: string[]
  suggestedRevisions: string[]
  humanReviewRequired: boolean
  findings: ForgeCopyQualityFinding[]
  sourceOfTruthArtifactIds: number[]
  fabricatedFactsAllowed: false
}

const GENERIC_PHRASES = [
  "unlock your potential",
  "elevate your business",
  "cutting-edge solutions",
  "seamless experience",
  "tailored solutions",
  "in today's digital landscape",
  "transform your business",
  "take your business to the next level",
  "one-stop shop",
  "quality you can trust",
  "we go above and beyond",
]

const EMPTY_SUPERLATIVES = /\b(?:best|leading|premier|trusted|reliable|exceptional|unmatched|world[- ]class|top[- ]rated|award[- ]winning|number one|#1)\b/gi
const HIGH_RISK_CLAIMS = /\b(?:award[- ]winning|number one|#1|top[- ]rated|guaranteed|fully insured|fully certified|licensed|accredited|rated\s+\d(?:\.\d)?|over \d+ years|\d+ years(?:'| of)? experience|hundreds of|thousands of)\b/gi
const VAGUE_CTAS = /\b(?:learn more|get started|contact us|reach out|discover more)\b/gi
const SERVICE_WORDS = /\b(?:repair|install|installation|maintenance|plaster|render|roof|landscap|clean|consult|design|build|audit|survey|quote|service|support|hosting|seo|website|portal|shop|store)\w*\b/gi
const OBJECTION_WORDS = /\b(?:cost|price|timeline|how long|disruption|mess|warranty|guarantee|insured|qualified|availability|response|process|what happens|after you enquire)\b/i

export function evaluateForgeCopyQuality(artifacts: ForgeConsistencyArtifactInput[], now = new Date()): ForgeCopyQualityReport {
  const current = latestApprovedArtifacts(artifacts)
  const copy = current.find((artifact) => artifact.type === "copy_doc") ?? null
  const sourceOfTruth = current.filter((artifact) => ["handover_doc", "research_report", "sitemap", "copy_doc"].includes(artifact.type))
  const truthText = sourceOfTruth.filter((artifact) => artifact.type !== "copy_doc").map(searchable).join(" ")
  const copyText = copy ? searchable(copy) : ""
  const visibleText = copy ? extractVisibleCopy(copy) : ""
  const findings: ForgeCopyQualityFinding[] = []

  const add = (input: Omit<ForgeCopyQualityFinding, "affectedArtifactVersions">) => findings.push({
    ...input,
    affectedArtifactVersions: input.affectedArtifacts.map((artifactId) => ({
      artifactId,
      version: artifacts.find((artifact) => artifact.id === artifactId)?.version ?? 0,
    })),
  })

  if (!copy) {
    return {
      kind: FORGE_COPY_QUALITY_ARTIFACT_KIND,
      evaluatedAt: now.toISOString(),
      copyArtifactId: null,
      copyArtifactVersion: null,
      scores: { specificity: 0, brandFit: 0, conversion: 0, evidence: 0, readability: 0, repetition: 0 },
      highRiskClaims: [],
      exactEvidence: ["No approved copy document was available."],
      suggestedRevisions: ["Approve a copy document before running copy-quality evaluation."],
      humanReviewRequired: true,
      findings: [{
        severity: "critical",
        category: "missing_service_specificity",
        evidence: ["No approved copy document was available."],
        affectedArtifacts: [],
        affectedArtifactVersions: [],
        suggestedRevision: "Approve a copy document before running copy-quality evaluation.",
        humanReviewRequired: true,
        confidence: 1,
      }],
      sourceOfTruthArtifactIds: sourceOfTruth.map((artifact) => artifact.id),
      fabricatedFactsAllowed: false,
    }
  }

  const genericHits = GENERIC_PHRASES.filter((phrase) => copyText.includes(phrase))
  if (genericHits.length) add(finding("error", "generic_ai_language", copy, genericHits.map((phrase) => `Generic phrase: "${phrase}"`), "Replace generic phrasing with the exact service, audience problem, location, process step, or verified proof from the approved facts.", .94))

  const emptySuperlatives = unsupportedMatches(visibleText, EMPTY_SUPERLATIVES, truthText)
  if (emptySuperlatives.length) add(finding("warning", "empty_superlative", copy, emptySuperlatives.map((claim) => `Unproven superlative: "${claim}"`), "Remove the superlative or qualify it with approved evidence already present in research or intake.", .82))

  const highRiskClaims = unsupportedMatches(visibleText, HIGH_RISK_CLAIMS, truthText)
  if (highRiskClaims.length) add(finding("critical", "unsupported_claim", copy, highRiskClaims.map((claim) => `No approved source evidence found for high-risk claim "${claim}".`), "Remove the claim or request verified client evidence. Do not invent testimonials, statistics, accreditations, experience, or guarantees.", .9))

  const vagueCtas = [...new Set([...visibleText.matchAll(VAGUE_CTAS)].map((match) => match[0]))]
  if (vagueCtas.length) add(finding("warning", "vague_call_to_action", copy, vagueCtas.map((cta) => `Vague CTA: "${cta}"`), "Use a next-step CTA that names the action, such as requesting a quote, booking a survey, calling the team, joining Discord, or submitting a project brief.", .78))

  const geography = inferGeographicTerms(sourceOfTruth.filter((artifact) => artifact.type !== "copy_doc"))
  const localSeoMentions = countMatches(copyText, /\blocal\b|\blocal seo copy\b|service area|nearby|across|serving|based in/gi)
  if (geography.length && !geography.some((term) => copyText.includes(term.toLowerCase()))) add(finding("error", "missing_geographic_relevance", copy, [`Approved local terms not reflected in copy: ${geography.slice(0, 5).join(", ")}.`], "Add the approved location or service area naturally where it helps the buyer decide, especially on service and contact pages.", .84))
  if (!geography.length && localSeoMentions > 2) add(finding("warning", "unnatural_local_seo", copy, ["Copy contains repeated local SEO framing but no approved geographic source fact was found."], "Remove location filler or request the real service area before writing local SEO copy.", .78))

  const serviceTerms = [...new Set([...visibleText.matchAll(SERVICE_WORDS)].map((match) => match[0].toLowerCase()))]
  if (serviceTerms.length < 3) add(finding("error", "missing_service_specificity", copy, ["Fewer than three concrete service or offer terms were detected in the approved copy."], "Name the actual services, deliverables, or website actions from approved sitemap/research instead of broad capability language.", .82))

  const competitorGeneric = detectCompetitorGenericSentences(visibleText)
  if (competitorGeneric.length) add(finding("warning", "competitor_generic_phrase", copy, competitorGeneric, "Rewrite these lines so they include the approved business name, service, audience, local context, or process evidence.", .76))

  const repeated = repeatedSentences(visibleText)
  if (repeated.length) add(finding("warning", "excessive_repetition", copy, repeated.map((sentence) => `Repeated sentence: "${sentence}"`), "Consolidate repeated points and use each section for a distinct buyer question, proof point, or next step.", .86))

  const structures = repetitiveStructures(visibleText)
  if (structures.length) add(finding("warning", "repetitive_sentence_structure", copy, structures, "Vary sentence openings and sentence lengths; use concrete noun-led lines, proof-led lines, and direct instructions where appropriate.", .72))

  const emDashCount = (visibleText.match(/—/g) ?? []).length
  if (emDashCount > 3) add(finding("warning", "excessive_em_dash", copy, [`${emDashCount} em dashes detected.`], "Replace most em dashes with shorter sentences, commas, or bullets where the structure is clearer.", .9))

  const evidenceTerms = countMatches(copyText, /\b(?:review|testimonial|case stud|photo|portfolio|insured|certified|accredited|licensed|years|guarantee|warranty|example|proof|process)\b/gi)
  if (evidenceTerms < 2) add(finding("error", "weak_evidence", copy, ["Copy has little recognisable proof, process evidence, or trust evidence."], "Ask for real proof or move existing approved evidence closer to claims and CTAs. Do not fabricate proof.", .82))

  if (!OBJECTION_WORDS.test(visibleText)) add(finding("warning", "missing_objection", copy, ["No pricing, timing, process, availability, disruption, qualification, or after-enquiry objection handling was detected."], "Answer one or two likely buyer objections using only approved facts or safe process language.", .74))
  if (!/\b(?:call|quote|book|enquire|email|submit|join|register|buy|order|visit|send)\b/i.test(visibleText)) add(finding("error", "missing_next_step_clarity", copy, ["No clear action verb was found for the visitor's next step."], "Name the exact next action and what happens after the visitor takes it.", .84))

  const intro = firstLongParagraph(visibleText)
  if (intro && wordCount(intro) > 85) add(finding("warning", "overly_long_introduction", copy, [`Opening paragraph is ${wordCount(intro)} words.`], "Shorten the introduction and move proof, service detail, or process explanation into later sections.", .82))

  const stuffing = keywordStuffing(visibleText)
  if (stuffing.length) add(finding("warning", "keyword_stuffing", copy, stuffing, "Reduce repeated keyword variants and write for buyer clarity first; keep location and service phrases natural.", .8))

  const scores = scoreFindings(findings, { copyText, serviceTerms, geography, evidenceTerms })
  const exactEvidence = findings.flatMap((item) => item.evidence).slice(0, 20)
  const suggestedRevisions = [...new Set(findings.map((item) => item.suggestedRevision))].slice(0, 12)

  return {
    kind: FORGE_COPY_QUALITY_ARTIFACT_KIND,
    evaluatedAt: now.toISOString(),
    copyArtifactId: copy.id,
    copyArtifactVersion: copy.version,
    scores,
    highRiskClaims,
    exactEvidence,
    suggestedRevisions,
    humanReviewRequired: findings.some((finding) => finding.humanReviewRequired),
    findings: findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity)),
    sourceOfTruthArtifactIds: sourceOfTruth.map((artifact) => artifact.id),
    fabricatedFactsAllowed: false,
  }
}

function latestApprovedArtifacts(artifacts: ForgeConsistencyArtifactInput[]) {
  const current = artifacts.filter((artifact) => artifact.approvalState === "approved" && !artifact.supersededAt && artifact.type !== "copy_quality_report")
  return current.filter((artifact) => current.filter((candidate) => candidate.type === artifact.type && candidate.title === artifact.title).sort((a, b) => b.version - a.version)[0]?.id === artifact.id)
}

function finding(severity: ForgeCopyQualitySeverity, category: ForgeCopyQualityCategory, artifact: ForgeConsistencyArtifactInput, evidence: string[], suggestedRevision: string, confidence: number): Omit<ForgeCopyQualityFinding, "affectedArtifactVersions"> {
  return { severity, category, evidence, affectedArtifacts: [artifact.id], suggestedRevision, humanReviewRequired: severity === "error" || severity === "critical", confidence }
}

function searchable(artifact: ForgeConsistencyArtifactInput) {
  return `${artifact.content ?? ""} ${JSON.stringify(artifact.metadataJson ?? {})}`.toLowerCase()
}

function extractVisibleCopy(artifact: ForgeConsistencyArtifactInput) {
  const metadata = artifact.metadataJson ?? {}
  const approvedCopy = metadata.approvedCopy ?? metadata.copy
  return approvedCopy ? JSON.stringify(approvedCopy) : artifact.content ?? ""
}

function unsupportedMatches(text: string, pattern: RegExp, sourceText: string) {
  return [...new Set([...text.matchAll(pattern)].map((match) => match[0].trim()))]
    .filter((claim) => !sourceText.includes(claim.toLowerCase()))
    .slice(0, 20)
}

function inferGeographicTerms(artifacts: ForgeConsistencyArtifactInput[]) {
  const text = artifacts.map(searchable).join(" ")
  const labelled = [...text.matchAll(/\b(?:location|service area|serving|based in|address|town|city)\b[^a-z0-9]{0,12}([a-z][a-z .'-]{2,40})/gi)]
    .map((match) => match[1].trim().replace(/[.,;:].*$/, ""))
  return [...new Set(labelled.filter((term) => !/not provided|none|unknown/i.test(term)))].slice(0, 12)
}

function detectCompetitorGenericSentences(text: string) {
  return sentences(text).filter((sentence) =>
    sentence.length > 45 &&
    /\b(?:quality|reliable|professional|solutions|services|needs|help|team)\b/i.test(sentence) &&
    !/\b(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?|[A-Z]{2,})\b/.test(sentence) &&
    countMatches(sentence, SERVICE_WORDS) === 0,
  ).slice(0, 8).map((sentence) => `Could describe any competitor: "${sentence}"`)
}

function repeatedSentences(text: string) {
  const counts = new Map<string, number>()
  for (const sentence of sentences(text).map((item) => item.toLowerCase())) counts.set(sentence, (counts.get(sentence) ?? 0) + 1)
  return [...counts.entries()].filter(([, count]) => count > 1).map(([sentence]) => sentence).slice(0, 8)
}

function repetitiveStructures(text: string) {
  const starts = sentences(text).map((sentence) => sentence.split(/\s+/).slice(0, 3).join(" ").toLowerCase())
  const repeated = [...new Set(starts.filter((start) => start && starts.filter((item) => item === start).length >= 3))]
  return repeated.slice(0, 8).map((start) => `Three or more sentences begin with "${start}".`)
}

function keywordStuffing(text: string) {
  const words = text.toLowerCase().match(/\b[a-z][a-z-]{4,}\b/g) ?? []
  const ignored = new Set(["business", "customers", "service", "services", "copy", "section", "should", "where", "after", "before", "about"])
  const counts = new Map<string, number>()
  for (const word of words) if (!ignored.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1)
  const threshold = Math.max(8, Math.floor(words.length / 45))
  return [...counts.entries()].filter(([, count]) => count >= threshold).slice(0, 8).map(([word, count]) => `"${word}" appears ${count} times.`)
}

function firstLongParagraph(text: string) {
  return text.split(/\n{2,}|\\n|(?<=[.!?])\s+(?=[A-Z])/).map((item) => item.trim()).find((item) => item.length > 120) ?? null
}

function sentences(text: string) {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter((item) => item.length > 20)
}

function wordCount(text: string) {
  return (text.match(/\b[\w'-]+\b/g) ?? []).length
}

function countMatches(text: string, pattern: RegExp) {
  return [...text.matchAll(pattern)].length
}

function scoreFindings(findings: ForgeCopyQualityFinding[], context: { copyText: string; serviceTerms: string[]; geography: string[]; evidenceTerms: number }) {
  const penalty = (categories: ForgeCopyQualityCategory[]) => findings.filter((finding) => categories.includes(finding.category)).reduce((sum, finding) => sum + severityPenalty(finding.severity), 0)
  return {
    specificity: clamp(82 + Math.min(context.serviceTerms.length, 8) * 2 - penalty(["generic_ai_language", "missing_service_specificity", "competitor_generic_phrase"])),
    brandFit: clamp(78 - penalty(["generic_ai_language", "competitor_generic_phrase", "missing_geographic_relevance"])),
    conversion: clamp(80 - penalty(["vague_call_to_action", "missing_next_step_clarity", "missing_objection", "overly_long_introduction"])),
    evidence: clamp(70 + Math.min(context.evidenceTerms, 6) * 3 - penalty(["unsupported_claim", "weak_evidence", "empty_superlative"])),
    readability: clamp(86 - penalty(["excessive_em_dash", "overly_long_introduction", "repetitive_sentence_structure", "unnatural_local_seo"])),
    repetition: clamp(90 - penalty(["excessive_repetition", "keyword_stuffing", "repetitive_sentence_structure"])),
  }
}

function severityPenalty(severity: ForgeCopyQualitySeverity) {
  return ({ info: 4, warning: 9, error: 16, critical: 24 })[severity]
}

function severityRank(severity: ForgeCopyQualitySeverity) {
  return ({ info: 0, warning: 1, error: 2, critical: 3 })[severity]
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function readForgeCopyQualityReport(value: unknown): ForgeCopyQualityReport | null {
  if (!value || typeof value !== "object") return null
  const report = (value as Record<string, unknown>).report
  return report && typeof report === "object" && (report as Record<string, unknown>).kind === FORGE_COPY_QUALITY_ARTIFACT_KIND
    ? report as ForgeCopyQualityReport
    : null
}
