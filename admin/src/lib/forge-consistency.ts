export const FORGE_CONSISTENCY_ARTIFACT_TITLE = "Cross-artifact consistency report"
export const FORGE_CONSISTENCY_ARTIFACT_KIND = "forge_cross_artifact_consistency_v1"

export const FORGE_CONSISTENCY_SEVERITIES = ["info", "warning", "error", "critical"] as const
export type ForgeConsistencySeverity = (typeof FORGE_CONSISTENCY_SEVERITIES)[number]

export interface ForgeConsistencyArtifactInput {
  id: number
  type: string
  title: string
  version: number
  content: string | null
  metadataJson: Record<string, unknown> | null
  outputHash: string
  upstreamArtifactIds: number[]
  upstreamArtifactHashes: Record<string, string>
  qualityState: string
  approvalState: string
  supersededAt: Date | string | null
}

export interface ForgeConsistencyFinding {
  severity: ForgeConsistencySeverity
  category: string
  evidence: string[]
  affectedArtifacts: number[]
  affectedArtifactVersions: Array<{ artifactId: number; version: number }>
  recommendedCorrection: string
  automaticFixEligible: boolean
  humanReviewRequired: boolean
  confidence: number
  blocking: boolean
}

export interface ForgeConsistencyReport {
  kind: typeof FORGE_CONSISTENCY_ARTIFACT_KIND
  evaluatedAt: string
  artifactCount: number
  blocking: boolean
  findings: ForgeConsistencyFinding[]
  clientFactsModified: false
}

export function evaluateForgeArtifactConsistency(artifacts: ForgeConsistencyArtifactInput[], now = new Date()): ForgeConsistencyReport {
  const approved = latestApprovedArtifacts(artifacts)
  const findings: ForgeConsistencyFinding[] = []
  const add = (finding: Omit<ForgeConsistencyFinding, "affectedArtifactVersions">) => findings.push({
    ...finding,
    affectedArtifactVersions: finding.affectedArtifacts.map((artifactId) => ({
      artifactId,
      version: approved.find((artifact) => artifact.id === artifactId)?.version ?? artifacts.find((artifact) => artifact.id === artifactId)?.version ?? 0,
    })),
  })

  for (const artifact of approved) {
    if (["fallback", "degraded"].includes(artifact.qualityState)) add(baseFinding({
      severity: "critical", category: "unsafe_quality_dependency", artifacts: [artifact], blocking: true, confidence: 1,
      evidence: [`Approved ${artifact.type} v${artifact.version} has quality state ${artifact.qualityState}.`],
      correction: "Require explicit human approval with a recorded reason before downstream use or deployment.",
    }))
    for (const upstreamId of artifact.upstreamArtifactIds) {
      const upstream = artifacts.find((candidate) => candidate.id === upstreamId)
      const latest = upstream && latestByIdentity(artifacts, upstream)
      const recordedHash = artifact.upstreamArtifactHashes[String(upstreamId)]
      if (!upstream || !latest || latest.id !== upstream.id || (recordedHash && recordedHash !== upstream.outputHash)) add(baseFinding({
        severity: "critical", category: "obsolete_upstream", artifacts: [artifact, ...(upstream ? [upstream] : [])], blocking: true, confidence: 1,
        evidence: [`${artifact.type} v${artifact.version} depends on upstream artifact ${upstreamId}, which is missing, superseded, or hash-mismatched.`],
        correction: "Regenerate the downstream artifact from the latest approved upstream versions.",
      }))
    }
  }

  const copy = approved.find((item) => item.type === "copy_doc")
  const sitemap = approved.find((item) => item.type === "sitemap")
  const component = approved.find((item) => item.type === "component_spec")
  const seo = approved.find((item) => item.type === "seo_pack")
  const design = approved.find((item) => item.type === "design_direction")
  const research = approved.find((item) => item.type === "research_report" || item.type === "handover_doc")

  if (copy && sitemap) {
    const copyServices = labelledValues(copy, ["services", "service"])
    const sitemapText = searchable(sitemap)
    const missing = copyServices.filter((service) => service.length > 2 && !sitemapText.includes(service.toLowerCase()))
    if (missing.length) add(baseFinding({ severity: "error", category: "service_missing_from_sitemap", artifacts: [copy, sitemap], blocking: true, confidence: .82, evidence: missing.map((v) => `Copy references service '${v}', absent from the sitemap.`), correction: "Review the approved service list and add an appropriate sitemap destination or remove unsupported copy." }))
    detectConflictingFacts([copy, sitemap, ...(research ? [research] : [])], add)
    detectContradictoryCtas([copy, sitemap], add)
  }
  detectLabelledFactConflicts(approved, add)
  detectUnsupportedClaims(approved, research, add)
  detectToneInconsistency(approved, add)
  if (sitemap) detectSitemapPurposeAndLegal(sitemap, add)
  if (component && sitemap) detectMissingSections(component, sitemap, add)
  if (seo) detectDuplicateSeoIntent(seo, add)
  if (copy) detectTrustSignals(copy, add)
  if (design && research) detectBrandConflict(design, research, add)

  findings.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
  return { kind: FORGE_CONSISTENCY_ARTIFACT_KIND, evaluatedAt: now.toISOString(), artifactCount: approved.length, blocking: findings.some((finding) => finding.blocking), findings, clientFactsModified: false }
}

