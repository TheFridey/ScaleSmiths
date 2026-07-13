import { createHash } from "node:crypto"
import type { ForgeMigrationAnalysis } from "./forge-migration-analysis"
import type { ForgeSiteInventory } from "./forge-site-inventory"

export const FORGE_MIGRATION_CANDIDATE_TITLE = "Migration Deployment Candidate"
export const FORGE_MIGRATION_CANDIDATE_KIND = "forge_migration_candidate_v1"
export type ForgeMigrationContentOrigin = "migrated" | "rewritten" | "newly_generated"
export interface ForgeMigrationApproval { actor: string; reason: string; at: string }
export interface ForgeMigrationCandidate {
  kind: typeof FORGE_MIGRATION_CANDIDATE_KIND
  candidateId: string
  createdAt: string
  mappingHash: string
  mappings: ReadonlyArray<{ oldUrl: string; newUrl: string; disposition: "retain" | "consolidate" | "verify" }>
  content: Array<{ targetUrl: string; origin: ForgeMigrationContentOrigin; sourceUrls: string[]; sourceEvidence: string; authoritativeFactsPreserved: boolean }>
  unsupportedClaims: Array<{ claim: string; sourceUrl: string; evidence: string; blocking: true }>
  redirectConfiguration: { format: "nginx"; status: "draft"; content: string; exportApproved: boolean }
  validation: {
    internalLinks: ChecklistResult
    canonicalTags: ChecklistResult
    metadata: ChecklistResult
    orphanedOldUrls: ChecklistResult
    assets: ChecklistResult & { tracked: Array<{ sourceUrl: string; assetUrl: string; targetStatus: "pending" }> }
    redirects: ChecklistResult & { chains: string[][]; loops: string[][] }
  }
  conflicts: Array<{ category: string; evidence: string[]; sourceUrl: string; blocking: true }>
  approvals: { redirectExport: ForgeMigrationApproval | null; deployment: ForgeMigrationApproval | null }
  rollbackOfCandidateId: string | null
  sourceArtifactIds: number[]
  finalReport: { readyForRedirectApproval: boolean; readyForDeploymentApproval: boolean; blockers: string[]; preservedHighValueUrls: string[] }
  checklist: Array<{ key: string; status: "passed" | "failed" | "pending"; evidence: string; blocking: boolean }>
  safeguards: { mappingsImmutable: true; automaticRedirectExport: false; automaticDeployment: false; destructiveChangesApplied: false }
}
interface ChecklistResult { status: "passed" | "failed" | "pending"; evidence: string[] }

