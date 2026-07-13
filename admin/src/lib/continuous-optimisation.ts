import type { WebsiteOutcomeEvaluation, WebsiteOutcomeEvidence, WebsiteOutcomeFinding } from "./website-outcome-evaluator"

export type OptimisationProposalStatus = "proposed" | "accepted" | "rejected" | "completed" | "measured"
export type OptimisationConfidence = "high" | "medium" | "low"
export type OptimisationRisk = "low" | "medium" | "high"

export interface ContinuousOptimisationProposal {
  key: string
  title: string
  evidence: WebsiteOutcomeEvidence[]
  expectedImpact: string
  confidence: OptimisationConfidence
  estimatedEffort: string
  risk: OptimisationRisk
  proposedChange: string
  validationMethod: string
  rollbackPlan: string
  requiredApproval: string
  relevantPages: string[]
  relevantArtifacts: Array<{ artifactId?: number; type: string; title: string; version?: number }>
  targetMetric: string
  baselineValue: number | null
}

export interface StoredOptimisationProposal extends ContinuousOptimisationProposal {
  id: number
  status: OptimisationProposalStatus
  measuredValue: number | null
  improved: boolean | null
  outcomeNotes: string | null
  decidedBy: string | null
  decidedAt: string | null
  measuredAt: string | null
}

export function buildContinuousOptimisationProposals(input: {
  clientId: number
  clientName: string
  isRetainerClient: boolean
  outcome: WebsiteOutcomeEvaluation
}): ContinuousOptimisationProposal[] {
  if (!input.isRetainerClient) return []
  const proposals: ContinuousOptimisationProposal[] = []
  const findings = [
    ...input.outcome.suggestedImprovements,
    ...input.outcome.hypotheses,
    ...input.outcome.recommendedInvestigations.filter((finding) => finding.category === "data_quality"),
  ]
  for (const finding of findings) {
    const proposal = proposalFromFinding(input.clientId, finding)
    if (proposal) proposals.push(proposal)
  }
  return uniqueByKey(proposals).slice(0, 8)
}

export function didProposalImproveMetric(input: { baselineValue: number | null; measuredValue: number | null; targetMetric: string }) {
  if (input.baselineValue === null || input.measuredValue === null) return null
  if (/error|failure|lcp|inp|cls/i.test(input.targetMetric)) return input.measuredValue < input.baselineValue
  return input.measuredValue > input.baselineValue
}

