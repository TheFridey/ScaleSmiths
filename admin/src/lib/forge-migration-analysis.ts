import type { ForgeSiteInventory, ForgeSiteInventoryPage } from "./forge-site-inventory"

export const FORGE_MIGRATION_ANALYSIS_ARTIFACT_TITLE = "Migration Analysis and Redirect Plan"
export const FORGE_MIGRATION_ANALYSIS_ARTIFACT_KIND = "forge_migration_analysis_v1"

export type ForgeMigrationConfidence = "low" | "medium" | "high"
export type ForgeMigrationSeverity = "info" | "warning" | "critical"
export interface ForgeMigrationRecommendation {
  id: string
  category: string
  severity: ForgeMigrationSeverity
  evidence: string[]
  confidence: ForgeMigrationConfidence
  sourceUrl: string
  proposedAction: string
  humanReviewRequired: true
}
export interface ForgeMigrationPagePlan extends ForgeMigrationRecommendation {
  proposedUrl: string
  rationale: string
}
export interface ForgeRedirectPlanItem extends ForgeMigrationRecommendation {
  oldUrl: string
  newUrl: string
  redirectType: 301
  status: "proposed"
}
export interface ForgeMigrationAnalysis {
  kind: typeof FORGE_MIGRATION_ANALYSIS_ARTIFACT_KIND
  generatedAt: string
  sourceInventory: { startUrl: string; completedAt: string; pageCount: number }
  existingSitemap: Array<{ url: string; status: number; title: string; depth: number; internalLinks: string[] }>
  duplicateContent: ForgeMigrationRecommendation[]
  thinContent: ForgeMigrationRecommendation[]
  brokenLinks: ForgeMigrationRecommendation[]
  staleContentCandidates: ForgeMigrationRecommendation[]
  currentServiceHierarchy: Array<{ parentUrl: string; serviceUrls: string[]; evidence: string[] }>
  geographicTargeting: ForgeMigrationRecommendation[]
  seoMetadataGaps: ForgeMigrationRecommendation[]
  missingTrustSignals: ForgeMigrationRecommendation[]
  assetInventory: Array<{ sourceUrl: string; assetUrl: string; alt: string; usedByPages: string[] }>
  contactDataConflicts: ForgeMigrationRecommendation[]
  proposedNewSitemap: ForgeMigrationPagePlan[]
  oldToNewPageMapping: Array<{ oldUrl: string; newUrl: string; disposition: "retain" | "consolidate" | "verify"; evidence: string[]; confidence: ForgeMigrationConfidence; sourceUrl: string; proposedAction: string; humanReviewRequired: true }>
  redirectPlan: ForgeRedirectPlanItem[]
  contentMigrationPlan: ForgeMigrationRecommendation[]
  requiresClientVerification: ForgeMigrationRecommendation[]
  highValuePages: ForgeMigrationRecommendation[]
  rankingRisks: ForgeMigrationRecommendation[]
  safeguards: { automaticChangesApplied: false; destructiveActionsApplied: false; requiresHumanApproval: true }
  summary: { findings: number; proposedPages: number; proposedRedirects: number; criticalRisks: number }
}

