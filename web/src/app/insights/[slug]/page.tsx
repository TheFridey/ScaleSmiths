import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRight, ChevronRight } from "lucide-react"
import { CTA } from "@/components/CTA"
import { JsonLd } from "@/components/JsonLd"
import { ArticleBody, TableOfContents } from "@/components/insights/ArticleBody"
import { AuthorByline, AuthorCard } from "@/components/insights/AuthorByline"
import { InsightCard } from "@/components/insights/InsightCard"
import { ProjectCard } from "@/components/work/ProjectCard"
import { caseStudiesForSlugs } from "@/lib/case-studies"
import {
  INSIGHT_CATEGORIES,
  getInsight,
  insightAuthor,
  publishedInsights,
  readingTimeMinutes,
  relatedInsights,
  tableOfContents,
} from "@/lib/insights"
import { buildPageMetadata } from "@/lib/page-metadata"
import { serviceRoutes } from "@/lib/service-routes"
import { siteBaseUrl } from "@/lib/site-identity"
import { buildInsightSchemas } from "@/lib/structured-data"

interface Props {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return publishedInsights().map((insight) => ({ slug: insight.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const insight = getInsight((await params).slug)
  if (!insight) return {}
  return {
    ...buildPageMetadata({
      title: insight.title,
      description: insight.description,
      path: `/insights/${insight.slug}`,
      type: "article",
      image: insight.heroImage ? { url: insight.heroImage.src, width: insight.heroImage.width, height: insight.heroImage.height, alt: insight.heroImage.alt } : undefined,
      robots: insight.status === "published" ? undefined : { index: false, follow: false },
    }),
    authors: [{ name: insightAuthor(insight).name, url: `/about/${insight.authorSlug}` }],
  }
}

export default async function InsightPage({ params }: Props) {
  const insight = getInsight((await params).slug)
  if (!insight) notFound()

  const author = insightAuthor(insight)
  const toc = tableOfContents(insight)
  const isPublished = insight.status === "published"
  const related = relatedInsights(insight, { includeDrafts: !isPublished })
  const services = serviceRoutes(insight.relatedServices)
  const studies = caseStudiesForSlugs(insight.relatedCaseStudies)

  return (
    <>
      {isPublished ? <JsonLd data={buildInsightSchemas(insight, siteBaseUrl())} /> : null}

      <article>
        <header className="px-6 pb-10 pt-10 md:px-12 md:pt-14">
          <div className="mx-auto max-w-[1080px]">
            <nav aria-label="Breadcrumb" className="font-dm text-xs text-t3">
              <ol className="flex flex-wrap items-center gap-2">
                <li><Link href="/" className="hover:text-t1">Home</Link></li>
                <li aria-hidden="true"><ChevronRight size={12} /></li>
                <li><Link href="/insights" className="hover:text-t1">Insights</Link></li>
                <li aria-hidden="true"><ChevronRight size={12} /></li>
                <li aria-current="page" className="text-t1">{insight.title}</li>
              </ol>
            </nav>

            {!isPublished ? (
              <p className="mt-6 rounded-lg border border-dashed border-b2 bg-s1 px-4 py-3 font-dm text-sm text-t2">
                {insight.status === "planned" ? "Planned article" : "Draft article"} — development preview only. Not listed, linked or indexed until {author.firstName} publishes it.
              </p>
            ) : null}

            <p className="mt-10 font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">{INSIGHT_CATEGORIES[insight.category].label}</p>
            <h1 className="mt-3 max-w-[900px] font-syne text-[clamp(34px,5.5vw,62px)] font-extrabold leading-[1.04] tracking-[-.03em]">{insight.title}</h1>
            <p className="mt-5 max-w-[760px] font-dm text-lg leading-relaxed text-t2">{insight.description}</p>
            <div className="mt-8 border-t border-b1 pt-6">
              <AuthorByline founder={author} datePublished={insight.datePublished} dateModified={insight.dateModified} readingMinutes={readingTimeMinutes(insight)} />
            </div>
          </div>
        </header>

        {insight.heroImage ? (
          <div className="px-6 md:px-12">
            <div className="mx-auto max-w-[1080px]">
              <Image src={insight.heroImage.src} alt={insight.heroImage.alt} width={insight.heroImage.width} height={insight.heroImage.height} priority sizes="(min-width: 1080px) 1080px, 100vw" className="h-auto w-full rounded-2xl border border-b1" />
            </div>
          </div>
        ) : null}

        <div className="px-6 py-12 md:px-12">
          <div className="mx-auto grid max-w-[1080px] gap-12 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="min-w-0 max-w-[760px]">
              {insight.status === "planned" ? (
                <div className="grid gap-6 font-dm text-sm text-t2">
                  <p>No draft yet. Brief for {author.name}:</p>
                  <dl className="grid gap-4">
                    <div><dt className="text-xs uppercase tracking-[.12em] text-t3">Target query</dt><dd className="mt-1">{insight.brief.targetQuery}</dd></div>
                    <div><dt className="text-xs uppercase tracking-[.12em] text-t3">Search intent</dt><dd className="mt-1">{insight.brief.searchIntent}</dd></div>
                    <div><dt className="text-xs uppercase tracking-[.12em] text-t3">Angle</dt><dd className="mt-1">{insight.brief.angle}</dd></div>
                    <div><dt className="text-xs uppercase tracking-[.12em] text-t3">Outline</dt><dd className="mt-1"><ol className="list-decimal pl-5">{insight.brief.outline.map((item) => <li key={item}>{item}</li>)}</ol></dd></div>
                    <div><dt className="text-xs uppercase tracking-[.12em] text-t3">First-hand evidence required</dt><dd className="mt-1"><ul className="list-disc pl-5">{insight.brief.firstHandEvidence.map((item) => <li key={item}>{item}</li>)}</ul></dd></div>
                    {insight.brief.cannibalisationNotes ? <div><dt className="text-xs uppercase tracking-[.12em] text-t3">Cannibalisation</dt><dd className="mt-1">{insight.brief.cannibalisationNotes}</dd></div> : null}
                  </dl>
                </div>
              ) : (
                <ArticleBody blocks={insight.body} />
              )}
              <div className="mt-14">
                <AuthorCard founder={author} />
              </div>
            </div>
            {toc.length >= 3 ? (
              <div className="hidden lg:block">
                <div className="sticky top-28"><TableOfContents items={toc} /></div>
              </div>
            ) : null}
          </div>
        </div>
      </article>

      {services.length > 0 || studies.length > 0 || related.length > 0 ? (
        <section aria-labelledby="insight-related" className="border-t border-b1 bg-s1/40 px-6 py-20 md:px-12">
          <div className="mx-auto grid max-w-[1240px] gap-14">
            <h2 id="insight-related" className="sr-only">Related services, work and articles</h2>
            {services.length > 0 ? (
              <div>
                <h3 className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-t3">Related services</h3>
                <ul className="mt-5 grid gap-3 md:grid-cols-3">
                  {services.map((service) => (
                    <li key={service.href}>
                      <Link href={service.href} prefetch={false} className="group flex h-full flex-col rounded-2xl border border-b1 bg-bg/60 p-5 transition-colors hover:border-b2">
                        <span className="font-syne text-lg font-bold">{service.label}</span>
                        <span className="mt-2 line-clamp-3 font-dm text-sm leading-relaxed text-t2">{service.description}</span>
                        <span className="mt-auto inline-flex items-center gap-2 pt-4 font-dm text-sm text-t1">Explore <ArrowRight size={14} aria-hidden="true" /></span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {studies.length > 0 ? (
              <div>
                <h3 className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-t3">Work referenced in this article</h3>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {studies.map((study) => <ProjectCard key={study.slug} study={study} size="compact" />)}
                </div>
              </div>
            ) : null}
            {related.length > 0 ? (
              <div>
                <h3 className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-t3">Related articles</h3>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {related.map((item) => <InsightCard key={item.slug} insight={item} headingLevel="h4" />)}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <CTA />
    </>
  )
}