function latestApprovedArtifacts(artifacts: ForgeConsistencyArtifactInput[]) {
  const current = artifacts.filter((a) => a.approvalState === "approved" && !a.supersededAt && a.type !== "consistency_report")
  return current.filter((a) => latestByIdentity(current, a)?.id === a.id)
}
function latestByIdentity(artifacts: ForgeConsistencyArtifactInput[], artifact: ForgeConsistencyArtifactInput) { return artifacts.filter((a) => a.type === artifact.type && a.title === artifact.title).sort((a, b) => b.version - a.version)[0] }
function searchable(a: ForgeConsistencyArtifactInput) { return `${a.content ?? ""} ${JSON.stringify(a.metadataJson ?? {})}`.toLowerCase() }
function labelledValues(a: ForgeConsistencyArtifactInput, labels: string[]) { const text = searchable(a); return [...new Set(labels.flatMap((label) => [...text.matchAll(new RegExp(`(?:${label})[^a-z0-9]{0,8}([a-z][a-z &/-]{2,50})`, "gi"))].map((m) => m[1].trim().replace(/[.,;:].*$/, ""))))].slice(0, 20) }
function baseFinding(input: { severity: ForgeConsistencySeverity; category: string; artifacts: ForgeConsistencyArtifactInput[]; evidence: string[]; correction: string; blocking?: boolean; confidence: number }): Omit<ForgeConsistencyFinding, "affectedArtifactVersions"> { return { severity: input.severity, category: input.category, evidence: input.evidence, affectedArtifacts: input.artifacts.map((a) => a.id), recommendedCorrection: input.correction, automaticFixEligible: false, humanReviewRequired: true, confidence: input.confidence, blocking: input.blocking ?? false } }
function severityRank(v: ForgeConsistencySeverity) { return ({ info: 0, warning: 1, error: 2, critical: 3 })[v] }