export function evaluateForgeMigrationInventory(inventory: ForgeSiteInventory, now = new Date()): ForgeMigrationAnalysis {
  const pages = inventory.pages
  let sequence = 0
  const recommendation = (category: string, page: ForgeSiteInventoryPage, evidence: string[], proposedAction: string, confidence: ForgeMigrationConfidence = "medium", severity: ForgeMigrationSeverity = "warning"): ForgeMigrationRecommendation => ({ id: `migration-${++sequence}`, category, severity, evidence, confidence, sourceUrl: page.finalUrl, proposedAction, humanReviewRequired: true })
  const duplicateContent: ForgeMigrationRecommendation[] = []
  const thinContent: ForgeMigrationRecommendation[] = []
  const brokenLinks: ForgeMigrationRecommendation[] = []
  const staleContentCandidates: ForgeMigrationRecommendation[] = []
  const geographicTargeting: ForgeMigrationRecommendation[] = []
  const seoMetadataGaps: ForgeMigrationRecommendation[] = []
  const missingTrustSignals: ForgeMigrationRecommendation[] = []
  const contactDataConflicts: ForgeMigrationRecommendation[] = []
  const requiresClientVerification: ForgeMigrationRecommendation[] = []
  const highValuePages: ForgeMigrationRecommendation[] = []
  const rankingRisks: ForgeMigrationRecommendation[] = []
  const contentMigrationPlan: ForgeMigrationRecommendation[] = []

  const contentGroups = new Map<string, ForgeSiteInventoryPage[]>()
  for (const page of pages) {
    const normalized = normalizeCopy(page.mainContent)
    if (normalized.length >= 120) contentGroups.set(normalized, [...(contentGroups.get(normalized) ?? []), page])
    if (wordCount(page.mainContent) < 150) thinContent.push(recommendation("thin_content", page, [`Only ${wordCount(page.mainContent)} visible words were inventoried.`], "Review whether to expand, consolidate, retain for utility, or retire this page after traffic and backlink checks.", "high"))
    if (!page.title || !page.metaDescription || !page.canonicalUrl) {
      const missing = [!page.title && "title", !page.metaDescription && "meta description", !page.canonicalUrl && "canonical tag"].filter(Boolean)
      seoMetadataGaps.push(recommendation("seo_metadata_gap", page, [`Missing ${missing.join(", ")}.`], "Draft metadata only after the target page purpose and approved facts are confirmed.", "high"))
    }
    if (/(20\d{2}|latest|current|new for)/i.test(page.mainContent)) staleContentCandidates.push(recommendation("stale_content_candidate", page, [excerpt(page.mainContent.match(/.{0,50}(?:20\d{2}|latest|current|new for).{0,80}/i)?.[0] ?? page.mainContent)], "Ask the client to confirm whether time-sensitive statements remain current before migration.", "medium"))
    const path = new URL(page.finalUrl).pathname
    if (/service|solution|product|treatment|repair|install/i.test(`${path} ${page.title} ${page.headings.map((item) => item.text).join(" ")}`)) highValuePages.push(recommendation("high_value_service_page", page, [page.title || path, `${page.internalLinks.length} internal link(s) recorded.`], "Preserve the page intent and verify analytics, rankings, backlinks, enquiries, and target queries before changing its URL.", "medium", "critical"))
    contentMigrationPlan.push(recommendation("content_migration", page, [`HTTP ${page.status}; ${wordCount(page.mainContent)} words; ${page.images.length} images.`], "Review and classify the page content as retain, revise, consolidate, archive, or client-verification required.", "high", "info"))
  }
  for (const group of contentGroups.values()) if (group.length > 1) for (const page of group) duplicateContent.push(recommendation("duplicate_content", page, [`Content substantially matches: ${group.filter((item) => item.finalUrl !== page.finalUrl).map((item) => item.finalUrl).join(", ")}`], "Choose a canonical target and consider consolidation only after ranking, backlink, and conversion evidence is reviewed.", "high"))

  const fetchedByUrl = new Map(pages.map((page) => [canonical(page.finalUrl), page]))
  for (const page of pages) for (const link of page.internalLinks) {
    const target = fetchedByUrl.get(canonical(link))
    if (target && target.status >= 400) brokenLinks.push(recommendation("broken_internal_link", page, [`${link} returned HTTP ${target.status}.`], "Correct the source link and decide the target URL; create a redirect only after approval.", "high"))
  }
  for (const failure of inventory.failures.filter((item) => item.category === "fetch_failure" || item.category === "redirect")) {
    const source = pages.find((page) => page.internalLinks.some((link) => canonical(link) === canonical(failure.url)))
    if (source) brokenLinks.push(recommendation("unverified_internal_link", source, [`${failure.url} could not be verified: ${failure.message}`], "Recheck the URL manually before classifying it as broken or proposing a redirect.", "low", "info"))
  }

  const locations = collectLocationSignals(pages)
  for (const [location, sources] of locations) geographicTargeting.push(recommendation("geographic_targeting", sources[0], [`Location signal '${location}' appears on ${sources.length} page(s).`], "Confirm the service area and whether this location warrants a distinct useful landing page.", "medium", "info"))
  const trustPattern = /review|testimonial|accredit|certif|award|guarantee|case stud|years? (?:of )?experience|insured/i
  for (const page of pages.filter((item) => /service|about|home|^\/$/i.test(`${item.title} ${new URL(item.finalUrl).pathname}`) && !trustPattern.test(item.mainContent))) missingTrustSignals.push(recommendation("missing_trust_signal", page, ["No obvious review, accreditation, certification, award, guarantee, case study, insurance, or experience evidence was detected."], "Ask the client which verifiable trust evidence may be published; do not invent proof.", "medium"))

  const contactValues = new Map<string, Set<string>>()
  for (const page of pages) for (const [kind, values] of Object.entries(page.contactDetails)) for (const value of values) contactValues.set(kind, new Set([...(contactValues.get(kind) ?? []), value]))
  for (const [kind, values] of contactValues) if (values.size > 1) {
    const source = pages.find((page) => page.contactDetails[kind as keyof typeof page.contactDetails].length) ?? pages[0]
    if (source) {
      const finding = recommendation("contact_data_conflict", source, [`Conflicting ${kind}: ${[...values].join(" | ")}`], `Ask the client to identify the authoritative ${kind} before copy, schema, forms, or redirects are approved.`, "high", "critical")
      contactDataConflicts.push(finding); requiresClientVerification.push(finding)
    }
  }
  for (const page of staleContentCandidates) requiresClientVerification.push({ ...page, id: `migration-${++sequence}`, category: "client_verification" })

  const currentServiceHierarchy = pages.filter(isServicePage).map((page) => ({ parentUrl: page.finalUrl, serviceUrls: page.internalLinks.filter((link) => pages.some((candidate) => canonical(candidate.finalUrl) === canonical(link) && isServicePage(candidate))), evidence: [page.title, ...page.headings.slice(0, 3).map((item) => item.text)].filter(Boolean) }))
  const proposedNewSitemap: ForgeMigrationPagePlan[] = pages.filter((page) => page.status < 400).map((page) => ({ ...recommendation("proposed_sitemap_page", page, [page.title || new URL(page.finalUrl).pathname, `${wordCount(page.mainContent)} inventoried words.`], "Retain this page intent provisionally; review quality, demand, overlap, and conversion purpose before approving the sitemap.", "medium", "info"), proposedUrl: normalizedPath(page.finalUrl), rationale: "Conservative like-for-like proposal designed to avoid losing existing intent before evidence review." }))
  const oldToNewPageMapping = pages.map((page) => ({ oldUrl: page.finalUrl, newUrl: normalizedPath(page.finalUrl), disposition: page.status >= 400 ? "verify" as const : "retain" as const, evidence: [`HTTP ${page.status}`, page.title || "No title"], confidence: page.status >= 400 ? "low" as const : "medium" as const, sourceUrl: page.finalUrl, proposedAction: page.status >= 400 ? "Verify whether this URL has a valid replacement before any redirect is created." : "Retain provisionally and validate against analytics, backlinks, rankings, and the approved new sitemap.", humanReviewRequired: true as const }))
  const redirectPlan: ForgeRedirectPlanItem[] = oldToNewPageMapping.filter((item) => new URL(item.oldUrl).pathname !== item.newUrl).map((item) => ({ ...recommendation("redirect_plan", pages.find((page) => page.finalUrl === item.oldUrl)!, item.evidence, "Approve a permanent redirect only after confirming target equivalence and ranking evidence.", item.confidence, "critical"), oldUrl: item.oldUrl, newUrl: item.newUrl, redirectType: 301, status: "proposed" }))
  if (!redirectPlan.length && pages[0]) rankingRisks.push(recommendation("ranking_risk", pages[0], ["No URL changes are currently proposed, but crawl evidence does not include analytics, Search Console, backlink, or ranking data."], "Import and review performance evidence before approving the final sitemap or redirect plan.", "high", "critical"))
  for (const page of highValuePages) rankingRisks.push({ ...page, id: `migration-${++sequence}`, category: "ranking_risk", proposedAction: "Do not remove, consolidate, or redirect this likely commercial page until traffic, conversions, backlinks, rankings, and intent equivalence are reviewed." })

  const assetMap = new Map<string, { sourceUrl: string; assetUrl: string; alt: string; usedByPages: string[] }>()
  for (const page of pages) for (const image of page.images) { const current = assetMap.get(image.src); if (current) current.usedByPages.push(page.finalUrl); else assetMap.set(image.src, { sourceUrl: page.finalUrl, assetUrl: image.src, alt: image.alt, usedByPages: [page.finalUrl] }) }
  const allFindings = [duplicateContent, thinContent, brokenLinks, staleContentCandidates, geographicTargeting, seoMetadataGaps, missingTrustSignals, contactDataConflicts, contentMigrationPlan, requiresClientVerification, highValuePages, rankingRisks].flat()
  return { kind: FORGE_MIGRATION_ANALYSIS_ARTIFACT_KIND, generatedAt: now.toISOString(), sourceInventory: { startUrl: inventory.startUrl, completedAt: inventory.completedAt, pageCount: pages.length }, existingSitemap: pages.map((page) => ({ url: page.finalUrl, status: page.status, title: page.title, depth: page.depth, internalLinks: page.internalLinks })), duplicateContent, thinContent, brokenLinks, staleContentCandidates, currentServiceHierarchy, geographicTargeting, seoMetadataGaps, missingTrustSignals, assetInventory: [...assetMap.values()], contactDataConflicts, proposedNewSitemap, oldToNewPageMapping, redirectPlan, contentMigrationPlan, requiresClientVerification, highValuePages, rankingRisks, safeguards: { automaticChangesApplied: false, destructiveActionsApplied: false, requiresHumanApproval: true }, summary: { findings: allFindings.length, proposedPages: proposedNewSitemap.length, proposedRedirects: redirectPlan.length, criticalRisks: allFindings.filter((item) => item.severity === "critical").length } }
}