function proposalFromFinding(clientId: number, finding: WebsiteOutcomeFinding): ContinuousOptimisationProposal | null {
  if (finding.category === "cta_performance" || finding.category === "form_completion" || finding.category === "actual_conversions") {
    return base({
      clientId,
      key: "improve-cta-conversion",
      title: "Improve a weak CTA or enquiry path",
      finding,
      expectedImpact: "Increase the proportion of visitors who take the intended enquiry action.",
      confidence: finding.confidence,
      estimatedEffort: "2-4 hours",
      risk: "medium",
      proposedChange: "Review the primary CTA, hero promise, form friction and contact route. Draft a small copy/layout change for approval before implementation.",
      validationMethod: "Compare conversion events, form submissions, phone clicks and CTA clicks over an agreed post-change window.",
      rollbackPlan: "Keep the current copy/layout version and revert the changed section if conversion quality or volume drops.",
      targetMetric: "conversionEvents",
      baselineValue: numberFromEvidence(finding),
    })
  }
  if (finding.category === "core_web_vitals") {
    return base({
      clientId,
      key: "improve-page-speed",
      title: "Improve page speed / Core Web Vitals",
      finding,
      expectedImpact: "Reduce performance friction and improve user experience on slower devices.",
      confidence: "medium",
      estimatedEffort: "3-6 hours",
      risk: "low",
      proposedChange: "Profile largest assets and blocking scripts, then propose a scoped performance patch.",
      validationMethod: "Re-measure LCP, INP and CLS after deployment and compare against the baseline.",
      rollbackPlan: "Revert the performance patch or asset changes if layout, tracking or rendering regressions appear.",
      targetMetric: "lcpP75Ms",
      baselineValue: numberFromEvidence(finding),
    })
  }
  if (finding.category === "search_visibility") {
    return base({
      clientId,
      key: "strengthen-local-seo",
      title: "Strengthen local SEO / search snippet performance",
      finding,
      expectedImpact: "Improve qualified search clicks by aligning page intent, title/meta language and local proof.",
      confidence: finding.confidence,
      estimatedEffort: "2-5 hours",
      risk: "medium",
      proposedChange: "Investigate queries/pages, then propose metadata and content improvements for the underperforming intent.",
      validationMethod: "Compare Search Console impressions, clicks and CTR over the agreed search window.",
      rollbackPlan: "Restore previous metadata/content if rankings, clicks or lead quality deteriorate.",
      targetMetric: "searchClicks",
      baselineValue: numberFromEvidence(finding),
    })
  }
  if (finding.category === "data_quality") {
    return base({
      clientId,
      key: `add-tracking-${slug(finding.conclusion)}`,
      title: "Add missing conversion or outcome tracking",
      finding,
      expectedImpact: "Improve decision quality by measuring the metric before changing the website.",
      confidence: "high",
      estimatedEffort: "1-3 hours",
      risk: "low",
      proposedChange: "Configure reviewed aggregate tracking for the missing source with client consent.",
      validationMethod: "Confirm new daily metric rows arrive with source attribution and no raw user-level data.",
      rollbackPlan: "Disable the analytics source and remove unneeded credentials if consent changes.",
      targetMetric: "dataCoverage",
      baselineValue: null,
    })
  }
  if (finding.category === "high_traffic_low_conversion") {
    return base({
      clientId,
      key: "investigate-page-level-conversion",
      title: "Investigate high-traffic, low-conversion pages",
      finding,
      expectedImpact: "Identify pages where better intent matching or CTAs may improve enquiry volume.",
      confidence: "low",
      estimatedEffort: "1-2 hours",
      risk: "low",
      proposedChange: "Connect or import page-level aggregate evidence before proposing page changes.",
      validationMethod: "Verify page-level source attribution exists before any improvement work is approved.",
      rollbackPlan: "Do not change the live site; remove the proposed investigation if evidence remains unavailable.",
      targetMetric: "pageConversionRate",
      baselineValue: null,
    })
  }
  return null
}

function base(input: {
  clientId: number
  key: string
  title: string
  finding: WebsiteOutcomeFinding
  expectedImpact: string
  confidence: OptimisationConfidence
  estimatedEffort: string
  risk: OptimisationRisk
  proposedChange: string
  validationMethod: string
  rollbackPlan: string
  targetMetric: string
  baselineValue: number | null
}): ContinuousOptimisationProposal {
  return {
    key: `${input.clientId}:${input.key}`,
    title: input.title,
    evidence: input.finding.evidence,
    expectedImpact: input.expectedImpact,
    confidence: input.confidence,
    estimatedEffort: input.estimatedEffort,
    risk: input.risk,
    proposedChange: input.proposedChange,
    validationMethod: input.validationMethod,
    rollbackPlan: input.rollbackPlan,
    requiredApproval: "Internal approval required before implementation; client approval required when copy, positioning, pricing, proof, tracking consent or visible layout changes.",
    relevantPages: inferRelevantPages(input.finding),
    relevantArtifacts: [],
    targetMetric: input.targetMetric,
    baselineValue: input.baselineValue,
  }
}

function inferRelevantPages(finding: WebsiteOutcomeFinding) {
  const pages = finding.evidence.map((item) => item.href).filter((href) => href.startsWith("/"))
  return pages.length ? Array.from(new Set(pages)) : ["Requires page-level evidence before selecting a page."]
}

function numberFromEvidence(finding: WebsiteOutcomeFinding) {
  const numeric = finding.evidence.map((item) => item.value).find((value) => value && /^-?\d+(\.\d+)?%?$/.test(value))
  if (!numeric) return null
  const parsed = Number.parseFloat(numeric)
  return Number.isFinite(parsed) ? parsed : null
}

function uniqueByKey<T extends { key: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.key, item])).values())
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "missing-data"
}
