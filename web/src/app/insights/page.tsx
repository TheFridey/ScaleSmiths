import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Breadcrumbs } from "@/components/Breadcrumbs"
import { InsightCard } from "@/components/insights/InsightCard"
import { JsonLd } from "@/components/JsonLd"
import { PaperBand } from "@/components/PaperBand"
import {
  ENTERPRISE_TOPIC_CLUSTERS,
  INSIGHT_FILTERS,
  INSIGHT_TOPIC_CLUSTERS,
  publishedInsights,
  type InsightTopicSlug,
} from "@/lib/insights"
import { buildPageMetadata } from "@/lib/page-metadata"
import { siteBaseUrl, websiteId, organizationId } from "@/lib/site-identity"
import { buildBreadcrumbSchema } from "@/lib/structured-data"

const baseMetadata = buildPageMetadata({
  title: "Insights",
  absoluteTitle: "Insights on Enterprise Software, Engineering & Growth | ScaleSmiths",
  description:
    "Technical guidance from ScaleSmiths on enterprise software, engineering, websites, search and infrastructure — written by the founders doing the work.",
  path: "/insights",
})
export const metadata: Metadata = {
  ...baseMetadata,
  alternates: { ...baseMetadata.alternates, types: { "application/rss+xml": "/feed.xml" } },
}