export function createForgeMigrationCandidate(input: { analysis: ForgeMigrationAnalysis; inventory: ForgeSiteInventory; sourceArtifactIds: number[]; approvedCopyRoutes?: string[]; approvedFactText?: string; now?: Date; rollbackOfCandidateId?: string | null }): ForgeMigrationCandidate {
  const now = input.now ?? new Date()
  const mappings = input.analysis.oldToNewPageMapping.map(({ oldUrl, newUrl, disposition }) => ({ oldUrl, newUrl, disposition }))
  const mappingHash = hash(mappings)
  const candidateId = `migration-${now.toISOString().replace(/\D/g, "").slice(0, 14)}-${mappingHash.slice(0, 10)}`
  const approvedRoutes = new Set((input.approvedCopyRoutes ?? []).map(normalizePath))
  const mappedTargets = new Set(mappings.map((item) => normalizePath(item.newUrl)))
  const content = input.analysis.proposedNewSitemap.map((item) => {
    const target = normalizePath(item.proposedUrl)
    const sources = mappings.filter((mapping) => normalizePath(mapping.newUrl) === target).map((mapping) => mapping.oldUrl)
    const origin: ForgeMigrationContentOrigin = approvedRoutes.has(target) ? "rewritten" : sources.length ? "migrated" : "newly_generated"
    return { targetUrl: target, origin, sourceUrls: sources, sourceEvidence: sources.length ? `Mapped from ${sources.join(", ")}.` : "No old URL maps to this approved proposed page.", authoritativeFactsPreserved: Boolean(input.approvedFactText?.trim()) }
  })
  const unsupportedClaims = detectUnsupportedClaims(input.inventory, input.approvedFactText ?? "")
  const conflicts = input.analysis.contactDataConflicts.map((item) => ({ category: "contact_data", evidence: item.evidence, sourceUrl: item.sourceUrl, blocking: true as const }))
  for (const item of input.analysis.requiresClientVerification.filter((finding) => /business.fact|contact/i.test(`${finding.category} ${finding.proposedAction}`))) conflicts.push({ category: "business_fact", evidence: item.evidence, sourceUrl: item.sourceUrl, blocking: true })
  const redirectValidation = validateRedirectMappings(mappings)
  const orphaned = input.inventory.pages.filter((page) => !mappings.some((mapping) => sameUrl(mapping.oldUrl, page.finalUrl))).map((page) => page.finalUrl)
  const brokenLinks = input.inventory.pages.flatMap((page) => page.internalLinks.filter((link) => { const mapped = mappings.find((mapping) => sameUrl(mapping.oldUrl, link)); return mapped ? !mappedTargets.has(normalizePath(mapped.newUrl)) : false }))
  const canonicalGaps = input.inventory.pages.filter((page) => !page.canonicalUrl).map((page) => page.finalUrl)
  const metadataGaps = input.inventory.pages.filter((page) => !page.title || !page.metaDescription).map((page) => page.finalUrl)
  const assets = input.analysis.assetInventory.map((asset) => ({ sourceUrl: asset.sourceUrl, assetUrl: asset.assetUrl, targetStatus: "pending" as const }))
  const blockers = [...conflicts.map((item) => `Unresolved ${item.category} conflict at ${item.sourceUrl}.`), ...unsupportedClaims.map((item) => `Unsupported claim at ${item.sourceUrl}: ${item.claim}`), ...redirectValidation.loops.map((loop) => `Redirect loop: ${loop.join(" -> ")}`), ...redirectValidation.chains.map((chain) => `Redirect chain: ${chain.join(" -> ")}`), ...orphaned.map((url) => `Orphaned old URL: ${url}`)]
  const validation = {
    internalLinks: result(brokenLinks, "All mapped internal-link targets resolve to candidate pages."),
    canonicalTags: result(canonicalGaps, "All inventoried pages supplied canonical evidence."),
    metadata: result(metadataGaps, "All inventoried pages supplied title and description evidence."),
    orphanedOldUrls: result(orphaned, "Every inventoried old URL has a frozen candidate mapping."),
    assets: { ...result(assets.map((item) => item.assetUrl), assets.length ? "Asset migration remains pending until copied and hash-verified." : "No crawl assets require migration."), status: assets.length ? "pending" as const : "passed" as const, tracked: assets },
    redirects: { status: redirectValidation.chains.length || redirectValidation.loops.length ? "failed" as const : "passed" as const, evidence: redirectValidation.chains.length || redirectValidation.loops.length ? ["Redirect chains or loops require correction."] : ["No redirect chains or loops detected."], chains: redirectValidation.chains, loops: redirectValidation.loops },
  }
  const checklist = [
    check("conflicts_resolved", conflicts.length ? "failed" : "passed", conflicts.length ? `${conflicts.length} authoritative-data conflict(s) remain.` : "No unresolved contact or business-fact conflicts detected.", true),
    check("unsupported_claims", unsupportedClaims.length ? "failed" : "passed", unsupportedClaims.length ? `${unsupportedClaims.length} unsupported claim(s) require verification.` : "No unsupported high-risk claims detected against approved fact text.", true),
    check("redirect_integrity", validation.redirects.status, validation.redirects.evidence.join(" "), true),
    check("old_url_coverage", validation.orphanedOldUrls.status, validation.orphanedOldUrls.evidence.join(" "), true),
    check("internal_links", validation.internalLinks.status, validation.internalLinks.evidence.join(" "), true),
    check("canonical_tags", validation.canonicalTags.status, validation.canonicalTags.evidence.join(" "), false),
    check("metadata", validation.metadata.status, validation.metadata.evidence.join(" "), false),
    check("asset_migration", validation.assets.status, validation.assets.evidence.join(" "), true),
    check("redirect_export_approval", "pending", "An authorised human must approve redirect export.", true),
    check("deployment_approval", "pending", "An authorised human must separately approve deployment.", true),
  ]
  return { kind: FORGE_MIGRATION_CANDIDATE_KIND, candidateId, createdAt: now.toISOString(), mappingHash, mappings: Object.freeze(mappings.map((mapping) => Object.freeze(mapping))), content, unsupportedClaims, redirectConfiguration: { format: "nginx", status: "draft", content: buildNginxRedirects(mappings), exportApproved: false }, validation, conflicts, approvals: { redirectExport: null, deployment: null }, rollbackOfCandidateId: input.rollbackOfCandidateId ?? null, sourceArtifactIds: input.sourceArtifactIds, finalReport: { readyForRedirectApproval: blockers.length === 0 && checklist.filter((item) => item.blocking && !["redirect_export_approval", "deployment_approval"].includes(item.key)).every((item) => item.status === "passed"), readyForDeploymentApproval: false, blockers, preservedHighValueUrls: input.analysis.highValuePages.map((item) => item.sourceUrl) }, checklist, safeguards: { mappingsImmutable: true, automaticRedirectExport: false, automaticDeployment: false, destructiveChangesApplied: false } }
}

