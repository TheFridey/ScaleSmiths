import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"
import { ClientLogo } from "@/components/ClientLogo"
import { CTA } from "@/components/CTA"
import { JsonLd } from "@/components/JsonLd"
import { BeforeAfterComparison, type ComparisonView } from "@/components/work/BeforeAfterComparison"
import { CaseStudyResults, ClientQuote, hasResults } from "@/components/work/CaseStudyResults"
import { CaseStudyGallery, ResponsiveShowcase, hasGalleryShots, hasResponsiveShots } from "@/components/work/CaseStudyVisuals"
import { ConfirmAKillStory } from "@/components/work/ConfirmAKillStory"
import { ProjectCard } from "@/components/work/ProjectCard"
import { ProjectScreenshot, hostFromUrl, isDevelopment } from "@/components/work/ProjectScreenshot"
import { getBuildLog, type BuildLog } from "@/lib/build-logs"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { getInsight } from "@/lib/insights"
import { serviceRoutes } from "@/lib/service-routes"
import { adjacentCaseStudies, getCaseStudy, primaryImage, relatedCaseStudies, relatedInsightsForCaseStudy, relatedServicesForCaseStudy, type CaseStudy } from "@/lib/case-studies"
import { resolveClientQuote, resolveOutcomes, resolveVerifiedMetrics } from "@/lib/case-study-metrics"
import { logoForProject } from "@/lib/client-proof"
import { founderProfileHref } from "@/lib/founders"
import { InsightCard } from "@/components/insights/InsightCard"
import { buildPageMetadata } from "@/lib/page-metadata"
import { publicClaimMap } from "@/lib/public-claims"
import { getVerifiedPublicClaims } from "@/lib/public-claims.server"
import { SITE_NAME, organizationId, siteBaseUrl } from "@/lib/site-identity"
import { buildBreadcrumbSchema, buildCaseStudySchemas } from "@/lib/structured-data"
import { SHOT_ASPECT, findShot } from "@/lib/work-media"

interface Props { params: Promise<{ slug: string }> }
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const log = getBuildLog(slug)
  if (log) {
    return buildPageMetadata({
      title: log.title,
      // Avoid "ScaleSmiths … | ScaleSmiths" when the note is about ScaleSmiths itself.
      absoluteTitle: log.title.includes("ScaleSmiths") ? log.title : undefined,
      description: log.summary,
      path: `/work/${log.slug}`,
      type: "article",
    })
  }

  const study = getCaseStudy(slug)
  if (!study) return {}
  const image = primaryImage(study)
  return buildPageMetadata({
    title: study.slug === "confirm-a-kill" ? "Confirm-A-Kill Case Study | Custom Website & SEO" : `${study.name} Case Study`,
    description: study.slug === "confirm-a-kill"
      ? "See how ScaleSmiths rebuilt Confirm-A-Kill's pest-control website around local search, conversion, structured content, analytics and long-term growth."
      : study.summary ?? `${study.name} case study by ScaleSmiths.`,
    path: `/work/${study.slug}`,
    type: "article",
    image: image ? { url: image.src, alt: image.alt } : undefined,
    robots: study.status === "draft" ? { index: false, follow: false } : undefined,
  })
}