export default function InsightsPage() {
  const articles = publishedInsights()
  const featured = articles.find((article) => article.featured && article.category === "enterprise")
    ?? articles.find((article) => article.featured)
    ?? articles[0]
  const latest = articles.filter((article) => article.slug !== featured.slug).slice(0, 9)
  const topics = Object.entries(INSIGHT_TOPIC_CLUSTERS) as Array<[InsightTopicSlug, (typeof INSIGHT_TOPIC_CLUSTERS)[InsightTopicSlug]]>
  const base = siteBaseUrl()

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "ScaleSmiths Insights",
            description: String(metadata.description),
            url: `${base}/insights`,
            isPartOf: { "@id": websiteId(base) },
            publisher: { "@id": organizationId(base) },
            hasPart: articles.map((article) => ({
              "@type": "BlogPosting",
              headline: article.title,
              url: `${base}/insights/${article.slug}`,
            })),
          },
          buildBreadcrumbSchema(base, [
            { name: "Home", path: "/" },
            { name: "Insights", path: "/insights" },
          ]),
        ]}
      />
      <main>
        <header className="relative overflow-hidden px-6 pb-16 pt-10 md:px-12 md:pb-24 md:pt-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_15%_0%,_rgba(232,160,69,0.12),_transparent_45%),linear-gradient(180deg,_rgba(15,15,15,0.4)_0%,_transparent_50%)]"
          />
          <div className="mx-auto max-w-[1240px]">
            <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Insights" }]} />
            <div className="mt-10 max-w-[900px]">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Engineering publication</p>
              <p className="mt-4 font-syne text-[clamp(2.75rem,7vw,4.5rem)] font-extrabold leading-none tracking-[-0.045em] text-t1">
                ScaleSmiths
              </p>
              <h1 className="mt-6 max-w-[22ch] font-syne text-[clamp(1.75rem,3.8vw,2.75rem)] font-bold leading-[1.15] tracking-[-.03em] text-t1">
                Technical insight for people who ship systems.
              </h1>
              <p className="mt-6 max-w-[760px] text-lg leading-relaxed text-t2">
                Enterprise software, engineering trade-offs, websites, search and infrastructure — written without inflated promises.
                Each article connects the decision to relevant services, delivery evidence and the next useful question.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/insights/enterprise" prefetch={false} className="btn-primary">
                  Enterprise library <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <Link href="/feed.xml" className="btn-ghost">
                  Subscribe via RSS
                </Link>
              </div>
            </div>

            <nav aria-label="Insight filters" className="mt-12">
              <p className="mb-3 font-dm text-xs font-semibold uppercase tracking-[.12em] text-t3">Browse by focus</p>
              <ul className="flex flex-wrap gap-2">
                {INSIGHT_FILTERS.map((filter) => (
                  <li key={filter.id}>
                    <Link
                      href={`/insights/${filter.topic}`}
                      prefetch={false}
                      title={filter.description}
                      className="inline-flex min-h-10 items-center rounded-lg border border-b1 bg-s1 px-4 py-2 font-dm text-sm text-t2 transition-colors hover:border-acc/50 hover:text-t1"
                    >
                      {filter.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>

        <PaperBand aria-labelledby="featured-insight" compact>
          <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div>
              <p className="paper-label">Featured insight</p>
              <h2 id="featured-insight" className="paper-display mt-3">
                {featured.title}
              </h2>
              <p className="paper-lede mt-5">{featured.description}</p>
              <Link href={`/insights/${featured.slug}`} prefetch={false} className="btn-primary mt-7">
                Read the guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <aside className="surface-chrome rounded-2xl border border-b1 p-7 md:p-9">
              <p className="font-syne text-xl font-bold tracking-[-0.015em] text-t1 md:text-2xl">Enterprise topic clusters</p>
              <p className="mt-4 font-dm text-sm leading-[1.7] text-t2">
                The enterprise library is organised around operating problems — not keyword pages. Start with the constraint you actually have.
              </p>
              <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ENTERPRISE_TOPIC_CLUSTERS.slice(0, 8).map((topic) => (
                  <li key={topic} className="font-dm text-xs text-t3">
                    <span className="mr-2 text-acc" aria-hidden="true">
                      /
                    </span>
                    {topic}
                  </li>
                ))}
              </ul>
              <Link href="/insights/enterprise" prefetch={false} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-acc hover:underline">
                View all enterprise articles <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </aside>
          </div>
        </PaperBand>

        <section aria-labelledby="insight-topics" className="px-6 py-20 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <div className="max-w-[720px]">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Topic library</p>
              <h2 id="insight-topics" className="mt-2 font-syne text-[clamp(30px,4vw,46px)] font-extrabold">
                Browse by the decision in front of you.
              </h2>
            </div>
            <nav aria-label="Insight categories" className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {topics.map(([slug, topic]) => (
                <Link
                  key={slug}
                  href={`/insights/${slug}`}
                  prefetch={false}
                  className="group rounded-2xl border border-b1 bg-s1 p-6 transition-colors hover:border-b2"
                >
                  <h3 className="font-syne text-xl font-bold">{topic.label}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-t2">{topic.description}</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-acc">
                    View {topic.label.toLowerCase()} insights{" "}
                    <ArrowRight size={14} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </section>

        <section aria-labelledby="latest-insights" className="px-6 py-20 md:px-12">
          <div className="mx-auto max-w-[1240px]">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Latest</p>
                <h2 id="latest-insights" className="mt-2 font-syne text-[clamp(30px,4vw,46px)] font-extrabold">
                  Recently published guidance.
                </h2>
              </div>
              <span className="text-sm text-t3">{articles.length} published articles</span>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {latest.map((article) => (
                <InsightCard key={article.slug} insight={article} headingLevel="h3" />
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-24 md:px-12">
          <div className="mx-auto grid max-w-[1240px] gap-7 rounded-3xl border border-acc/20 bg-s1 p-8 md:grid-cols-[1fr_auto] md:items-center md:p-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-acc">Apply the guidance</p>
              <h2 className="mt-3 font-syne text-3xl font-extrabold">Need the website or system reviewed in context?</h2>
              <p className="mt-3 max-w-[720px] text-sm leading-relaxed text-t2">
                Explore ScaleSmiths services, review the{" "}
                <Link href="/enterprise" className="underline decoration-acc/50 underline-offset-2 hover:decoration-acc">
                  enterprise systems
                </Link>{" "}
                surface, or start a focused{" "}
                <Link href="/enterprise/contact" className="underline decoration-acc/50 underline-offset-2 hover:decoration-acc">
                  enterprise discovery
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/enterprise/contact" prefetch={false} className="btn-primary justify-center">
                Start enterprise discovery <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/work" prefetch={false} className="btn-ghost justify-center">
                View work
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