export function approveForgeMigrationCandidate(candidate: ForgeMigrationCandidate, action: "redirect_export" | "deployment", approval: ForgeMigrationApproval): ForgeMigrationCandidate {
  if (hash(candidate.mappings) !== candidate.mappingHash) throw new Error("Migration mappings changed after candidate creation.")
  if (candidate.finalReport.blockers.length) throw new Error("Migration blockers must be resolved before approval.")
  if (action === "deployment" && !candidate.approvals.redirectExport) throw new Error("Redirect export must be approved before deployment approval.")
  const approvals = { ...candidate.approvals, [action === "redirect_export" ? "redirectExport" : "deployment"]: approval }
  const checklist = candidate.checklist.map((item) => item.key === `${action}_approval` ? { ...item, status: "passed" as const, evidence: `Approved by ${approval.actor}: ${approval.reason}` } : item)
  return { ...candidate, approvals, checklist, redirectConfiguration: action === "redirect_export" ? { ...candidate.redirectConfiguration, exportApproved: true } : candidate.redirectConfiguration, finalReport: { ...candidate.finalReport, readyForDeploymentApproval: Boolean(approvals.redirectExport) && checklist.filter((item) => item.blocking && item.key !== "deployment_approval").every((item) => item.status === "passed") } }
}

export function readForgeMigrationCandidate(value: unknown): ForgeMigrationCandidate | null { if (!value || typeof value !== "object") return null; const candidate = value as Partial<ForgeMigrationCandidate>; return candidate.kind === FORGE_MIGRATION_CANDIDATE_KIND && Array.isArray(candidate.mappings) && typeof candidate.mappingHash === "string" ? candidate as ForgeMigrationCandidate : null }
export function validateRedirectMappings(mappings: ReadonlyArray<{ oldUrl: string; newUrl: string }>) { const edges = new Map(mappings.map((item) => [normalizePath(item.oldUrl), normalizePath(item.newUrl)])); const chains: string[][] = []; const loops: string[][] = []; for (const start of edges.keys()) { const path = [start]; let current = start; let looped = false; const seen = new Set([start]); while (edges.has(current)) { const next = edges.get(current)!; path.push(next); if (seen.has(next)) { loops.push(path); looped = true; break } seen.add(next); if (!edges.has(next)) break; current = next } if (path.length > 2 && !looped) chains.push(path) } return { chains: dedupePaths(chains), loops: dedupePaths(loops) } }
function detectUnsupportedClaims(inventory: ForgeSiteInventory, facts: string) { const normalizedFacts = facts.toLowerCase(); const pattern = /\b(?:\d+\s*years?|certified|accredited|award[- ]winning|guaranteed|number one|#1|fully insured)\b/i; return inventory.pages.flatMap((page) => page.mainContent.split(/(?<=[.!?])\s+/).filter((sentence) => pattern.test(sentence) && !normalizedFacts.includes(sentence.toLowerCase().slice(0, 80))).map((sentence) => ({ claim: sentence.trim().slice(0, 300), sourceUrl: page.finalUrl, evidence: "High-risk claim appears in migrated source but was not found in the approved fact corpus.", blocking: true as const }))) }
function buildNginxRedirects(mappings: ReadonlyArray<{ oldUrl: string; newUrl: string }>) { return mappings.filter((item) => normalizePath(item.oldUrl) !== normalizePath(item.newUrl)).map((item) => `location = ${normalizePath(item.oldUrl)} { return 301 ${normalizePath(item.newUrl)}; }`).join("\n") }
function result(failures: string[], success: string): ChecklistResult { return failures.length ? { status: "failed", evidence: failures.slice(0, 100) } : { status: "passed", evidence: [success] } }
function check(key: string, status: "passed" | "failed" | "pending", evidence: string, blocking: boolean) { return { key, status, evidence, blocking } }
function normalizePath(value: string) { try { const path = new URL(value, "https://candidate.invalid").pathname; return (path.replace(/\/$/, "") || "/").toLowerCase() } catch { return value } }
function sameUrl(a: string, b: string) { return normalizePath(a) === normalizePath(b) }
function hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex") }
function dedupePaths(paths: string[][]) { const seen = new Set<string>(); return paths.filter((path) => { const key = [...path].sort().join("|"); if (seen.has(key)) return false; seen.add(key); return true }) }