function BuildLogPage({ log, verifiedBusinessValue, verifiedOutcome }: { log: BuildLog; verifiedBusinessValue?: string; verifiedOutcome?: string }) {
  const base = siteBaseUrl()
  const logServices = serviceRoutes(log.relatedServiceHrefs ?? [])
  const logArticles = (log.relatedInsightSlugs ?? [])
    .map((slug) => getInsight(slug, { includeDrafts: false }))
    .filter((insight): insight is NonNullable<typeof insight> => Boolean(insight))
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "TechArticle",
      headline: log.title,
      description: log.summary,
      url: `${base}/work/${log.slug}`,
      mainEntityOfPage: `${base}/work/${log.slug}`,
      inLanguage: "en-GB",
      author: { "@id": organizationId(base), name: SITE_NAME },
      publisher: { "@id": organizationId(base) },
    },
    buildBreadcrumbSchema(base, [
      { name: "Home", path: "/" },
      { name: "Work", path: "/work" },
      { name: log.title, path: `/work/${log.slug}` },
    ]),
  ]

  return (
    <>
      <JsonLd data={schema} />
      <div className="mx-auto max-w-[1080px] px-6 pt-10 md:px-12">
        <Breadcrumbs
          className="mb-12"
          items={[{ name: "Home", href: "/" }, { name: "Work", href: "/work" }, { name: log.title }]}
        />
        <AnimateIn>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">
            <span>{log.status}</span><span className="text-t3">System · {log.system}</span>
          </div>
          <h1 className="mt-3 font-syne text-[clamp(38px,7vw,76px)] font-extrabold leading-none tracking-[-0.03em]">
            {log.title}
          </h1>
          <p className="mt-6 max-w-[720px] font-dm text-lg leading-relaxed text-t2">{log.summary}</p>
          <div className="mt-7 flex flex-wrap gap-3 font-dm text-[11px] text-t3">
            {log.tags.map((tag) => (
              <span key={tag}>#{tag.replaceAll(" ", "-").toLowerCase()}</span>
            ))}
          </div>
        </AnimateIn>

        <div className="my-16 border-y border-b1">
          {[
            ["Problem", log.problem],
            ["Decision", log.solution],
            ...(verifiedBusinessValue ? [["Verified business value", verifiedBusinessValue]] : []),
            ...(verifiedOutcome ? [["Verified outcome", verifiedOutcome]] : []),
          ].map(([title, copy], index) => (
            <AnimateIn key={title} className={`grid gap-4 py-8 md:grid-cols-[180px_1fr] ${index ? "border-t border-b1" : ""}`}>
              <h2 className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{title}</h2>
              <p className="max-w-[720px] font-dm text-base leading-relaxed text-t2">{copy}</p>
            </AnimateIn>
          ))}
        </div>

        <AnimateIn className="mb-20 grid gap-8 rounded-2xl border border-b1 bg-s1 p-7 md:grid-cols-[0.7fr_1.3fr] md:p-9">
          <div><span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Implementation record</span><h2 className="mt-2 font-syne text-2xl font-bold">Technical approach</h2></div>
          <ol className="grid gap-0 border-t border-b1">
            {log.technicalApproach.map((item, index) => <li key={item} className="grid grid-cols-[34px_1fr] border-b border-b1 py-3 font-dm text-sm text-t2"><span className="text-t3">0{index + 1}</span>{item}</li>)}
          </ol>
        </AnimateIn>

        {logServices.length > 0 || logArticles.length > 0 ? (
          <AnimateIn className="mb-20 border-t border-b1 pt-10">
            <h2 className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Where this applies</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {/* Labels only. The catalogue descriptions are identical on every note, so repeating
                  them made six short pages look like near-duplicates of each other. */}
              {logServices.map((service) => (
                <Link key={service.href} href={service.href} prefetch={false} className="group inline-flex items-center justify-between gap-3 rounded-xl border border-b1 bg-s1 px-5 py-4 transition-colors hover:border-b2">
                  <span className="font-syne text-base font-bold">{service.label}</span>
                  <ArrowRight size={14} aria-hidden="true" className="shrink-0 text-acc transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
            {logArticles.length > 0 ? (
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {logArticles.map((insight) => <InsightCard key={insight.slug} insight={insight} headingLevel="h3" />)}
              </div>
            ) : null}
          </AnimateIn>
        ) : null}
      </div>
      <CTA />
    </>
  )
}

function Section({ id, eyebrow, title, children, tinted = false }: { id: string; eyebrow: string; title: string; children: ReactNode; tinted?: boolean }) {
  return (
    <section aria-labelledby={id} className={tinted ? "border-y border-b1 bg-s1/40 px-6 py-20 md:px-12 md:py-24" : "px-6 py-20 md:px-12 md:py-24"}>
      <div className="mx-auto max-w-[1240px]">
        <AnimateIn className="mb-10 max-w-[760px]">
          <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{eyebrow}</span>
          <h2 id={id} className="mt-2 font-syne text-[clamp(28px,4vw,46px)] font-extrabold tracking-[-.03em]">{title}</h2>
        </AnimateIn>
        {children}
      </div>
    </section>
  )
}

/** Development-only marker for a draft case study's missing, unverified content. */
function AwaitingContent({ study, what }: { study: CaseStudy; what: string }) {
  if (study.status !== "draft" || !isDevelopment) return null
  return <p className="rounded-lg border border-dashed border-b2 px-4 py-3 font-dm text-sm text-t3">Awaiting verified content: {what}</p>
}

function Prose({ paragraphs }: { paragraphs: string[] }) {
  return <div className="grid max-w-[760px] gap-4">{paragraphs.map((text) => <p key={text} className="font-dm text-lg leading-relaxed text-t2">{text}</p>)}</div>
}

function comparisonViews(study: CaseStudy): ComparisonView[] {
  return (["desktop", "mobile"] as const).flatMap((view) => {
    const before = findShot(study.media, view, "before")
    const after = findShot(study.media, view, "current")
    if (!before || !after) return []
    if (!(before.available && after.available) && !isDevelopment) return []
    const image = (shot: typeof before) => ({ src: shot.src, alt: shot.alt, aspect: SHOT_ASPECT[view], available: shot.available })
    return [{ view, before: image(before), after: image(after) }]
  })
}

export default async function CaseStudyPage({ params }: Props) {
  const { slug } = await params
  const log = getBuildLog(slug)
  if (log) {
    const claims = publicClaimMap(await getVerifiedPublicClaims({ route: `/work/${slug}`, component: "build_log_claims" }))
    return <BuildLogPage log={log} verifiedBusinessValue={claims.get(`build-log.${slug}.business-value`)?.approvedWording} verifiedOutcome={claims.get(`build-log.${slug}.outcome`)?.approvedWording} />
  }

  const study = getCaseStudy(slug)
  if (!study) notFound()

  const claims = study.status === "published" ? await getVerifiedPublicClaims({ route: `/work/${slug}` }) : []
  const outcomes = resolveOutcomes(study.outcomeClaimIds, claims)
  const metrics = resolveVerifiedMetrics(study.metrics, claims)
  const quote = resolveClientQuote(study.quoteClaimId, claims)
  const results = { metrics, outcomes, awaiting: study.awaitingMetrics }

  const base = siteBaseUrl()
  const host = hostFromUrl(study.websiteUrl)
  const hero = primaryImage(study)
  const logo = logoForProject(study.slug)
  const views = comparisonViews(study)
  const relatedServices = relatedServicesForCaseStudy(study.slug)
  const siblings = relatedCaseStudies(study.slug)
  const articles = study.status === "published" ? relatedInsightsForCaseStudy(study.slug) : []
  const { previous, next } = adjacentCaseStudies(study.slug)
  const meta = [study.industry, study.location, study.year].filter(Boolean).join(" · ")

  return (
    <>
      {study.project ? <JsonLd data={buildCaseStudySchemas(study.project, base, study.founder, hero)} /> : null}

      <section className="px-6 pb-12 pt-10 md:px-12 md:pb-16 md:pt-14">
        <div className="mx-auto max-w-[1240px]">
          <nav aria-label="Breadcrumb" className="font-dm text-xs text-t3">
            <ol className="flex flex-wrap items-center gap-2">
              <li><Link href="/" className="hover:text-t1">Home</Link></li>
              <li aria-hidden="true"><ChevronRight size={12} /></li>
              <li><Link href="/work" className="hover:text-t1">Work</Link></li>
              <li aria-hidden="true"><ChevronRight size={12} /></li>
              <li aria-current="page" className="text-t1">{study.name}</li>
            </ol>
          </nav>

          {study.status === "draft" ? (
            <p className="mt-6 rounded-lg border border-dashed border-b2 bg-s1 px-4 py-3 font-dm text-sm text-t2">
              Draft case study preview — visible in development only, never listed, linked or indexed. Sections fill in as verified content and screenshots are supplied.
            </p>
          ) : null}

          <AnimateIn className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
            <div>
              {logo ? <ClientLogo name={study.name} logo={logo} height={36} className="mb-6" /> : null}
              <p className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">ScaleSmiths case study</p>
              <h1 className="mt-3 font-syne text-[clamp(40px,7vw,84px)] font-extrabold leading-[.98] tracking-[-.04em]">{study.name}</h1>
              {meta ? <p className="mt-4 font-dm text-base text-t2">{meta}</p> : null}
              {study.summary ? <p className="mt-6 max-w-[720px] font-dm text-[clamp(17px,2vw,21px)] leading-relaxed text-t1">{study.summary}</p> : <div className="mt-6"><AwaitingContent study={study} what="one-sentence project summary" /></div>}
            </div>

            <div className="grid gap-6">
              {study.services.length > 0 ? (
                <div>
                  <h2 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Scope delivered</h2>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {study.services.map((service) => <li key={service} className="rounded-md border border-b1 bg-s1 px-2.5 py-1 font-dm text-xs text-t2">{service}</li>)}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-3">
                {study.websiteUrl ? (
                  <a href={study.websiteUrl} target="_blank" rel="noopener noreferrer" className="btn-primary font-dm">
                    Visit website <ArrowUpRight size={16} aria-hidden="true" /><span className="sr-only"> (opens {host} in a new tab)</span>
                  </a>
                ) : null}
                <Link href="/quote" prefetch={false} className={study.websiteUrl ? "btn-ghost font-dm" : "btn-primary font-dm"}>Start a similar project</Link>
              </div>
              {study.founder ? (
                <Link href={founderProfileHref(study.founder)} prefetch={false} className="inline-flex w-fit items-center gap-2 font-dm text-xs text-t3 transition-colors hover:text-t1">
                  Founder contribution · {study.credit?.replace("Made by ", "")} <ArrowRight size={12} aria-hidden="true" />
                </Link>
              ) : study.credit ? <p className="font-dm text-xs text-t3">{study.credit}</p> : null}
            </div>
          </AnimateIn>

          <AnimateIn delay={0.08} className="mt-12">
            {hasResponsiveShots(study.media, { availableOnly: true }) || (!hero && hasResponsiveShots(study.media)) ? (
              <ResponsiveShowcase media={study.media} host={host} />
            ) : hero ? (
              <ProjectScreenshot image={hero} sizes="(min-width: 1280px) 1240px, 100vw" priority />
            ) : null}
          </AnimateIn>
        </div>
      </section>

      <Section id="case-client" eyebrow="The client" title={`Who ${study.name} are`} tinted>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            {study.client ? <p className="font-dm text-lg leading-relaxed text-t1">{study.client}</p> : <AwaitingContent study={study} what="who the client is" />}
          </div>
          <div>
            <h3 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">The starting point</h3>
            {study.challenge ? <p className="mt-3 font-dm text-base leading-relaxed text-t2">{study.challenge}</p> : null}
            {study.startingPoint.length > 0 ? (
              <ul className="mt-5 grid gap-2">
                {study.startingPoint.map((issue) => <li key={issue} className="border-t border-b1 pt-2 font-dm text-sm text-t2">{issue}</li>)}
              </ul>
            ) : null}
            {!study.challenge && study.startingPoint.length === 0 ? <div className="mt-3"><AwaitingContent study={study} what="verified starting-point issues" /></div> : null}
          </div>
        </div>
      </Section>

      {views.length > 0 ? (
        <Section id="case-before-after" eyebrow="Before and after" title="What changed, side by side">
          <BeforeAfterComparison views={views} showPlaceholders={isDevelopment} />
        </Section>
      ) : null}

      {study.slug === "confirm-a-kill" ? <ConfirmAKillStory /> : null}

      {study.strategy.length > 0 || study.status === "draft" ? (
        <Section id="case-strategy" eyebrow="Strategy" title="What we set out to improve">
          {study.strategy.length > 0 ? <Prose paragraphs={study.strategy} /> : <AwaitingContent study={study} what="strategy and reasoning" />}
        </Section>
      ) : null}

      <Section id="case-build" eyebrow="The build" title="What ScaleSmiths built" tinted={views.length === 0}>
        <div className="grid gap-12 lg:grid-cols-[1.1fr_.9fr]">
          <div>{study.solution ? <Prose paragraphs={[study.solution]} /> : <AwaitingContent study={study} what="description of the delivered solution" />}</div>
          {study.features.length > 0 ? (
            <div>
              <h3 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Production scope</h3>
              <ol className="mt-4 grid border-t border-b1">
                {study.features.map((feature, index) => (
                  <li key={feature} className="grid grid-cols-[34px_1fr] border-b border-b1 py-3 font-dm text-sm text-t1"><span className="text-t3">{String(index + 1).padStart(2, "0")}</span>{feature}</li>
                ))}
              </ol>
              {study.stack.length > 0 ? (
                <>
                  <h3 className="mt-8 font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Stack & capabilities</h3>
                  <ul className="mt-3 flex flex-wrap gap-1.5">
                    {study.stack.map((item) => <li key={item} className="rounded-md border border-b1 bg-s1 px-2.5 py-1 font-dm text-xs text-t2">{item}</li>)}
                  </ul>
                </>
              ) : null}
              {study.repoUrl ? (
                <a href={study.repoUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1.5 font-dm text-sm text-t2 hover:text-t1">
                  View repository <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </Section>

      {study.technicalImplementation.length > 0 ? (
        <Section id="case-technical" eyebrow="Under the hood" title="How it was built">
          <div className="grid gap-3 md:grid-cols-2">
            {study.technicalImplementation.map((item, index) => (
              <AnimateIn key={item.title} delay={index * 0.04} className="rounded-2xl border border-b1 bg-s1/50 p-6">
                <span className="font-dm text-xs font-semibold tabular-nums text-acc">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-syne text-xl font-bold">{item.title}</h3>
                <p className="mt-2 font-dm text-sm leading-relaxed text-t2">{item.detail}</p>
              </AnimateIn>
            ))}
          </div>
        </Section>
      ) : null}

      {hasGalleryShots(study.media) ? (
        <Section id="case-evidence" eyebrow="Visual evidence" title="Inside the delivered work" tinted>
          <CaseStudyGallery media={study.media} host={host} />
        </Section>
      ) : null}

      {hasResults(results) ? (
        <Section id="case-results" eyebrow="Results" title="Verified results">
          <CaseStudyResults {...results} />
        </Section>
      ) : null}

      {quote ? (
        <section aria-label="Client perspective" className="px-6 py-20 md:px-12">
          <ClientQuote quote={quote} />
        </section>
      ) : null}

      {relatedServices.length > 0 || siblings.length > 0 || articles.length > 0 ? (
        <Section id="case-related" eyebrow="Related" title="Services and work behind this project" tinted>
          {relatedServices.length > 0 ? (
            <ul className="grid gap-3 md:grid-cols-3">
              {relatedServices.map((service) => (
                <li key={service.href}>
                  <Link href={service.href} prefetch={false} className="group flex h-full flex-col rounded-2xl border border-b1 bg-bg/60 p-5 transition-colors hover:border-b2">
                    <span className="font-syne text-lg font-bold">{service.label}</span>
                    <span className="mt-2 line-clamp-3 font-dm text-sm leading-relaxed text-t2">{service.description}</span>
                    <span className="mt-auto inline-flex items-center gap-2 pt-4 font-dm text-sm font-medium text-t1">Explore <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {articles.length > 0 ? (
            <div className="mt-12">
              <h3 className="font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Articles drawing on this project</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {articles.map((insight) => <InsightCard key={insight.slug} insight={insight} headingLevel="h4" />)}
              </div>
            </div>
          ) : null}
          {siblings.length > 0 ? (
            <div className="mt-12 grid gap-5 md:grid-cols-2">
              {siblings.map((sibling) => <ProjectCard key={sibling.slug} study={sibling} size="compact" />)}
            </div>
          ) : null}
        </Section>
      ) : null}

      {previous || next ? (
        <nav aria-label="More case studies" className="border-t border-b1 px-6 py-12 md:px-12">
          <div className="mx-auto grid max-w-[1240px] gap-3 md:grid-cols-2">
            {previous ? (
              <Link href={`/work/${previous.slug}`} prefetch={false} className="group rounded-2xl border border-b1 bg-s1/40 p-6 transition-colors hover:border-b2">
                <span className="inline-flex items-center gap-2 font-dm text-xs font-semibold uppercase tracking-[.14em] text-t3">
                  <ArrowLeft size={13} aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5" /> Previous case study
                </span>
                <span className="mt-3 block font-syne text-xl font-bold">{previous.name}</span>
                {previous.industry ? <span className="mt-1 block font-dm text-sm text-t2">{previous.industry}</span> : null}
              </Link>
            ) : null}
            {next ? (
              <Link href={`/work/${next.slug}`} prefetch={false} className="group rounded-2xl border border-b1 bg-s1/40 p-6 transition-colors hover:border-b2 md:col-start-2 md:text-right">
                <span className="inline-flex items-center gap-2 font-dm text-xs font-semibold uppercase tracking-[.14em] text-t3">
                  Next case study <ArrowRight size={13} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-3 block font-syne text-xl font-bold">{next.name}</span>
                {next.industry ? <span className="mt-1 block font-dm text-sm text-t2">{next.industry}</span> : null}
              </Link>
            ) : null}
          </div>
          <div className="mx-auto mt-6 max-w-[1240px]">
            <Link href="/work" prefetch={false} className="inline-flex items-center gap-2 font-dm text-sm text-t2 transition-colors hover:text-t1">
              All case studies <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      ) : null}

      <CTA />
    </>
  )
}
