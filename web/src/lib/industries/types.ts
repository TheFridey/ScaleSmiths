/**
 * ScaleSmiths Global Industry Growth Engine — typed content model.
 *
 * Only `published` pages are routable and sitemap-indexed. Candidates exist so the
 * directory can grow without mass-publishing thin pages.
 */

export type IndustryPublicationState =
  | "idea"
  | "researched"
  | "draft"
  | "fact-checked"
  | "designed"
  | "qa"
  | "approved"
  | "published"
  | "review-due"
  | "merged"
  | "retired"

export type IndustryProofLevel = "direct" | "adjacent" | "illustrative"

export type IndustryPresentationVariant =
  | "trades"
  | "clinic"
  | "hospitality"
  | "ecommerce"
  | "industrial"
  | "saas"
  | "professional"

export type CommercialPathwayId = "build" | "growth" | "systems" | "audit"

export interface IndustryFriction {
  title: string
  symptom: string
  fix: string
}

export interface IndustryStrategyPoint {
  title: string
  description: string
}

export interface IndustryJourneyStep {
  title: string
  description: string
}

export interface IndustryFaq {
  q: string
  a: string
}

export interface IndustryProof {
  level: IndustryProofLevel
  /** Case-study slug when proof references published Work. */
  workSlug?: string
  label: string
  summary: string
}

export interface IndustryPathwayEmphasis {
  pathway: CommercialPathwayId
  whoFor: string
  whatNext: string
}

export interface IndustryPage {
  /** Stable registry id; never reuse after retirement. */
  id: string
  slug: string
  hubSlug: string
  name: string
  pluralName: string
  metaTitle: string
  description: string
  eyebrow: string
  h1: string
  intro: string
  searchIntent: string
  buyer: string
  presentation: IndustryPresentationVariant
  state: Extract<IndustryPublicationState, "published" | "approved" | "qa" | "draft">
  /** ISO date of last substantive editorial review. */
  reviewedAt: string
  reviewer: "rhys" | "trevor-newton-bradley"
  primaryProblem: string
  frictions: IndustryFriction[]
  strategy: IndustryStrategyPoint[]
  journey: IndustryJourneyStep[]
  pathways: IndustryPathwayEmphasis[]
  proof: IndustryProof
  faqs: IndustryFaq[]
  relatedSolutionHrefs: string[]
  relatedIndustrySlugs: string[]
  synonyms: string[]
  /** Metrics that make commercial sense for this sector — not promises. */
  meaningfulMetrics: string[]
  unknowns: string[]
  showCustomSystems: boolean
}

export interface IndustryHubSection {
  title: string
  paragraphs: string[]
}

export interface IndustryHub {
  slug: string
  name: string
  shortName: string
  metaTitle: string
  description: string
  eyebrow: string
  h1: string
  intro: string
  audience: string
  /** Date the hub copy was last materially revised, used as sitemap lastmod. */
  reviewedAt: string
  /** Distinct guidance for this vertical. Not a renamed copy of another hub. */
  sections: IndustryHubSection[]
  featuredIndustrySlugs: string[]
  relatedSolutionHrefs: string[]
}

export interface IndustryCandidate {
  id: string
  name: string
  hubSlug: string
  /** Proposed URL slug if/when published. */
  slug: string
  state: IndustryPublicationState
  primaryProblem: string
  proofLevel: IndustryProofLevel
  synonyms: string[]
  /** When true, appears in directory search as a candidate with request CTA. */
  discoverable: boolean
}

export interface IndustrySearchHit {
  kind: "published" | "candidate" | "hub"
  id: string
  name: string
  href: string
  hubSlug: string
  hubName: string
  primaryProblem: string
  proofLevel?: IndustryProofLevel
  state: IndustryPublicationState
}
