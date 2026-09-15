import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { AnimateIn } from "@/components/AnimateIn"
import { InsightCard } from "@/components/insights/InsightCard"
import { JsonLd } from "@/components/JsonLd"
import { INSIGHT_CATEGORIES, draftPreviewEnabled, editorialPipeline, insightAuthor, publishedInsights } from "@/lib/insights"
import { buildPageMetadata } from "@/lib/page-metadata"
import { siteBaseUrl, websiteId, organizationId } from "@/lib/site-identity"
import { buildBreadcrumbSchema } from "@/lib/structured-data"

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: "Insights from the Founders",
    description: "Articles written by ScaleSmiths founders Rhys and Trevor Newton-Bradley on web development, technical SEO, local growth and business systems.",
    path: "/insights",
    // Never index the hub until it has published articles to show.
    robots: publishedInsights().length ? undefined : { index: false, follow: true },
  })
}

export default function InsightsPage() {
  const published = publishedInsights()
  const preview = draftPreviewEnabled()
  // Production has no empty hub: the route only exists once something is published.
  if (published.length === 0 && !preview) notFound()

  const base = siteBaseUrl()
  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "ScaleSmiths Insights",
      url: `${base}/insights`,
      isPartOf: { "@id": websiteId(base) },
      publisher: { "@id": organizationId(base) },
      hasPart: published.map((insight) => ({ "@type": "BlogPosting", headline: insight.title, url: `${base}/insights/${insight.slug}` })),
    },
    buildBreadcrumbSchema(base, [
      { name: "Home", path: "/" },
      { name: "Insights", path: "/insights" },
    ]),
  ]
  const categories = (Object.keys(INSIGHT_CATEGORIES) as Array<keyof typeof INSIGHT_CATEGORIES>).filter((category) => published.some((insight) => insight.category === category))

  return (
    <>
      <JsonLd data={schema} />
      <section className="px-6 pb-16 pt-10 md:px-12 md:pb-24 md:pt-14">
        <div className="mx-auto max-w-[1240px]">
          <nav aria-label="Breadcrumb" className="font-dm text-xs text-t3">
            <ol className="flex flex-wrap items-center gap-2">
              <li><Link href="/" className="hover:text-t1">Home</Link></li>
              <li aria-hidden="true"><ChevronRight size={12} /></li>
              <li aria-current="page" className="text-t1">Insights</li>
            </ol>
          </nav>

          <AnimateIn className="mt-10 max-w-[820px]">
            <span className="font-dm text-xs font-semibold uppercase tracking-[.14em] text-acc">Insights</span>
            <h1 className="mt-3 font-syne text-[clamp(38px,6.5vw,72px)] font-black leading-[1.02] tracking-[-.04em]">Written by the people doing the work.</h1>
            <p className="mt-6 font-dm text-lg leading-relaxed text-t2">
              Articles from ScaleSmiths&apos; founders on web development, technical SEO, local growth and business systems, drawn from projects we have actually delivered.
            </p>
          </AnimateIn>

          {categories.length > 1 ? (
            <ul aria-label="Categories" className="mt-10 flex flex-wrap gap-2">
              {categories.map((category) => (
                <li key={category}><a href={`#${category}`} className="inline-flex rounded-md border border-b1 bg-s1 px-3 py-1.5 font-dm text-sm text-t2 hover:text-t1">{INSIGHT_CATEGORIES[category].label}</a></li>
              ))}
            </ul>
          ) : null}

          {published.length > 0 ? (
            <div className="mt-12 grid gap-16">
              {categories.map((category) => (
                <section key={category} id={category} aria-labelledby={`${category}-heading`} className="scroll-mt-28">
                  <h2 id={`${category}-heading`} className="border-b border-b1 pb-3 font-syne text-2xl font-bold">{INSIGHT_CATEGORIES[category].label}</h2>
                  <p className="mt-2 font-dm text-sm text-t3">{INSIGHT_CATEGORIES[category].description}</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {published.filter((insight) => insight.category === category).map((insight) => <InsightCard key={insight.slug} insight={insight} />)}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {preview ? (
            <section aria-labelledby="pipeline-heading" className="mt-16 rounded-2xl border border-dashed border-b2 p-6 md:p-8">
              <h2 id="pipeline-heading" className="font-syne text-2xl font-bold">Editorial pipeline <span className="font-dm text-sm font-normal text-t3">· development only</span></h2>
              <p className="mt-2 max-w-[760px] font-dm text-sm text-t3">Planned and draft articles in priority order. None of these are listed, linked or indexed in production until published by their author.</p>
              <ol className="mt-6 grid gap-3">
                {editorialPipeline().map((insight) => (
                  <li key={insight.slug} className="grid gap-2 rounded-xl border border-b1 bg-s1 p-4 md:grid-cols-[48px_1fr_auto] md:items-start">
                    <span className="font-syne text-lg font-bold text-acc">{insight.brief.priority}</span>
                    <div>
                      <Link href={`/insights/${insight.slug}`} prefetch={false} className="font-syne text-lg font-bold hover:text-acc">{insight.title}</Link>
                      <p className="mt-1 font-dm text-sm text-t2">{insight.brief.angle}</p>
                      <p className="mt-2 font-dm text-xs text-t3">Target query: {insight.brief.targetQuery} · Evidence needed: {insight.brief.firstHandEvidence.join("; ")}</p>
                    </div>
                    <span className="font-dm text-xs uppercase tracking-[.1em] text-t3">{insight.status} · {insightAuthor(insight).firstName}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </section>
    </>
  )
}
