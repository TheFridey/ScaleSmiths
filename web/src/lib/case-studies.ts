import { projectImageAlt, projects, type Project } from "./data"
import type { MetricKey } from "./case-study-metrics"
import { founderForProject, type Founder } from "./founders"
import { landingPages } from "./landing-pages"
import { serviceJourneys } from "./service-journeys"
import { findShot, mediaForProject, SHOT_ASPECT, type ProjectMedia } from "./work-media"

/**
 * One view model for every case study, so published projects and in-progress drafts share
 * the same page structure. Sections render only when their content exists.
 */
export interface CaseStudy {
  slug: string
  name: string
  status: "published" | "draft"
  industry?: string
  location?: string
  year?: string
  summary?: string
  client?: string
  challenge?: string
  startingPoint: string[]
  strategy: string[]
  solution?: string
  features: string[]
  stack: string[]
  services: string[]
  portfolioGroup?: Project["portfolioGroup"]
  websiteUrl?: string
  repoUrl?: string
  credit?: string
  accentColor: string
  founder?: Founder
  media: ProjectMedia
  outcomeClaimIds: string[]
  metrics: Array<{ key: MetricKey; claimId: string }>
  awaitingMetrics: MetricKey[]
  quoteClaimId?: string
  project?: Project
}

export interface CaseStudyImage {
  src: string
  alt: string
  aspect: string
  kind: "screenshot" | "photograph" | "cover-card"
  blurDataURL?: string
}

const draftCaseStudies: CaseStudy[] = []

export function draftPreviewEnabled(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>) {
  return env.NODE_ENV !== "production"
}

function fromProject(project: Project): CaseStudy {
  return {
    slug: project.slug,
    name: project.name,
    status: "published",
    industry: project.type,
    location: project.location,
    year: project.year,
    summary: project.headline,
    client: project.client,
    challenge: project.challenge,
    startingPoint: project.startingPoint ?? [],
    strategy: project.strategy ?? [],
    solution: project.solution,
    features: project.features,
    stack: project.tags,
    services: project.services,
    portfolioGroup: project.portfolioGroup,
    websiteUrl: project.websiteUrl,
    repoUrl: project.repoUrl,
    credit: project.credit,
    accentColor: project.accentColor,
    founder: founderForProject(project.slug),
    media: mediaForProject(project.slug),
    outcomeClaimIds: project.outcomeClaimIds,
    metrics: project.metrics ?? [],
    awaitingMetrics: project.awaitingMetrics ?? [],
    quoteClaimId: project.quoteClaimId,
    project,
  }
}

export function publishedCaseStudies(): CaseStudy[] {
  return projects.map(fromProject)
}

export function getCaseStudy(slug: string, { includeDrafts = draftPreviewEnabled() } = {}): CaseStudy | undefined {
  const project = projects.find((candidate) => candidate.slug === slug)
  if (project) return fromProject(project)
  return includeDrafts ? draftCaseStudies.find((draft) => draft.slug === slug) : undefined
}

/**
 * The image that represents a case study: a real desktop homepage capture when one exists,
 * otherwise the existing cover imagery.
 */
export function primaryImage(study: CaseStudy): CaseStudyImage | undefined {
  const desktop = findShot(study.media, "desktop", "current")
  if (desktop?.available) return { src: desktop.src, alt: desktop.alt, aspect: SHOT_ASPECT.desktop, kind: "screenshot" }
  const project = study.project
  if (!project?.heroImage) return undefined
  return {
    src: project.heroImage,
    alt: projectImageAlt(project),
    aspect: "16 / 9",
    kind: project.imageKind === "photograph" ? "photograph" : "cover-card",
    blurDataURL: project.blurDataURL,
  }
}

/** Card imagery: the desktop capture, else the lighter cover thumbnail. */
export function cardImage(study: CaseStudy): CaseStudyImage | undefined {
  const primary = primaryImage(study)
  if (!primary || primary.kind === "screenshot" || !study.project?.thumbImage) return primary
  return { ...primary, src: study.project.thumbImage, aspect: "3 / 2" }
}

export interface ServiceLink {
  href: string
  label: string
  description: string
}

/**
 * Service pages that already cite this case study as proof. Using the curated proof lists
 * keeps service → case study and case study → service links symmetrical and relevant.
 */
export function relatedServicesForCaseStudy(slug: string, limit = 3): ServiceLink[] {
  const journeyLinks = Object.values(serviceJourneys)
    .filter((journey) => journey.proofSlugs.includes(slug))
    .map((journey) => ({ href: `/${journey.slug}`, label: journey.eyebrow, description: journey.description }))
  const landingLinks = Object.values(landingPages)
    .filter((page) => page.proofLinks.includes(slug))
    .map((page) => ({ href: `/${page.slug}`, label: page.title, description: page.description }))
  return [...journeyLinks, ...landingLinks].slice(0, limit)
}

/** Other case studies cited by the same service pages. */
export function relatedCaseStudies(slug: string, limit = 2): CaseStudy[] {
  const servicePaths = new Set(relatedServicesForCaseStudy(slug, Number.POSITIVE_INFINITY).map((link) => link.href.slice(1)))
  const siblings = new Set<string>()
  for (const journey of Object.values(serviceJourneys)) if (servicePaths.has(journey.slug)) journey.proofSlugs.forEach((candidate) => siblings.add(candidate))
  for (const page of Object.values(landingPages)) if (servicePaths.has(page.slug)) page.proofLinks.forEach((candidate) => siblings.add(candidate))
  siblings.delete(slug)
  return publishedCaseStudies().filter((study) => siblings.has(study.slug)).slice(0, limit)
}

export function caseStudiesForSlugs(slugs: readonly string[]): CaseStudy[] {
  return slugs.map((slug) => getCaseStudy(slug, { includeDrafts: false })).filter((study): study is CaseStudy => Boolean(study))
}