export function readForgeMigrationAnalysis(value: unknown): ForgeMigrationAnalysis | null { if (!value || typeof value !== "object") return null; const report = value as Partial<ForgeMigrationAnalysis>; return report.kind === FORGE_MIGRATION_ANALYSIS_ARTIFACT_KIND && Array.isArray(report.existingSitemap) ? report as ForgeMigrationAnalysis : null }
function wordCount(value: string) { return value.trim() ? value.trim().split(/\s+/).length : 0 }
function normalizeCopy(value: string) { return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim() }
function canonical(value: string) { try { const url = new URL(value); url.hash = ""; if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, ""); return url.toString() } catch { return value } }
function normalizedPath(value: string) { const url = new URL(value); const path = url.pathname.toLowerCase().replace(/\.(?:html?|php)$/i, "").replace(/\/{2,}/g, "/").replace(/\/$/, ""); return path || "/" }
function excerpt(value: string) { return value.replace(/\s+/g, " ").trim().slice(0, 240) }
function isServicePage(page: ForgeSiteInventoryPage) { return /service|solution|product|treatment|repair|install/i.test(`${new URL(page.finalUrl).pathname} ${page.title} ${page.headings.map((item) => item.text).join(" ")}`) }
function collectLocationSignals(pages: ForgeSiteInventoryPage[]) { const result = new Map<string, ForgeSiteInventoryPage[]>(); const pattern = /\b(?:in|across|near|serving)\s+([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){0,2})\b/g; for (const page of pages) for (const match of page.mainContent.matchAll(pattern)) result.set(match[1], [...(result.get(match[1]) ?? []), page]); return result }