function detectConflictingFacts(artifacts: ForgeConsistencyArtifactInput[], add: (f: Omit<ForgeConsistencyFinding, "affectedArtifactVersions">) => void) {
  const patterns = { phone: /(?:\+?44\s?|0)\d[\d ()-]{8,}/g, price: /(?:£|gbp\s?)\d[\d,.]*(?:\s*(?:per|\/)[a-z]+)?/gi }
  for (const [category, pattern] of Object.entries(patterns)) { const values = artifacts.flatMap((a) => [...searchable(a).matchAll(pattern)].map((m) => ({ value: m[0].replace(/\s+/g, " ").trim(), artifact: a }))); const unique = [...new Set(values.map((v) => v.value))]; if (unique.length > 1) add(baseFinding({ severity: "error", category: `conflicting_${category}`, artifacts: [...new Map(values.map((v) => [v.artifact.id, v.artifact])).values()], blocking: true, confidence: .9, evidence: unique.map((v) => `Conflicting ${category}: ${v}`), correction: `Confirm the approved ${category} and revise affected artifacts without changing the client fact automatically.` })) }
}
function detectLabelledFactConflicts(artifacts: ForgeConsistencyArtifactInput[], add: (f: Omit<ForgeConsistencyFinding, "affectedArtifactVersions">) => void) { for (const label of ["company name", "business name", "address"]) { const found = artifacts.flatMap((artifact) => [...searchable(artifact).matchAll(new RegExp(`${label}[^a-z0-9]{0,8}([a-z0-9][a-z0-9 ,.\u0027&/-]{3,100})`, "gi"))].map((match) => ({ value: match[1].trim().replace(/[;\n].*$/, ""), artifact }))); const unique = [...new Set(found.map(({ value }) => value))]; if (unique.length > 1) add(baseFinding({ severity: "error", category: `conflicting_${label.replaceAll(" ", "_")}`, artifacts: [...new Map(found.map(({ artifact }) => [artifact.id, artifact])).values()], blocking: true, confidence: .84, evidence: unique.map((value) => `${label}: ${value}`), correction: `Confirm the approved ${label}; do not alter the client fact automatically.` })) } }
function detectUnsupportedClaims(artifacts: ForgeConsistencyArtifactInput[], research: ForgeConsistencyArtifactInput | undefined, add: (f: Omit<ForgeConsistencyFinding, "affectedArtifactVersions">) => void) { const claimArtifacts = artifacts.filter((a) => ["copy_doc", "design_direction", "seo_pack"].includes(a.type)); const evidence = research ? searchable(research) : ""; const claims = claimArtifacts.flatMap((artifact) => [...searchable(artifact).matchAll(/(?:award[- ]winning|number one|#1|best in|guaranteed|\d+ years? experience|fully (?:insured|certified))/gi)].map((match) => ({ claim: match[0], artifact }))).filter(({ claim }) => !evidence.includes(claim)); if (claims.length) add(baseFinding({ severity: "error", category: "unsupported_claims", artifacts: [...new Map(claims.map(({ artifact }) => [artifact.id, artifact])).values()], blocking: true, confidence: .78, evidence: claims.map(({ claim }) => `No approved evidence found for claim '${claim}'.`), correction: "Request client evidence or remove the claim; never invent or automatically modify approved client facts." })) }
function detectToneInconsistency(artifacts: ForgeConsistencyArtifactInput[], add: (f: Omit<ForgeConsistencyFinding, "affectedArtifactVersions">) => void) { const formal = artifacts.filter((a) => /(professional|authoritative|formal|corporate)/.test(searchable(a))); const playful = artifacts.filter((a) => /(playful|cheeky|quirky|fun tone|super awesome|hey there)/.test(searchable(a))); if (formal.length && playful.length) add(baseFinding({ severity: "warning", category: "tone_inconsistency", artifacts: [...new Map([...formal, ...playful].map((a) => [a.id, a])).values()], confidence: .7, evidence: ["Approved artifacts contain both formal/authoritative and playful/cheeky tone signals."], correction: "Choose the approved tone strategy and align downstream copy and design direction." })) }
function detectContradictoryCtas(artifacts: ForgeConsistencyArtifactInput[], add: (f: Omit<ForgeConsistencyFinding, "affectedArtifactVersions">) => void) { const text = artifacts.map(searchable).join(" "); const intents = [["book", /book (?:a )?(?:call|consultation|survey)/], ["quote", /(?:get|request) (?:a )?(?:free )?quote/], ["buy", /(?:buy|shop|order) now/]].filter(([, p]) => (p as RegExp).test(text)); if (intents.length > 2) add(baseFinding({ severity: "warning", category: "contradictory_calls_to_action", artifacts, confidence: .7, evidence: [`Competing primary CTA intents detected: ${intents.map(([v]) => v).join(", ")}.`], correction: "Choose one primary conversion action and make other actions secondary." })) }
function detectSitemapPurposeAndLegal(a: ForgeConsistencyArtifactInput, add: (f: Omit<ForgeConsistencyFinding, "affectedArtifactVersions">) => void) { const text = searchable(a); const pages = [...text.matchAll(/(?:path|url|slug)[^a-z0-9/]{0,8}(\/[a-z0-9/_-]*)/g)].map((m) => m[1]); const vague = pages.filter((p) => !/(contact|quote|book|service|about|case|portfolio|product|pricing|home|privacy|terms|cookie)/.test(p)); if (vague.length) add(baseFinding({ severity: "warning", category: "unclear_page_conversion_purpose", artifacts: [a], confidence: .65, evidence: vague.map((p) => `No clear conversion purpose inferred for ${p}.`), correction: "Define a conversion or journey purpose for each page." })); if (!/(privacy|terms|cookie)/.test(text)) add(baseFinding({ severity: "warning", category: "missing_legal_pages", artifacts: [a], confidence: .8, evidence: ["No privacy, terms, or cookie page was found in the approved sitemap."], correction: "Review applicable legal requirements and add required policy pages." })) }
function detectMissingSections(c: ForgeConsistencyArtifactInput, s: ForgeConsistencyArtifactInput, add: (f: Omit<ForgeConsistencyFinding, "affectedArtifactVersions">) => void) { const paths = [...searchable(s).matchAll(/\/[a-z0-9/_-]+/g)].map((m) => m[0]); const missing = [...new Set(paths)].filter((p) => !searchable(c).includes(p)); if (missing.length) add(baseFinding({ severity: "error", category: "component_spec_missing_approved_sections", artifacts: [c, s], blocking: true, confidence: .85, evidence: missing.slice(0, 10).map((p) => `Approved sitemap path ${p} is absent from the component specification.`), correction: "Regenerate the component specification with all approved sitemap sections." })) }
function detectDuplicateSeoIntent(a: ForgeConsistencyArtifactInput, add: (f: Omit<ForgeConsistencyFinding, "affectedArtifactVersions">) => void) { const titles = [...searchable(a).matchAll(/(?:keyword|intent|title)[^a-z0-9]{0,8}([a-z][a-z0-9 -]{4,70})/g)].map((m) => m[1].trim()); const normalized = titles.map((t) => t.split(/\s+/).filter((w) => w.length > 3).sort().join(" ")); if (new Set(normalized).size < normalized.length) add(baseFinding({ severity: "warning", category: "duplicate_seo_intent", artifacts: [a], confidence: .75, evidence: ["Multiple SEO pages appear to target substantially identical normalized intent."], correction: "Consolidate cannibalising pages or differentiate their search intent." })) }
function detectTrustSignals(a: ForgeConsistencyArtifactInput, add: (f: Omit<ForgeConsistencyFinding, "affectedArtifactVersions">) => void) { if (!/(review|testimonial|accredit|guarantee|case stud|years? experience|insured|certif)/.test(searchable(a))) add(baseFinding({ severity: "warning", category: "missing_trust_signals", artifacts: [a], confidence: .78, evidence: ["Approved copy contains no recognisable trust signal."], correction: "Request verified trust evidence from the client and add only supported claims." })) }
function detectBrandConflict(d: ForgeConsistencyArtifactInput, r: ForgeConsistencyArtifactInput, add: (f: Omit<ForgeConsistencyFinding, "affectedArtifactVersions">) => void) { const pairs = [["premium", "budget"], ["playful", "corporate"], ["minimal", "maximal"]]; for (const [x, y] of pairs) if (searchable(d).includes(x) && searchable(r).includes(y)) add(baseFinding({ severity: "warning", category: "design_brand_strategy_conflict", artifacts: [d, r], confidence: .68, evidence: [`Design direction '${x}' conflicts with approved strategy language '${y}'.`], correction: "Reconcile the design direction with the approved brand strategy." })) }

export function readForgeConsistencyReport(value: unknown): ForgeConsistencyReport | null { if (!value || typeof value !== "object") return null; const report = (value as Record<string, unknown>).report; return report && typeof report === "object" && (report as Record<string, unknown>).kind === FORGE_CONSISTENCY_ARTIFACT_KIND ? report as ForgeConsistencyReport : null }
